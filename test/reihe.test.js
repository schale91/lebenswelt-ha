// Freischaltreihe (Wunsch vom 17.11.2026): feste Reihenfolge, Gebäude als Hürden, kein Level mehr: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")
const A = require("../lebenswelt/pb_hooks/einsatz/ablauf.js")
const { vorspulen, schritt, mitPolizei } = require("./reihe_hilfe.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"
const L = R.FREISCHALTREIHE
const I = S._intern
const pos = (id) => L.findIndex((x) => x.id === id)
/** Dienst eines Schritts für die Abwechslung: Organisation, bei Gebäuden ohne Organisation "gemeinde" */
const dienst = (x) => (x.art ? x.org : x.viertel ? "gemeinde" : x.org || "gemeinde")

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
  // Meilensteine: Gebäude (optional mit Kräften), Kräfte einer Organisation oder ein Viertel; jeder genau einmal
  for (const x of L.filter((y) => !y.art)) {
    assert.ok(x.bau || x.viertel || (x.kraefte && x.org), x.id)
    if (x.kraefte) assert.ok(Number.isInteger(x.kraefte) && x.kraefte > 0, x.id)
    if (x.viertel) assert.ok(R.VIERTEL[x.viertel], x.id)
  }
  assert.equal(new Set(L.map((x) => x.id)).size, L.length, "jede Kennung einmal")
  assert.deepEqual(L.map((x) => x.nr), L.map((_, i) => i + 1))
  assert.deepEqual([L[0].art, L[2].art], ["tier_katze", "p_ruhestoerung"], "Start bleibt Katze und Ruhestörung")
  assert.deepEqual([L[1].org, L[1].kraefte], ["polizei", 1], "dazwischen: eine Kraft an der Dienststelle")
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
  // Jede Organisation mit eigenem Gebäude hat genau einen Meilenstein für ihr Gebäude (Stufe 1)
  for (const [org, o] of Object.entries(R.ORGANISATIONEN)) if (o.ab_level) assert.equal(L.filter((y) => y.bau === o.gebaeude && y.stufe === 1 && y.org === org).length, 1, org)
  // Kräfte steigen je Organisation nur
  const zuletzt = {}
  for (const x of L.filter((y) => y.kraefte)) {
    assert.ok(x.kraefte > (zuletzt[x.org] || 0), x.id)
    zuletzt[x.org] = x.kraefte
  }
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
  assert.equal(s.reihe, 1, "zuerst eine Kraft an der Dienststelle")
  s = mitPolizei(S, R, s, 2, T0)
  assert.equal(s.reihe, 3)
  const frei = []
  for (let i = 0; i < 11; i++) {
    const r = fuenfSterneTag(s)
    s = r.s
    frei.push(...r.tag.freigeschaltet)
  }
  assert.deepEqual(frei, L.slice(3, pos("bau:deponie:1")).filter((x) => x.art).map((x) => x.art))
  assert.equal(s.reihe, pos("bau:deponie:1"))
  // Ein Tag mit 4,5 Sternen schaltet nichts frei und merkt nichts
  s.reihe = 4
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
  // Direkt danach verlangt die Reihe vier Feuerwehrleute: Das Guthaben wartet weiter, nichts verfällt
  assert.equal(nach.reihe, pos("kraefte:feuerwehr:4"))
  assert.equal(nach.freischalt_guthaben, 3)
  assert.deepEqual([nach.naechster_schritt.typ, nach.naechster_schritt.kraefte, nach.naechster_schritt.kraefte_jetzt], ["kraefte", 4, 0])
  // Vier Einsatzkräfte ziehen ein (Häuser), mit dem letzten Einzug gehen die drei Tage sofort weiter
  let mitHaus = nach
  for (const bp of ["bp01", "bp02", "bp03", "bp04"]) mitHaus = kaufe(mitHaus, { art: "bauplatz", id: bp }, nach.bis)
  const einzug = Math.max(...mitHaus.baustellen.map((b) => b.ende))
  const fertig2 = S.fortschreiben(mitHaus, einzug + MIN, trocken, R)
  assert.equal(fertig2.freischalt_guthaben, 0)
  assert.deepEqual(fertig2.eingeloest.map((x) => x.id), L.slice(pos("kraefte:feuerwehr:4") + 1, pos("kraefte:feuerwehr:4") + 4).map((x) => x.art))
  assert.ok(fertig2.eingeloest.every((x) => x.zeit >= einzug - 2 * STD && x.zeit <= einzug + MIN), "gleich beim Einzug")
  for (const x of fertig2.eingeloest) assert.ok(fertig2.freigeschaltet.includes(x.id))
  assert.equal(fertig2.reihe, pos("kraefte:feuerwehr:4") + 4)
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
  assert.equal(s.reihe, pos("bau:bauhof:1"), "ohne Gemeindearbeiter ist der Bauhof-Meilenstein offen")
  s = kaufe(s, { art: "personal", id: "bauhof" }, T0)
  // bh_ast, th_kind_auto, bh_streuen eingelöst, dann silvester als Einsatz: Guthaben 0
  assert.deepEqual(s.eingeloest.map((x) => x.id), ["bh_ast", "th_kind_auto", "bh_streuen"])
  s.reihe = pos("silvester")
  s.freischalt_guthaben = 2
  s.eingeloest = []
  I.reiheWeiter(R, s, T0)
  assert.equal(s.reihe, pos("bau:werkstatt:1"), "hält am Meilenstein der Werkstatt")
  assert.equal(s.freischalt_guthaben, 1, "der Rest bleibt gemerkt")
  s.reihe = L.length
  s.freischalt_guthaben = 2
  I.reiheWeiter(R, s, T0)
  assert.equal(s.freischalt_guthaben, 0)
  assert.equal(s.stufe, 30)
})

