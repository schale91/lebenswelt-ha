// Tests der Simulation: node --test test/
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const trocken = () => "trocken"

/** Kaufen; Bauten sind in diesen Tests sofort fertig (eigene Tests prüfen die Bauzeit). */
function kaufe(s, auftrag, t = T0, sofort = true) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  if (sofort) for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
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

test("Einstieg 6: drei Häuser, Fahrrad, Handzugwagen, Handschuhe, Box und gute Stiefel ergeben 5 Sterne und schalten den Mülltonnenbrand frei", () => {
  let s = S.neuerStand(R, T0, 4)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  s = kaufe(s, { art: "bauplatz", id: "bp03" })
  s = kaufe(s, { art: "haus_ausbau", ziel: s.haeuser[1].id, id: "fahrrad" })
  s = kaufe(s, { art: "haus_ausbau", ziel: s.haeuser[2].id, id: "fahrrad" })
  s = kaufe(s, { art: "fahrzeug", id: "handzugwagen" })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  s = kaufe(s, { art: "geraet", id: "tierhandschuhe" })
  s = kaufe(s, { art: "geraet", id: "transportbox" })
  for (const p of s.personal) {
    s = kaufe(s, { art: "psa", ziel: p.id, id: "stiefel", stufe: 1 })
    s = kaufe(s, { art: "psa", ziel: p.id, id: "stiefel", stufe: 2 })
    s = kaufe(s, { art: "psa", ziel: p.id, id: "helm", stufe: 1 })
  }
  const { e, stand } = katze(s)
  assert.equal(e.status, "abgeschlossen", e.grund)
  assert.equal(e.bewertung.sterne, 5, JSON.stringify(e.bewertung.abzuege))
  // Freigeschaltet wird erst bei der Tagesabrechnung um Mitternacht
  assert.ok(!stand.freigeschaltet.includes("b_muelltonne"), "nicht sofort")
  const nachts = S.fortschreiben(stand, S._intern.tagesende(e.tag) + MIN, trocken, R)
  assert.ok(nachts.freigeschaltet.includes("b_muelltonne"))
  assert.ok(!nachts.einsatzarten.b_muelltonne, "freigeschaltet heißt noch nicht gekauft")
  const d = nachts.tage[e.tag]
  assert.ok(d.abgerechnet && d.durchschnitt >= 4.5 && d.xp > 0, JSON.stringify(d))
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

/** Drei Kräfte nah am Feuerwehrhaus mit Fahrrad, Leiter, Handschuhen und Box; Ausrüstung je nach Aufruf. */
function katzenWache(saat, psa) {
  let s = S.neuerStand(R, T0, saat)
  for (const bp of ["bp01", "bp02", "bp03"]) s = kaufe(s, { art: "bauplatz", id: bp })
  for (const h of s.haeuser) s = kaufe(s, { art: "haus_ausbau", ziel: h.id, id: "fahrrad" })
  for (const g of ["klappleiter", "tierhandschuhe", "transportbox"]) s = kaufe(s, { art: "geraet", id: g })
  for (const p of s.personal) for (const [teil, bis] of Object.entries(psa)) for (let st = 1; st <= bis; st++) s = kaufe(s, { art: "psa", ziel: p.id, id: teil, stufe: st })
  return s
}

test("Ausrüstung: mit Gummistiefeln dauert der Einsatz länger als mit Lederstiefeln", () => {
  const gummi = katze(katzenWache(20, {})).e
  const leder = katze(katzenWache(20, { stiefel: 2 })).e
  assert.ok(gummi.plan.arbeit_ende > leder.plan.arbeit_ende, "Gummistiefel müssen bremsen")
  assert.ok(gummi.bewertung.sterne <= leder.bewertung.sterne)
  assert.ok(gummi.plan.faktoren.some((f) => f.grund === "zu_fuss"))
})

test("Ausrüstung: gute Stiefel verkürzen das Umziehen", () => {
  const s = katzenWache(21, {})
  const p = s.personal[0]
  const ohne = S._intern.feuerwehrBereit(R, s, p, T0, "trocken")
  const mit = S._intern.feuerwehrBereit(R, s, Object.assign({}, p, { psa: { stiefel: 2 } }), T0, "trocken")
  assert.equal(ohne - mit, 15000)
})

test("Dunkelheit bremst, Helmlampen bei allen heben das auf", () => {
  const nacht = Date.UTC(2026, 9, 13, 20) // 22 Uhr Ortszeit
  assert.ok(S._intern.dunkel(R, nacht))
  assert.ok(!S._intern.dunkel(R, T0))
  const ohne = katze(katzenWache(22, { stiefel: 2 }), nacht).e
  const lampe = katze(katzenWache(22, { stiefel: 2, helm: 3 }), nacht).e
  assert.ok(ohne.plan.faktoren.some((f) => f.grund === "dunkel"))
  assert.ok(!lampe.plan.faktoren.some((f) => f.grund === "dunkel"))
  assert.ok(ohne.plan.arbeit_ende - ohne.plan.eintreffen > lampe.plan.arbeit_ende - lampe.plan.eintreffen)
})

test("Ohne Verteiler wird mit nur einem Strahlrohr gelöscht", () => {
  const brand = (mitVerteiler) => {
    let s = S.neuerStand(R, T0, 23)
    for (const bp of ["bp01", "bp02", "bp03", "bp04"]) s = kaufe(s, { art: "bauplatz", id: bp })
    s = kaufe(s, { art: "fahrzeug", id: "tsf_w" })
    for (const p of s.personal) p.lehrgaenge.fahrberechtigung = T0 - 1
    if (!mitVerteiler) s = S.einraeumen(s, { fahrzeug: s.fahrzeuge[0].id, geraet: "verteiler", richtung: "aus" }, R).stand
    s.freigeschaltet.push("b_hecke")
    s = kaufe(s, { art: "einsatzart", id: "b_hecke" })
    for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
    const e = S._intern.erzeuge(R, s, "b_hecke", T0 + MIN, trocken, null, "hecke_nachbar")
    assert.equal(e.status, "alarmiert", e.grund)
    return e.plan
  }
  const mit = brand(true)
  const ohne = brand(false)
  assert.ok(ohne.arbeit_ende - ohne.eintreffen > mit.arbeit_ende - mit.eintreffen, "ohne Verteiler muss es länger dauern")
  assert.ok(ohne.faktoren.some((f) => /Verteiler/.test(f.text)), JSON.stringify(ohne.faktoren))
  assert.ok(mit.faktoren.some((f) => f.grund === "loeschen" && f.faktor < 1), "zwei Rohre löschen schneller")
})

test("Bauen: ein Haus braucht Bauzeit, erst danach zieht die Einsatzkraft ein", () => {
  let s = S.neuerStand(R, T0, 30)
  s = kaufe(s, { art: "bauplatz", id: "bp01" }, T0, false)
  assert.equal(s.personal.length, 0)
  assert.equal(s.baustellen.length, 1)
  const b = s.baustellen[0]
  assert.equal(b.ende - b.start, R.BAU.haus_h * 3600000)
  assert.equal(S._intern.bauPhase(R, b, b.start + 1).id, "erdarbeiten")
  assert.equal(S._intern.bauPhase(R, b, b.ende - 1).id, "abnahme")
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const fertig = S.fortschreiben(s, b.ende + 1000, trocken, R)
  assert.equal(fertig.baustellen.length, 0)
  assert.equal(fertig.personal.length, 1)
  assert.equal(fertig.bauchronik[0].name, "Haus auf BP01")
})

test("Bauen: die Baufirma hat zwei Kolonnen, der dritte Auftrag wartet", () => {
  let s = S.neuerStand(R, T0, 31)
  for (const bp of ["bp01", "bp02", "bp03"]) s = kaufe(s, { art: "bauplatz", id: bp }, T0, false)
  const [a, b, c] = s.baustellen
  assert.equal(a.start, T0)
  assert.equal(b.start, T0)
  assert.equal(c.start, a.ende)
})

test("Bauen: schlechtes Wetter verlängert die Bauzeit, nach dem Ende einmal nachgerechnet", () => {
  let s = S.neuerStand(R, T0, 32)
  s = kaufe(s, { art: "bauplatz", id: "bp01" }, T0, false)
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const ende = s.baustellen[0].ende
  const sturm = S.fortschreiben(s, ende + 1000, () => "sturm", R)
  assert.equal(sturm.baustellen.length, 1, "bei Sturm noch nicht fertig")
  assert.equal(sturm.baustellen[0].verzug_ms, ende - T0)
  const spaeter = S.fortschreiben(sturm, 2 * ende - T0 + 1000, () => "sturm", R)
  assert.equal(spaeter.baustellen.length, 0)
})

test("Bauen: Umbau am Gerätehaus bremst das Ausrücken (Behelfsbetrieb), nicht mehr bei der Abnahme", () => {
  let s = katzenWache(33, { stiefel: 2 })
  const ohne = katze(s).e
  s = kaufe(s, { art: "gebaeude", id: "geraetehaus" }, T0, false)
  const b = s.baustellen[0]
  assert.ok(S._intern.behelfAktiv(R, s, "geraetehaus", T0 + 1))
  assert.ok(!S._intern.behelfAktiv(R, s, "geraetehaus", b.ende - 1), "Abnahme zählt nicht")
  const mit = katze(s).e
  assert.ok(mit.plan.eintreffen - mit.meldung > ohne.plan.eintreffen - ohne.meldung)
  assert.ok(mit.plan.faktoren.some((f) => f.grund === "behelf"))
  assert.match(S.kaufe(s, { art: "gebaeude", id: "geraetehaus" }, T0 + 1, R).fehler || "", /schon gebaut/)
})

test("Bauen: eine laute Baustelle an der Strecke kostet Zeit", () => {
  let s = katzenWache(34, { stiefel: 2 })
  s = kaufe(s, { art: "bauplatz", id: "bp07" }, T0, false)
  const b = s.baustellen[0]
  const amWeg = S._intern.baustellenAmWeg(R, s, [R.ORTE.feuerwehrhaus, R.ORTE.baum_feuerwehr, b.ort], T0 + 1)
  assert.ok(amWeg.length >= 1)
})

test("Bauen: Baustellen-Einsätze entstehen nur, solange gebaut wird", () => {
  let s = S.neuerStand(R, T0, 35)
  for (const bp of ["bp01", "bp02", "bp03"]) s = kaufe(s, { art: "bauplatz", id: bp })
  s = kaufe(s, { art: "gebaeude", id: "geraetehaus" }, T0, false)
  assert.ok(s.einsatzarten.th_baustelle, "mit der Baustelle aktiv")
  for (const [id, a] of Object.entries(s.einsatzarten)) if (id !== "th_baustelle") a.naechster = T0 + 1e12
  const b = s.baustellen[0]
  const nachher = S.fortschreiben(s, b.ende + 10 * 24 * 3600000, trocken, R)
  const unfaelle = nachher.abgeschlossen.filter((e) => e.art === "th_baustelle")
  for (const e of unfaelle) {
    assert.ok(e.meldung >= b.start && e.meldung < b.ende + (nachher.bauchronik[0].verzug_ms || 0), "nur während des Baus")
    assert.equal(e.ort, "baustelle:" + b.id)
  }
})

test("Tagesbilanz: Durchschnitt aller Einsätze des Tages, verfallene zählen mit 0 Sternen", () => {
  const s = S.neuerStand(R, T0, 31)
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  const tag = S._intern.tagVon(T0)
  s.tage = { [tag]: { anzahl: 3, sterne: 4 + 3 + 0, erfolgreich: 2, arten: ["tier_katze"], abgerechnet: false } }
  const nachts = S.fortschreiben(s, S._intern.tagesende(tag) + MIN, trocken, R)
  const d = nachts.tage[tag]
  assert.equal(d.durchschnitt, 2.3)
  assert.ok(!nachts.freigeschaltet.includes("b_muelltonne"), "2,3 Sterne reichen nicht für 3")
  assert.ok(d.xp > 0 && d.xp <= 150)
})

test("Tagesende liegt um Mitternacht Ortszeit, auch an der Zeitumstellung", () => {
  assert.equal(new Date(S._intern.tagesende("2026-10-14")).toISOString(), "2026-10-14T22:00:00.000Z")
  assert.equal(new Date(S._intern.tagesende("2026-12-01")).toISOString(), "2026-12-01T23:00:00.000Z")
  assert.equal(new Date(S._intern.tagesende("2026-10-24")).toISOString(), "2026-10-24T22:00:00.000Z")
  assert.equal(new Date(S._intern.tagesende("2026-10-25")).toISOString(), "2026-10-25T23:00:00.000Z")
  assert.equal(S._intern.tagVon(Date.parse("2026-10-14T22:30:00Z")), "2026-10-15")
})

test("Einsatz sofort: nur gekaufte Arten, sonst eine zufällige gekaufte", () => {
  const s = S.neuerStand(R, T0, 32)
  assert.ok(S.sofort(s, "b_hecke", T0 + MIN, trocken, R).fehler)
  const r = S.sofort(s, null, T0 + MIN, trocken, R)
  assert.ok(!r.fehler, r.fehler)
  assert.equal(r.einsatz.art, "tier_katze")
  assert.ok(r.einsatz.sofort)
  assert.ok(r.stand.laufend.some((e) => e.id === r.einsatz.id))
})

test("Schutzzonen: dort nur harmlose Einsätze, dramatische weichen auf andere Orte aus", () => {
  const h = R.ORTE.hecke_werkstatt
  const RZ = Object.assign({}, R, { SCHUTZZONEN: [{ x: h.x, z: h.z, r: 5 }] })
  const s = S.neuerStand(RZ, T0, 7)
  for (let i = 0; i < 40; i++) {
    const e = S._intern.erzeuge(RZ, s, "b_hecke", T0 + i * MIN, trocken, null)
    assert.notEqual(e.ort, "hecke_werkstatt")
  }
  assert.equal(S._intern.ortErlaubt(RZ, s, R.EINSATZARTEN.b_hecke, "hecke_werkstatt"), false)
  assert.equal(S._intern.ortErlaubt(RZ, s, R.EINSATZARTEN.tier_katze, "hecke_werkstatt"), true)
  // ohne Zonen (öffentliches Regelwerk) ist alles erlaubt
  assert.equal(S._intern.ortErlaubt(R, s, R.EINSATZARTEN.b_hecke, "hecke_werkstatt"), true)
})
