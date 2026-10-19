// Neue DWD-Regeln (Gewitter, Hitze) und Gerätehausbesetzung bei Unwetter: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 18, 2) // Sonntag, 4 Uhr Ortszeit: niemand arbeitet
const MIN = 60000
const STD = 60 * MIN

test("Gewitter ab Stufe 2 ist Sturm, mit Orkanböen bleibt es Sturm, Hitze setzt Hitze", () => {
  const r = (name, stufe) => S.warnungsRegel(R, { name, stufe })
  assert.equal(r("GEWITTER", 1), null)
  assert.equal(r("STARKES GEWITTER", 2).wetter, "sturm")
  assert.equal(r("SCHWERES GEWITTER mit ORKANBÖEN", 3).muster[0], "ORKAN")
  assert.equal(r("STARKE HITZE", 1).wetter, "hitze")
  assert.equal(r("EXTREME HITZE", 2).ausloesen[0].art, "b_flaeche")
})

function mitKraft() {
  let s = S.neuerStand(R, T0 - STD, 5)
  const k = S.kaufe(s, { art: "bauplatz", id: "bp10" }, T0 - STD, R)
  assert.ok(!k.fehler, k.fehler)
  s = k.stand
  for (const b of s.baustellen.slice()) S._intern.fertigstellen(R, s, b, T0 - STD)
  return s
}

test("Gerätehausbesetzung: bei Unwetter mit Ausbau am Gerätehaus, sonst von zu Hause", () => {
  const s = mitKraft()
  const p = s.personal[0]
  const ohne = S._intern.heimweg(R, s, p, T0, "trocken")
  s.ausbau.push("unwetterbereitschaft")
  // Ausbau ohne Warnung wirkt nicht
  assert.equal(S._intern.heimweg(R, s, p, T0, "trocken").umgezogen, ohne.umgezogen)
  s.bereitschaft = [[T0 - STD, T0 + STD]]
  const mit = S._intern.heimweg(R, s, p, T0, "trocken")
  assert.ok(mit.umgezogen < ohne.umgezogen, "schneller umgezogen")
  assert.equal(mit.weg, null)
  // Nach der Warnung wieder wie sonst
  assert.equal(S._intern.heimweg(R, s, p, T0 + 2 * STD, "trocken").umgezogen - (T0 + 2 * STD), ohne.umgezogen - T0)
})
