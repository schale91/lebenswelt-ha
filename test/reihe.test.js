// Freischaltreihe (Wunsch vom 17.11.2026): feste Reihenfolge, Gebäude als Hürden, kein Level mehr: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")
const A = require("../lebenswelt/pb_hooks/einsatz/ablauf.js")
const { vorspulen, schritt } = require("./reihe_hilfe.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"
const L = R.FREISCHALTREIHE
const I = S._intern
const pos = (id) => L.findIndex((x) => x.id === id)
/** Dienst eines Schritts für die Abwechslung: Organisation, bei Gebäuden ohne Organisation "gemeinde" */
const dienst = (x) => (x.bau ? x.org || "gemeinde" : x.org)

/** Einsatzarten, die man kauft bzw. die über die Reihe kommen (ohne Baustellen- und Folgeeinsätze) */
const reiheArten = Object.entries(R.EINSATZARTEN)
  .filter(([, a]) => !a.folge_nur && !a.baustelle)
  .map(([id]) => id)

/** Ein Tag mit lauter 5-Sterne-Einsätzen am Tag von t, dann bis kurz nach Mitternacht fortschreiben (ohne echte Einsätze). */
function fuenfSterneTag(s, wetter = trocken) {
  for (const a of Object.values(s.einsatzarten)) a.naechster = s.bis + 1e13
  s.training_naechster = s.bis + 1e13
  s.tage = s.tage || {}
  const tag = I.tagVon(s.bis + 1)
  s.tage[tag] = { anzahl: 2, sterne: 10, erfolgreich: 2, fuenf: 2, arten: ["tier_katze"], abgerechnet: false }
  const neu = S.fortschreiben(s, I.tagesende(tag) + MIN, wetter, R)
  return { s: neu, tag: neu.tage[tag] }
}

function kaufe(s, auftrag, t) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  return r.stand
}

test("Reihe: jede Einsatzart, die über die Reihe kommt, steht genau einmal drin, Meilensteine sind echte Gebäudestufen", () => {
  const arten = L.filter((x) => x.art).map((x) => x.art)
  assert.equal(new Set(arten).size, arten.length, "keine doppelt")
  assert.deepEqual([...arten].sort(), [...reiheArten].sort(), "alle und nur diese")
  for (const x of L.filter((y) => y.bau)) {
    assert.ok(R.GEBAEUDE[x.bau] && R.GEBAEUDE[x.bau][x.stufe], x.id)
    assert.equal(x.name, R.GEBAEUDE[x.bau][x.stufe].name)
  }
  assert.deepEqual(L.map((x) => x.nr), L.map((_, i) => i + 1))
  assert.deepEqual([L[0].art, L[1].art], ["tier_katze", "p_ruhestoerung"], "Start bleibt Katze und Ruhestörung")
})

test("Reihe: Vorgänger vor Nachfolger, Meilenstein vor seiner Organisation und vor Gebäude-Voraussetzungen", () => {
  for (const x of L.filter((y) => y.art)) {
    const a = R.EINSATZARTEN[x.art]
    if (a.freischaltung) assert.ok(pos(a.freischaltung.nach) < pos(x.id), x.art + " nach " + a.freischaltung.nach)
    const o = R.ORGANISATIONEN[a.org]
    if (o && o.ab_level) assert.ok(pos("bau:" + o.gebaeude + ":1") < pos(x.id), x.art + " nach dem Gebäude der Organisation")
    for (const [g, st] of Object.entries(a.braucht_gebaeude || {})) {
      const m = L.findIndex((y) => y.bau === g && y.stufe >= st)
      assert.ok(m >= 0 && m < pos(x.id), x.art + " braucht " + g + " " + st)
    }
  }
  // Jede Organisation mit eigenem Gebäude hat genau einen Meilenstein
  for (const [org, o] of Object.entries(R.ORGANISATIONEN)) if (o.ab_level) assert.equal(L.filter((y) => y.bau === o.gebaeude && y.org === org).length, 1, org)
})

