// Einwohner von Elbe Springs (Entscheidung vom 19.10.2026): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const STD = 3600000
const trocken = () => "trocken"

function elbe(level = 0) {
  const alt = S.neuerStand(R, T0, 1)
  const s = S.neustart(alt, T0, R).stand
  s.level = level
  return s
}

function fertig(s, t = T0) {
  for (const b of s.baustellen.slice()) S._intern.fertigstellen(R, s, b, t)
  return s
}

test("Zum Start: du und drei Feuerwehrleute mit Namen, noch ohne Job", () => {
  const s = elbe()
  assert.deepEqual(s.personal.map((p) => [p.org, p.beruf, p.anrede]), [["feuerwehr", "ohne", "Frau"], ["feuerwehr", "ohne", "Herr"], ["feuerwehr", "ohne", "Herr"]])
  assert.ok(s.personal.every((p) => p.name && s.haeuser.some((h) => h.id === p.haus)))
  // Ohne Job zu Hause: für die Feuerwehr erreichbar
  assert.ok(s.personal.every((p) => S._intern.einsatzbereitFuer(R, p, "feuerwehr", T0, s)))
})

test("Bestehende Kräfte bleiben, verlieren aber den alten Job; fehlende Startkräfte ziehen ein; nur einmal", () => {
  const s = elbe()
  delete s.einwohner_start
  s.personal = [Object.assign(s.personal[0], { beruf: "dorf", arbeitgeber: "markt" })]
  const w = S.fortschreiben(s, T0 + 60000, trocken, R)
  assert.equal(w.personal.length, 3)
  assert.equal(w.personal[0].beruf, "ohne")
  assert.equal(w.personal[0].arbeitgeber, undefined)
  // Ein zweites Mal ändert nichts mehr
  w.personal[0].beruf = "auswaerts"
  const w2 = S.fortschreiben(w, T0 + 120000, trocken, R)
  assert.equal(w2.personal[0].beruf, "auswaerts")
  assert.equal(w2.personal.length, 3)
})

test("Einladen: Einwohnerin mit Name, Anrede und Aussehen; Einzugsgebühr steigt; höchstens 3 + Level", () => {
  let s = elbe(2)
  const k = S.kaufe(s, { art: "wohnhaus", bewohner: { org: "buerger", name: "  Ilka Meyer  ", anrede: "Frau", aussehen: "nb_jule" } }, T0, R)
  assert.ok(!k.fehler, k.fehler)
  s = fertig(k.stand)
  const p = s.personal.at(-1)
  assert.deepEqual([p.org, p.beruf, p.name, p.anrede, p.aussehen], ["buerger", "ohne", "Ilka Meyer", "Frau", "nb_jule"])
  const platz = (k2) => R.BAUPLAETZE.find((b) => b.id === k2.buchung.split(":")[1]).preis
  const k2 = S.kaufe(s, { art: "wohnhaus", bewohner: { org: "buerger" } }, T0, R)
  assert.equal(k2.preis, S.preis(R, platz(k2) + 4 * R.EINWOHNER.einzug_roh_je))
  s = fertig(k2.stand)
  // Level 2: höchstens fünf Einwohner
  const voll = S.kaufe(s, { art: "wohnhaus", bewohner: { org: "buerger" } }, T0, R)
  assert.match(voll.fehler, /ab Level 3/)
  // Unsinnige Angaben fallen weg
  s.level = 9
  const k3 = fertig(S.kaufe(s, { art: "wohnhaus", bewohner: { org: "buerger", anrede: "Dr.", aussehen: "../x", name: "x".repeat(80) } }, T0, R).stand)
  const q = k3.personal.at(-1)
  assert.equal(q.anrede, "")
  assert.equal(q.aussehen, undefined)
  assert.equal(q.name.length, 40)
})

