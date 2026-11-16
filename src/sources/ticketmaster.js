import { config } from "../config.js";
import { normalizeEvent } from "../normalization.js";

export async function fetchTicketmaster({ from, to, fetchWithTimeout }) {
  if (!config.ticketmasterApiKey) return [];
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("city", "Ankara");
  url.searchParams.set("countryCode", "TR");
  const startUtc = new Date(from + "T00:00:00+03:00").toISOString();
  const endUtc = new Date(to + "T23:59:59+03:00").toISOString();
  url.searchParams.set("startDateTime", startUtc);
  url.searchParams.set("endDateTime", endUtc);
  url.searchParams.set("size", "100");
  url.searchParams.set("page", "0");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("apikey", config.ticketmasterApiKey);

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Accept: "application/json" }
  });
  const payload = await response.json();
  const events = payload?._embedded?.events || [];

  return events.map((item) => {
    const venue = item._embedded?.venues?.[0] || {};
    const classification = item.classifications?.[0] || {};
    const price = item.priceRanges?.[0]?.min;
    const start = item.dates?.start?.dateTime ||
      (item.dates?.start?.localDate
        ? item.dates.start.localDate + "T" + (item.dates.start.localTime || "00:00:00") + "+03:00"
        : null);
    return normalizeEvent({
      source: "ticketmaster",
      sourceLabel: "Ticketmaster",
      sourceId: item.id,
      title: item.name,
      description: item.info || item.pleaseNote,
      category: classification.subGenre?.name || classification.genre?.name || classification.segment?.name,
      startAt: start,
      endAt: item.dates?.end?.dateTime,
      timezone: venue.timezone || "Europe/Istanbul",
      city: venue.city?.name || "Ankara",
      district: venue.state?.name,
      venue: venue.name,
      address: venue.address?.line1,
      latitude: venue.location?.latitude,
      longitude: venue.location?.longitude,
      price,
      isFree: Number(price) === 0,
      imageUrl: (item.images || []).find((image) => image.ratio === "16_9")?.url || item.images?.[0]?.url,
      url: item.url,
      ticketUrl: item.url
    });
  }).filter(Boolean);
}
