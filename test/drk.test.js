// DRK-Ortsverein (ab Level 20): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 16) // Dienstag, 18 Uhr Ortszeit (nach Feierabend)
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Lehrgänge (Grundausbildung) sofort abschließen. */
function fertig(s) {
  for (const p of s.personal)
    if (p.lehrgang_laeuft) {
      p.lehrgaenge[p.lehrgang_laeuft.id] = T0
      p.lehrgang_laeuft = null
    }
  return s
}

/** Dorf mit drei Feuerwehrleuten, zwei davon im DRK, und einem PKW Helfer vor Ort. */
function dorf(level = 20) {
  let s = S.neuerStand(R, T0, 11)
  s.level = level
  for (const bp of ["bp01", "bp02", "bp03"]) s = kaufe(s, { art: "bauplatz", id: bp })
  const [a, b] = s.personal
  s = fertig(kaufe(s, { art: "mitgliedschaft", id: "drk", ziel: a.id }))
  s = fertig(kaufe(s, { art: "mitgliedschaft", id: "drk", ziel: b.id }))
  s = kaufe(s, { art: "fahrzeug", id: "hvo_pkw" })
  return s
}

function einsatz(s, art, ort, t = T0 + MIN, dauer = 4 * STD) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  const e = S._intern.erzeuge(R, x, art, t, trocken, null, ort)
  const ende = S.fortschreiben(x, t + dauer, trocken, R)
  return { e: ende.abgeschlossen.find((a) => a.id === e.id), alle: ende.abgeschlossen, roh: e, stand: ende }
}

test("Vor Level 20 gibt es keinen DRK-Ortsverein", () => {
  let s = S.neuerStand(R, T0, 11)
  s.level = 19
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  assert.match(S.kaufe(s, { art: "mitgliedschaft", id: "drk", ziel: s.personal[0].id }, T0, R).fehler, /Erst ab Level 20/)
  s = S.fortschreiben(s, T0 + MIN, trocken, R)
  assert.ok(!s.freigeschaltet.includes("drk_hvo"))
})

test("Feuerwehrleute treten ins DRK ein (zwei Organisationen, nicht mehr)", () => {
  const s = dorf()
  const p = s.personal.find((x) => (x.mitglied || []).includes("drk"))
  assert.equal(p.lehrgaenge.sanitaetshelfer, T0)
  assert.match(S.kaufe(s, { art: "mitgliedschaft", id: "drk", ziel: p.id }, T0, R).fehler, /Schon Mitglied/)
})

test("Helfer vor Ort: von der Unterkunft im Gemeindehaus, danach Rettungsdienst mit Erster Hilfe", () => {
  const s = S.fortschreiben(dorf(), T0, trocken, R)
  assert.ok(s.freigeschaltet.includes("drk_hvo"))
  assert.deepEqual(S._intern.standortVon(R, s, "drk"), R.ORTE.bibliothek)
  const { e, alle } = einsatz(s, "drk_hvo", "marktplatz")
  assert.equal(e.status, "abgeschlossen")
  assert.ok(!e.plan.extern)
  const rd = alle.find((x) => x.art === "rd_versorgung")
  assert.ok(rd, "Rettungsdienst kommt dazu")
  assert.deepEqual(rd.patient.hilfen, ["Erste Hilfe vor Ort"])
})

test("Paralleler Alarm: der Helfer vor Ort ist vor dem RTW da, dem Patienten geht es besser", () => {
  const ohne = einsatz(dorf(), "rd_sturz", "marktplatz").e
  const s = kaufe(dorf(), { art: "ausbau", id: "hvo_parallel" })
  const mit = einsatz(s, "rd_sturz", "marktplatz")
  assert.ok(mit.alle.some((x) => x.art === "drk_hvo_parallel"), "Helfer vor Ort alarmiert")
  assert.ok(mit.e.patient.minuten < ohne.patient.minuten, `${mit.e.patient.minuten} < ${ohne.patient.minuten}`)
})

