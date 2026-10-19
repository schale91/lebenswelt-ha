// Müllabfuhr nach dem Abfallkalender: Termine, Tonnen, Müllautos, Deponie, XP, Brand: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")
const M = require("../lebenswelt/pb_hooks/einsatz/muell.js")

const MIN = 60000
const STD = 60 * MIN
const TAG = "2026-10-29" // Donnerstag, Biotonne
const ZT = (stunde, minute = 0, tag = TAG) => M.ortsZeit(tag, stunde, minute)

function kaufe(s, auftrag, t) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Dorf mit drei Wohnhäusern (Feuerwehr) und dem Zuhause. */
function dorf() {
  const t = ZT(8, 0, "2026-10-27")
  let s = S.neuerStand(R, t, 11)
  for (const id of ["bp01", "bp02", "bp03"]) s = kaufe(s, { art: "bauplatz", id }, t)
  s.bis = t
  return s
}

const termine = [{ tag: TAG, art: "bio", name: "Biotonne" }]

test("Termine aus dem Abfallkalender: Arten erkannt, Hausmüll 14-täglich und 4-wöchentlich sind eine Abfuhr", () => {
  const ereignisse = [
    { summary: "Hausmüll 14-täglich", start: { date: "2026-10-22" } },
    { summary: "Hausmüll 4-wöchentlich", start: { date: "2026-10-22" } },
    { summary: "Biotonne", start: { date: "2026-10-29" } },
    { summary: "Gelbe Tonne", start: { date: "2026-11-02" } },
    { summary: "Altpapier", start: { dateTime: "2026-11-09T06:00:00+01:00" } },
    { summary: "Grünabfall", start: { date: "2026-11-13" } },
    { summary: "Sperrmüll für den 26. rausstellen", start: { date: "2026-10-25" } },
  ]
  const t = M.termineAus(R, ereignisse)
  assert.deepEqual(
    t.map((x) => x.tag + " " + x.art),
    ["2026-10-22 restmuell", "2026-10-29 bio", "2026-11-02 gelb", "2026-11-09 papier", "2026-11-13 gruen"],
  )
})

test("Ortszeit: Vorabend 16 Uhr, Abfuhr 7 Uhr plus Versatz, auch über die Zeitumstellung", () => {
  assert.equal(new Date(ZT(7)).toISOString(), "2026-10-29T06:00:00.000Z") // MEZ
  assert.equal(new Date(M.ortsZeit("2026-10-24", 16)).toISOString(), "2026-10-24T14:00:00.000Z") // MESZ
  const s = M.fortschreiben(R, dorf(), termine, ZT(10, 0, "2026-10-27"))
  const T = s.muell.termine[TAG + ":bio"]
  assert.equal(T.vorabend, ZT(16, 0, "2026-10-28"))
  assert.equal(T.abfuhr_ab, ZT(7, R.ABFALL.arten.bio.versatz_min))
})

test("Vorabend: Einwohner stellen ihre Tonne raus (fest je Haus), deine bleibt bei dir", () => {
  let s = M.fortschreiben(R, dorf(), termine, ZT(16, 30, "2026-10-28"))
  const T = s.muell.termine[TAG + ":bio"]
  const raus = Object.entries(T.raus)
  assert.ok(raus.length >= 2, "Einwohner mit Tonne: " + raus.length)
  for (const [, r] of raus) {
    assert.equal(r.art, "bio")
    assert.ok(r.t >= ZT(17, 0, "2026-10-28") && r.t <= ZT(22, 0, "2026-10-28"))
  }
  assert.equal(T.raus[M.ZUHAUSE], undefined)
  // Zweimal gerechnet ergibt dasselbe
  const s2 = M.fortschreiben(R, s, termine, ZT(17, 0, "2026-10-28"))
  assert.deepEqual(s2.muell.termine[TAG + ":bio"].raus, T.raus)
})

test("Deine Tonne: falsche Farbe wird gemeldet und nicht geleert, die richtige gibt XP und zählt für die Serie", () => {
  let s = M.fortschreiben(R, dorf(), termine, ZT(18, 0, "2026-10-28"))
  const falsch = M.tonne(R, s, { art: "papier" }, ZT(18, 5, "2026-10-28"))
  assert.equal(falsch.richtig, false)
  assert.match(falsch.text, /Biotonne/)
  // Abfuhr mit falscher Tonne: nichts geleert, Serie 0
  let f = M.fortschreiben(R, falsch.stand, termine, ZT(9))
  assert.equal(f.muell.termine[TAG + ":bio"].ergebnis, "falsch")
  assert.equal(f.muell.termine[TAG + ":bio"].xp, 0)

  const richtig = M.tonne(R, falsch.stand, { art: "bio" }, ZT(18, 10, "2026-10-28"))
  assert.equal(richtig.richtig, true)
  // Die falsche Tonne kam zurück, die richtige steht draußen
  assert.equal(richtig.stand.muell.termine[TAG + ":bio"].raus[M.ZUHAUSE].art, "bio")
  s = M.fortschreiben(R, richtig.stand, termine, ZT(9))
  const T = s.muell.termine[TAG + ":bio"]
  assert.equal(T.ergebnis, "richtig")
  assert.equal(T.xp, R.ABFALL.xp.richtig)
  assert.equal(s.muell.serie, 1)
  assert.ok(T.abfuhr.halte.some((h) => h.haus === M.ZUHAUSE))
  // XP einmal abholen
  const a = M.abholen(s, T.id)
  assert.equal(a.xp, R.ABFALL.xp.richtig)
  assert.equal(M.abholen(a.stand, T.id).xp, 0)
})

