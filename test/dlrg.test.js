// DLRG-Ortsgruppe (ab Level 24): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 6, 11, 10) // Samstag, 11. Juli, 12 Uhr Ortszeit
const WERKTAG = Date.UTC(2026, 6, 14, 16) // Dienstag, 18 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

function fertig(s) {
  for (const p of s.personal)
    if (p.lehrgang_laeuft) {
      p.lehrgaenge[p.lehrgang_laeuft.id] = T0 - STD
      p.lehrgang_laeuft = null
    }
  return s
}

/** Drei Feuerwehrleute, zwei davon in der DLRG, Wachturm und Rettungsbrett. */
function dorf(level = 24, turm = true) {
  let s = S.neuerStand(R, T0 - 24 * STD, 5)
  s.level = level
  for (const bp of ["bp01", "bp02", "bp03"]) s = kaufe(s, { art: "bauplatz", id: bp })
  const [a, b] = s.personal
  s = fertig(kaufe(s, { art: "mitgliedschaft", id: "dlrg", ziel: a.id }))
  s = fertig(kaufe(s, { art: "mitgliedschaft", id: "dlrg", ziel: b.id }))
  if (turm) s = kaufe(s, { art: "gebaeude", id: "wachstation" })
  s = kaufe(s, { art: "geraet", id: "rettungsbrett", org: "dlrg" })
  s = kaufe(s, { art: "geraet", id: "wurfsack", org: "dlrg" })
  return s
}

function erzeugeAllein(s, art, ort, t) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  return { x, e: S._intern.erzeuge(R, x, art, t, trocken, null, ort) }
}

test("Vor Level 24 gibt es keine DLRG", () => {
  let s = S.neuerStand(R, T0, 5)
  s.level = 23
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  assert.match(S.kaufe(s, { art: "mitgliedschaft", id: "dlrg", ziel: s.personal[0].id }, T0, R).fehler, /Erst ab Level 24/)
  assert.ok(!S._intern.wachdienstAktiv(R, s, T0))
})

test("Rettungsschwimmen braucht Fitness: Bronze ab 40, Silber ab 55", () => {
  let s = S.neuerStand(R, T0, 5)
  s.level = 24
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  const p = s.personal[0]
  p.fitness = 35
  assert.match(S.kaufe(s, { art: "mitgliedschaft", id: "dlrg", ziel: p.id }, T0, R).fehler, /Fitness 40/)
  p.fitness = 50
  s = fertig(kaufe(s, { art: "mitgliedschaft", id: "dlrg", ziel: p.id }))
  assert.match(S.kaufe(s, { art: "lehrgang", id: "rs_silber", ziel: p.id }, T0, R).fehler, /Fitness 55/)
  s.personal[0].fitness = 60
  assert.ok(kaufe(s, { art: "lehrgang", id: "rs_silber", ziel: p.id }))
})

test("Wachdienst am Sommerwochenende: zwei Mitglieder sitzen auf dem Turm und fehlen der Feuerwehr", () => {
  const s = dorf()
  assert.ok(S._intern.wachdienstAktiv(R, s, T0))
  assert.ok(!S._intern.wachdienstAktiv(R, s, WERKTAG))
  const [a, b, c] = s.personal
  assert.ok(S._intern.aufWache(R, s, a, T0) && S._intern.aufWache(R, s, b, T0))
  assert.ok(!S._intern.aufWache(R, s, c, T0))
  assert.ok(!S._intern.einsatzbereitFuer(R, a, "feuerwehr", T0, s))
  assert.ok(S._intern.einsatzbereitFuer(R, a, "dlrg", T0, s))
  assert.ok(S._intern.einsatzbereitFuer(R, a, "feuerwehr", WERKTAG, s))
  // Ohne Wachturm gibt es keinen Wachdienst
  assert.ok(!S._intern.wachdienstAktiv(R, dorf(24, false), T0))
})

test("Badeunfall während des Wachdienstes: Hilfe sofort, Erste Hilfe für den Rettungsdienst", () => {
  const { x, e } = erzeugeAllein(dorf(), "dlrg_badeunfall", "elbe_ufer", T0)
  assert.ok(e.plan && !e.plan.extern, e.grund)
  const ohneWache = erzeugeAllein(dorf(24, false), "dlrg_badeunfall", "elbe_ufer", T0).e
  assert.ok(e.plan.eintreffen < ohneWache.plan.eintreffen, "vom Turm aus schneller")
  const ende = S.fortschreiben(x, T0 + 4 * STD, trocken, R)
  const rd = ende.abgeschlossen.find((y) => y.art === "rd_notarzt")
  assert.ok(rd, "Rettungsdienst kommt dazu")
  assert.equal(rd.erste_hilfe, rd.meldung)
})

test("Person im Eis: ab Level 24 unterstützen Strömungsretter der DLRG", () => {
  let s = dorf(24, false)
  s = kaufe(s, { art: "geraet", id: "rettungsring" })
  s = kaufe(s, { art: "geraet", id: "wathose" })
  for (const p of s.personal) p.lehrgaenge.eisrettung = T0 - STD
  for (const p of s.personal.filter((q) => (q.mitglied || []).includes("dlrg"))) p.lehrgaenge.rs_silber = T0 - STD
  // Ein dritter und vierter Feuerwehrmann, damit die Feuerwehr ohne die DLRG-Leute ausrücken kann
  s = kaufe(s, { art: "bauplatz", id: "bp04" })
  s = kaufe(s, { art: "bauplatz", id: "bp05" })
  const { x, e } = erzeugeAllein(s, "th_eis", "elbe_ufer", WERKTAG)
  assert.ok(e.plan, e.grund)
  const ende = S.fortschreiben(x, WERKTAG + 3 * STD, trocken, R)
  assert.ok(ende.abgeschlossen.concat(ende.laufend).some((y) => y.art === "dlrg_wasserrettung"))
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit Wachdienst", () => {
  let s = dorf()
  s = S.fortschreiben(s, T0, trocken, R)
  s = kaufe(s, { art: "einsatzart", id: "dlrg_badeunfall" })
  const ende = T0 + 3 * 24 * STD
  const ganz = S.fortschreiben(s, ende, trocken, R)
  let teile = s
  for (let t = T0 + 5 * STD; t < ende; t += 7 * STD) teile = S.fortschreiben(teile, t, trocken, R)
  teile = S.fortschreiben(teile, ende, trocken, R)
  assert.deepEqual(teile, ganz)
})
