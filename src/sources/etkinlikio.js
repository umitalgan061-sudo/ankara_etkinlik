import { XMLParser } from "fast-xml-parser";
import { config } from "../config.js";
import { cleanText, normalizeEvent, stripHtml } from "../normalization.js";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
  processEntities: true
});

function listFrom(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["items", "data", "events", "veri"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.[key]?.items)) return payload[key].items;
  }
  return [];
}

function normalizeApiItem(item) {
  const venue = item.venueData || item.venue || {};
  const district = venue.district || {};
  const city = venue.city || {};
  return normalizeEvent({
    source: "etkinlikio",
    sourceLabel: "Etkinlik.io",
    sourceId: item.id,
    title: item.name || item.title,
    description: stripHtml(item.content || item.description || ""),
    category: item.category?.name || item.category || item.format?.name || item.format,
    startAt: item.startR001 || item.start_r001 || item.start,
    endAt: item.endR001 || item.end_r001 || item.end,
    timezone: item.timezone || "Europe/Istanbul",
    city: city.name || venue.cityName || "Ankara",
    district: district.name || venue.districtName,
    venue: venue.name || item.venueName,
    address: venue.address,
    latitude: venue.lat || venue.latitude,
    longitude: venue.lng || venue.longitude,
    price: item.minPrice ?? item.price,
    isFree: item.isFree,
    imageUrl: item.posterUrl || item.imageUrl,
    url: item.url || item.webUrl,
    ticketUrl: item.ticketUrl || item.url
  });
}

async function getAnkaraCityId(fetchWithTimeout) {
  const response = await fetchWithTimeout(config.etkinlikIoBaseUrl + "/cities", {
    headers: { "X-Etkinlik-Token": config.etkinlikIoToken, Accept: "application/json" }
  });
  const payload = await response.json();
  const cities = listFrom(payload);
  const ankara = cities.find((city) =>
    cleanText(city.name).toLocaleLowerCase("tr-TR") === "ankara"
  );
  if (!ankara?.id) throw new Error("Etkinlik.io şehir listesinden Ankara ID'si bulunamadı.");
  return ankara.id;
}

export async function fetchEtkinlikIoApi({ from, to, fetchWithTimeout }) {
  if (!config.etkinlikIoToken) return [];
  const cityId = await getAnkaraCityId(fetchWithTimeout);
  const events = [];
  const pageSize = 50;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(config.etkinlikIoBaseUrl + "/events");
    url.searchParams.set("cityIds", String(cityId));
    url.searchParams.set("startGte", from + " 00:00:00");
    url.searchParams.set("endLte", to + " 23:59:59");
    url.searchParams.set("sortBy", "upcoming");
    url.searchParams.set("skip", String(page * pageSize));
    url.searchParams.set("take", String(pageSize));

    const response = await fetchWithTimeout(url.toString(), {
      headers: { "X-Etkinlik-Token": config.etkinlikIoToken, Accept: "application/json" }
    });
    const payload = await response.json();
    const items = listFrom(payload);
    events.push(...items.map(normalizeApiItem).filter(Boolean));
    if (items.length < pageSize) break;
  }
  return events;
}

function rssItems(parsed) {
  const channel = parsed?.rss?.channel || parsed?.feed || {};
  const items = channel.item || parsed?.feed?.entry || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function firstText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") return cleanText(value["#text"] || value.href || value["@_href"] || value["@_url"]);
  return "";
}

function dateFromDescription(text) {
  const iso = text.match(/20\d{2}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:[+\-]\d{2}:?\d{2}|Z)?)?/);
  if (iso) return iso[0].replace(" ", "T");
  const tr = text.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})(?:\s*(?:saat|,)?\s*(\d{1,2}):(\d{2}))?/i);
  if (!tr) return null;
  const day = tr[1].padStart(2, "0");
  const month = tr[2].padStart(2, "0");
  const time = tr[4] ? "T" + tr[4].padStart(2, "0") + ":" + tr[5] + ":00+03:00" : "T00:00:00+03:00";
  return tr[3] + "-" + month + "-" + day + time;
}

async function fetchRss(urlValue, sourceId, sourceLabel, city, fetchWithTimeout) {
  const response = await fetchWithTimeout(urlValue, {
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }
  });
  const xml = await response.text();
  const parsed = xmlParser.parse(xml);
  return rssItems(parsed).map((item) => {
    const description = stripHtml(firstText(item.description || item.summary || item["content:encoded"]));
    const explicitDate = firstText(item.startDate || item.start || item.eventDate || item.date || item["dc:date"]);
    const startAt = explicitDate || dateFromDescription(description);
    const enclosure = item.enclosure || item["media:content"] || {};
    const imageUrl = firstText(enclosure["@_url"] || enclosure["@_href"] || item.image);
    return normalizeEvent({
      source: sourceId,
      sourceLabel,
      sourceId: firstText(item.guid || item.id) || firstText(item.link),
      title: firstText(item.title),
      description,
      category: firstText(item.category),
      startAt,
      city: firstText(item.city || item.location?.city) || city,
      district: firstText(item.district || item.location?.district),
      venue: firstText(item.venue || item.location?.name),
      address: firstText(item.address || item.location?.address),
      imageUrl,
      url: firstText(item.link || item.id),
      attribution: sourceLabel
    });
  }).filter(Boolean);
}

export async function fetchEtkinlikIoRss({ fetchWithTimeout }) {
  if (!config.etkinlikIoRssUrl) return [];
  return fetchRss(config.etkinlikIoRssUrl, "etkinlikio-rss", "Etkinlik.io RSS", "Ankara", fetchWithTimeout);
}

export async function fetchExtraRssFeeds({ fetchWithTimeout }) {
  const results = await Promise.all(config.extraRssFeeds.map(async (feed, index) => {
    if (!feed.url) return [];
    const id = cleanText(feed.id) || "extra-rss-" + (index + 1);
    const label = cleanText(feed.name) || id;
    return fetchRss(feed.url, id, label, cleanText(feed.city) || "Ankara", fetchWithTimeout);
  }));
  return results.flat();
}
