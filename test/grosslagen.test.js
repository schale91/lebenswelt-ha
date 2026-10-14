// Großlagen, alle zusammen (ab Level 30): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const sturm = () => "sturm"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Feuerwehr mit sechs Kräften und Motorsäge, Polizei, Rettungswache, DRK-Mitglied. */
function dorf(level = 30) {
  let s = S.neuerStand(R, T0 - STD, 21)
  s.level = level
  for (const bp of ["bp01", "bp02", "bp03", "bp04", "bp05", "bp06", "bp07", "bp08"]) s = kaufe(s, { art: "bauplatz", id: bp })
  s = kaufe(s, { art: "geraet", id: "motorsaege" })
  for (const p of s.personal) {
    p.lehrgaenge.motorsaege = T0 - STD
    p.lehrgaenge.tf = T0 - STD
    p.psa.helm = 2
  }
  s = kaufe(s, { art: "gebaeude", id: "dienststelle" })
  s = kaufe(s, { art: "personal", id: "polizei" })
  s = kaufe(s, { art: "personal", id: "polizei" })
  return s
}

test("Großlagen werden nicht gekauft und kommen erst ab Level 30 von selbst", () => {
  const vorher = S.fortschreiben(dorf(29), T0, sturm, R)
  assert.ok(!Object.keys(vorher.einsatzarten).some((id) => R.EINSATZARTEN[id].grosslage))
  const ab = S.fortschreiben(dorf(30), T0, sturm, R)
  for (const [id, a] of Object.entries(R.EINSATZARTEN).filter(([, x]) => x.grosslage && !x.baustelle)) assert.ok(ab.einsatzarten[id], id)
  assert.match(S.kaufe(ab, { art: "einsatzart", id: "gl_sturm" }, T0, R).fehler, /nicht gekauft/)
})

test("Sturm-Großlage: alle Teile werden gleichzeitig alarmiert, das THW kommt auf Anforderung", () => {
  const s = dorf()
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = T0 + 1e12
  x.training_naechster = T0 + 1e12
  x.bis = T0
  const e = S._intern.erzeuge(R, x, "gl_sturm", T0, sturm, null, "hauptstrasse_ost")
  assert.ok(e.plan, e.grund)
  const sofort = x.laufend.filter((y) => y.folge_von === e.id)
  const orgs = new Set(sofort.map((y) => R.EINSATZARTEN[y.art].org))
  for (const o of ["polizei", "rettungsdienst", "drk", "bauhof", "werkstatt"]) assert.ok(orgs.has(o), o)
  assert.ok(sofort.every((y) => y.meldung === T0), "gleichzeitig")
  assert.ok(!sofort.some((y) => R.EINSATZARTEN[y.art].org === "thw"), "THW erst auf Anforderung")
  const ende = S.fortschreiben(x, T0 + 8 * STD, sturm, R)
  const alle = ende.abgeschlossen.filter((y) => y.folge_von === e.id)
  assert.ok(alle.some((y) => y.art === "thw_raeumen"), "THW nachgefordert")
  assert.equal(alle.filter((y) => y.art === "thw_raeumen").length, 1)
  // Niemand in zwei Einsätzen zugleich
  const zeit = {}
  for (const y of ende.abgeschlossen.filter((z) => z.plan && z.plan.eintreffen)) {
    for (const p of y.plan.personen) {
      for (const [von, bis] of zeit[p.id] || []) assert.ok(y.plan.alarm >= bis || y.plan.einsatzbereit <= von, `${p.id} doppelt`)
      zeit[p.id] = (zeit[p.id] || []).concat([[y.plan.alarm, y.plan.einsatzbereit]])
    }
  }
  assert.ok(ende.abgeschlossen.find((y) => y.id === e.id).bewertung.zusammenarbeit, "Zusammenarbeit bewertet")
})

test("Gute Zusammenarbeit macht Großlagen häufiger", () => {
  const mk = (sterne) => {
    const s = dorf()
    s.zusammenarbeit = Array.from({ length: 10 }, (_, i) => ({ id: "z" + i, sterne }))
    return S.fortschreiben(s, T0 + 60 * 24 * STD, sturm, R).abgeschlossen.filter((e) => R.EINSATZARTEN[e.art].grosslage).length
  }
  assert.ok(mk(5) >= mk(1))
})

test("Eine Großlage über mehrere Stunden wird in unter einer Sekunde fortgeschrieben", () => {
  const s = dorf()
  const x = JSON.parse(JSON.stringify(s))
  x.bis = T0
  S._intern.erzeuge(R, x, "gl_sturm", T0, sturm, null, "kreuzung")
  const start = Date.now()
  S.fortschreiben(x, T0 + 12 * STD, sturm, R)
  assert.ok(Date.now() - start < 1000, `${Date.now() - start} ms`)
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit Großlagen", () => {
  const s = dorf()
  const ende = T0 + 6 * 24 * STD
  const ganz = S.fortschreiben(s, ende, sturm, R)
  let teile = s
  for (let t = T0 + 5 * STD; t < ende; t += 11 * STD) teile = S.fortschreiben(teile, t, sturm, R)
  teile = S.fortschreiben(teile, ende, sturm, R)
  assert.deepEqual(teile, ganz)
})