test("Reihe: logisch, Wasser nach der DLRG, Sport nach dem Sportplatz, einfache Einsätze vor schweren", () => {
  const dlrg = pos("bau:wachstation:1")
  for (const id of ["th_eis", "th_person_wasser", "th_deich"]) assert.ok(pos(id) > dlrg, id)
  const sport = L.findIndex((y) => y.bau === "sportplatz")
  for (const id of ["rd_sportverletzung", "fr_reanimation_sport", "drk_sanwache_sport"]) assert.ok(pos(id) > sport, id)
  assert.ok(pos("th_deich") > pos("bau:thw_unterkunft:1"), "Deichverteidigung mit THW-Pumpen")
  // Innerhalb einer Organisation steigt der alte Preis im Mittel: die erste Hälfte ist günstiger als die zweite
  for (const org of ["feuerwehr", "polizei", "rettungsdienst"]) {
    const p = L.filter((y) => y.art && !y.grosslage && y.org === org).map((y) => R.EINSATZARTEN[y.art].preis)
    const h = Math.floor(p.length / 2)
    const mittel = (l) => l.reduce((n, v) => n + v, 0) / l.length
    assert.ok(mittel(p.slice(0, h)) < mittel(p.slice(h)), org)
  }
})

test("Reihe: abwechslungsreich, nie mehr als zwei gleiche Dienste hintereinander, Großlagen zuletzt", () => {
  const erste = L.findIndex((y) => y.grosslage)
  assert.ok(erste > 0)
  assert.ok(L.slice(erste).every((y) => y.grosslage), "nach der ersten Großlage nur noch Großlagen")
  const vorne = L.slice(0, erste)
  for (let i = 2; i < vorne.length; i++) {
    const d = dienst(vorne[i])
    assert.ok(!(dienst(vorne[i - 1]) === d && dienst(vorne[i - 2]) === d), "drei Mal " + d + " bis " + vorne[i].id)
  }
  // Jeder Dienst kommt vor, und in jedem Viertel der Reihe gibt es mindestens drei verschiedene
  const dienste = new Set(vorne.map(dienst))
  for (const d of ["feuerwehr", "polizei", "bauhof", "werkstatt", "rettungsdienst", "drk", "dlrg", "thw"]) assert.ok(dienste.has(d), d)
  for (let v = 0; v < 4; v++) {
    const teil = vorne.slice(Math.floor((v * vorne.length) / 4), Math.floor(((v + 1) * vorne.length) / 4))
    assert.ok(new Set(teil.map(dienst)).size >= 3, "Viertel " + (v + 1))
  }
  // Großlagen erst, wenn alle beteiligten Dienste ihr Gebäude haben
  for (const x of L.filter((y) => y.grosslage)) {
    assert.ok(x.dienste.length >= 3, x.art)
    for (const d of x.dienste) {
      const o = R.ORGANISATIONEN[d]
      if (o && o.ab_level) assert.ok(pos("bau:" + o.gebaeude + ":1") < pos(x.id), x.art + " braucht " + d)
    }
  }
})

test("Stufe: monoton, an den Ankern genau das alte Level, am Ende 30; jedes Gebäude ist an seinem Meilenstein baubar", () => {
  for (let i = 1; i < L.length; i++) assert.ok(L[i].fortschritt >= L[i - 1].fortschritt, "monoton bei " + L[i].id)
  assert.equal(L[0].fortschritt, 0)
  for (const [org, o] of Object.entries(R.ORGANISATIONEN)) if (o.ab_level) assert.equal(L[pos("bau:" + o.gebaeude + ":1")].fortschritt, o.ab_level, org)
  assert.equal(L.find((y) => y.grosslage).fortschritt, R.FREISCHALTUNG_LEVEL.alle)
  assert.equal(L[L.length - 1].fortschritt, 30)
  assert.equal(S.stufeVon(R, { reihe: L.length }), 30)
  assert.ok(L.every((x) => Number.isInteger(x.fortschritt)))
  // Keine Sackgasse: Alle Stufen bis zum Meilenstein sind dort schon baubar
  for (const x of L.filter((y) => y.bau)) for (let k = 1; k <= x.stufe; k++) assert.ok((R.GEBAEUDE[x.bau][k].ab_level || 0) <= x.fortschritt, x.id + " Stufe " + k)
  // Hilfsfunktion: zu einem alten Level der Schritt, nach dem es frei wird
  assert.equal(S.schrittVorStufe(R, 0), null)
  assert.equal(S.schrittVorStufe(R, 16).id, L[pos("bau:rettungswache:1") - 1].id)
  assert.match(I.reiheText(R, 16), /nach „Gasgeruch im Gebäude“/)
})

