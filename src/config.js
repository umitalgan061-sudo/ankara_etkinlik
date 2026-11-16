import "dotenv/config";

function numberFromEnv(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseJsonArray(value, envName) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("Dizi olmalı");
    return parsed.filter((item) => item && typeof item.url === "string");
  } catch (error) {
    throw new Error(envName + " geçerli bir JSON dizisi olmalı: " + error.message);
  }
}

export const config = {
  port: numberFromEnv("PORT", 4000, 1, 65535),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:4000")
    .split(",").map((item) => item.trim()).filter(Boolean),
  cacheTtlSeconds: numberFromEnv("CACHE_TTL_SECONDS", 300, 0, 3600),
  sourceTimeoutMs: numberFromEnv("SOURCE_TIMEOUT_MS", 12000, 1000, 60000),
  clientRateLimitPerMinute: numberFromEnv("CLIENT_RATE_LIMIT_PER_MINUTE", 120, 10, 1000),

  whatsMoodEnabled: process.env.WHATS_MOOD_ENABLED !== "false",

  etkinlikIoToken: process.env.ETKINLIKIO_API_TOKEN || "",
  etkinlikIoBaseUrl: (process.env.ETKINLIKIO_API_BASE_URL || "https://etkinlik.io/api/v2").replace(/\/$/, ""),
  etkinlikIoRssUrl: process.env.ETKINLIKIO_RSS_URL || "",

  biletsaApiKey: process.env.BILETSA_API_KEY || "",
  biletsaBaseUrl: (process.env.BILETSA_API_BASE_URL || "https://biletsa.com/api/v1").replace(/\/$/, ""),

  ticketmasterApiKey: process.env.TICKETMASTER_API_KEY || "",
  extraRssFeeds: parseJsonArray(process.env.EXTRA_RSS_FEEDS || "[]", "EXTRA_RSS_FEEDS")
};
