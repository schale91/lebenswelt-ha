// TrainMe in der Lebenswelt: Prüfen und Zusammenführen der Daten, Gesundheitswerte, Kopplung je App:
// node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const T = require("../lebenswelt/pb_hooks/trainme.js")
const G = require("../lebenswelt/pb_hooks/geraete.js")

const satz = { last: 100, wdh: 5, rir: 2 }

test("Stamm: nur Objekt mit Zeit wird angenommen", () => {
  assert.equal(T.stammGueltig(null), null)
  assert.equal(T.stammGueltig({ zeit: 1, daten: [] }), null)
  assert.equal(T.stammGueltig({ zeit: 0, daten: {} }), null)
  assert.deepEqual(T.stammGueltig({ zeit: 5, daten: { profil: null } }), { zeit: 5, daten: { profil: null } })
})

test("Stamm: der neuere gewinnt, der gespeicherte bleibt nur, wenn er neuer ist", () => {
  assert.equal(T.stammEntscheiden(null, { zeit: 1 }).behalten, false)
  assert.equal(T.stammEntscheiden({ zeit: 2 }, { zeit: 1 }).behalten, true)
  assert.equal(T.stammEntscheiden({ zeit: 2 }, { zeit: 2 }).behalten, false)
})

test("Tag: Datum im Format JJJJ-MM-TT, kaputte Einträge fallen heraus", () => {
  assert.equal(T.tagGueltig({ tag: "26.10.2026", zeit: 1 }), null)
  const t = T.tagGueltig({ tag: "2026-10-26", zeit: 3, protokoll: [{ uebung: "x", saetze: [satz] }, { saetze: [] }, null], erledigt: [{ titel: "Push" }, {}] })
  assert.equal(t.protokoll.length, 1)
  assert.equal(t.erledigt.length, 1)
})

test("Tag: zwei Geräte am selben Tag verlieren nichts, bei gleicher Übung gilt der neuere Stand", () => {
  const alt = { tag: "2026-10-26", zeit: 10, protokoll: [{ uebung: "kniebeuge", datum: "2026-10-26", saetze: [satz] }], erledigt: [{ titel: "Beine", datum: "2026-10-26" }] }
  const neu = {
    tag: "2026-10-26",
    zeit: 20,
    protokoll: [
      { uebung: "kniebeuge", datum: "2026-10-26", saetze: [satz, satz] },
      { uebung: "wade", datum: "2026-10-26", saetze: [satz] },
    ],
    erledigt: [],
  }
  const z = T.tagZusammen(alt, neu)
  assert.equal(z.zeit, 20)
  assert.equal(z.protokoll.length, 2)
  assert.equal(z.protokoll.find((p) => p.uebung === "kniebeuge").saetze.length, 2)
  assert.equal(z.erledigt.length, 1)
  // Älterer Upload überschreibt den neueren Satzstand nicht
  const zurueck = T.tagZusammen(z, { ...alt, zeit: 5 })
  assert.equal(zurueck.protokoll.find((p) => p.uebung === "kniebeuge").saetze.length, 2)
  assert.equal(T.tagZusammen(null, neu), neu)
})

test("Gesundheit: nur Werte über null, HRV aus der letzten Nacht, Stand der Synchronisierung", () => {
  const g = T.gesundheitAus(
    { schritte: 4200, schlaf_min: 0, ruhepuls: 52, hrv_nacht: 61.4, synchronisiert: "2026-10-26T06:10:00+00:00" },
    "2026-10-26",
    { "2026-10-25": { schritte: 9000, schlaf_min: 420, ruhepuls: "unbekannt" }, falsch: { schritte: 1 } },
  )
  assert.deepEqual(g.tage["2026-10-26"], { schritte: 4200, ruhepuls: 52, hrv: 61 })
  assert.deepEqual(g.tage["2026-10-25"], { schritte: 9000, schlaf_min: 420 })
  assert.equal(g.tage.falsch, undefined)
  assert.equal(g.stand, "2026-10-26T06:10:00+00:00")
  assert.deepEqual(T.gesundheitAus(null, "2026-10-26", {}).tage, {})
})

test("Kraftbuch: alle Typen des früheren Kraftbuchs werden übernommen", () => {
  for (const t of ["plantag", "trainingslog", "maxwert", "verletzung", "geraet", "bandfarbe", "kraft_verlauf"]) assert.ok(T.KRAFTBUCH_TYPEN.includes(t), t)
})

test("Kopplung je App: ältere Geräte gehören zu Lebenswelt Fit, TrainMe erreicht nur seine Routen", () => {
  assert.equal(G.zielVon(undefined), "fit")
  assert.equal(G.zielVon("trainme"), "trainme")
  assert.equal(G.zielVon("etwas"), "fit")
  assert.equal(G.pfadErlaubt("fit", "/api/lebenswelt/spielstand"), true)
  assert.equal(G.pfadErlaubt("trainme", "/api/lebenswelt/trainme"), true)
  assert.equal(G.pfadErlaubt("trainme", "/api/lebenswelt/trainme/kraftbuch"), true)
  assert.equal(G.pfadErlaubt("trainme", "/api/lebenswelt/ich"), true)
  assert.equal(G.pfadErlaubt("trainme", "/api/lebenswelt/spielstand"), false)
  assert.equal(G.pfadErlaubt("trainme", "/api/lebenswelt/trainmex"), false)
  assert.equal(G.pfadErlaubt("trainme", "/api/lebenswelt/dokumente"), false)
})