test("Bürgerinnen und Bürger rücken nicht aus, erst als Mitglied der Freiwilligen Feuerwehr", () => {
  let s = elbe(5)
  s = fertig(S.kaufe(s, { art: "wohnhaus", bewohner: { org: "buerger" } }, T0, R).stand)
  const p = s.personal.at(-1)
  assert.equal(S._intern.einsatzbereitFuer(R, p, "feuerwehr", T0, s), false)
  const m = S.kaufe(s, { art: "mitgliedschaft", id: "feuerwehr", ziel: p.id }, T0, R)
  assert.ok(!m.fehler, m.fehler)
  const q = m.stand.personal.find((x) => x.id === p.id)
  // Nach der Grundausbildung einsatzbereit
  assert.equal(S._intern.einsatzbereitFuer(R, q, "feuerwehr", T0 + 20 * STD, m.stand), true)
})

test("Job vergeben: Stellen sind begrenzt, ohne Job und Pendeln gehen immer, Polizei behält ihren Dienst", () => {
  const s = elbe(5)
  const [a, b, c] = s.personal
  let r = S.setzeJob(s, a.id, { beruf: "dorf", arbeitgeber: "krapfen" }, R)
  assert.ok(!r.fehler, r.fehler)
  assert.equal(r.stand.personal[0].arbeitgeber, "krapfen")
  // Die Krapfen-Bude hat eine Stelle
  assert.match(S.setzeJob(r.stand, b.id, { beruf: "dorf", arbeitgeber: "krapfen" }, R).fehler, /keine Stelle/)
  // Wer die Stelle hat, kann sie behalten
  assert.ok(!S.setzeJob(r.stand, a.id, { beruf: "dorf", arbeitgeber: "krapfen" }, R).fehler)
  r = S.setzeJob(r.stand, c.id, { beruf: "dorf", arbeitgeber: "geraetewart" }, R)
  assert.equal(r.stand.personal[2].arbeitgeber, "geraetewart")
  r = S.setzeJob(r.stand, a.id, { beruf: "auswaerts" }, R)
  assert.equal(r.stand.personal[0].arbeitgeber, undefined)
  assert.ok(S.setzeJob(r.stand, a.id, { beruf: "dorf", arbeitgeber: "gibtsnicht" }, R).fehler)
  // Pendler fehlen werktags in der Arbeitszeit
  assert.equal(S._intern.einsatzbereitFuer(R, r.stand.personal[0], "feuerwehr", T0, r.stand), false)
  r.stand.personal.push({ id: "pX", org: "polizei", beruf: "schicht", lehrgaenge: {}, psa: {} })
  assert.match(S.setzeJob(r.stand, "pX", { beruf: "ohne" }, R).fehler, /Dienst/)
})

test("Figuren aus Geschichten ziehen kostenlos ein, jede nur einmal; die Kontaktbeamtin zur Polizei", () => {
  let s = elbe(0)
  const k = S.kaufe(s, { art: "einladung", id: "hilde", bewohner: { name: "Hilde Brakenhoff", anrede: "Frau", aussehen: "nb_hilde" } }, T0, R)
  assert.ok(!k.fehler, k.fehler)
  assert.equal(k.preis, 0)
  const h = k.stand.personal.at(-1)
  assert.deepEqual([h.org, h.beruf, h.figur, h.name], ["buerger", "ohne", "hilde", "Hilde Brakenhoff"])
  // Auch über der Höchstzahl (Level 0: drei)
  assert.equal(k.stand.personal.length, 4)
  assert.match(S.kaufe(k.stand, { art: "einladung", id: "hilde" }, T0, R).fehler, /schon/)
  const m = S.kaufe(k.stand, { art: "einladung", id: "merle", bewohner: { org: "polizei", name: "Merle", anrede: "Frau" } }, T0, R)
  assert.ok(!m.fehler, m.fehler)
  assert.deepEqual([m.stand.personal.at(-1).org, m.stand.personal.at(-1).beruf], ["polizei", "schicht"])
})
