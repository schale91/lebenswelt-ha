// Einsätze nur, wenn jemand kommen kann, und Keller nur an Häusern: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 16, 19) // 21 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Neues Spiel mit gekaufter Ruhestörung (die Polizei startet mit ihr), aber ohne Beamte. */
function ohnePolizei() {
  let s = S.neuerStand(R, T0 - STD, 11)
  s = kaufe(s, { art: "einsatzart", id: "p_ruhestoerung" }, T0 - STD)
  s.bis = T0 - STD
  return s
}

test("Ohne Beamte entsteht keine Ruhestörung", () => {
  const s = S.fortschreiben(ohnePolizei(), T0 + 3 * 24 * STD, trocken, R)
  const alle = s.laufend.concat(s.abgeschlossen || [])
  assert.equal(alle.filter((e) => e.art === "p_ruhestoerung").length, 0)
  assert.equal(S._intern.orgBesetzt(R, s, "polizei"), false)
  // Feuerwehr hat die Nachbarhilfe, Werkstatt erst ab Level 12 Hilfe von außen
  assert.equal(S._intern.orgBesetzt(R, s, "feuerwehr"), true)
  assert.equal(S._intern.orgBesetzt(R, s, "werkstatt"), false)
})

test("Mit einer Beamtin kommt die Ruhestörung", () => {
  let s = ohnePolizei()
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "polizei", beruf: "schicht" } }, T0 - STD)
  s.bis = T0 - STD
  s = S.fortschreiben(s, T0 + 5 * 24 * STD, trocken, R)
  assert.ok(s.laufend.concat(s.abgeschlossen || []).some((e) => e.art === "p_ruhestoerung"))
})

test("Ein wartender Einsatz ohne jede Kraft wird still gestrichen", () => {
  const s = ohnePolizei()
  s.laufend.push({ id: "e_alt", art: "p_ruhestoerung", ort: "nachbarhaus", meldung: T0 - 30 * MIN, verfall: T0 + 23 * STD, status: "gemeldet", wartet: true, plan: null })
  const n = S.fortschreiben(s, T0 + MIN, trocken, R)
  assert.ok(!n.laufend.some((e) => e.id === "e_alt"))
  assert.ok(!(n.abgeschlossen || []).some((e) => e.id === "e_alt"), "zählt nicht als verfallen")
})

test("Wasser im Keller nur an Wohnhäusern, auf denen ein Haus steht", () => {
  const Rk = Object.assign({}, R, { ZUFALLSORTE: { keller: [{ x: R.BAUPLAETZE[0].x, z: R.BAUPLAETZE[0].z }, { x: R.BAUPLAETZE[1].x, z: R.BAUPLAETZE[1].z }] } })
  let s = S.neuerStand(R, T0 - STD, 3)
  assert.equal(S._intern.ortBewohnt(Rk, s, "zufall:keller:0"), false)
  assert.equal(S._intern.ortBewohnt(Rk, s, "nachbarhaus"), true)
  s = kaufe(s, { art: "bauplatz", id: R.BAUPLAETZE[0].id, bewohner: { org: "feuerwehr", beruf: "auswaerts" } })
  assert.equal(S._intern.ortBewohnt(Rk, s, "zufall:keller:0"), true)
  assert.equal(S._intern.ortBewohnt(Rk, s, "zufall:keller:1"), false)
})