/** Alter Stand von Alex vor dem Update (ohne reihe, freischalt_guthaben, stufe, viertel), Level 18, eine Polizeikraft */
function alexAlt(mitBauhof = false, polizei = 1) {
  const elbe = S.neustart(S.neuerStand(R, T0 - 30 * 24 * STD, 41), T0 - 30 * 24 * STD, R).stand
  const s = JSON.parse(JSON.stringify(polizei ? mitPolizei(S, R, elbe, polizei, T0 - 30 * 24 * STD) : elbe))
  delete s.reihe
  delete s.freischalt_guthaben
  delete s.stufe
  delete s.naechster_schritt
  delete s.viertel
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
  // Viertel: was die App bei Level 18 zeigte (Kirchweg, Gewerbe, Wohnviertel 2), bleibt erschlossen; Freizeit (24) nicht
  assert.deepEqual([...s.viertel].sort(), ["gewerbe", "kirche", "wohnen2"])
  // Idempotent: nochmal fortschreiben ändert an der Reihe nichts
  const wieder = S.fortschreiben(s, T0 + 2 * MIN, trocken, R)
  assert.equal(wieder.reihe, s.reihe)
  assert.deepEqual(wieder.freigeschaltet, s.freigeschaltet)
  assert.deepEqual(wieder.viertel, s.viertel)
  // Gültig für den Server und für das Handy (lokal.ts schickt den Stand an /fit)
  assert.ok(A.gueltig(wieder))
  A.pruefeZahlen(wieder)
  // Weiter in der Reihe: b_hecke ist schon erledigt; dann verlangt die Reihe die Polizeistation mit zwei Kräften,
  // gute Tage danach werden gemerkt
  let t = wieder
  const frei = []
  for (let i = 0; i < 4; i++) {
    const r = fuenfSterneTag(t)
    t = r.s
    frei.push(...r.tag.freigeschaltet)
  }
  assert.deepEqual(frei, ["p_falschparker"])
  assert.equal(t.naechster_schritt.id, "bau:dienststelle:1")
  assert.equal(t.freischalt_guthaben, 3)
})

test("Migration: ohne Polizeikraft steht der Zeiger auf der ersten Pflicht, nichts geht verloren", () => {
  const s = S.fortschreiben(alexAlt(false, 0), T0 + MIN, trocken, R)
  assert.equal(s.reihe, pos("kraefte:polizei:1"))
  assert.equal(s.naechste_freischaltung, null)
  for (const id of ["b_muelltonne", "th_oelspur", "b_hecke"]) assert.ok(s.freigeschaltet.includes(id))
})

