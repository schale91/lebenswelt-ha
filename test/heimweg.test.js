// Weg von zu Hause zum Feuerwehrhaus: Gehweg, Rad, Auto, Halt an Hindernissen: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 16) // Dienstag, 18 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"
const ll = (p, q) => Math.hypot(p.x - q.x, p.z - q.z)

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Eine Einsatzkraft am Bauplatz bp07 (der Weg führt über die Straßen), auf Wunsch mit Fahrrad oder Auto. */
function dorf(ausbau) {
  let s = S.neuerStand(R, T0 - STD, 7)
  s = kaufe(s, { art: "bauplatz", id: "bp07" })
  if (ausbau) for (const a of ausbau) s = kaufe(s, { art: "haus_ausbau", ziel: s.haeuser[0].id, id: a })
  return s
}

/** Punkt auf dem Netz zwischen Start und Ziel (für Hindernisse direkt an der Route). */
function mitteDerRoute(route) {
  return route[Math.floor(route.length / 2)]
}

test("Zu Fuß über den Gehweg: abgekürzt wird nur am Anfang und am Ende, höchstens abkuerzung_max", () => {
  const fw = R.ORTE.feuerwehrhaus
  for (const b of R.BAUPLAETZE) {
    const route = S._intern.fussroute(R, b, fw)
    if (ll(b, fw) <= R.ZEITEN.abkuerzung_max) continue
    assert.ok(ll(route[0], route[1]) <= Math.max(R.ZEITEN.abkuerzung_max, ll(b, S._intern.strassenroute(R, b, fw)[1])) + 0.01, b.id)
    const n = route.length
    assert.ok(ll(route[n - 2], route[n - 1]) <= Math.max(R.ZEITEN.abkuerzung_max, ll(fw, S._intern.strassenroute(R, b, fw).slice(-2)[0])) + 0.01, b.id)
    // Nie länger als über die Straße
    const l = (r) => r.reduce((x, p, i) => (i ? x + ll(p, r[i - 1]) : 0), 0)
    assert.ok(l(route) <= l(S._intern.strassenroute(R, b, fw)) + 0.01, b.id)
  }
})

test("Der Plan enthält den Weg vom Haus: Verkehrsmittel, Start, los und da", () => {
  let s = dorf()
  const h = S._intern.heimweg(R, s, s.personal[0], T0, "trocken")
  assert.equal(h.weg.mittel, "zu_fuss")
  assert.ok(h.weg.los < h.weg.da && h.weg.da < h.umgezogen)
  assert.deepEqual(h.weg.halt, [])
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  s.bis = T0
  const e = S._intern.erzeuge(R, s, "tier_katze", T0, trocken, null, "baum_feuerwehr")
  const w = e.plan.personen[0].weg
  assert.equal(w.mittel, "zu_fuss")
  assert.deepEqual(w.von, { x: -68, z: 23 })
  assert.equal(e.plan.personen[0].umgezogen, S._intern.heimweg(R, s, s.personal[0], T0, "trocken").umgezogen)
})

test("Eine Baustelle am Gehweg: zu Fuß wird kurz gewartet, mit dem Auto vorsichtig vorbeigefahren", () => {
  const ohne = dorf()
  const p = ohne.personal[0]
  const route = S._intern.fussroute(R, R.BAUPLAETZE.find((b) => b.id === "bp07"), R.ORTE.feuerwehrhaus)
  const m = mitteDerRoute(route)
  const mit = JSON.parse(JSON.stringify(ohne))
  mit.baustellen.push({ id: "bx", art: "gebaeude", ziel: "test", ort: { x: m.x + 4, z: m.z + 4 }, start: T0 - STD, ende: T0 + 20 * STD, gekauft: T0 - STD })
  const a = S._intern.heimweg(R, ohne, p, T0, "trocken")
  const b = S._intern.heimweg(R, mit, p, T0, "trocken")
  assert.equal(b.weg.halt.length, 1)
  assert.equal(b.weg.halt[0].s, R.BAU.verkehr.zu_fuss_s)
  assert.equal(b.umgezogen - a.umgezogen, R.BAU.verkehr.zu_fuss_s * 1000)
  // Eine Baustelle weit weg vom Weg stört nicht
  const weit = JSON.parse(JSON.stringify(ohne))
  weit.baustellen.push({ id: "by", art: "gebaeude", ziel: "test", ort: { x: m.x + 60, z: m.z + 60 }, start: T0 - STD, ende: T0 + 20 * STD, gekauft: T0 - STD })
  assert.equal(S._intern.heimweg(R, weit, p, T0, "trocken").umgezogen, a.umgezogen)
  // Mit dem Auto über die Straße: an derselben Baustelle vorsichtig vorbei, das dauert länger als zu Fuß
  const auto = dorf(["auto"])
  const mitAuto = JSON.parse(JSON.stringify(auto))
  const sr = S._intern.strassenroute(R, R.BAUPLAETZE.find((b) => b.id === "bp07"), R.ORTE.feuerwehrhaus)
  const ms = mitteDerRoute(sr)
  mitAuto.baustellen.push({ id: "bz", art: "gebaeude", ziel: "test", ort: { x: ms.x + 3, z: ms.z + 3 }, start: T0 - STD, ende: T0 + 20 * STD, gekauft: T0 - STD })
  const c = S._intern.heimweg(R, mitAuto, mitAuto.personal[0], T0, "trocken")
  assert.equal(c.weg.mittel, "auto")
  assert.equal(c.weg.halt[0].s, R.BAU.verkehr.fahrzeug_s)
})

