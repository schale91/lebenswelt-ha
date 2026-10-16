// Einsatzkraft verabschieden: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8)
const TAG = 86400000

function mitHaus(bp, t = T0) {
  const s = S.neuerStand(R, t)
  const r = S.kaufe(s, { art: "bauplatz", id: bp }, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  r.stand.ausgaben.push({ zeit: t, betrag: r.preis, text: "bauplatz:" + bp })
  return r.stand
}

test("Verabschieden: Person weg, leeres Haus abgerissen, frischer Bauplatzkauf erstattet", () => {
  const s = mitHaus("bp12")
  const p = s.personal.find((x) => x.haus)
  assert.ok(p, "mit dem Haus ist eine Einsatzkraft eingezogen")
  const v = S.verabschiede(s, p.id, T0 + 2 * TAG)
  assert.ok(!v.fehler, v.fehler)
  assert.ok(!v.stand.personal.some((x) => x.id === p.id))
  assert.ok(!v.stand.haeuser.some((h) => h.bauplatz === "bp12"))
  assert.equal(v.bauplatz, "bp12")
  assert.ok(v.erstattung > 0)
  // Der alte Stand bleibt unverändert
  assert.ok(s.personal.some((x) => x.id === p.id))
  // Der Bauplatz lässt sich wieder kaufen
  assert.ok(!S.kaufe(v.stand, { art: "bauplatz", id: "bp12" }, T0 + 2 * TAG, R).fehler)
})

test("Nach einer Woche gibt es keine Erstattung mehr, im Einsatz geht es gar nicht", () => {
  const s = mitHaus("bp12")
  const p = s.personal.find((x) => x.haus)
  assert.equal(S.verabschiede(s, p.id, T0 + 8 * TAG).erstattung, 0)
  const belegt = JSON.parse(JSON.stringify(s))
  belegt.personal.find((x) => x.id === p.id).belegt_bis = T0 + 3 * TAG
  assert.ok(S.verabschiede(belegt, p.id, T0 + 2 * TAG).fehler)
  assert.ok(S.verabschiede(s, "p999", T0).fehler)
})