test("Sanitätswachdienst: Notfälle auf dem Festplatz werden sofort versorgt", () => {
  let s = dorf()
  s = kaufe(s, { art: "geraet", id: "notfallrucksack", org: "drk" })
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = T0 + 1e12
  x.training_naechster = T0 + 1e12
  const wache = S._intern.erzeuge(R, x, "drk_sanwache", T0, trocken, null, "festplatz")
  assert.ok(wache.plan, wache.grund)
  const notfall = S._intern.erzeuge(R, x, "rd_hitze", wache.plan.eintreffen + 30 * MIN, trocken, null, "festplatz")
  assert.equal(notfall.erste_hilfe, notfall.meldung)
})

test("Verpflegung durch das DRK: lange Einsätze gehen danach schneller", () => {
  const RL = JSON.parse(JSON.stringify(R))
  RL.EINSATZARTEN.test_lang = { org: "feuerwehr", name: "Langer Einsatz", stichwort: "TH", preis: 0, orte: ["kreuzung"], intervall_min: 1e9, ablauf_min: 60, arbeit_min: 300, ziel_eintreffen_min: 30, mindestens: { personen: 1 } }
  let s = S.neuerStand(RL, T0, 11)
  s.level = 20
  for (const bp of ["bp01", "bp02"]) {
    const r = S.kaufe(s, { art: "bauplatz", id: bp }, T0, RL)
    s = r.stand
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(RL, s, b, T0)
  }
  const plan = (st) => S._intern.plane(RL, st, { id: "x", art: "test_lang", ort: "kreuzung", meldung: T0, wetter: "trocken" }, T0, trocken).plan
  const ohne = plan(s)
  // Eine Polizistin aus dem Dorf kocht für das DRK: Feldkoch, MTW und Feldküche
  const koch = s.personal[1]
  koch.org = "polizei"
  koch.mitglied = ["drk"]
  koch.lehrgaenge.sanitaetshelfer = T0
  koch.lehrgaenge.verpflegungshelfer = T0
  {
    const r = S.kaufe(s, { art: "gebaeude", id: "drk_unterkunft" }, T0, RL)
    assert.ok(!r.fehler, r.fehler)
    s = r.stand
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(RL, s, b, T0)
  }
  for (const typ of ["mtw_drk", "feldkueche"]) {
    const r = S.kaufe(s, { art: "fahrzeug", id: typ }, T0, RL)
    assert.ok(!r.fehler, r.fehler)
    s = r.stand
  }
  const mit = plan(s)
  assert.ok(mit.faktoren.some((f) => f.grund === "verpflegung"))
  assert.ok(mit.arbeit_ende < ohne.arbeit_ende)
})

test("Wer im DRK und in der Feuerwehr ist, rückt nie zu zwei Einsätzen zugleich aus", () => {
  let s = dorf()
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = T0 + 1e12
  x.training_naechster = T0 + 1e12
  const hvo = S._intern.erzeuge(R, x, "drk_hvo", T0, trocken, null, "marktplatz")
  const katze = S._intern.erzeuge(R, x, "tier_katze", T0 + MIN, trocken, null, "baum_markt")
  const a = hvo.plan.personen.map((p) => p.id)
  const b = katze.plan ? katze.plan.personen.map((p) => p.id) : []
  assert.ok(!a.some((id) => b.includes(id)))
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit DRK", () => {
  let s = dorf()
  s = S.fortschreiben(s, T0, trocken, R)
  s = kaufe(s, { art: "einsatzart", id: "drk_hvo" })
  s = kaufe(s, { art: "ausbau", id: "hvo_parallel" })
  const ende = T0 + 4 * 24 * STD
  const ganz = S.fortschreiben(s, ende, trocken, R)
  let teile = s
  for (let t = T0 + 5 * STD; t < ende; t += 9 * STD) teile = S.fortschreiben(teile, t, trocken, R)
  teile = S.fortschreiben(teile, ende, trocken, R)
  assert.deepEqual(teile, ganz)
  assert.ok(ganz.abgeschlossen.some((e) => e.art === "drk_hvo"))
})