test("Strenge Abfolge: jeder 5-Sterne-Tag schaltet genau den nächsten Schritt frei, nichts wird übersprungen", () => {
  let s = S.neuerStand(R, T0, 11)
  assert.equal(s.reihe, 2)
  const frei = []
  for (let i = 0; i < 11; i++) {
    const r = fuenfSterneTag(s)
    s = r.s
    frei.push(...r.tag.freigeschaltet)
  }
  assert.deepEqual(frei, L.slice(2, 13).map((x) => x.art))
  assert.equal(s.reihe, pos("bau:deponie:1"))
  // Ein Tag mit 4,5 Sternen schaltet nichts frei und merkt nichts
  s.reihe = 3
  for (const a of Object.values(s.einsatzarten)) a.naechster = s.bis + 1e13
  s.tage = s.tage || {}
  const tag = I.tagVon(s.bis + 1)
  s.tage[tag] = { anzahl: 2, sterne: 9, erfolgreich: 2, fuenf: 1, arten: ["tier_katze"], abgerechnet: false }
  const vorher = s.freigeschaltet.length
  s = S.fortschreiben(s, I.tagesende(tag) + MIN, trocken, R)
  assert.equal(s.freigeschaltet.length, vorher)
  assert.equal(s.freischalt_guthaben, 0)
})

test("Meilenstein-Hürde: gute Tage werden gemerkt (höchstens 3) und eingelöst, sobald das Gebäude steht", () => {
  let s = S.neuerStand(R, T0, 12)
  vorspulen(R, s, 0)
  s.reihe = pos("bau:deponie:1")
  s = S.fortschreiben(s, T0 + MIN, trocken, R)
  assert.equal(s.naechste_freischaltung, null)
  assert.deepEqual({ typ: s.naechster_schritt.typ, gebaeude: s.naechster_schritt.gebaeude, danach: s.naechster_schritt.danach }, { typ: "bau", gebaeude: "deponie", danach: "b_wertstoffhof" })
  for (let i = 0; i < 4; i++) {
    const r = fuenfSterneTag(s)
    s = r.s
    assert.deepEqual(r.tag.freigeschaltet, [], "vor dem Meilenstein wird nichts freigeschaltet")
    assert.equal(r.tag.gemerkt, true)
  }
  assert.equal(s.freischalt_guthaben, R.REIHE_GUTHABEN_MAX)
  assert.equal(s.naechster_schritt.guthaben, 3)
  // Wertstoffhof bauen: mit der Fertigstellung (12 h) gehen die drei gemerkten Tage sofort weiter
  const kauf = s.bis
  s = kaufe(s, { art: "gebaeude", id: "deponie" }, kauf)
  const fertig = s.baustellen[0].ende
  const kurz = S.fortschreiben(s, fertig - MIN, trocken, R)
  assert.equal(kurz.freischalt_guthaben, 3, "noch im Bau")
  const nach = S.fortschreiben(s, fertig + MIN, trocken, R)
  assert.equal(nach.freischalt_guthaben, 0)
  assert.deepEqual(nach.eingeloest.map((x) => x.id), L.slice(pos("bau:deponie:1") + 1, pos("bau:deponie:1") + 4).map((x) => x.art))
  assert.ok(nach.eingeloest.every((x) => x.zeit >= fertig - 2 * STD && x.zeit <= fertig + MIN), "gleich bei Fertigstellung")
  for (const x of nach.eingeloest) assert.ok(nach.freigeschaltet.includes(x.id))
  assert.equal(nach.reihe, pos("bau:deponie:1") + 4)
  // In Teilen gerechnet kommt dasselbe heraus
  let teile = s
  for (const t of [kauf + 3 * STD, fertig - MIN, fertig, fertig + MIN]) teile = S.fortschreiben(teile, t, trocken, R)
  assert.deepEqual(teile, nach)
})

