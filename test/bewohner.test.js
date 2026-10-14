// Tests für Bewohner, Berufe, Mitgliedschaften, Level und Sportplatz: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit (Arbeitszeit)
const ABEND = Date.UTC(2026, 9, 13, 18) // Dienstag, 20 Uhr Ortszeit
const FEIERABEND = Date.UTC(2026, 9, 13, 15, 30) // Dienstag, 17:30 Uhr Ortszeit, noch hell
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0, sofort = true) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  if (sofort) for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Katze am Baum beim Feuerwehrhaus zum Zeitpunkt t auslösen und bis zum Ende fortschreiben. */
function katze(s, t, dauer = 2 * STD) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = Math.max(x.bis, t)
  const e = S._intern.erzeuge(R, x, "tier_katze", t, trocken, null, "baum_feuerwehr")
  const fertig = S.fortschreiben(x, t + dauer, trocken, R)
  return fertig.abgeschlossen.find((a) => a.id === e.id) || fertig.laufend.find((a) => a.id === e.id)
}

/** Stand mit Leiter und Fahrrad an einem Haus nahe dem Feuerwehrhaus. */
function mitHaus(bewohner) {
  let s = S.neuerStand(R, T0, 1)
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  return s
}

test("Level wie in der App: Level 5 ab 2478 XP, Level 30 ab 152066 XP", () => {
  assert.equal(S.levelAusXp(0), 0)
  assert.equal(S.levelAusXp(99), 0)
  assert.equal(S.levelAusXp(100), 1)
  assert.equal(S.levelAusXp(2477), 4)
  assert.equal(S.levelAusXp(2478), 5)
  assert.equal(S.levelAusXp(152065), 29)
  assert.equal(S.levelAusXp(152066), 30)
})

test("Ohne Angabe zieht wie bisher eine immer verfügbare Feuerwehrkraft ein", () => {
  const s = mitHaus(undefined)
  assert.equal(s.personal[0].org, "feuerwehr")
  assert.equal(s.personal[0].beruf, "frei")
  assert.equal(katze(s, T0 + MIN).status, "abgeschlossen")
})

test("Wer auswärts arbeitet, fehlt werktags in der Arbeitszeit, abends ist er da", () => {
  const s = mitHaus({ org: "feuerwehr", beruf: "auswaerts" })
  // Werktags um 10 Uhr ist niemand da: Der Einsatz wartet bis zum Feierabend und bringt dann nur noch einen Stern
  const tags = katze(s, T0 + MIN, 12 * STD)
  assert.equal(tags.status, "abgeschlossen")
  assert.ok(tags.alarm_spaeter_s >= 6 * 3600, "erst nach Feierabend: " + tags.alarm_spaeter_s)
  assert.equal(tags.bewertung.sterne, 1)
  assert.equal(katze(s, FEIERABEND).status, "abgeschlossen")
  // Samstag 10 Uhr: keine Arbeitszeit
  assert.equal(katze(s, T0 + 4 * 24 * STD).status, "abgeschlossen")
})

test("Wer im Dorf arbeitet, kommt in der Arbeitszeit vom Arbeitsplatz und braucht länger als abends", () => {
  const s = mitHaus({ org: "feuerwehr", beruf: "dorf", arbeitgeber: "hof" })
  assert.equal(s.personal[0].arbeitgeber, "hof")
  const p = s.personal[0]
  const tags = S._intern.feuerwehrBereit(R, s, p, T0, "trocken") - T0
  const abends = S._intern.feuerwehrBereit(R, s, p, ABEND, "trocken") - ABEND
  assert.ok(tags > abends + 60 * 1000, `tags ${tags} ms, abends ${abends} ms`)
})

