// Lange Fristen statt schnellem Verfall: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Eine Einsatzkraft mit Kübelspritze, die bis `frei` anderweitig gebunden ist; Mülltonnenbrand gekauft. */
function muelltonne(frei) {
  let s = S.neuerStand(R, T0 - STD, 3)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "geraet", id: "kuebelspritze" })
  s.freigeschaltet.push("b_muelltonne")
  s = kaufe(s, { art: "einsatzart", id: "b_muelltonne" })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  s.training_naechster = T0 + 1e12
  s = S.fortschreiben(s, T0, trocken, R)
  s.personal[0].belegt_bis = frei
  const e = S._intern.erzeuge(R, s, "b_muelltonne", T0, trocken, null, "muelltonnen")
  return { s, e }
}

test("Die Frist ist lang: Einsätze warten einen Tag, nicht nur Minuten", () => {
  const a = R.EINSATZARTEN.tier_katze
  assert.ok(R.VERFALL.frist_min >= 12 * 60)
  assert.equal(S._intern.verfallVon(R, a, T0, null), T0 + R.VERFALL.frist_min * MIN)
  // Längere eigene Fristen bleiben
  const lang = Object.assign({}, a, { ablauf_min: R.VERFALL.frist_min + 60 })
  assert.equal(S._intern.verfallVon(R, lang, T0, null), T0 + lang.ablauf_min * MIN)
})

test("Absichern und Ausleuchten verfallen spätestens mit dem Ende des Auslösers", () => {
  const a = R.EINSATZARTEN.bh_absperrung
  assert.ok(a.dauer_wie_ausloeser)
  const ausloeser = { id: "x", ende: T0 + 3 * STD }
  assert.equal(S._intern.verfallVon(R, a, T0, ausloeser), T0 + 3 * STD)
  // Nie kürzer als die eigene Frist der Einsatzart
  assert.equal(S._intern.verfallVon(R, a, T0, { id: "y", ende: T0 + MIN }), T0 + a.ablauf_min * MIN)
})

test("Nach drei Stunden Warten: Der Brand wird noch gelöscht, mit einem Stern, und hat sich nicht endlos ausgebreitet", () => {
  const { s, e } = muelltonne(T0 + 3 * STD)
  assert.ok(e.wartet, e.grund)
  const fertig = S.fortschreiben(s, T0 + 5 * STD, trocken, R)
  const z = fertig.abgeschlossen.find((x) => x.id === e.id)
  assert.equal(z.status, "abgeschlossen", z.grund)
  assert.equal(z.bewertung.sterne, 1)
  const art = R.EINSATZARTEN.b_muelltonne
  const ausbreitung = z.plan.faktoren.find((f) => f.grund === "ausbreitung")
  assert.ok(Math.abs(ausbreitung.faktor - (1 + art.wachstum * art.ablauf_min)) < 1e-9, JSON.stringify(ausbreitung))
  // Erneut alarmiert wird nach der ursprünglichen Frist im Raster von R.VERFALL.raster_min Minuten
  assert.ok(z.alarm_spaeter_s >= 3 * 3600 && z.alarm_spaeter_s <= 3 * 3600 + R.VERFALL.raster_min * 60, String(z.alarm_spaeter_s))
})

test("Kurz verspätet gibt es mehr Sterne als lange verspätet", () => {
  const sterne = (frei) => {
    const { s, e } = muelltonne(frei)
    return S.fortschreiben(s, T0 + 6 * STD, trocken, R).abgeschlossen.find((x) => x.id === e.id).bewertung.sterne
  }
  assert.ok(sterne(T0) > sterne(T0 + 3 * STD))
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, auch über das grobe Raster hinweg", () => {
  const { s } = muelltonne(T0 + 7 * STD + 3 * MIN)
  const ende = T0 + 30 * STD
  const ganz = S.fortschreiben(s, ende, trocken, R)
  let teile = s
  for (const t of [T0 + 4 * MIN, T0 + 9 * MIN + 1234, T0 + 2 * STD + 17, T0 + 7 * STD + 4 * MIN, T0 + 26 * STD, ende]) teile = S.fortschreiben(teile, t, trocken, R)
  assert.deepEqual(teile, ganz)
})

test("30 Tage ohne Einsatzkräfte: immer nur eine wartende Katze, schnell gerechnet", () => {
  const s = S.neuerStand(R, T0, 1)
  const t = Date.now()
  const nach = S.fortschreiben(s, T0 + 30 * 24 * STD, trocken, R)
  assert.ok(Date.now() - t < 1000)
  assert.ok(nach.laufend.filter((e) => e.wartet).length <= 1)
  assert.ok(nach.abgeschlossen.length >= 25 && nach.abgeschlossen.length <= 31, String(nach.abgeschlossen.length))
})

test("Kein zweiter Einsatz derselben Art an einem Ort, an dem noch einer läuft", () => {
  let s = S.neuerStand(R, T0, 11)
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const orte = R.EINSATZARTEN.tier_katze.orte
  // An allen Bäumen bis auf einen sitzt schon eine Katze: Die nächste kommt an den freien Baum
  for (const o of orte.slice(0, -1)) S._intern.erzeuge(R, s, "tier_katze", T0, trocken, null, o)
  for (let i = 0; i < 5; i++) {
    const x = JSON.parse(JSON.stringify(s))
    const e = S._intern.erzeuge(R, x, "tier_katze", T0 + MIN * (i + 1), trocken, null)
    assert.equal(e.ort, orte[orte.length - 1])
  }
})
