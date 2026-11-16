import { config } from "../config.js";
import { cleanText, normalizeEvent } from "../normalization.js";

function getArray(payload) {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload?.events, payload?.items, payload?.results, payload?.data, payload?.veri]) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.items)) return candidate.items;
    if (Array.isArray(candidate?.events)) return candidate.events;
  }
  return [];
}

export async function fetchWhatsMood({ from, to, fetchWithTimeout }) {
  if (!config.whatsMoodEnabled) return [];
  const url = new URL("https://www.whatsmood.com/api/ai/events");
  url.searchParams.set("city", "Ankara");
  url.searchParams.set("date", from + ".." + to);
  url.searchParams.set("limit", "20");

  const payload = await fetchWithTimeout(url.toString(), {
    headers: { Accept: "application/json" }
  }).then((response) => response.json());

  const events = getArray(payload);
  return events.map((item) => {
    const venue = item.venue || item.place || item.location || {};
    const start = item.startAt || item.start_at || item.startDate || item.dateTime ||
      item.localDateTime || item.date || item.start || item.datetime;
    const venueName = typeof venue === "string" ? venue : venue.name || venue.title;
    const event = normalizeEvent({
      source: "whatsmood",
      sourceLabel: "WhatsMood",
      sourceId: item.id || item.eventId || item.event_id,
      title: item.title || item.name || item.eventName,
      description: item.description || item.summary,
      category: item.category || item.type,
      startAt: start,
      endAt: item.endAt || item.end_at || item.endDate,
      timezone: item.timezone || "Europe/Istanbul",
      city: item.city || venue.city || "Ankara",
      district: item.district || venue.district || venue.ilce,
      venue: venueName || item.venueName || item.placeName,
      address: item.address || venue.address,
      latitude: item.latitude || item.lat || venue.latitude || venue.lat,
      longitude: item.longitude || item.lng || venue.longitude || venue.lng,
      price: item.minPrice ?? item.lowestPrice ?? item.price,
      isFree: item.isFree || item.is_free,
      imageUrl: item.imageUrl || item.image || item.posterUrl,
      url: item.url || item.eventUrl || item.pageUrl || item.link,
      ticketUrl: item.ticketUrl || item.ticket_url,
      attribution: "Powered by WhatsMood"
    });
    if (event && !cleanText(event.city)) event.city = "Ankara";
    return event;
  }).filter(Boolean);
}
