import { config } from "../config.js";
import { cleanText, normalizeEvent } from "../normalization.js";

function getEvents(payload) {
  if (Array.isArray(payload)) return payload;
  for (const value of [payload?.data, payload?.veri, payload?.events]) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
  }
  return [];
}

function mapEvent(event, session) {
  const venue = session?.mekan || event.mekan || {};
  const priceCandidates = (session?.fiyatlar || []).map((item) => Number(item.fiyat)).filter(Number.isFinite);
  const sessionPrice = priceCandidates.length ? Math.min(...priceCandidates) : null;
  const fallbackPrice = event.enDusukFiyat === null || event.enDusukFiyat === undefined
    ? null : Number(event.enDusukFiyat);
  return normalizeEvent({
    source: "biletsa",
    sourceLabel: "Biletsa",
    sourceId: String(event.id || event.slug || event.ad) + (session?.id ? "-" + session.id : ""),
    title: event.ad || event.name,
    description: event.kisaAciklama || event.aciklama,
    category: event.kategori,
    startAt: session?.tarih || event.tarih || event.baslangic,
    endAt: session?.bitis,
    city: venue.sehir || "Ankara",
    district: venue.ilce,
    venue: venue.ad || venue.name,
    address: venue.adres || venue.address,
    price: sessionPrice ?? fallbackPrice,
    isFree: sessionPrice === 0 || fallbackPrice === 0,
    imageUrl: event.gorsel || event.kapak,
    url: session?.url || event.url,
    ticketUrl: session?.url || event.url,
    timezone: "Europe/Istanbul"
  });
}

export async function fetchBiletsa({ from, to, fetchWithTimeout }) {
  if (!config.biletsaApiKey) return [];
  const output = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(config.biletsaBaseUrl + "/etkinlikler");
    url.searchParams.set("sehir", "Ankara");
    url.searchParams.set("baslangic", from);
    url.searchParams.set("bitis", to);
    url.searchParams.set("sayfa", String(page));

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        Authorization: "Bearer " + config.biletsaApiKey,
        Accept: "application/json"
      }
    });
    const payload = await response.json();
    const records = getEvents(payload);

    for (const event of records) {
      const sessions = Array.isArray(event.seanslar) ? event.seanslar : [];
      if (sessions.length) {
        for (const session of sessions) {
          const normalized = mapEvent(event, session);
          if (normalized) output.push(normalized);
        }
      } else {
        const normalized = mapEvent(event, null);
        if (normalized) output.push(normalized);
      }
    }

    const lastPage = Number(payload?.sonSayfa || payload?.lastPage || 0);
    if (!records.length || (lastPage && page >= lastPage) || records.length < 50) break;
  }
  return output.filter((event) => cleanText(event.city).toLocaleLowerCase("tr-TR").includes("ankara"));
}
