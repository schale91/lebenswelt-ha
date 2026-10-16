// Gebiete im Nebel: angrenzend kaufen, Preis und Level nach Ring: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8)
const neu = () => S.neuerStand(R, T0, 3)

test("Startgebiet ist frei, der Rest liegt im Nebel", () => {
  const s = neu()
  assert.ok(S.gebietFrei(R, s, "0:0"))
  assert.ok(S.gebietFrei(R, s, "3:3"))
  assert.ok(!S.gebietFrei(R, s, "5:0"))
  assert.equal(S.gebietRing(R, "5:0"), 1)
  assert.equal(S.gebietRing(R, "7:6"), 3)
  // alle Bauplätze der Karte liegen im Startgebiet
  for (const bp of R.BAUPLAETZE) assert.ok(S.gebietFrei(R, s, S.gebietAn(R, bp.x, bp.z)), bp.id)
  for (const nb of R.NEUBAUGEBIETE)
    for (let k = 0; k < nb.spalten * nb.reihen; k++)
      assert.ok(S.gebietFrei(R, s, S.gebietAn(R, nb.ursprung.x + (k % nb.spalten) * nb.raster, nb.ursprung.z + Math.floor(k / nb.spalten) * nb.raster)), nb.id + "_" + k)
})

test("Kauf nur angrenzend, mit Level und Münzen", () => {
  let s = neu()
  s.level = 0
  assert.match(S.gebietSperre(R, s, "5:0"), /Level 4/)
  s.level = 30
  assert.equal(S.gebietSperre(R, s, "5:0"), null)
  assert.match(S.gebietSperre(R, s, "6:0"), /angrenzendes/)
  assert.match(S.gebietSperre(R, s, "2:2"), /Schon frei/)
  assert.match(S.gebietSperre(R, s, "0:-1"), /gibt es nicht/)
  const r = S.kaufe(s, { art: "gebiet", id: "5:0" }, T0, R)
  assert.ok(!r.fehler, r.fehler)
  assert.ok(r.preis > 0)
  s = r.stand
  assert.ok(S.gebietFrei(R, s, "5:0"))
  assert.equal(S.gebietSperre(R, s, "6:0"), null)
  assert.ok(S.gebietPreis(R, "6:0") > S.gebietPreis(R, "5:0"))
})

test("Krankenhaus im Dorf erst mit dem Krankenhausgelände", () => {
  const s = neu()
  s.level = 30
  const kh = Object.entries(R.GEBIETE.besonders).find(([, g]) => g.art === "krankenhaus")[0]
  for (const p of s.personal) p.krankenhaus = null
  const R2 = { ...R, KRANKENHAUS: { ...R.KRANKENHAUS, chance: 1 } }
  const e = (id) => ({ id, art: "b_hecke", plan: { personen: s.personal.map((p) => ({ id: p.id })), zurueck: T0 } })
  if (!s.personal.length) return
  S._intern.verletzungen(R2, s, e("k1"), T0)
  assert.equal(s.personal[0].krankenhaus.ort, R.KRANKENHAUS.name_stadt)
  for (const p of s.personal) p.krankenhaus = null
  s.gebiete.push(kh)
  S._intern.verletzungen(R2, s, e("k2"), T0)
  assert.equal(s.personal[0].krankenhaus.ort, R.KRANKENHAUS.name_dorf)
})

test("Gebäude im Nebel erst nach dem Freischalten, Einsätze nicht im Nebel", () => {
  // Sportplatz auf ein Quadrat im Nebel legen (wie auf der echten Karte)
  const R2 = { ...R, ORTE: { ...R.ORTE, sportplatz: { ...R.ORTE.sportplatz, x: 400, z: 0 } } }
  let s = neu()
  s.level = 60
  s.muenzen = 1e7
  const key = S.gebietAn(R2, 400, 0)
  assert.ok(!S.gebietFrei(R2, s, key))
  const r = S.kaufe(s, { art: "gebaeude", id: "sportplatz" }, T0, R2)
  assert.match(r.fehler || "", /Nebel/)
  s = { ...s, gebiete: [...(s.gebiete || []), key] }
  const r2 = S.kaufe(s, { art: "gebaeude", id: "sportplatz" }, T0, R2)
  assert.ok(!r2.fehler, r2.fehler)
  // Einsatzart mit Orten im Nebel und im Freien: es trifft nur die freien
  const s3 = neu()
  const art = Object.entries(R2.EINSATZARTEN).find(([, a]) => (a.orte || []).includes("sportplatz") && a.orte.length > 1)
  if (!art) return
  for (let k = 0; k < 30; k++) {
    const e = S._intern.erzeuge(R2, s3, art[0], T0 + k, () => "trocken")
    assert.notEqual(e.ort, "sportplatz")
  }
})
