// Rettungsdienst (ab Level 16): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const NACHT = Date.UTC(2026, 9, 13, 22) // Mittwoch, 0 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

function stand(level = 16) {
  const s = S.neuerStand(R, T0, 7)
  s.level = level
  return s
}

/** Eigene Rettungswache (Stufe 2, rund um die Uhr) mit RTW und zwei Kräften. */
function wache(level = 16, mitNfs = true) {
  let s = stand(level)
  s = kaufe(s, { art: "gebaeude", id: "rettungswache" })
  s = kaufe(s, { art: "gebaeude", id: "rettungswache" })
  s = kaufe(s, { art: "personal", id: mitNfs ? "notfallsanitaeter" : "rettungssanitaeter" })
  s = kaufe(s, { art: "personal", id: "rettungssanitaeter" })
  s = kaufe(s, { art: "fahrzeug", id: "rtw" })
  s = kaufe(s, { art: "geraet", id: "defi_monitor", org: "rettungsdienst" })
  // Defi ins Fahrzeug
  const rtw = s.fahrzeuge.find((f) => f.typ === "rtw")
  rtw.beladung.defi_monitor = 1
  s.lager.rettungsdienst.defi_monitor = 0
  return s
}

/** Einsatz auslösen und bis zum Ende fortschreiben; keine anderen Meldungen. */
function einsatz(s, art, ort, t = T0 + MIN, dauer = 4 * STD) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  const e = S._intern.erzeuge(R, x, art, t, trocken, null, ort)
  const fertig = S.fortschreiben(x, t + dauer, trocken, R)
  return { e: fertig.abgeschlossen.find((a) => a.id === e.id), stand: fertig, alle: fertig.abgeschlossen, roh: e }
}

test("Vor Level 16 gibt es keinen Rettungsdienst: Verkehrsunfall läuft wie bisher", () => {
  let s = stand(15)
  s = S.fortschreiben(s, T0 + MIN, trocken, R)
  assert.ok(!s.freigeschaltet.includes("rd_krankentransport"))
  assert.match(S.kaufe(s, { art: "gebaeude", id: "rettungswache" }, T0, R).fehler, /Erst ab Level 16/)
  assert.match(S.kaufe(s, { art: "ausbau", id: "notrufabfrage" }, T0, R).fehler, /Erst ab Level 16/)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  s = kaufe(s, { art: "geraet", id: "tueroeffnung" })
  const { alle } = einsatz(s, "th_tuer", "schule")
  assert.ok(!alle.some((e) => R.EINSATZARTEN[e.art].org === "rettungsdienst"))
})

test("Ab Level 16 ohne eigene Wache: RTW der Nachbarwache mit 14 Minuten, höchstens 3 Sterne", () => {
  const s = S.fortschreiben(stand(16), T0 + MIN, trocken, R)
  assert.ok(s.freigeschaltet.includes("rd_krankentransport"))
  const { e } = einsatz(s, "rd_sturz", "marktplatz")
  assert.equal(e.status, "abgeschlossen")
  assert.equal(e.plan.extern, R.EXTERN.rettungsdienst.name)
  assert.ok(e.bewertung.sterne <= 3)
  assert.ok(e.patient && e.patient.text)
})

test("Eigene Wache: RTW in der Hilfsfrist, Transport bindet das Fahrzeug, der zweite Notfall bekommt die Nachbarwache", () => {
  const s = wache()
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = T0 + 1e12
  x.training_naechster = T0 + 1e12
  const erster = S._intern.erzeuge(R, x, "rd_sturz", T0, trocken, null, "marktplatz")
  assert.ok(!erster.plan.extern)
  assert.ok((erster.plan.eintreffen - erster.meldung) / MIN <= R.RETTUNG.hilfsfrist_min, "in der Hilfsfrist")
  assert.ok(erster.plan.transport, "mit Transport")
  assert.ok(erster.plan.einsatzbereit - erster.plan.arbeit_ende >= (2 * R.RETTUNG.transport_min + R.RETTUNG.uebergabe_min) * MIN)
  const zweiter = S._intern.erzeuge(R, x, "rd_atemnot", erster.plan.arbeit_ende + 5 * MIN, trocken, null, "schule")
  assert.equal(zweiter.plan.extern, R.EXTERN.rettungsdienst.name)
  const fertig = S.fortschreiben(x, T0 + 5 * STD, trocken, R)
  assert.equal(fertig.hilfsfrist.length, 2)
  assert.deepEqual(fertig.hilfsfrist.map((h) => h.ok), [true, false])
})