test("Migration der Viertel: Level 0 nichts, gebaute Werkstatt öffnet das Gewerbe, mehr Häuser Wohnviertel 2; idempotent", () => {
  const leer = alexAlt(false, 0)
  leer.level = 0
  assert.deepEqual(S.fortschreiben(leer, T0 + MIN, trocken, R).viertel, [])
  const gebaut = alexAlt(false, 0)
  gebaut.level = 0
  gebaut.gebaeude.werkstatt = 1
  for (let i = 0; i < 10; i++) gebaut.haeuser.push({ id: "hx" + i, bauplatz: "bp" + (40 + i), gekauft: 0, ausbau: [], alarmierung: "sirene", im_bau: false })
  const g = S.fortschreiben(gebaut, T0 + MIN, trocken, R)
  assert.deepEqual([...g.viertel].sort(), ["gewerbe", "wohnen2"])
  // Ein höheres Level danach ändert nichts mehr: die Übernahme passiert einmal
  g.level = 30
  assert.deepEqual(S.fortschreiben(g, T0 + 2 * MIN, trocken, R).viertel, g.viertel)
  // Außerhalb von Elbe Springs gibt es keine Viertel: dort zählen Viertel-Schritte als erledigt
  assert.ok(I.schrittErledigt({ welt: undefined, viertel: [] }, L[pos("viertel:gewerbe")], R))
})

test("Viertel erschließen: Kauf mit Münzen, als Meilenstein oder ab seiner Stufe; vorher entsteht dort kein Einsatz", () => {
  let s = S.fortschreiben(alexAlt(false, 2), T0 + MIN, trocken, R)
  s.viertel = []
  s.reihe = pos("p_einbruch")
  // Kirchweg und Gewerbe dürfen ab Stufe 7 auch vor ihrem Meilenstein erschlossen werden, Freizeit erst ab Stufe 24
  assert.equal(S.viertelSperre(R, s, "kirche"), null)
  assert.match(S.viertelSperre(R, s, "freizeit"), /Kommt in der Freischaltreihe nach/)
  // Werkstatt im Gewerbe: bauen erst nach dem Erschließen
  s.reihe = pos("bau:werkstatt:1")
  assert.match(S.kaufe(s, { art: "gebaeude", id: "werkstatt" }, T0 + MIN, R).fehler, /Viertel Gewerbe/)
  // Am Meilenstein Gewerbe: Kauf bucht den Preis, der Meilenstein ist erledigt
  s.reihe = pos("viertel:gewerbe")
  const r = S.kaufe(s, { art: "erschliessung", id: "gewerbe" }, T0 + MIN, R)
  assert.ok(!r.fehler, r.fehler)
  assert.equal(r.preis, S.preis(R, R.VIERTEL.gewerbe.preis))
  assert.deepEqual(r.stand.viertel, ["gewerbe"])
  assert.equal(r.stand.reihe, pos("bau:bauhof:1"))
  assert.match(S.kaufe(r.stand, { art: "erschliessung", id: "gewerbe" }, T0 + MIN, R).fehler, /Schon erschlossen/)
  // Kein Einsatz im Kirchweg, solange er zu ist: der Aufzug steckt nur im Rathaus
  assert.equal(I.viertelOffen(R, r.stand, "kirche"), false)
  const x = JSON.parse(JSON.stringify(r.stand))
  for (const a of Object.values(x.einsatzarten)) a.naechster = T0 + 1e13
  for (let i = 0; i < 20; i++) assert.equal(I.erzeuge(R, x, "th_aufzug", T0 + 2 * MIN + i, () => "trocken", null).ort, "arbeit_rathaus")
})

test("Migration: ein schon gebautes Gebäude bleibt nutzbar und zählt als erledigter Meilenstein", () => {
  let s = S.fortschreiben(alexAlt(true), T0 + MIN, trocken, R)
  assert.ok(I.orgFrei(R, s, "bauhof"), "der Bauhof bleibt im Spiel")
  s.reihe = pos("bau:bauhof:1")
  I.reiheWeiter(R, s, T0 + MIN)
  assert.equal(s.reihe, pos("bau:bauhof:1"), "das Gebäude steht, es fehlt noch die Kraft")
  s = kaufe(s, { art: "personal", id: "bauhof" }, T0 + MIN)
  assert.equal(s.reihe, pos("bh_ast"), "Meilenstein übersprungen, weil Gebäude und Kraft da sind")
})

