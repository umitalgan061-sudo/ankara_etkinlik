import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvent, deduplicateEvents } from "../src/normalization.js";

test("etkinlik ortak modele dönüştürülür", () => {
  const event = normalizeEvent({
    source: "test",
    sourceId: "123",
    title: "Ankara Caz Konseri",
    startAt: "2026-11-20T20:00:00+03:00",
    venue: "CSO Ada Ankara",
    city: "Ankara",
    category: "konser"
  });
  assert.equal(event.title, "Ankara Caz Konseri");
  assert.equal(event.city, "Ankara");
  assert.equal(event.category, "Müzik");
  assert.equal(event.timezone, "Europe/Istanbul");
  assert.equal(event.isFree, false);
});

test("başlık veya geçerli başlangıç tarihi olmayan kayıt atlanır", () => {
  assert.equal(normalizeEvent({ title: "Tarihsiz etkinlik" }), null);
  assert.equal(normalizeEvent({ startAt: "2026-11-20T20:00:00+03:00" }), null);
});

test("aynı etkinliğin farklı kaynak kayıtları birleştirilir", () => {
  const first = normalizeEvent({
    source: "biletix", sourceId: "a", title: "Caz Gecesi",
    startAt: "2026-11-20T20:00:00+03:00", venue: "CSO Ada", city: "Ankara", url: "https://example.com/a"
  });
  const second = normalizeEvent({
    source: "whatsmood", sourceId: "b", title: "Caz Gecesi",
    startAt: "2026-11-20T20:00:00+03:00", venue: "CSO Ada", city: "Ankara", url: "https://example.com/b"
  });
  const result = deduplicateEvents([first, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].sources.length, 2);
  assert.equal(result[0].sourceLinks.length, 2);
});

test("farklı başlangıç saatleri olan aynı başlıklı seanslar ayrı kalır", () => {
  const first = normalizeEvent({
    source: "test", title: "Aynı oyun", startAt: "2026-11-20T15:00:00+03:00", venue: "Sahne", city: "Ankara"
  });
  const second = normalizeEvent({
    source: "test", title: "Aynı oyun", startAt: "2026-11-20T20:00:00+03:00", venue: "Sahne", city: "Ankara"
  });
  assert.equal(deduplicateEvents([first, second]).length, 2);
});