test("Ohne Termin am Abend gibt es nichts rauszustellen; reinholen nach der Abfuhr", () => {
  const s = M.fortschreiben(R, dorf(), termine, ZT(12, 0, "2026-10-28"))
  const r = M.tonne(R, s, { art: "bio" }, ZT(12, 0, "2026-10-28"))
  assert.match(r.fehler, /keine Müllabfuhr/)
  let a = M.fortschreiben(R, s, termine, ZT(18, 0, "2026-10-28"))
  a = M.tonne(R, a, { art: "bio" }, ZT(18, 1, "2026-10-28")).stand
  a = M.fortschreiben(R, a, termine, ZT(11))
  const rein = M.tonne(R, a, { art: "bio", rein: true }, ZT(12))
  assert.equal(rein.richtig, true)
  assert.equal(rein.stand.muell.termine[TAG + ":bio"].rein[M.ZUHAUSE], ZT(12))
})

test("Serie: ab der fünften richtigen Abfuhr gibt es den Bonus, eine verpasste setzt zurück", () => {
  const tage = ["2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26", "2026-12-03", "2026-12-10"]
  const t = tage.map((tag) => ({ tag, art: "bio", name: "Biotonne" }))
  let s = dorf()
  for (const tag of tage.slice(0, 5)) {
    const vor = new Date(Date.parse(tag + "T12:00:00Z") - 24 * STD).toISOString().slice(0, 10)
    s = M.fortschreiben(R, s, t, M.ortsZeit(vor, 18))
    s = M.tonne(R, s, { art: "bio" }, M.ortsZeit(vor, 18, 1)).stand
    s = M.fortschreiben(R, s, t, M.ortsZeit(tag, 10))
  }
  assert.equal(s.muell.serie, 5)
  assert.equal(s.muell.termine["2026-12-03:bio"].xp, R.ABFALL.xp.richtig + 15)
  s = M.fortschreiben(R, s, t, M.ortsZeit("2026-12-10", 10))
  assert.equal(s.muell.serie, 0)
  assert.equal(s.muell.serie_best, 5)
})

test("Müllauto: fährt von Haus zu Haus, hält je Tonne, ohne Deponie aus der Stadt, mit Wertstoffhof dorthin", () => {
  const papier = [{ tag: TAG, art: "papier", name: "Altpapier" }]
  let s = M.fortschreiben(R, dorf(), papier, ZT(22, 30, "2026-10-28"))
  s = M.fortschreiben(R, s, papier, ZT(9))
  let plan = s.muell.termine[TAG + ":papier"].abfuhr
  assert.equal(plan.ziel, "ortseingang")
  assert.ok(plan.halte.length >= 2)
  for (let i = 1; i < plan.halte.length; i++) assert.ok(plan.halte[i].an >= plan.halte[i - 1].ab)
  assert.equal(plan.halte[0].ab - plan.halte[0].an, R.ABFALL.halt_s * 1000)
  // Mitten im Halt steht das Auto am Haus und ist ein Hindernis auf dem Weg
  const h = plan.halte[0]
  const t = h.an + 5000
  assert.deepEqual(S.muellautoPunkt(plan, t), { x: h.x, z: h.z })
  assert.deepEqual(S._intern.sperrungenAmWeg(R, s, [{ x: h.x, z: h.z }], t).map((x) => x.name), ["Müllauto"])
  assert.equal(S.muellautoPunkt(plan, plan.ende + 1), null)

  // Mit Wertstoffhof (Deponie Stufe 1) lädt das Papier-Auto dort ab, der Haufen wächst
  let d = dorf()
  d.gebaeude.deponie = 1
  d = M.fortschreiben(R, d, papier, ZT(22, 30, "2026-10-28"))
  d = M.fortschreiben(R, d, papier, ZT(9))
  plan = d.muell.termine[TAG + ":papier"].abfuhr
  assert.equal(plan.ziel, "deponie")
  assert.equal(d.muell.deponie.papier, plan.geleert)
  // Bio nimmt erst der Kompostplatz
  let b = dorf()
  b.gebaeude.deponie = 1
  b = M.fortschreiben(R, M.fortschreiben(R, b, termine, ZT(22, 30, "2026-10-28")), termine, ZT(9))
  assert.equal(b.muell.termine[TAG + ":bio"].abfuhr.ziel, "ortseingang")
})

