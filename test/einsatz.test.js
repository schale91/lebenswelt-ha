// Tests der Simulation: node --test test/
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  return r.stand
}

/** Katze am Baum beim Feuerwehrhaus auslösen und bis zum Ende fortschreiben; keine anderen Meldungen. */
function katze(s, t = T0 + MIN) {
  for (const a of Object.values(s.einsatzarten)) a.naechster = t + 1e12
  const x = JSON.parse(JSON.stringify(s))
  const e = S._intern.erzeuge(R, x, "tier_katze", t, trocken, null, "baum_feuerwehr")
  const fertig = S.fortschreiben(x, t + 2 * 60 * MIN, trocken, R)
  return { e: fertig.abgeschlossen.find((a) => a.id === e.id), stand: fertig }
}

test("Einstieg 1 und 2: Katze ist gekauft, ohne Feuerwehr verfällt jeder Einsatz", () => {
  const s = S.neuerStand(R, T0, 1)
  assert.ok(s.einsatzarten.tier_katze)
  const nach = S.fortschreiben(s, T0 + 12 * 60 * MIN, trocken, R)
  assert.ok(nach.abgeschlossen.length >= 6 && nach.abgeschlossen.length <= 18, "etwa stündlich: " + nach.abgeschlossen.length)
  for (const e of nach.abgeschlossen) {
    assert.equal(e.status, "verfallen")
    assert.equal(e.grund, "Keine Einsatzkraft verfügbar.")
    assert.equal(e.bewertung.sterne, 0)
  }
})

test("Einstieg 3 und 4: eine Einsatzkraft ohne Leiter, der Einsatz verfällt mit Grund", () => {
  let s = S.neuerStand(R, T0, 2)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  assert.equal(s.personal.length, 1)
  const { e } = katze(s)
  assert.equal(e.status, "verfallen")
  assert.match(e.grund, /leiter/i)
})

test("Einstieg 5: mit Klappleiter klappt die Rettung, aber höchstens 3 Sterne (Leiter nicht gesichert)", () => {
  let s = S.neuerStand(R, T0, 3)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  const { e } = katze(s)
  assert.equal(e.status, "abgeschlossen", e.grund)
  assert.ok(e.bewertung.sterne <= 3, "Sterne " + e.bewertung.sterne)
  assert.ok(e.bewertung.sterne >= 1)
  assert.ok(e.bewertung.abzuege.some((a) => a.grund === "leiter_sicherung"))
  assert.ok(e.plan.zu_fuss)
})

test("Einstieg 6: zweites Haus, Fahrrad, Handzugwagen, Handschuhe und Box ergeben 5 Sterne und schalten den Mülltonnenbrand frei", () => {
  let s = S.neuerStand(R, T0, 4)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  s = kaufe(s, { art: "haus_ausbau", ziel: s.haeuser[1].id, id: "fahrrad" })
  s = kaufe(s, { art: "fahrzeug", id: "handzugwagen" })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  s = kaufe(s, { art: "geraet", id: "tierhandschuhe" })
  s = kaufe(s, { art: "geraet", id: "transportbox" })
  const { e, stand } = katze(s)
  assert.equal(e.status, "abgeschlossen", e.grund)
  assert.equal(e.bewertung.sterne, 5, JSON.stringify(e.bewertung.abzuege))
  assert.ok(stand.freigeschaltet.includes("b_muelltonne"))
  assert.ok(!stand.einsatzarten.b_muelltonne, "freigeschaltet heißt noch nicht gekauft")
})

test("Der Baum am Markt ist zu Fuß vom Feuerwehrhaus nicht in 5 Minuten zu schaffen", () => {
  let s = S.neuerStand(R, T0, 5)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const e = S._intern.erzeuge(R, s, "tier_katze", T0 + MIN, trocken, null, "baum_markt")
  assert.equal(e.status, "verfallen")
  assert.match(e.grund, /Zu spät/)
})

