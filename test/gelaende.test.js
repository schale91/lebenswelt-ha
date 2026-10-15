// Geländehöhen der Karte: Wassereinsätze treten in Senken häufiger auf (tief_gewicht): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

// Raster 3 × 2 mit 10 m Abstand: links 2,5 m, Mitte 3,5 m, rechts 4,5 m
const GELAENDE = { x0: 0, z0: 0, raster: 10, spalten: 3, reihen: 2, nhn: [2.5, 3.5, 4.5, 2.5, 3.5, 4.5] }
const mitHoehen = (zufallsorte) => Object.assign({}, R, { GELAENDE, ZUFALLSORTE: zufallsorte || {} })

test("ohne Geländehöhen gibt es keine Höhe", () => {
  assert.equal(S.hoeheBei(R, 5, 5), null)
})

test("hoeheBei rechnet bilinear und bleibt am Rand", () => {
  const Rh = mitHoehen()
  assert.equal(S.hoeheBei(Rh, 0, 0), 2.5)
  assert.ok(Math.abs(S.hoeheBei(Rh, 5, 3) - 3) < 1e-6)
  assert.ok(Math.abs(S.hoeheBei(Rh, 20, 10) - 4.5) < 1e-6)
  assert.equal(S.hoeheBei(Rh, -50, -50), 2.5)
})

test("Wasser im Keller trifft tiefer gelegene Häuser häufiger", () => {
  const Rh = mitHoehen({ keller: [{ x: 0, z: 0 }, { x: 20, z: 0 }] })
  const art = Object.assign({}, R.EINSATZARTEN.th_wasser_keller)
  const auswahl = ["zufall:keller:0", "zufall:keller:1"]
  const s = S.neuerStand(R, Date.UTC(2026, 9, 10), 1)
  let tief = 0
  for (let i = 0; i < 2000; i++) {
    const r = S._intern.zufall("probe:" + i)
    if (S._intern.waehleOrt(Rh, s, art, auswahl, r) === auswahl[0]) tief++
  }
  // Gewichte 1 + 2 × 1 m = 3 und mindestens 0,2: rund 94 % in der Senke
  assert.ok(tief > 1750, "tief " + tief)
})

test("ohne tief_gewicht oder ohne Höhen bleibt die Auswahl gleich verteilt und unverändert", () => {
  const auswahl = ["a", "b", "c", "d"]
  const s = S.neuerStand(R, Date.UTC(2026, 9, 10), 1)
  for (let i = 0; i < 50; i++) {
    const r1 = S._intern.zufall("x:" + i)
    const r2 = S._intern.zufall("x:" + i)
    assert.equal(S._intern.waehleOrt(R, s, R.EINSATZARTEN.th_wasser_keller, auswahl, r1), auswahl[Math.floor(r2() * auswahl.length)])
  }
})

test("Graben übergelaufen: gültige Geräte, Freischaltung und Orte", () => {
  const a = R.EINSATZARTEN.th_graben
  assert.ok(a)
  assert.ok(R.EINSATZARTEN[a.freischaltung.nach])
  for (const teil of [a.mindestens, a.optimal]) for (const g of teil.geraete) for (const alt of g) for (const id of Object.keys(alt)) assert.ok(R.GERAETE[id], id)
  assert.ok(R.ORTE.graben)
  assert.deepEqual(S.orteVon(mitHoehen({ durchlass: [{ x: 1, z: 1 }] }), a), ["graben", "zufall:durchlass:0"])
  assert.equal(S.ortName(R, "zufall:durchlass:0"), "Durchlass am Graben")
})