test("Guthaben stoppt am nächsten Meilenstein und verfällt nicht; am Ende der Reihe gibt es kein Guthaben", () => {
  let s = S.neuerStand(R, T0, 13)
  s.reihe = pos("bau:bauhof:1")
  s.freischalt_guthaben = 3
  s.gebaeude.bauhof = 1
  I.reiheWeiter(R, s, T0)
  // bh_ast, th_kind_auto, bh_streuen eingelöst, dann silvester als Einsatz: Guthaben 0
  assert.deepEqual(s.eingeloest.map((x) => x.id), ["bh_ast", "th_kind_auto", "bh_streuen"])
  s.reihe = pos("silvester")
  s.freischalt_guthaben = 2
  I.reiheWeiter(R, s, T0)
  assert.equal(s.reihe, pos("bau:werkstatt:1"), "hält am Meilenstein der Werkstatt")
  assert.equal(s.freischalt_guthaben, 1, "der Rest bleibt gemerkt")
  s.reihe = L.length
  s.freischalt_guthaben = 2
  I.reiheWeiter(R, s, T0)
  assert.equal(s.freischalt_guthaben, 0)
  assert.equal(s.stufe, 30)
})

/** Alter Stand von Alex vor dem Update (ohne reihe, freischalt_guthaben, stufe), Level 18 */
function alexAlt(mitBauhof = false) {
  const elbe = S.neustart(S.neuerStand(R, T0 - 30 * 24 * STD, 41), T0 - 30 * 24 * STD, R).stand
  const s = JSON.parse(JSON.stringify(elbe))
  delete s.reihe
  delete s.freischalt_guthaben
  delete s.stufe
  delete s.naechster_schritt
  s.level = 18
  s.bis = T0
  for (const id of ["th_baustelle", "th_oelspur", "tier_katze", "b_muelltonne", "p_baulaerm", "p_baustelle_diebstahl", "p_ruhestoerung"]) {
    s.einsatzarten[id] = s.einsatzarten[id] || { gekauft: T0 - 5 * 24 * STD, naechster: T0 + 3 * STD, nr: 2, anzahl: 2, erfolgreich: 2, beste_sterne: 5 }
    if (!s.freigeschaltet.includes(id) && !R.EINSATZARTEN[id].baustelle) s.freigeschaltet.push(id)
  }
  s.freigeschaltet.push("b_hecke") // freigeschaltet, noch nicht übernommen
  if (mitBauhof) s.gebaeude.bauhof = 1
  return s
}

test("Migration: Alex' alter Stand behält alles, der Zeiger steht auf dem ersten offenen Schritt", () => {
  const alt = alexAlt()
  const vorher = JSON.parse(JSON.stringify(alt))
  const s = S.fortschreiben(alt, T0 + MIN, trocken, R)
  assert.deepEqual(alt, vorher, "der alte Stand selbst bleibt unverändert")
  for (const id of Object.keys(vorher.einsatzarten)) assert.ok(s.einsatzarten[id], id + " bleibt aktiv")
  for (const id of vorher.freigeschaltet) assert.ok(s.freigeschaltet.includes(id), id + " bleibt freigeschaltet")
  assert.equal(new Set(s.freigeschaltet).size, s.freigeschaltet.length, "nichts doppelt")
  assert.equal(s.reihe, pos("p_falschparker"), "erster offener Schritt")
  assert.equal(s.naechste_freischaltung, "p_falschparker")
  assert.equal(s.freischalt_guthaben, 0)
  assert.equal(s.stufe, L[pos("p_falschparker")].fortschritt)
  assert.ok(!I.orgFrei(R, s, "bauhof") && !I.orgFrei(R, s, "rettungsdienst"), "Level 18 öffnet keine Organisation mehr")
  // Idempotent: nochmal fortschreiben ändert an der Reihe nichts
  const wieder = S.fortschreiben(s, T0 + 2 * MIN, trocken, R)
  assert.equal(wieder.reihe, s.reihe)
  assert.deepEqual(wieder.freigeschaltet, s.freigeschaltet)
  // Gültig für den Server und für das Handy (lokal.ts schickt den Stand an /fit)
  assert.ok(A.gueltig(wieder))
  A.pruefeZahlen(wieder)
  // Weiter in der Reihe: b_muelltonne, th_oelspur und b_hecke sind schon erledigt und werden übersprungen
  let t = wieder
  const frei = []
  for (let i = 0; i < 4; i++) {
    const r = fuenfSterneTag(t)
    t = r.s
    frei.push(...r.tag.freigeschaltet)
  }
  assert.deepEqual(frei, ["p_falschparker", "p_hilflos", "th_baum_strasse", "b_muellfahrzeug"])
})

