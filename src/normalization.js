import { createHash } from "node:crypto";

export function cleanText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") return cleanText(value.name || value.ad || value.title || value.value || "");
  return "";
}

export function stripHtml(value) {
  return cleanText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function extractFirst(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

export function normalizeCategory(value) {
  const raw = cleanText(value).toLocaleLowerCase("tr-TR");
  const aliases = [
    [/konser|müzik|music|concert|opera|bale/, "Müzik"],
    [/tiyatro|theatre|theater|sahne|oyun/, "Tiyatro"],
    [/stand.?up|komedi|comedy/, "Stand-up / Komedi"],
    [/sergi|exhibition|sanat|art|müze/, "Sergi / Sanat"],
    [/spor|sport|futbol|basketbol|voleybol|tenis/, "Spor"],
    [/çocuk|cocuk|kids|family|aile/, "Çocuk ve Aile"],
    [/festival/, "Festival"],
    [/atölye|atolye|workshop|seminer|eğitim|egitim/, "Atölye / Eğitim"],
    [/fuar|kongre|konferans|zirve/, "Fuar / Kongre"]
  ];
  for (const [pattern, label] of aliases) if (pattern.test(raw)) return label;
  return cleanText(value) || "Diğer";
}

function slugForFingerprint(value) {
  return cleanText(value).toLocaleLowerCase("tr-TR")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeEvent(input) {
  const title = extractFirst(input.title, input.name, input.ad, input.eventName);
  const startAt = parseDate(input.startAt || input.start || input.startDate || input.date || input.dateTime);
  if (!title || !startAt) return null;

  const source = cleanText(input.source || "unknown");
  const sourceId = cleanText(input.sourceId || input.id);
  const venue = extractFirst(input.venue, input.venueName, input.mekan, input.placeName);
  const city = extractFirst(input.city, input.cityName) || "Ankara";
  const district = extractFirst(input.district, input.districtName, input.ilce);
  const address = extractFirst(input.address, input.fullAddress);
  const latitude = Number(input.latitude ?? input.lat);
  const longitude = Number(input.longitude ?? input.lng ?? input.lon);
  const priceValue = input.price ?? input.minPrice ?? input.lowestPrice;
  const price = priceValue === "" || priceValue === null || priceValue === undefined
    ? null : Number(priceValue);
  const url = extractFirst(input.url, input.eventUrl, input.pageUrl, input.ticketUrl, input.link);
  const startMinute = startAt.slice(0, 16);
  const fingerprintText = [
    slugForFingerprint(title),
    startMinute,
    slugForFingerprint(venue || district || city)
  ].join("|");
  const fingerprint = createHash("sha1").update(fingerprintText).digest("hex").slice(0, 20);

  return {
    id: sourceId ? source + ":" + sourceId : "event:" + fingerprint,
    fingerprint,
    source,
    sourceLabel: cleanText(input.sourceLabel || source),
    sourceId: sourceId || null,
    title,
    description: stripHtml(input.description || input.summary || input.content || ""),
    category: normalizeCategory(input.category || input.type || input.format),
    startAt,
    endAt: parseDate(input.endAt || input.end || input.endDate),
    timezone: cleanText(input.timezone) || "Europe/Istanbul",
    city,
    district,
    venue,
    address,
    latitude: Number.isFinite(latitude) && latitude !== 0 ? latitude : null,
    longitude: Number.isFinite(longitude) && longitude !== 0 ? longitude : null,
    price: Number.isFinite(price) ? price : null,
    currency: cleanText(input.currency) || "TRY",
    isFree: input.isFree === true || input.is_free === true || input.free === true || (Number.isFinite(price) && price === 0),
    imageUrl: extractFirst(input.imageUrl, input.image, input.posterUrl, input.poster, input.cover),
    url,
    attribution: cleanText(input.attribution) || cleanText(input.sourceLabel || source),
    ticketUrl: extractFirst(input.ticketUrl, input.bookingUrl, input.url),
    lastSeenAt: new Date().toISOString()
  };
}

export function deduplicateEvents(events) {
  const map = new Map();
  for (const event of events) {
    if (!event) continue;
    const existing = map.get(event.fingerprint);
    if (!existing) {
      map.set(event.fingerprint, {
        ...event,
        sources: [event.source],
        sourceLinks: event.url ? [{ source: event.source, url: event.url }] : []
      });
      continue;
    }
    if (!existing.sources.includes(event.source)) existing.sources.push(event.source);
    if (event.url && !existing.sourceLinks.some((item) => item.source === event.source && item.url === event.url)) {
      existing.sourceLinks.push({ source: event.source, url: event.url });
    }
    if (!existing.imageUrl && event.imageUrl) existing.imageUrl = event.imageUrl;
    if (!existing.description && event.description) existing.description = event.description;
    if (!existing.address && event.address) existing.address = event.address;
    if (!existing.latitude && event.latitude) existing.latitude = event.latitude;
    if (!existing.longitude && event.longitude) existing.longitude = event.longitude;
    if (existing.price === null && event.price !== null) existing.price = event.price;
    if (!existing.ticketUrl && event.ticketUrl) existing.ticketUrl = event.ticketUrl;
  }
  return [...map.values()].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}
