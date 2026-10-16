// Krankenhaus: leichte Verletzungen nach Einsätzen, niemand stirbt: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8)
const STD = 3600000

function stand() {
  let s = S.neuerStand(R, T0, 3)
  for (const bp of R.BAUPLAETZE.slice(0, 2)) {
    const r = S.kaufe(s, { art: "bauplatz", id: bp.id }, T0, R)
    assert.ok(!r.fehler, r.fehler)
    s = r.stand
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(R, s, b, T0)
  }
  return s
}

const einsatz = (s, id, art) => ({ id, art, plan: { personen: s.personal.map((p) => ({ id: p.id })), zurueck: T0 + STD } })

test("Mit Chance 1 liegt jeder Beteiligte im Kreiskrankenhaus und fällt aus, danach ist er wieder da", () => {
  const s = stand()
  const K = { ...R.KRANKENHAUS, chance: 1 }
  const R2 = { ...R, KRANKENHAUS: K }
  const verletzt = S._intern.verletzungen(R2, s, einsatz(s, "e1", "b_hecke"), T0 + STD)
  assert.equal(verletzt.length, s.personal.length)
  const p = s.personal[0]
  assert.equal(p.krankenhaus.ort, K.name_stadt)
  assert.ok(K.gruende.includes(p.krankenhaus.grund))
  assert.equal(p.krankenhaus.bis, T0 + STD + K.dauer_h.stadt * STD)
  assert.equal(S._intern.einsatzbereitFuer(R, p, "feuerwehr", T0 + 2 * STD, s), false)
  // nach der Zeit wieder einsatzbereit (fortschreiben räumt auf)
  const spaeter = S.fortschreiben(s, T0 + STD + K.dauer_h.stadt * STD + 1, () => "trocken", R)
  const q = spaeter.personal.find((x) => x.id === p.id)
  assert.ok(!q.krankenhaus)
})

test("Mit eigenem Krankenhaus im Dorf (ab Level) geht es schneller; ohne Glück passiert nichts", () => {
  const s = stand()
  s.level = R.KRANKENHAUS.ab_level
  const R2 = { ...R, KRANKENHAUS: { ...R.KRANKENHAUS, chance: 1 } }
  S._intern.verletzungen(R2, s, einsatz(s, "e2", "th_oelspur"), T0)
  assert.equal(s.personal[0].krankenhaus.ort, R.KRANKENHAUS.name_dorf)
  assert.equal(s.personal[0].krankenhaus.bis, T0 + R.KRANKENHAUS.dauer_h.dorf * STD)
  const s2 = stand()
  const R3 = { ...R, KRANKENHAUS: { ...R.KRANKENHAUS, chance: 0 } }
  assert.deepEqual(S._intern.verletzungen(R3, s2, einsatz(s2, "e3", "b_hecke"), T0), [])
})

test("Die Chance ist klein: über viele Einsätze nur wenige Verletzte", () => {
  const s = stand()
  let n = 0
  for (let i = 0; i < 400; i++) {
    for (const p of s.personal) p.krankenhaus = null
    n += S._intern.verletzungen(R, s, einsatz(s, "x" + i, "tier_katze"), T0).length
  }
  assert.ok(n > 0 && n < 40, "Verletzte: " + n)
})