test("Arbeitgeber im Dorf haben begrenzte Stellen, auch Häuser im Bau zählen mit", () => {
  let s = S.neuerStand(R, T0, 1)
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "feuerwehr", beruf: "dorf", arbeitgeber: "hof" } }, T0, false)
  const r = S.kaufe(s, { art: "bauplatz", id: "bp02", bewohner: { org: "feuerwehr", beruf: "dorf", arbeitgeber: "hof" } }, T0, R)
  assert.match(r.fehler, /keine Stelle frei/)
  const ohne = S.kaufe(s, { art: "bauplatz", id: "bp02", bewohner: { org: "feuerwehr" } }, T0, R)
  assert.match(ohne.fehler, /Beruf wählen/)
  assert.equal(S._intern.freieStellen(R, s, "markt"), 2)
  assert.equal(S._intern.freieStellen(R, s, "platzwart"), 0) // erst mit dem Vereinsheim
})

test("Schichtplan: fünf Tage im Wechsel, die Nachtschicht reicht bis 6 Uhr am Folgetag", () => {
  const p = { id: "p1", org: "polizei", beruf: "schicht" }
  let stunden = 0
  for (let t = T0; t < T0 + 5 * 24 * STD; t += STD) if (S._intern.inSchicht(R, p, t)) stunden++
  assert.equal(stunden, 24) // je 8 Stunden Früh, Spät und Nacht in fünf Tagen
  const verschoben = { id: "p2", org: "polizei", beruf: "schicht" }
  let gleich = 0
  for (let t = T0; t < T0 + 24 * STD; t += STD) if (S._intern.inSchicht(R, p, t) === S._intern.inSchicht(R, verschoben, t)) gleich++
  assert.ok(gleich < 24, "Schichten sind je Person versetzt")
})

test("Polizist im Dorf tritt in die Feuerwehr ein: Grundausbildung, danach außerhalb der Schicht in der Feuerwehr", () => {
  let s = mitHaus({ org: "polizei" })
  const p = s.personal[0]
  assert.equal(p.org, "polizei")
  assert.equal(p.beruf, "schicht")
  s = kaufe(s, { art: "mitgliedschaft", id: "feuerwehr", ziel: p.id })
  const q = s.personal[0]
  assert.deepEqual(q.mitglied, ["feuerwehr"])
  assert.ok(q.lehrgang_laeuft && q.lehrgang_laeuft.id === "tm1")
  assert.equal(S._intern.einsatzbereitFuer(R, q, "feuerwehr", T0 + MIN), false, "während der Grundausbildung nicht")
  const nachher = T0 + 20 * STD
  // Keine Einsätze dazwischen, damit niemand gerade unterwegs ist
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  s = S.fortschreiben(s, nachher, trocken, R)
  const r = s.personal[0]
  assert.ok(r.lehrgaenge.tm1, "Grundausbildung abgeschlossen")
  // Über fünf Tage: in der Schicht nie für die Feuerwehr, außerhalb immer; für die Polizei immer
  for (let t = nachher; t < nachher + 5 * 24 * STD; t += STD) {
    const schicht = S._intern.inSchicht(R, r, t)
    assert.equal(S._intern.einsatzbereitFuer(R, r, "feuerwehr", t), !schicht)
    assert.equal(S._intern.einsatzbereitFuer(R, r, "polizei", t), true)
  }
  const nochmal = S.kaufe(s, { art: "mitgliedschaft", id: "feuerwehr", ziel: r.id }, nachher, R)
  assert.match(nochmal.fehler, /Schon Mitglied/)
})

test("Nur wer im Dorf wohnt, kann als Polizist in die Feuerwehr", () => {
  let s = S.neuerStand(R, T0, 1)
  s = kaufe(s, { art: "personal", id: "polizei" })
  const r = S.kaufe(s, { art: "mitgliedschaft", id: "feuerwehr", ziel: s.personal[0].id }, T0, R)
  assert.match(r.fehler, /im Dorf wohnt/)
})