test("Leerer Neustand: Reihe am Anfang, Stand gültig", () => {
  const s = S.fortschreiben(S.neuerStand(R, T0, 1), T0 + MIN, trocken, R)
  assert.equal(s.reihe, 1)
  assert.equal(s.stufe, 0)
  assert.equal(s.freischalt_guthaben, 0)
  assert.deepEqual(s.viertel, [])
  assert.deepEqual([s.naechster_schritt.typ, s.naechster_schritt.org, s.naechster_schritt.kraefte, s.naechster_schritt.danach], ["kraefte", "polizei", 1, "b_muelltonne"])
  assert.equal(s.naechster_schritt.nr, 2)
  assert.equal(s.naechster_schritt.von, L.length)
  assert.ok(A.gueltig(s))
  A.pruefeZahlen(s)
  // Unsinnige Werte von außen werden repariert, nicht übernommen
  const kaputt = JSON.parse(JSON.stringify(s))
  kaputt.reihe = -4
  kaputt.freischalt_guthaben = "x"
  const heil = S.fortschreiben(kaputt, T0 + 2 * MIN, trocken, R)
  assert.equal(heil.reihe, 1)
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

/**
 * Was bis zum Schritt i Pflicht war: Kräfte je Organisation (mit den drei Startbewohnern der Feuerwehr), erschlossene
 * Viertel, Organisationen, deren Meilenstein erreicht ist, und die Stufe.
 */
function pflichtBis(i) {
  const kraefte = { feuerwehr: R.EINWOHNER.start_feuerwehr }
  const viertel = new Set()
  for (const x of L.slice(0, i)) {
    if (x.kraefte) kraefte[x.org] = Math.max(kraefte[x.org] || 0, x.kraefte)
    if (x.viertel) viertel.add(x.viertel)
  }
  const orgFrei = (org) => {
    const o = R.ORGANISATIONEN[org]
    return !o || !o.ab_level || L.findIndex((y) => y.bau === o.gebaeude && y.stufe === 1) <= i
  }
  return { kraefte, viertel, orgFrei, stufe: L[i].fortschritt }
}

/** Ist eine Gerätegruppe mit dem Kaufbaren erfüllbar (Gerät der Organisation, Merkmal eines Fahrzeugs bis zur Stufe)? */
function gruppeKaufbar(org, gruppe, stufe, polizeiFrei) {
  const fahrzeuge = Object.entries(R.FAHRZEUGE).filter(([, f]) => f.org === org && (f.ab_level || 0) <= stufe)
  const durchEinsatz = Object.entries(R.FAHRZEUGE).filter(([, f]) => f.org === org && gruppe.some((alt) => Object.entries(alt).every(([g, n]) => ((f.grundbeladung || {})[g] || 0) >= n)))
  const hat = (g) => {
    if (R.GERAETE[g]) return R.GERAETE[g].org === org || R.GERAETE[g].org === "beide" || durchEinsatz.length > 0
    if (g === "polizei_vor_ort") return polizeiFrei
    const mk = R.MERKMALE[g]
    if (!mk) return false
    if (mk.aus.fahrzeug_feld) return fahrzeuge.some(([, f]) => f[mk.aus.fahrzeug_feld])
    if (mk.aus.fahrzeug) return fahrzeuge.some(([id]) => mk.aus.fahrzeug.indexOf(id) >= 0)
    return false
  }
  return gruppe.some((alt) => Object.keys(alt).every(hat)) || durchEinsatz.length > 0
}

test("Jeder Einsatz der Reihe ist mit dem, was bis dahin Pflicht war, zu 4,9 abschließbar (Orte, Kräfte, Gebäude, Geräte)", () => {
  const fehler = []
  for (const [i, x] of L.entries()) {
    if (!x.art) continue
    const a = R.EINSATZARTEN[x.art]
    const p = pflichtBis(i)
    // Orte: mindestens einer außerhalb noch geschlossener Viertel
    const orte = a.orte || []
    const zu = (o) => Object.entries(R.VIERTEL).some(([id, v]) => v.orte.indexOf(o) >= 0 && !p.viertel.has(id))
    if (orte.length && !(a.ort_gruppen || []).length && orte.every(zu)) fehler.push(x.art + ": alle Orte in geschlossenen Vierteln")
    // Kräfte für den Einsatz und alle Folgeeinsätze von Diensten, die es dann gibt (sonst nur von außen, höchstens 3 ★)
    const teile = [x.art].concat((a.folge || []).filter((f) => R.EINSATZARTEN[f] && p.orgFrei(R.EINSATZARTEN[f].org)))
    for (const t of teile) {
      const b = R.EINSATZARTEN[t]
      const n = (b.mindestens && b.mindestens.personen) || 0
      if (n > (p.kraefte[b.org] || 0)) fehler.push(x.art + (t !== x.art ? " (Folge " + t + ")" : "") + ": braucht " + n + " " + b.org + ", Pflicht waren " + (p.kraefte[b.org] || 0))
      for (const [q, k] of Object.entries((b.mindestens && b.mindestens.qualifikation) || {})) {
        if (!R.LEHRGAENGE[q]) fehler.push(t + ": Qualifikation " + q + " gibt es nicht")
        if (k > (p.kraefte[b.org] || 0)) fehler.push(t + ": " + k + "× " + q + " bei " + (p.kraefte[b.org] || 0) + " Kräften")
      }
      for (const gruppe of (b.mindestens && b.mindestens.geraete) || []) if (!gruppeKaufbar(b.org, gruppe, p.stufe, p.orgFrei("polizei"))) fehler.push(t + ": Geräte " + JSON.stringify(gruppe) + " bei Stufe " + p.stufe + " nicht kaufbar")
    }
    // Gebäude-Voraussetzungen
    for (const [g, st] of Object.entries(a.braucht_gebaeude || {})) if (!L.slice(0, i).some((y) => y.bau === g && y.stufe >= st)) fehler.push(x.art + ": " + g + " " + st + " ist vorher keine Pflicht")
  }
  assert.deepEqual(fehler, [])
})

test("Jeder Kräfte-Meilenstein ist erfüllbar: Stellen im Gebäude, Wohnhäuser in den erschlossenen Vierteln, Einwohnerzahl", () => {
  const ANGESTELLT = ["polizei", "werkstatt", "bauhof", "rettungsdienst"]
  const fehler = []
  for (const [i, x] of L.entries()) {
    if (!x.kraefte) continue
    const p = pflichtBis(i + 1)
    // Angestellte: so viele Stellen hat die beste Stufe, die bis hierher Pflicht (oder mit der Stufe baubar) ist
    if (ANGESTELLT.indexOf(x.org) >= 0) {
      const geb = x.org === "polizei" ? "dienststelle" : R.ORGANISATIONEN[x.org].gebaeude
      const max = Math.max(...R.GEBAEUDE[geb].filter((st) => (st.ab_level || 0) <= x.fortschritt).map((st) => st.personal_max || 0))
      if (x.kraefte > max) fehler.push(x.id + ": nur " + max + " Stellen")
    }
    // Wohnen: jedes Haus mit Einliegerwohnung für zwei; Angestellte bekommen in Elbe Springs eine Dienstwohnung (ein Haus)
    const haeuser = R.WOHNHAEUSER_START + [...p.viertel].reduce((n, v) => n + (R.VIERTEL[v].wohnhaeuser || 0), 0)
    const angestellte = ANGESTELLT.reduce((n, o) => n + (p.kraefte[o] || 0), 0)
    const bewohner = (p.kraefte.feuerwehr || 0) + angestellte
    if (bewohner > 2 * haeuser) fehler.push(x.id + ": " + bewohner + " Bewohner, Platz für " + 2 * haeuser)
    for (const o of ["drk", "dlrg", "thw"]) if ((p.kraefte[o] || 0) > bewohner) fehler.push(x.id + ": mehr Ehrenamtliche als Bewohner")
    // Die Einwohnerzahl ist nie kleiner als die Pflicht (auch bei niedrigem Level)
    const s = { reihe: i, level: 0, welt: "elbe", personal: [], baustellen: [] }
    if (S.einwohnerMax(R, s) < bewohner) fehler.push(x.id + ": Einwohner höchstens " + S.einwohnerMax(R, s))
  }
  assert.deepEqual(fehler, [])
  // Ohne Wohnviertel 2 reichen die Häuser für die 20 Feuerwehrleute nicht: deshalb steht es davor
  assert.ok(pos("viertel:wohnen2") < pos("kraefte:feuerwehr:20"))
})