test("Nachbarschaftshilfe erst nach 22 Uhr und nur, wo die Tonne vergessen wurde", () => {
  // Haus, dessen Einwohner vergisst: Anteil auf 1 setzen
  const R2 = Object.assign({}, R, { ABFALL: Object.assign({}, R.ABFALL, { vergessen: 1 }) })
  let s = M.fortschreiben(R2, dorf(), termine, ZT(18, 0, "2026-10-28"))
  const haus = s.haeuser[0].id
  assert.match(M.tonne(R2, s, { haus, art: "bio" }, ZT(19, 0, "2026-10-28")).fehler, /selbst raus/)
  const r = M.tonne(R2, s, { haus, art: "bio" }, ZT(22, 30, "2026-10-28"))
  assert.equal(r.richtig, true)
  s = M.fortschreiben(R2, r.stand, termine, ZT(9))
  assert.equal(s.muell.termine[TAG + ":bio"].xp, R.ABFALL.xp.nachbar)
})

test("Brand im Müllfahrzeug: angemeldet an der Haltestelle, die Simulation alarmiert dort", () => {
  const R2 = Object.assign({}, R, { ABFALL: Object.assign({}, R.ABFALL, { brand_anteil: 1 }) })
  let s = dorf()
  s.einsatzarten.b_muellfahrzeug = { gekauft: 0, naechster: Infinity, nr: 0, anzahl: 0, erfolgreich: 0, beste_sterne: 0 }
  s.einsatzarten.b_muellfahrzeug.naechster = ZT(23, 0, "2026-12-31")
  s = M.fortschreiben(R2, s, termine, ZT(22, 30, "2026-10-28"))
  s.bis = ZT(22, 30, "2026-10-28")
  s = M.fortschreiben(R2, s, termine, ZT(7, 21))
  assert.equal(s.angemeldet.length, 1)
  const a = s.angemeldet[0]
  s = S.fortschreiben(s, a.t + MIN, () => "trocken", R)
  const e = s.laufend.concat(s.abgeschlossen).find((x) => x.art === "b_muellfahrzeug")
  assert.ok(e, "Einsatz entstanden")
  assert.equal(e.ort, "punkt:" + a.x + ":" + a.z)
  assert.deepEqual(S._intern.punktVon(R, s, e.ort), { x: a.x, z: a.z })
  assert.equal(S.ortName(R, e.ort), "auf der Straße")
  assert.equal(s.angemeldet.length, 0)
})

test("Brand im Müllfahrzeug kommt nie nach Intervall, nur angemeldet", () => {
  let s = dorf()
  s.einsatzarten.b_muellfahrzeug = { gekauft: 0, naechster: s.bis + MIN, nr: 0, anzahl: 0, erfolgreich: 0, beste_sterne: 0 }
  s = S.fortschreiben(s, s.bis + 10 * MIN, () => "trocken", R)
  assert.equal(s.laufend.filter((e) => e.art === "b_muellfahrzeug").length, 0)
})

test("Deponie im Store: Stufen mit Level, Arbeitgeber ab Stufe 1, Einsätze brauchen das Gebäude", () => {
  let s = dorf()
  s.level = 2
  assert.match(S.kaufe(s, { art: "gebaeude", id: "deponie" }, s.bis, R).fehler, /Level 3/)
  s.level = 3
  const k = S.kaufe(s, { art: "gebaeude", id: "deponie" }, s.bis, R)
  assert.ok(!k.fehler, k.fehler)
  assert.equal(k.stand.baustellen[0].ziel, "deponie")
  assert.equal(R.ARBEITGEBER.deponie.gebaeude, "deponie")
  s.freigeschaltet.push("b_wertstoffhof")
  assert.match(S.kaufe(s, { art: "einsatzart", id: "b_wertstoffhof" }, s.bis, R).fehler, /Wertstoffhof/)
})

test("Erinnerung am Vorabend ab 18 Uhr, nur wenn deine Tonne noch nicht draußen steht", () => {
  let s = M.fortschreiben(R, dorf(), termine, ZT(17, 0, "2026-10-28"))
  assert.equal(M.erinnerungFaellig(R, s, ZT(17, 30, "2026-10-28")), null)
  assert.equal(M.erinnerungFaellig(R, s, ZT(18, 5, "2026-10-28")).id, TAG + ":bio")
  s = M.tonne(R, s, { art: "bio" }, ZT(18, 6, "2026-10-28")).stand
  assert.equal(M.erinnerungFaellig(R, s, ZT(18, 10, "2026-10-28")), null)
})
