// Neubaugebiete mit einzelnen Plätzen aus der Karte der App: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

test("ohne Plätze liegen die Bauplätze im Raster ab dem Ursprung", () => {
  const nb = R.NEUBAUGEBIETE[0]
  const p = S._intern.bauplatz(R, nb.id + "_5")
  assert.equal(p.x, nb.ursprung.x + (5 % nb.spalten) * nb.raster)
  assert.equal(p.z, nb.ursprung.z + Math.floor(5 / nb.spalten) * nb.raster)
  assert.equal(p.neubaugebiet, nb.id)
})

test("mit Plätzen aus der Karte gilt der einzelne Platz", () => {
  const nb0 = R.NEUBAUGEBIETE[0]
  const plaetze = Array.from({ length: nb0.spalten * nb0.reihen }, (_, i) => ({ x: 100 + i * 15, z: -40 + (i % 2) * 30 }))
  const R2 = Object.assign({}, R, { NEUBAUGEBIETE: [Object.assign({}, nb0, { plaetze }), ...R.NEUBAUGEBIETE.slice(1)] })
  const p = S._intern.bauplatz(R2, nb0.id + "_3")
  assert.deepEqual([p.x, p.z], [145, -10])
  assert.equal(S._intern.bauplatz(R2, nb0.id + "_" + plaetze.length), null)
})
