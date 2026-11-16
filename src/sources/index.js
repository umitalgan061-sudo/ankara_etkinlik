import { config } from "../config.js";
import { fetchWhatsMood } from "./whatsmood.js";
import { fetchEtkinlikIoApi, fetchEtkinlikIoRss, fetchExtraRssFeeds } from "./etkinlikio.js";
import { fetchBiletsa } from "./biletsa.js";
import { fetchTicketmaster } from "./ticketmaster.js";

export const sourceCatalog = [
  {
    id: "whatsmood",
    name: "WhatsMood",
    kind: "Public JSON",
    configured: config.whatsMoodEnabled,
    authRequired: false,
    docs: "https://www.whatsmood.com/gelistiriciler",
    note: "Anahtarsız JSON uç noktası; IP başına dakikada 60 istek ve kaynak atfı şartı var."
  },
  {
    id: "etkinlikio-rss",
    name: "Etkinlik.io RSS",
    kind: "RSS",
    configured: Boolean(config.etkinlikIoRssUrl),
    authRequired: false,
    docs: "https://etkinlik.io/rss/bilgi",
    note: "Ankara filtresi uygulanarak RSS oluşturucudan alınan özel URL gerekir."
  },
  {
    id: "etkinlikio-api",
    name: "Etkinlik.io REST",
    kind: "REST API",
    configured: Boolean(config.etkinlikIoToken),
    authRequired: true,
    docs: "https://etkinlik.io/api-bilgi",
    note: "Yayıncı ağı onayı ve X-Etkinlik-Token gerekir."
  },
  {
    id: "biletsa",
    name: "Biletsa",
    kind: "REST API",
    configured: Boolean(config.biletsaApiKey),
    authRequired: true,
    docs: "https://biletsa.com/entegrasyon",
    note: "Okuma anahtarı gerekir; yalnız satışta olan gelecek seansları döndürür."
  },
  {
    id: "ticketmaster",
    name: "Ticketmaster Discovery",
    kind: "REST API",
    configured: Boolean(config.ticketmasterApiKey),
    authRequired: true,
    docs: "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/",
    note: "Consumer Key gerekir; Ankara/Türkiye kapsamı canlı sorguyla ayrıca izlenmelidir."
  },
  ...config.extraRssFeeds.map((feed, index) => ({
    id: feed.id || "extra-rss-" + (index + 1),
    name: feed.name || feed.id || "Ek RSS kaynağı",
    kind: "RSS",
    configured: true,
    authRequired: false,
    docs: feed.url,
    note: "Kullanıcı tarafından tanımlanmış RSS kaynağı."
  }))
];

export const unconnectedSources = [
  { id: "abb-kultursanat", name: "ABB Kültür Sanat", kind: "Web takvimi", configured: false, docs: "https://kultursanat.ankara.bel.tr/event", note: "Kamuya açık, dokümante edilmiş JSON API doğrulanmadı; resmî servis bilgisi/izin gerekiyor." },
  { id: "abb-genclik-spor", name: "ABB Gençlik ve Spor", kind: "Web takvimi", configured: false, docs: "https://genclikvespor.ankara.bel.tr/etkinlikler?track=spor", note: "Açık API doğrulanmadı." },
  { id: "cankaya", name: "Çankaya Belediyesi", kind: "Web/PDF", configured: false, docs: "https://www.cankaya.bel.tr/kultur-sanat", note: "Programlar PDF/web biçiminde; otomatik servis doğrulanmadı." },
  { id: "etimesgut", name: "Etimesgut Belediyesi", kind: "Web takvimi", configured: false, docs: "https://www.etimesgut.bel.tr/etkinlikler", note: "Açık API doğrulanmadı." },
  { id: "biletix", name: "Biletix", kind: "Bilet platformu", configured: false, docs: "https://www.biletix.com/anasayfa/ANKARA/tr", note: "Kamuya açık genel etkinlik API'si doğrulanmadı." },
  { id: "bubilet", name: "Bubilet", kind: "Bilet platformu", configured: false, docs: "https://www.bubilet.com.tr/ankara", note: "Açık geliştirici API'si doğrulanmadı." },
  { id: "biletinial", name: "Biletinial", kind: "Bilet platformu", configured: false, docs: "https://biletinial.com/tr-tr/search?q=ankara", note: "Açık geliştirici API'si doğrulanmadı." },
  { id: "cso-ada", name: "CSO Ada Ankara", kind: "Kültür kurumu", configured: false, docs: "https://csoadaankara.gov.tr/tr/Event", note: "Web takvimi mevcut; açık API doğrulanmadı." },
  { id: "cermodern", name: "CerModern", kind: "Kültür kurumu", configured: false, docs: "https://cermodern.org/events", note: "Web takvimi mevcut; açık API doğrulanmadı." },
  { id: "erimtan", name: "Erimtan Müzesi", kind: "Müze", configured: false, docs: "https://erimtanmuseum.org/", note: "Web/bilet takvimi; açık API doğrulanmadı." },
  { id: "tobb-fuar", name: "TOBB Fuar Takvimi", kind: "Tablo/Excel", configured: false, docs: "https://fuarlar.tobb.org.tr/FuarTakvimi/2026", note: "Fuarlar için resmî kaynak; belgelenmiş JSON API doğrulanmadı." },
  { id: "meetup", name: "Meetup Ankara", kind: "Topluluk etkinlikleri", configured: false, docs: "https://www.meetup.com/find/tr--ankara/", note: "API erişimi ve kullanım koşulları ayrıca değerlendirilmelidir." },
  { id: "institut-francais", name: "Institut français Ankara", kind: "Kültür kurumu", configured: false, docs: "https://www.ifturquie.org/ankara/", note: "Web takvimi mevcut; açık API doğrulanmadı." },
  { id: "odtu-mezunlari", name: "ODTÜ Mezunları Derneği", kind: "Topluluk", configured: false, docs: "https://odtumd.org.tr/etkinlik-takvimi/", note: "Takvim sayfası mevcut; açık API doğrulanmadı." },
  { id: "ankara-kent-konseyi", name: "Ankara Kent Konseyi", kind: "Kurumsal program", configured: false, docs: "https://ankarakentkonseyi.org.tr/", note: "Duyuru/haftalık program; otomatik API doğrulanmadı." }
];

export const activeAdapters = [
  { id: "whatsmood", configured: config.whatsMoodEnabled, fetch: fetchWhatsMood },
  { id: "etkinlikio-rss", configured: Boolean(config.etkinlikIoRssUrl), fetch: fetchEtkinlikIoRss },
  { id: "etkinlikio-api", configured: Boolean(config.etkinlikIoToken), fetch: fetchEtkinlikIoApi },
  { id: "biletsa", configured: Boolean(config.biletsaApiKey), fetch: fetchBiletsa },
  { id: "ticketmaster", configured: Boolean(config.ticketmasterApiKey), fetch: fetchTicketmaster },
  { id: "extra-rss", configured: config.extraRssFeeds.length > 0, fetch: fetchExtraRssFeeds }
];