test("Stufe 1 am Feuerwehrhaus ist nur tagsüber besetzt, nachts kommt die Nachbarwache", () => {
  let s = stand(16)
  s = kaufe(s, { art: "gebaeude", id: "rettungswache" })
  s = kaufe(s, { art: "personal", id: "rettungssanitaeter" })
  s = kaufe(s, { art: "personal", id: "rettungssanitaeter" })
  s = kaufe(s, { art: "fahrzeug", id: "rtw" })
  assert.deepEqual(S._intern.standortVon(R, s, "rettungsdienst"), R.ORTE.feuerwehrhaus)
  const tag = einsatz(s, "rd_sturz", "marktplatz").e
  assert.ok(!tag.plan.extern)
  const nacht = einsatz(s, "rd_sturz", "marktplatz", NACHT).e
  assert.equal(nacht.plan.extern, R.EXTERN.rettungsdienst.name)
})

test("Reanimation: Telefonreanimation und Defibrillator in der Nähe verbessern das Ergebnis", () => {
  const ohne = einsatz(wache(), "rd_reanimation", "marktplatz").e
  let s = wache()
  s = kaufe(s, { art: "ausbau", id: "telefonreanimation" })
  s = kaufe(s, { art: "ausbau", id: "aed_markt" })
  const mit = einsatz(s, "rd_reanimation", "marktplatz").e
  assert.equal(ohne.status, "abgeschlossen")
  assert.ok(mit.patient.minuten < ohne.patient.minuten, `${mit.patient.minuten} < ${ohne.patient.minuten}`)
  assert.deepEqual(mit.patient.hilfen, ["Telefonreanimation", "Defibrillator in der Nähe"])
  assert.ok(S._intern.aedInDerNaehe(R, s, R.ORTE.marktplatz))
  assert.ok(!S._intern.aedInDerNaehe(R, s, R.ORTE.scheune))
})

test("Notarzt: tagsüber der Hubschrauber, nachts aus der Stadt, mit NEF und Notarztvertrag aus dem Dorf", () => {
  const tag = einsatz(wache(), "rd_brustschmerz", "marktplatz").e
  assert.equal(tag.plan.notarzt.quelle, "rth")
  const nacht = einsatz(wache(), "rd_brustschmerz", "marktplatz", NACHT).e
  assert.equal(nacht.plan.notarzt.quelle, "stadt")
  assert.ok(nacht.bewertung.abzuege.some((a) => a.grund === "notarzt"))
  let s = wache()
  s = kaufe(s, { art: "personal", id: "rettungssanitaeter" })
  s = kaufe(s, { art: "fahrzeug", id: "nef" })
  s = kaufe(s, { art: "ausbau", id: "notarztvertrag" })
  const eigen = einsatz(s, "rd_brustschmerz", "marktplatz", NACHT).e
  assert.equal(eigen.plan.notarzt.quelle, "nef")
  assert.equal(eigen.plan.fahrzeuge.length, 2, "RTW und NEF")
  assert.ok(!eigen.bewertung.abzuege.some((a) => a.grund === "notarzt"))
})

test("Ohne Notfallsanitäter im RTW gibt es einen Abzug (§ 10 NRettDG)", () => {
  const e = einsatz(wache(16, false), "rd_sturz", "marktplatz").e
  assert.ok(e.bewertung.abzuege.some((a) => a.grund === "besetzung"))
  const mit = einsatz(wache(16, true), "rd_sturz", "marktplatz").e
  assert.ok(!mit.bewertung.abzuege.some((a) => a.grund === "besetzung"))
})

