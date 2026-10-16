// Freischaltung der Fahrzeuge: Level oder passender Einsatz, Fahrerlaubnis, Zugfahrzeug: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8)

function mitHaeusern(n) {
  let s = S.neuerStand(R, T0, 3)
  for (const bp of R.BAUPLAETZE.slice(0, n)) {
    const r = S.kaufe(s, { art: "bauplatz", id: bp.id }, T0, R)
    assert.ok(!r.fehler, r.fehler)
    s = r.stand
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(R, s, b, T0)
  }
  return s
}

test("Staffel je Organisation: das günstigste Fahrzeug ab dem Level der Organisation, teurere später", () => {
  assert.equal(R.FAHRZEUGE.handzugwagen.ab_level, 0)
  assert.ok(R.FAHRZEUGE.hlf20.ab_level > R.FAHRZEUGE.lf10.ab_level)
  assert.equal(R.FAHRZEUGE.rtw.ab_level, R.ORGANISATIONEN.rettungsdienst.ab_level)
  for (const f of Object.values(R.FAHRZEUGE)) assert.ok(f.ab_level >= (R.ORGANISATIONEN[f.org].ab_level || 0), f.name)
})

test("Teure Fahrzeuge erst ab ihrem Level; der Starteinsatz schaltet das günstigste passende Fahrzeug frei", () => {
  const s = mitHaeusern(2)
  for (const p of s.personal) p.lehrgaenge.fahrberechtigung = T0 - 1
  // Katze auf Baum braucht eine Leiter: das TSF bringt sie mit und ist damit frei, das LF 10 nicht
  assert.ok(S.fahrzeugeDurchEinsatz(R, s).has("tsf"))
  assert.equal(S.fahrzeugSperre(R, s, "tsf", T0), null)
  assert.match(S.fahrzeugSperre(R, s, "lf10", T0), /Erst ab Level/)
  s.level = R.FAHRZEUGE.lf10.ab_level
  assert.match(S.fahrzeugSperre(R, s, "lf10", T0) || "", /^$|Klasse C/)
})

test("Ohne passende Fahrerlaubnis kein Kauf, Anhänger nur mit Zugfahrzeug", () => {
  const s = mitHaeusern(2)
  s.level = 30
  assert.match(S.fahrzeugSperre(R, s, "tsf", T0), /Niemand darf es fahren/)
  assert.match(S.kaufe(s, { art: "fahrzeug", id: "tsf" }, T0, R).fehler, /Fahrberechtigung/)
  s.personal[0].lehrgaenge.fahrberechtigung = T0 - 1
  assert.equal(S.fahrzeugSperre(R, s, "tsf", T0), null)
  // MLF braucht den Führerschein Klasse C
  assert.match(S.fahrzeugSperre(R, s, "mlf", T0), /Klasse C/)
  // Anhänger ohne Zugfahrzeug
  assert.match(S.fahrzeugSperre(R, s, "tsa", T0), /Zugfahrzeug/)
  // Ein schon vorhandener Typ darf ein zweites Mal gekauft werden, auch unter dem Level
  s.level = 0
  s.fahrzeuge.push({ id: "fx", typ: "lf10", beladung: {}, belegt_bis: 0 })
  s.personal[0].lehrgaenge.fuehrerschein_c = T0 - 1
  assert.equal(S.fahrzeugSperre(R, s, "lf10", T0), null)
})