test("Polizei im Dorf zählt zur Dienststelle", () => {
  let s = S.neuerStand(R, T0, 1)
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "polizei" } }, T0, false)
  // Büro der Kontaktbeamtin: höchstens eine Person, das Haus im Bau zählt schon
  const r = S.kaufe(s, { art: "personal", id: "polizei" }, T0, R)
  assert.match(r.fehler, /voll besetzt/)
})

test("Ein Polizist in der Feuerwehr ist nie in zwei Einsätzen zugleich", () => {
  let s = mitHaus({ org: "polizei" })
  s = kaufe(s, { art: "mitgliedschaft", id: "feuerwehr", ziel: s.personal[0].id })
  s = S.fortschreiben(s, T0 + 20 * STD, trocken, R)
  // einen Zeitpunkt außerhalb der Schicht suchen
  let t = T0 + 20 * STD
  while (S._intern.inSchicht(R, s.personal[0], t)) t += STD
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  S._intern.erzeuge(R, x, "p_ruhestoerung", t, trocken, null)
  S._intern.erzeuge(R, x, "tier_katze", t, trocken, null, "baum_feuerwehr")
  const laufend = x.laufend.filter((e) => e.plan && e.plan.personen.length)
  assert.equal(laufend.length, 1, "nur ein Einsatz bekommt die Person")
})

test("Level: der Sportplatz ist erst ab Level 5 kaufbar, der Sportverein auch", () => {
  let s = S.neuerStand(R, T0, 1)
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  const r = S.kaufe(s, { art: "gebaeude", id: "sportplatz" }, T0, R)
  assert.match(r.fehler, /Erst ab Level 5/)
  const v = S.kaufe(s, { art: "mitgliedschaft", id: "sportverein", ziel: s.personal[0].id }, T0, R)
  assert.match(v.fehler, /Erst ab Level 5/)
  s.level = 5
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  assert.equal(s.gebaeude.sportplatz, 1)
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  assert.equal(s.gebaeude.sportplatz, 4)
  const heim = S.kaufe(s, { art: "gebaeude", id: "sportplatz" }, T0, R)
  assert.match(heim.fehler, /Erst ab Level 12/)
})

test("Rasenplatz: eigene Bauphasen, im Winter wächst der Rasen langsamer an", () => {
  let s = S.neuerStand(R, T0, 1)
  s.level = 5
  for (let i = 0; i < 3; i++) s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  const sommer = S.kaufe(s, { art: "gebaeude", id: "sportplatz" }, Date.UTC(2026, 5, 2, 8), R).stand.baustellen[0]
  const winter = S.kaufe(s, { art: "gebaeude", id: "sportplatz" }, Date.UTC(2026, 11, 1, 8), R).stand.baustellen[0]
  assert.equal(sommer.phasen, "rasen")
  assert.equal(Math.round((sommer.ende - sommer.start) / STD), 48)
  assert.equal(Math.round((winter.ende - winter.start) / STD), 120)
  const mitte = S._intern.bauPhase(R, sommer, sommer.start + 0.6 * (sommer.ende - sommer.start))
  assert.equal(mitte.id, "anwachsen")
})

test("Training: Verein auf der Bolzwiese +0,5, Trimm-dich-Pfad für alle, ohne Training sinkt die Fitness bis 50", () => {
  let s = S.neuerStand(R, T0, 1)
  s.level = 5
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  const [a, b] = s.personal.map((p) => p.id)
  s = kaufe(s, { art: "mitgliedschaft", id: "sportverein", ziel: a })
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" }) // Bolzwiese
  assert.equal(S._intern.naechstesTraining(R, T0), ABEND - STD) // Dienstag 19 Uhr
  s = S.fortschreiben(s, ABEND, trocken, R)
  const fit = (st, id) => st.personal.find((p) => p.id === id).fitness
  assert.equal(fit(s, a), 50.5)
  assert.equal(fit(s, b), 50)
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" }, ABEND) // Trimm-dich-Pfad
  s = S.fortschreiben(s, ABEND + 2 * 24 * STD, trocken, R) // Donnerstag
  assert.equal(fit(s, a), 51)
  assert.equal(fit(s, b), 50.2)
  // Austritt: ohne Training sinkt die Fitness langsam, nie unter 50
  s.personal.find((p) => p.id === a).sportverein = false
  s.gebaeude.sportplatz = 0
  s = S.fortschreiben(s, ABEND + 60 * 24 * STD, trocken, R)
  assert.equal(fit(s, a), 50)
  assert.equal(fit(s, b), 50)
})