test("Rettungsdienst-Teil bei der Türöffnung: nachgefordert beim Eintreffen, mit Notrufabfrage gleich alarmiert", () => {
  let s = wache()
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  s = kaufe(s, { art: "geraet", id: "tueroeffnung" })
  const nach = einsatz(s, "th_tuer", "schule")
  const rd1 = nach.alle.find((e) => e.art === "rd_versorgung")
  assert.ok(rd1, "Rettungsdienst-Teil entsteht")
  assert.equal(rd1.meldung, nach.roh.plan.eintreffen)
  s = kaufe(s, { art: "ausbau", id: "notrufabfrage" })
  const sofort = einsatz(s, "th_tuer", "schule")
  const rd2 = sofort.alle.find((e) => e.art === "rd_versorgung")
  assert.equal(rd2.meldung, sofort.roh.meldung)
  assert.equal(sofort.alle.filter((e) => e.art === "rd_versorgung").length, 1, "nicht doppelt")
  assert.ok(rd2.patient.minuten <= rd1.patient.minuten)
})

test("Rettungsdienstler wohnen im Dorf, zählen zu den Stellen und können in die Feuerwehr", () => {
  let s = wache()
  s = kaufe(s, { art: "personal", id: "rettungssanitaeter" })
  s = kaufe(s, { art: "personal", id: "rettungssanitaeter" })
  assert.match(S.kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "rettungsdienst" } }, T0, R).fehler, /Stellen besetzt/)
  s = kaufe(s, { art: "gebaeude", id: "rettungswache" })
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "rettungsdienst" } })
  const p = s.personal.find((x) => x.org === "rettungsdienst" && x.haus)
  assert.equal(p.beruf, "rettungswache")
  assert.ok(p.lehrgaenge.rs !== undefined)
  s = kaufe(s, { art: "mitgliedschaft", id: "feuerwehr", ziel: p.id })
  assert.ok(s.personal.find((x) => x.id === p.id).mitglied.includes("feuerwehr"))
})

test("Notfallsanitäter ausbilden geht nur an der Lehrrettungswache, die erst ab Level 27 kommt", () => {
  let s = wache(27)
  const p = s.personal.find((x) => x.org === "rettungsdienst" && !x.lehrgaenge.nfs)
  assert.match(S.kaufe(s, { art: "lehrgang", id: "nfs", ziel: p.id }, T0, R).fehler, /Lehrrettungswache/)
  s = kaufe(s, { art: "gebaeude", id: "rettungswache" })
  s = kaufe(s, { art: "gebaeude", id: "rettungswache" })
  assert.ok(kaufe(s, { art: "lehrgang", id: "nfs", ziel: p.id }))
  const frueh = kaufe(wache(26), { art: "gebaeude", id: "rettungswache" })
  assert.match(S.kaufe(frueh, { art: "gebaeude", id: "rettungswache" }, T0, R).fehler, /Erst ab Level 27/)
})

test("Sportverletzung erst mit Sportplatz Stufe 3", () => {
  const s = wache()
  s.freigeschaltet.push("rd_sportverletzung")
  assert.match(S.kaufe(s, { art: "einsatzart", id: "rd_sportverletzung" }, T0, R).fehler, /braucht es/)
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit Rettungsdienst", () => {
  let s = wache()
  s = kaufe(s, { art: "einsatzart", id: "rd_krankentransport" })
  s.freigeschaltet.push("rd_sturz")
  s = kaufe(s, { art: "einsatzart", id: "rd_sturz" })
  s.level = R.FAHRZEUGE.ktw.ab_level
  s = kaufe(s, { art: "fahrzeug", id: "ktw" })
  const ende = T0 + 4 * 24 * STD
  const ganz = S.fortschreiben(s, ende, trocken, R)
  let teile = s
  for (let t = T0 + 7 * STD; t < ende; t += 13 * STD) teile = S.fortschreiben(teile, t, trocken, R)
  teile = S.fortschreiben(teile, ende, trocken, R)
  assert.deepEqual(teile, ganz)
  assert.ok(ganz.abgeschlossen.some((e) => e.art === "rd_krankentransport"))
  // Niemand ist in zwei Einsätzen zugleich
  const belegt = {}
  for (const e of ganz.abgeschlossen.filter((x) => x.plan && x.plan.eintreffen)) {
    for (const id of e.plan.fahrzeuge) {
      for (const [von, bis] of belegt[id] || []) assert.ok(e.plan.alarm >= bis || e.plan.einsatzbereit <= von, `${id} doppelt`)
      belegt[id] = (belegt[id] || []).concat([[e.plan.alarm, e.plan.einsatzbereit]])
    }
  }
})
