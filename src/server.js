import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { deduplicateEvents } from "./normalization.js";
import { activeAdapters, sourceCatalog, unconnectedSources } from "./sources/index.js";

const app = express();
const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const cache = new Map();
const requestCounters = new Map();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https:", "data:"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Bu origin için CORS izni yok."));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDirectory));

function todayInIstanbul() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function plusDays(dateText, amount) {
  const date = new Date(dateText + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isValidDateText(value) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function localDateOf(value) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.sourceTimeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "AnkaraEtkinlik/1.0 (+event aggregation; contact the project owner)",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const message = "Kaynak HTTP " + response.status + " döndürdü: " + new URL(url).hostname;
      throw new Error(message);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function takeRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const item = requestCounters.get(key) || { count: 0, startedAt: now };
  if (now - item.startedAt >= windowMs) {
    item.count = 0;
    item.startedAt = now;
  }
  item.count += 1;
  requestCounters.set(key, item);
  if (item.count > config.clientRateLimitPerMinute) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "İstek sınırı aşıldı. Bir dakika sonra tekrar deneyin." });
    return;
  }
  next();
}

app.use("/api", takeRateLimit);

async function collectEvents(from, to, force = false) {
  const key = from + "|" + to;
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.createdAt < config.cacheTtlSeconds * 1000) {
    return { ...cached.value, cached: true };
  }

  const configuredAdapters = activeAdapters.filter((adapter) => adapter.configured);
  const results = await Promise.all(configuredAdapters.map(async (adapter) => {
    try {
      const events = await adapter.fetch({ from, to, fetchWithTimeout });
      return { id: adapter.id, status: "ok", count: events.length, events, error: null };
    } catch (error) {
      return {
        id: adapter.id,
        status: "error",
        count: 0,
        events: [],
        error: error?.name === "AbortError" ? "Kaynak zaman aşımına uğradı." : (error?.message || "Bilinmeyen kaynak hatası")
      };
    }
  }));

  const allEvents = deduplicateEvents(results.flatMap((result) => result.events));
  const value = {
    events: allEvents,
    sources: results.map(({ id, status, count, error }) => ({ id, status, count, error })),
    fetchedAt: new Date().toISOString()
  };

  if (config.cacheTtlSeconds > 0) {
    cache.set(key, { createdAt: Date.now(), value });
  }
  return { ...value, cached: false };
}

function matchesQuery(event, query) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("tr-TR");
  return [event.title, event.description, event.venue, event.district, event.address, event.category]
    .join(" ").toLocaleLowerCase("tr-TR").includes(needle);
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Ankara Etkinlik Toplayıcı",
    city: "Ankara",
    time: new Date().toISOString(),
    configuredSources: activeAdapters.filter((item) => item.configured).map((item) => item.id)
  });
});

app.get("/api/sources", (_req, res) => {
  const items = [
    ...sourceCatalog.map((item) => ({
      ...item,
      status: item.configured ? "configured" : "waiting-for-configuration"
    })),
    ...unconnectedSources.map((item) => ({ ...item, status: "not-connected" }))
  ];
  res.json({
    city: "Ankara",
    configuredCount: items.filter((item) => item.status === "configured").length,
    total: items.length,
    sources: items
  });
});

app.get("/api/events", async (req, res) => {
  const today = todayInIstanbul();
  const from = String(req.query.from || today);
  const to = String(req.query.to || plusDays(today, 120));
  if (!isValidDateText(from) || !isValidDateText(to) || from > to) {
    res.status(400).json({ error: "from/to YYYY-MM-DD biçiminde olmalı ve from, to tarihinden büyük olmamalı." });
    return;
  }
  const span = Math.ceil((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
  if (span > 370) {
    res.status(400).json({ error: "Tek sorguda en fazla 370 günlük aralık istenebilir." });
    return;
  }

  try {
    const collected = await collectEvents(from, to, req.query.refresh === "true");
    const query = String(req.query.q || "").trim();
    const district = String(req.query.district || "").trim().toLocaleLowerCase("tr-TR");
    const category = String(req.query.category || "").trim().toLocaleLowerCase("tr-TR");
    const source = String(req.query.source || "").trim();
    const filtered = collected.events.filter((event) => {
      const eventDate = localDateOf(event.startAt);
      if (eventDate < from || eventDate > to) return false;
      if (!matchesQuery(event, query)) return false;
      if (district && !String(event.district || "").toLocaleLowerCase("tr-TR").includes(district)) return false;
      if (category && !String(event.category || "").toLocaleLowerCase("tr-TR").includes(category)) return false;
      if (source && !(event.sources || [event.source]).includes(source)) return false;
      return true;
    });

    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit || "100", 10) || 100));
    const start = (page - 1) * limit;
    res.json({
      city: "Ankara",
      from,
      to,
      total: filtered.length,
      page,
      limit,
      pages: Math.ceil(filtered.length / limit),
      fetchedAt: collected.fetchedAt,
      cached: collected.cached,
      sources: collected.sources,
      events: filtered.slice(start, start + limit)
    });
  } catch (error) {
    res.status(500).json({ error: "Etkinlikler birleştirilirken beklenmeyen bir hata oluştu.", detail: error.message });
  }
});

app.get("/api/events/:fingerprint", async (req, res) => {
  const today = todayInIstanbul();
  const collected = await collectEvents(today, plusDays(today, 370), false);
  const event = collected.events.find((item) => item.fingerprint === req.params.fingerprint || item.id === req.params.fingerprint);
  if (!event) {
    res.status(404).json({ error: "Etkinlik bulunamadı. Liste endpoint'indeki fingerprint değerini kullanın." });
    return;
  }
  res.json({ event });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "index.html"));
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "Sunucu hatası." });
});

app.listen(config.port, () => {
  console.log("Ankara Etkinlik Toplayıcı http://localhost:" + config.port);
});