test("Training im Winter ohne Flutlicht bringt nur so viel wie Joggen", () => {
  let s = S.neuerStand(R, Date.UTC(2026, 11, 1, 8), 1)
  s.level = 5
  s = kaufe(s, { art: "bauplatz", id: "bp01" }, s.bis)
  s = kaufe(s, { art: "mitgliedschaft", id: "sportverein", ziel: s.personal[0].id }, s.bis)
  for (let i = 0; i < 4; i++) s = kaufe(s, { art: "gebaeude", id: "sportplatz" }, s.bis) // Rasenplatz
  s = S.fortschreiben(s, s.training_naechster || S._intern.naechstesTraining(R, s.bis) + MIN, trocken, R)
  s = S.fortschreiben(s, S._intern.naechstesTraining(R, s.bis - 2 * STD) + MIN, trocken, R)
  assert.equal(s.personal[0].fitness, 50.3)
})

test("Fitness macht schneller: mit Fitness 80 ist die Katze früher gerettet", () => {
  const s = mitHaus(undefined)
  const normal = katze(s, T0 + MIN)
  const fit = JSON.parse(JSON.stringify(s))
  fit.personal[0].fitness = 80
  const schnell = katze(fit, T0 + MIN)
  assert.ok(schnell.plan.arbeit_ende < normal.plan.arbeit_ende, `${schnell.plan.arbeit_ende} < ${normal.plan.arbeit_ende}`)
})

test("Alter Stand (Version 1) wird übernommen und ergibt dieselbe Bewertung", () => {
  const s = mitHaus(undefined)
  const alt = JSON.parse(JSON.stringify(s))
  alt.version = 1
  delete alt.level
  delete alt.gebaeude.sportplatz
  for (const p of alt.personal) {
    delete p.beruf
    delete p.fitness
  }
  const a = katze(alt, T0 + MIN)
  const b = katze(s, T0 + MIN)
  assert.equal(a.bewertung.sterne, b.bewertung.sterne)
  assert.equal(a.plan.arbeit_ende, b.plan.arbeit_ende)
  const neu = S.fortschreiben(alt, T0 + MIN, trocken, R)
  assert.equal(neu.version, 2)
  assert.equal(neu.personal[0].beruf, "frei")
  assert.equal(neu.gebaeude.sportplatz, 0)
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, auch mit Training und Berufen", () => {
  let s = S.neuerStand(R, T0, 7)
  s.level = 5
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "feuerwehr", beruf: "auswaerts" } })
  s = kaufe(s, { art: "bauplatz", id: "bp02", bewohner: { org: "feuerwehr", beruf: "dorf", arbeitgeber: "markt" } })
  s = kaufe(s, { art: "geraet", id: "klappleiter" })
  s = kaufe(s, { art: "mitgliedschaft", id: "sportverein", ziel: s.personal[0].id })
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  s = kaufe(s, { art: "gebaeude", id: "sportplatz" })
  const ende = T0 + 10 * 24 * STD
  const ganz = S.fortschreiben(s, ende, trocken, R)
  let teile = s
  for (let t = T0 + 7 * STD; t < ende; t += 13 * STD) teile = S.fortschreiben(teile, t, trocken, R)
  teile = S.fortschreiben(teile, ende, trocken, R)
  assert.deepEqual(teile, ganz)
  assert.ok(ganz.personal[0].fitness > 50)
})