test("Migration: ein schon gebautes Gebäude bleibt nutzbar und zählt als erledigter Meilenstein", () => {
  const s = S.fortschreiben(alexAlt(true), T0 + MIN, trocken, R)
  assert.ok(I.orgFrei(R, s, "bauhof"), "der Bauhof bleibt im Spiel")
  s.reihe = pos("bau:bauhof:1")
  I.reiheWeiter(R, s, T0 + MIN)
  assert.equal(s.reihe, pos("bh_ast"), "Meilenstein übersprungen, weil das Gebäude steht")
})

test("Leerer Neustand: Reihe am Anfang, Stand gültig", () => {
  const s = S.fortschreiben(S.neuerStand(R, T0, 1), T0 + MIN, trocken, R)
  assert.equal(s.reihe, 2)
  assert.equal(s.stufe, 0)
  assert.equal(s.freischalt_guthaben, 0)
  assert.equal(s.naechster_schritt.art, "b_muelltonne")
  assert.equal(s.naechster_schritt.nr, 3)
  assert.equal(s.naechster_schritt.von, L.length)
  assert.ok(A.gueltig(s))
  A.pruefeZahlen(s)
  // Unsinnige Werte von außen werden repariert, nicht übernommen
  const kaputt = JSON.parse(JSON.stringify(s))
  kaputt.reihe = -4
  kaputt.freischalt_guthaben = "x"
  const heil = S.fortschreiben(kaputt, T0 + 2 * MIN, trocken, R)
  assert.equal(heil.reihe, 2)
  assert.equal(heil.freischalt_guthaben, 0)
})

test("Das Level hat keinen Einfluss mehr: gleicher Stand mit Level 0 und 99 hat dieselben Sperren", () => {
  for (const n of [0, 12, 20, 30]) {
    const basis = vorspulen(R, S.neuerStand(R, T0, 5), n)
    const a = JSON.parse(JSON.stringify(basis))
    const b = JSON.parse(JSON.stringify(basis))
    a.level = 0
    b.level = 99
    for (const id of Object.keys(R.FAHRZEUGE)) assert.equal(S.fahrzeugSperre(R, a, id, T0), S.fahrzeugSperre(R, b, id, T0), id)
    for (const org of Object.keys(R.ORGANISATIONEN)) assert.equal(I.orgFrei(R, a, org), I.orgFrei(R, b, org), org)
    for (const g of Object.keys(R.GEBAEUDE)) assert.equal(S.kaufe(a, { art: "gebaeude", id: g }, T0, R).fehler, S.kaufe(b, { art: "gebaeude", id: g }, T0, R).fehler, g)
    for (const id of Object.keys(R.AUSBAU)) assert.equal(S.kaufe(a, { art: "ausbau", id }, T0, R).fehler, S.kaufe(b, { art: "ausbau", id }, T0, R).fehler, id)
    assert.equal(S.stufeVon(R, a), S.stufeVon(R, b))
    assert.deepEqual(I.freischaltKandidaten(R, a), I.freischaltKandidaten(R, b))
    const fa = S.fortschreiben(a, T0 + 3 * 24 * STD, trocken, R)
    const fb = S.fortschreiben(b, T0 + 3 * 24 * STD, trocken, R)
    fb.level = 0
    assert.deepEqual(fa, fb, "dieselbe Simulation bei Stufe " + n)
  }
})

test("Organisationen sind erst offen, wenn die Reihe ihren Meilenstein erreicht hat; vorher sagt der Fehler, was davor kommt", () => {
  const s = S.neuerStand(R, T0, 6)
  s.reihe = pos("bau:rettungswache:1") - 1
  const r = S.kaufe(s, { art: "gebaeude", id: "rettungswache" }, T0, R)
  assert.match(r.fehler, /^Rettungsdienst kommt in der Freischaltreihe nach „Gasgeruch im Gebäude“/)
  s.reihe = pos("bau:rettungswache:1")
  assert.ok(!S.kaufe(s, { art: "gebaeude", id: "rettungswache" }, T0, R).fehler)
  // Die Werkstatt gibt es nicht schon, nur weil die Stufe 12 (am Bauhof) erreicht ist
  s.reihe = pos("bau:bauhof:1")
  assert.equal(s.reihe >= 0 && L[s.reihe].fortschritt, 12)
  assert.match(S.kaufe(s, { art: "gebaeude", id: "werkstatt" }, T0, R).fehler, /Werkstatt und Abschleppdienst kommt in der Freischaltreihe nach/)
  assert.ok(!S.kaufe(s, { art: "gebaeude", id: "bauhof" }, T0, R).fehler)
})
