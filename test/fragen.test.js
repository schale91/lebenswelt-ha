// Rückfragen zu Paperless-Dokumenten (typ "frage"): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const F = require("../lebenswelt/pb_hooks/fragen.js")

const DOK = { id: 42, titel: "Rechnung Stadtwerke", link: "https://paperless.example/documents/42/details" }
const JETZT = Date.parse("2026-10-20T08:00:00Z")

test("neue Frage: voller Text, Status offen, Verweis auf das Dokument", () => {
  const lang = "Gehört diese Rechnung zum Haus oder zur Wohnung? ".repeat(20)
  const d = F.frageDaten(DOK, "  " + lang + "  ", JETZT)
  assert.equal(d.text, lang.trim())
  assert.equal(d.text.length > 200, true)
  assert.equal(d.status, "offen")
  assert.equal(d.paperless_id, 42)
  assert.equal(d.titel, "Rechnung Stadtwerke")
  assert.equal(d.link, DOK.link)
  assert.equal(d.antwort, "")
  assert.equal(d.erstellt, "2026-10-20T08:00:00.000Z")
  assert.equal(d.beantwortet_am, null)
  assert.equal(d.verarbeitet_am, null)
})

test("neue Frage: ohne Text oder zu lang gibt 400", () => {
  assert.throws(() => F.frageDaten(DOK, "   ", JETZT), (e) => e.status === 400)
  assert.throws(() => F.frageDaten(DOK, "x".repeat(F.TEXT_MAX + 1), JETZT), (e) => e.status === 400)
  assert.equal(F.frageDaten({ id: 7 }, "Frage?", JETZT).titel, "Dokument 7")
})

test("Status: beantwortet mit Antwort, dann verarbeitet", () => {
  const offen = F.frageDaten(DOK, "Haus oder Wohnung?", JETZT)
  const b = F.statusAendern(offen, { antwort: " Haus " }, JETZT + 1000)
  assert.equal(b.status, "beantwortet")
  assert.equal(b.antwort, "Haus")
  assert.equal(b.beantwortet_am, "2026-10-20T08:00:01.000Z")
  const v = F.statusAendern(b, { status: "verarbeitet" }, JETZT + 2000)
  assert.equal(v.status, "verarbeitet")
  assert.equal(v.antwort, "Haus")
  assert.equal(v.beantwortet_am, "2026-10-20T08:00:01.000Z")
  assert.equal(v.verarbeitet_am, "2026-10-20T08:00:02.000Z")
  // Die alten Daten bleiben unverändert
  assert.equal(offen.status, "offen")
})

test("Status: ungültige Werte und beantwortet ohne Antwort gibt 400", () => {
  const offen = F.frageDaten(DOK, "Haus oder Wohnung?", JETZT)
  assert.throws(() => F.statusAendern(offen, { status: "fertig" }, JETZT), (e) => e.status === 400)
  assert.throws(() => F.statusAendern(offen, { status: "beantwortet" }, JETZT), (e) => e.status === 400)
  assert.throws(() => F.statusAendern(offen, {}, JETZT), (e) => e.status === 400)
  // Zurück auf offen setzt die Zeitstempel zurück
  const b = F.statusAendern(offen, { antwort: "Haus" }, JETZT)
  const o = F.statusAendern(b, { status: "offen" }, JETZT)
  assert.equal(o.beantwortet_am, null)
})

test("Filter nach Status in der Abfrage", () => {
  assert.equal(F.statusFilter(""), null)
  assert.equal(F.statusFilter(null), null)
  assert.equal(F.statusFilter("beantwortet"), "beantwortet")
  assert.throws(() => F.statusFilter("alle"), (e) => e.status === 400)
})