test("Preise: Faktor 0,05, Mindestpreis 10 Münzen", () => {
  const s = S.neuerStand(R, T0, 6)
  assert.equal(S.kaufe(s, { art: "bauplatz", id: "bp01" }, T0, R).preis, 90) // 1800 · 0,05
  assert.equal(S.kaufe(s, { art: "geraet", id: "klappleiter" }, T0, R).preis, 10) // 120 · 0,05 = 6 → 10
  assert.equal(S.kaufe(s, { art: "einsatzart", id: "p_ruhestoerung" }, T0, R).preis, 10)
  assert.ok(S.kaufe(s, { art: "einsatzart", id: "b_hecke" }, T0, R).fehler, "nicht freigeschaltet")
})

/** Ein ausgebauter Stand für Dauer- und Lasttests. */
function ausgebaut(saat) {
  let s = S.neuerStand(R, T0, saat)
  for (const bp of ["bp01", "bp02", "bp03", "bp04", "bp05", "bp06", "bp07", "bp08"]) s = kaufe(s, { art: "bauplatz", id: bp })
  s = kaufe(s, { art: "gebaeude", id: "geraetehaus" })
  s = kaufe(s, { art: "gebaeude", id: "geraetehaus" })
  s = kaufe(s, { art: "gebaeude", id: "dienststelle" })
  for (let i = 0; i < 3; i++) s = kaufe(s, { art: "personal", id: "polizei" })
  s = kaufe(s, { art: "fahrzeug", id: "handzugwagen" })
  s = kaufe(s, { art: "fahrzeug", id: "tsf_w" })
  s = kaufe(s, { art: "fahrzeug", id: "fustw" })
  const fw = s.personal.filter((p) => p.org === "feuerwehr")
  for (const p of fw.slice(0, 3)) p.lehrgaenge.fahrberechtigung = T0
  for (const id of ["klappleiter", "tierhandschuhe", "transportbox", "pulverloescher", "schaumloescher", "oelbinder", "oelbinder", "besen_schaufel"]) s = kaufe(s, { art: "geraet", id })
  // Freischalten und kaufen wie im Spiel
  s.freigeschaltet.push("b_muelltonne", "b_hecke", "th_oelspur", "p_falschparker", "p_verkehrsregelung")
  for (const id of ["b_muelltonne", "b_hecke", "th_oelspur", "p_ruhestoerung", "p_falschparker"]) s = kaufe(s, { art: "einsatzart", id })
  return s
}

test("Keine Person und kein Fahrzeug ist in zwei Einsätzen zugleich", () => {
  const s = S.fortschreiben(ausgebaut(7), T0 + 30 * 24 * 60 * MIN, trocken, R)
  const alle = s.abgeschlossen.concat(s.laufend).filter((e) => e.plan)
  assert.ok(alle.length > 100, "genug Einsätze: " + alle.length)
  const belegung = new Map()
  for (const e of alle) {
    const von = e.plan.alarm
    const bis = e.plan.einsatzbereit || e.plan.zurueck
    for (const r of e.plan.personen.map((p) => p.id).concat(e.plan.fahrzeuge)) {
      for (const [a, b, id] of belegung.get(r) || []) assert.ok(bis <= a || von >= b, `${r} doppelt in ${id} und ${e.id}`)
      belegung.set(r, (belegung.get(r) || []).concat([[von, bis, e.id]]))
    }
  }
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück", () => {
  const start = ausgebaut(8)
  const t2 = T0 + 5 * 24 * 60 * MIN
  const ganz = S.fortschreiben(start, t2, trocken, R)
  let teile = start
  for (const t of [T0 + 7 * MIN, T0 + 3 * 60 * MIN, T0 + 26 * 60 * MIN, T0 + 3 * 24 * 60 * MIN, t2]) teile = S.fortschreiben(teile, t, trocken, R)
  assert.deepEqual(teile, ganz)
})