test("Unfall oder Panne auf der Straße am Weg: Halt mit Grund", () => {
  const s = dorf()
  const route = S._intern.fussroute(R, R.BAUPLAETZE.find((b) => b.id === "bp07"), R.ORTE.feuerwehrhaus)
  const m = mitteDerRoute(route)
  // Eine Panne direkt an der Route (eigener Ort im Testregelwerk)
  const RL = Object.assign({}, R, { ORTE: Object.assign({}, R.ORTE, { panne_test: { name: "Test", x: m.x + 2, z: m.z } }) })
  s.laufend.push({ id: "e_panne", art: "ab_panne", ort: "panne_test", meldung: T0 - MIN, verfall: T0 + STD, status: "alarmiert", plan: null, ende: T0 + STD })
  const h = S._intern.heimweg(RL, s, s.personal[0], T0, "trocken")
  assert.deepEqual(h.weg.halt.map((x) => x.name), [R.EINSATZARTEN.ab_panne.name])
  // Vorbei, wenn die Panne beseitigt ist
  assert.deepEqual(S._intern.heimweg(RL, s, s.personal[0], T0 + 2 * STD, "trocken").weg.halt, [])
})

test("Mit dem Auto über die Straße, nicht über den Hof", () => {
  const s = dorf(["auto"])
  s.personal[0].fitness = 50
  const h = S._intern.heimweg(R, s, s.personal[0], T0, "trocken")
  assert.equal(h.weg.mittel, "auto")
  const start = R.BAUPLAETZE.find((b) => b.id === "bp07")
  const l = (r) => r.reduce((x, p, i) => (i ? x + ll(p, r[i - 1]) : 0), 0)
  const fahrt = (h.weg.da - h.weg.los) / 1000
  assert.ok(Math.abs(fahrt - (l(S._intern.strassenroute(R, start, R.ORTE.feuerwehrhaus)) * R.METER_JE_EINHEIT) / R.HAUS_AUSBAU.auto.tempo_ms) < 1)
})

test("Nach dem Einsatz geht es heim; ein neuer Alarm unterwegs: umdrehen statt von zu Hause kommen", () => {
  let s = dorf(["fahrrad"])
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  s.training_naechster = T0 + 1e12
  s.bis = T0
  const e = S._intern.erzeuge(R, s, "tier_katze", T0, trocken, null, "baum_feuerwehr")
  assert.ok(e.plan, e.grund)
  const p = s.personal[0]
  assert.equal(p.zurueck_fw.ab, e.plan.einsatzbereit)
  assert.equal(p.zurueck_fw.mittel, e.plan.personen[0].weg.mittel)
  const daheim = S._intern.heimweg(R, s, p, e.plan.einsatzbereit + 3 * STD, "trocken")
  // Gleich nach dem Einsatz noch am Gerätehaus: kein Weg, schnell wieder umgezogen
  const gleich = S._intern.heimweg(R, s, p, e.plan.einsatzbereit + 1000, "trocken")
  assert.ok(gleich.umgezogen - (e.plan.einsatzbereit + 1000) < daheim.umgezogen - (e.plan.einsatzbereit + 3 * STD))
  // Auf halbem Weg: dreht mit dem Rad um, startet zwischen Gerätehaus und Haus
  const unterwegs = S._intern.aufDemHeimweg(R, s, p, e.plan.einsatzbereit + 30000)
  assert.ok(unterwegs && unterwegs.anteil > 0 && unterwegs.anteil < 1, JSON.stringify(unterwegs))
  const halb = S._intern.heimweg(R, s, p, e.plan.einsatzbereit + 30000, "trocken")
  assert.equal(halb.weg.mittel, p.zurueck_fw.mittel)
  assert.deepEqual(halb.weg.von, unterwegs.punkt)
  // Später ist sie daheim
  assert.equal(S._intern.aufDemHeimweg(R, s, p, e.plan.einsatzbereit + 3 * STD), null)
  assert.deepEqual(daheim.weg.von, { x: -68, z: 23 })
})
