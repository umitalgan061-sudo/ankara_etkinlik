const state = { page: 1, limit: 30, total: 0, query: {} };
const $ = (id) => document.getElementById(id);

function localDateInput(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  return parts;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(value) {
  if (!value) return "Tarih belirtilmemiş";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit", month: "long", year: "numeric",
    weekday: "long", hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

function safeText(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function makeSourceStrip(sources = []) {
  const root = $("source-strip");
  root.replaceChildren();
  if (!sources.length) return;
  for (const source of sources) {
    const pill = document.createElement("span");
    pill.className = "source-pill " + (source.status === "ok" ? "ok" : source.status === "error" ? "error" : "");
    const count = source.status === "ok" ? " · " + source.count : source.error ? " · hata" : "";
    pill.textContent = source.id + count;
    pill.title = source.error || source.status;
    root.append(pill);
  }
}

function buildCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "event-image-wrap";
  if (event.imageUrl) {
    const image = document.createElement("img");
    image.className = "event-image";
    image.src = event.imageUrl;
    image.alt = event.title;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.onerror = () => image.remove();
    imageWrap.append(image);
  }

  const date = new Date(event.startAt);
  const day = document.createElement("div");
  day.className = "date-chip";
  const dayNumber = document.createElement("strong");
  dayNumber.textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit" }).format(date);
  const month = document.createElement("span");
  month.textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", month: "short" }).format(date);
  day.append(dayNumber, month);
  imageWrap.append(day);

  const body = document.createElement("div");
  body.className = "event-content";
  const category = document.createElement("div");
  category.className = "event-category";
  category.textContent = safeText(event.category, "Etkinlik");
  const title = document.createElement("h3");
  title.className = "event-title";
  title.textContent = event.title;
  const when = document.createElement("p");
  when.className = "event-detail";
  when.textContent = "◷ " + formatDate(event.startAt);
  const place = document.createElement("p");
  place.className = "event-detail";
  place.textContent = "⌖ " + [event.venue, event.district, event.city].filter(Boolean).join(" · ");
  const price = document.createElement("span");
  price.className = "event-price";
  price.textContent = event.isFree ? "Ücretsiz" : event.price !== null ? event.price.toLocaleString("tr-TR") + " TL'den" : "Fiyat bilgisi yok";
  const bottom = document.createElement("div");
  bottom.className = "event-bottom";
  const link = document.createElement("a");
  link.className = "event-link";
  link.href = event.url || (event.sourceLinks?.[0]?.url || "#");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Etkinliği incele";
  bottom.append(price, link);
  const source = document.createElement("div");
  source.className = "event-sources";
  source.textContent = "Kaynak: " + (event.sources || [event.sourceLabel]).join(", ") + (event.attribution === "Powered by WhatsMood" ? " · Powered by WhatsMood" : "");
  body.append(category, title, when, place);
  if (event.description) {
    const description = document.createElement("p");
    description.className = "event-detail";
    description.textContent = event.description.slice(0, 180);
    body.append(description);
  }
  body.append(bottom, source);
  card.append(imageWrap, body);
  return card;
}

function renderEvents(data) {
  const root = $("events");
  root.replaceChildren();
  makeSourceStrip(data.sources || []);
  $("result-title").textContent = data.total + " etkinlik";
  $("result-meta").textContent = data.from + " – " + data.to + " · Son veri kontrolü: " + formatDate(data.fetchedAt);

  if (!data.events?.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Bu filtrelerle etkinlik bulunamadı. Kaynak ayarlarını /api/sources adresinden kontrol edebilir veya tarih aralığını genişletebilirsin.";
    root.append(empty);
  } else {
    for (const event of data.events) root.append(buildCard(event));
  }
  $("load-more").classList.toggle("hidden", data.page >= data.pages);
}

async function loadSources() {
  try {
    const response = await fetch("/api/sources");
    const data = await response.json();
    const root = $("source-strip");
    root.replaceChildren();
    for (const source of data.sources.filter((item) => item.configured)) {
      const pill = document.createElement("span");
      pill.className = "source-pill ok";
      pill.textContent = source.name;
      root.append(pill);
    }
  } catch {}
}

async function loadEvents(append = false, refresh = false) {
  $("message").textContent = "Kaynaklardan etkinlikler alınıyor…";
  const params = new URLSearchParams({
    from: state.query.from,
    to: state.query.to,
    page: String(state.page),
    limit: String(state.limit)
  });
  if (state.query.q) params.set("q", state.query.q);
  if (state.query.category) params.set("category", state.query.category);
  if (refresh) params.set("refresh", "true");

  try {
    const response = await fetch("/api/events?" + params.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Etkinlikler yüklenemedi.");
    state.total = data.total;
    renderEvents(data);
    if (append) {
      const root = $("events");
      for (const event of data.events || []) root.append(buildCard(event));
    }
    $("message").textContent = data.sources?.some((item) => item.status === "error")
      ? "Bazı kaynaklara şu an ulaşılamadı. Diğer kaynaklardan gelen sonuçlar gösteriliyor."
      : data.events?.length ? "" : "Henüz sonuç yok. API anahtarı gereken kaynaklar için .env ayarlarını tamamlayabilirsin.";
  } catch (error) {
    $("message").textContent = error.message;
  }
}

function applyFilters(event) {
  if (event) event.preventDefault();
  state.page = 1;
  state.query = {
    from: $("from").value,
    to: $("to").value,
    q: $("q").value.trim(),
    category: $("category").value
  };
  loadEvents(false, true);
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  $("from").value = localDateInput(today);
  $("to").value = localDateInput(addDays(today, 120));
  state.query = { from: $("from").value, to: $("to").value, q: "", category: "" };

  $("filters").addEventListener("submit", applyFilters);
  $("refresh").addEventListener("click", () => loadEvents(false, true));
  $("load-more").addEventListener("click", () => {
    state.page += 1;
    loadEvents(true, false);
  });
  loadSources();
  loadEvents();
});