test("30 Tage ohne Öffnen der App rechnen in unter einer Sekunde", () => {
  const start = ausgebaut(9)
  const t = Date.now()
  const s = S.fortschreiben(start, T0 + 30 * 24 * 60 * MIN, trocken, R)
  const ms = Date.now() - t
  assert.ok(ms < 1000, ms + " ms")
  assert.ok(s.abgeschlossen.some((e) => e.status === "abgeschlossen"))
})

test("Folgeeinsatz: Ölspur bringt die Polizei zur Verkehrsregelung", () => {
  let s = ausgebaut(10)
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const e = S._intern.erzeuge(R, s, "th_oelspur", T0 + MIN, trocken, null, "hauptstrasse_west")
  s = S.fortschreiben(s, T0 + 3 * 60 * MIN, trocken, R)
  const folge = s.abgeschlossen.find((x) => x.folge_von === e.id)
  assert.ok(folge, "Folgeeinsatz angelegt")
  assert.equal(folge.art, "p_verkehrsregelung")
})

test("Ortszeit: Sommer- und Winterzeit", () => {
  assert.equal(S.ortszeit(Date.UTC(2026, 6, 1, 20)).stunde, 22)
  assert.equal(S.ortszeit(Date.UTC(2026, 11, 1, 20)).stunde, 21)
})

test("Kaufbuch: unbekannte Ausgaben werden beim Hochladen nachgezogen, bekannte nicht doppelt", () => {
  const KB = require("../lebenswelt/pb_hooks/einsatz/kaufbuch.js")
  const gekauft = KB.buche({ state: { muenzen: 100 }, version: 3 }, 30, 1000, "geraet:klappleiter")
  assert.equal(gekauft.daten.state.muenzen, 70)
  const ausgaben = [gekauft.ausgabe]
  // Zweites Gerät mit altem Stand (kennt den Kauf nicht, hat inzwischen 5 Münzen verdient)
  const alt = KB.abgleich({ state: { muenzen: 105 }, version: 3 }, ausgaben)
  assert.equal(alt.nachgezogen, 30)
  assert.equal(alt.daten.state.muenzen, 75)
  assert.equal(alt.daten.state.einsatzAusgabenBekannt, 1000)
  // Derselbe Stand noch einmal: nichts mehr abzuziehen
  assert.equal(KB.abgleich(alt.daten, ausgaben).nachgezogen, 0)
  // Gerät, das den Kauf schon kannte
  assert.equal(KB.abgleich(gekauft.daten, ausgaben).nachgezogen, 0)
  assert.ok(KB.buche({ state: { muenzen: 5 } }, 10, 2000, "x").fehler)
})

test("Wetter aus Home Assistant", () => {
  // dienst.js braucht PocketBase; die Zuordnung ist dort, hier nur die Werte gegen das Regelwerk
  const zustaende = ["trocken", "nass", "schnee", "glaette", "sturm", "hitze"]
  for (const z of zustaende) assert.ok(R.WETTER[z])
})

test("Ohne Rückmeldung kommen alle, mit Rückmeldung nur die Gebrauchten", () => {
  let s = S.neuerStand(R, T0, 11)
  for (const bp of ["bp01", "bp02", "bp03", "bp04"]) s = kaufe(s, { art: "bauplatz", id: bp })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const ohne = S._intern.erzeuge(R, JSON.parse(JSON.stringify(s)), "tier_katze", T0 + MIN, trocken, null, "baum_feuerwehr")
  assert.ok(ohne.plan.vergeblich.length >= 1, "Unnötig Alarmierte gebunden")
  for (const h of s.haeuser) s = kaufe(s, { art: "alarmierung", ziel: h.id, id: "fme_rueck" })
  const mit = S._intern.erzeuge(R, s, "tier_katze", T0 + MIN, trocken, null, "baum_feuerwehr")
  assert.equal(mit.plan.vergeblich.length, 0)
})
