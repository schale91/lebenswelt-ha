// Werkstatt mit Abschleppdienst und Bauhof (ab Level 12): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"
const glatt = () => "glaette"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

function stand(level = 12) {
  const s = S.neuerStand(R, T0, 5)
  s.level = level
  return s
}

/** Einsatz auslösen und bis zum Ende fortschreiben; keine anderen Meldungen. */
function einsatz(s, art, ort, wetter = trocken, t = T0 + MIN) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  const e = S._intern.erzeuge(R, x, art, t, wetter, null, ort)
  const fertig = S.fortschreiben(x, t + 4 * STD, wetter, R)
  return { e: fertig.abgeschlossen.find((a) => a.id === e.id), stand: fertig, alle: fertig.abgeschlossen }
}

test("Vor Level 12 gibt es weder Werkstatt noch Bauhof, auch keine Folgeeinsätze mit ihnen", () => {
  let s = stand(11)
  s = S.fortschreiben(s, T0 + MIN, trocken, R)
  assert.ok(!s.freigeschaltet.includes("ab_panne"))
  assert.match(S.kaufe(s, { art: "gebaeude", id: "werkstatt" }, T0, R).fehler, /Erst ab Level 12/)
  assert.match(S.kaufe(s, { art: "personal", id: "bauhof" }, T0, R).fehler, /Erst ab Level 12/)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "geraet", id: "oelbinder", anzahl: 2 })
  s = kaufe(s, { art: "geraet", id: "besen_schaufel" })
  const { alle } = einsatz(s, "th_oelspur", "kreuzung")
  assert.ok(!alle.some((e) => e.art === "bh_oel"), "keine Reinigung durch den Bauhof vor Level 12")
})

test("Ab Level 12 sind Panne, Streuen und Ast kaufbar", () => {
  const s = S.fortschreiben(stand(12), T0 + MIN, trocken, R)
  for (const id of ["ab_panne", "bh_streuen", "bh_ast"]) assert.ok(s.freigeschaltet.includes(id), id)
  assert.ok(kaufe(s, { art: "einsatzart", id: "ab_panne" }).einsatzarten.ab_panne)
})

test("Ohne eigenen Betrieb übernimmt der Abschleppdienst aus der Stadt: lange Anfahrt, höchstens 3 Sterne", () => {
  const { e } = einsatz(stand(12), "ab_panne", "kreuzung")
  assert.equal(e.status, "abgeschlossen")
  assert.equal(e.plan.extern, R.EXTERN.werkstatt.name)
  assert.equal(Math.round((e.plan.eintreffen - e.meldung) / MIN), R.EXTERN.werkstatt.anfahrt_min)
  assert.ok(e.bewertung.sterne <= 3)
  assert.ok(e.bewertung.abzuege.some((a) => a.grund === "extern"))
})

test("Mit eigener Werkstatt, Mechaniker und Pannenhilfsfahrzeug geht es schneller und besser", () => {
  let s = stand(12)
  s = kaufe(s, { art: "gebaeude", id: "werkstatt" })
  s = kaufe(s, { art: "personal", id: "werkstatt" })
  assert.match(S.kaufe(s, { art: "personal", id: "werkstatt" }, T0, R).fehler, /Stellen sind besetzt/)
  s = kaufe(s, { art: "fahrzeug", id: "pannenhilfe" })
  const { e } = einsatz(s, "ab_panne", "kreuzung")
  assert.equal(e.status, "abgeschlossen")
  assert.ok(!e.plan.extern)
  assert.ok(e.plan.eintreffen - e.meldung < R.EXTERN.werkstatt.anfahrt_min * MIN)
  assert.ok(e.bewertung.sterne > 3, JSON.stringify(e.bewertung))
})

test("Eine Panne blockiert die Straße: ein Feuerwehreinsatz in der Nähe verliert Zeit", () => {
  let s = stand(12)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  s = kaufe(s, { art: "geraet", id: "oelbinder", anzahl: 2 })
  s = kaufe(s, { art: "geraet", id: "besen_schaufel" })
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = T0 + 1e12
  x.training_naechster = T0 + 1e12
  const panne = S._intern.erzeuge(R, x, "ab_panne", T0, trocken, null, "kreuzung")
  assert.ok(panne.plan.extern)
  const oel = S._intern.erzeuge(R, x, "th_oelspur", T0 + MIN, trocken, null, "kreuzung")
  assert.ok(oel.plan, oel.grund)
  assert.ok(oel.plan.faktoren.some((f) => f.grund === "baustelle" && /Panne/.test(f.text)), JSON.stringify(oel.plan.faktoren))
})

test("Winterdienst: nach dem Streuen gilt bei Glätte der Reibwert für Nässe", () => {
  const { e, stand: s } = einsatz(stand(12), "bh_streuen", "kreuzung", glatt)
  assert.equal(e.status, "abgeschlossen")
  assert.ok(s.gestreut_bis > e.plan.arbeit_ende)
  assert.equal(S._intern.wetterGestreut(s, "glaette", e.plan.arbeit_ende + STD), "nass")
  assert.equal(S._intern.wetterGestreut(s, "glaette", s.gestreut_bis + 1), "glaette")
  assert.equal(S._intern.wetterGestreut(s, "sturm", e.plan.arbeit_ende + STD), "sturm")
})

test("Falschparker: der Abschleppdienst setzt um, danach ist die Zufahrt frei", () => {
  let s = stand(12)
  s = kaufe(s, { art: "personal", id: "polizei" })
  const { alle } = einsatz(s, "p_falschparker", "feuerwehrhaus")
  const umsetzen = alle.find((e) => e.art === "ab_umsetzen")
  assert.ok(umsetzen, "Umsetzen als Folgeeinsatz")
  assert.equal(umsetzen.status, "abgeschlossen")
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit Werkstatt und Bauhof bei Glätte", () => {
  let s = stand(12)
  s = kaufe(s, { art: "einsatzart", id: "ab_panne" })
  s = kaufe(s, { art: "einsatzart", id: "bh_streuen" })
  s = kaufe(s, { art: "gebaeude", id: "bauhof" })
  s = kaufe(s, { art: "personal", id: "bauhof" })
  s = kaufe(s, { art: "geraet", id: "streusalz", anzahl: 8, org: "bauhof" })
  const ende = T0 + 5 * 24 * STD
  const ganz = S.fortschreiben(s, ende, glatt, R)
  let teile = s
  for (let t = T0 + 5 * STD; t < ende; t += 11 * STD) teile = S.fortschreiben(teile, t, glatt, R)
  teile = S.fortschreiben(teile, ende, glatt, R)
  assert.deepEqual(teile, ganz)
  assert.ok(ganz.gestreut_bis > T0)
})
