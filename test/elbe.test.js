// Neustart des Einsatzspiels für Elbe Springs: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")
const kb = require("../lebenswelt/pb_hooks/einsatz/kaufbuch.js")

const T0 = Date.UTC(2026, 9, 13, 8)
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

/** Ein Dorf mit zwei Häusern, Namen und Käufen im Kaufbuch */
function dorf(namen = true) {
  let s = S.neuerStand(R, T0, 1)
  s.level = 9
  for (const bp of ["bp20", "bp19"]) {
    const r = S.kaufe(s, { art: "bauplatz", id: bp }, T0, R)
    assert.ok(!r.fehler, r.fehler)
    s = r.stand
    s.ausgaben.push({ zeit: T0, betrag: r.preis, text: "bauplatz:" + bp })
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(R, s, b, T0)
  }
  if (namen) {
    s.personal[0].name = "Dieter"
    s.personal[1].name = "Marco"
    s.personal[1].beruf = "auswaerts"
  }
  s.ausgaben.push({ zeit: T0 + 1, betrag: 40, text: "geraet:x" }, { zeit: T0 + 2, betrag: -10, text: "erstattung:bauplatz:bp99" })
  return s
}

test("Neustart: alles Gekaufte auf Anfang, Gutschrift über das Kaufbuch, Level bleibt, Dieter und Marco ziehen gleich mit um", () => {
  const alt = dorf()
  const summe = alt.ausgaben.reduce((n, a) => n + a.betrag, 0)
  const n = S.neustart(alt, T0 + STD, R)
  assert.ok(!n.fehler, n.fehler)
  assert.equal(n.erstattung, summe)
  const s = n.stand
  assert.equal(s.welt, "elbe")
  assert.equal(s.level, 9)
  assert.deepEqual(s.fahrzeuge, [])
  assert.equal(s.gebaeude.geraetehaus, 0)
  // Die müssen ja irgendwo wohnen: beide bekommen sofort ein fertiges Wohnhaus, ohne Baukosten
  assert.deepEqual(s.personal.map((p) => [p.name, p.beruf]), [["Dieter", "frei"], ["Marco", "auswaerts"]])
  assert.equal(s.haeuser.length, 2)
  assert.ok(s.haeuser.every((h) => !h.im_bau && h.grund === "umzug"))
  assert.ok(s.personal.every((p) => s.haeuser.some((h) => h.id === p.haus)))
  assert.deepEqual(s.rueckkehrer, [])
  // Die Gutschrift landet einmal im Spielstand, alte Käufe zählen nicht doppelt
  const spiel = { state: { muenzen: 5, einsatzAusgabenBekannt: T0 + 2 } }
  const ab = kb.abgleich(spiel, s.ausgaben)
  assert.equal(ab.daten.state.muenzen, 5 + summe)
  assert.equal(kb.abgleich(ab.daten, s.ausgaben).nachgezogen, 0)
  // Nur einmal
  assert.ok(S.neustart(s, T0 + 2 * STD, R).fehler)
})

test("Ohne Kräfte pausieren die Einsätze, mit dem ersten Wohnhaus zieht jemand ein und es geht los", () => {
  let s = S.neustart(dorf(false), T0, R).stand
  assert.deepEqual(s.personal, [])
  const leer = S.fortschreiben(s, T0 + 48 * STD, trocken, R)
  assert.equal(leer.laufend.length, 0)
  assert.equal(leer.abgeschlossen.length, 0)
  // Im Dorf gibt es keine Bauplätze mehr zu kaufen, in Elbe Springs Wohnhäuser
  assert.ok(S.kaufe(leer, { art: "bauplatz", id: "bp01" }, T0, R).fehler)
  const k = S.kaufe(leer, { art: "wohnhaus", bewohner: { org: "feuerwehr", beruf: "auswaerts" } }, T0 + 48 * STD, R)
  assert.ok(!k.fehler, k.fehler)
  assert.equal(k.buchung, "wohnhaus:bp20")
  assert.equal(k.preis, S.preis(R, 300))
  assert.equal(k.stand.haeuser[0].bauplatz, "bp20")
  s = S.fortschreiben(k.stand, T0 + 48 * STD + (R.BAU.haus_h + 1) * STD, trocken, R)
  assert.equal(s.personal.length, 1)
  // Der zweite nimmt den nächstgünstigen Platz
  const k2 = S.kaufe(s, { art: "wohnhaus", bewohner: { org: "feuerwehr", beruf: "auswaerts" } }, s.bis, R)
  assert.equal(k2.stand.haeuser[1].bauplatz, "bp16")
  const s2 = S.fortschreiben(k2.stand, s.bis + (R.BAU.haus_h + 1) * STD, trocken, R)
  assert.equal(s2.personal.length, 2)
  // Jetzt kommen wieder Einsätze der Feuerwehr
  const spaeter = S.fortschreiben(s2, s2.bis + 72 * STD, trocken, R)
  assert.ok(spaeter.laufend.length + spaeter.abgeschlossen.length > 0)
})

test("Wohnhaus nur in Elbe Springs, Verabschieden erstattet ein frisches Wohnhaus", () => {
  assert.ok(S.kaufe(S.neuerStand(R, T0, 1), { art: "wohnhaus" }, T0, R).fehler)
  const s = S.neustart(dorf(false), T0, R).stand
  const k = S.kaufe(s, { art: "wohnhaus" }, T0, R)
  k.stand.ausgaben.push({ zeit: T0, betrag: k.preis, text: k.buchung })
  for (const b of k.stand.baustellen.slice()) S._intern.fertigstellen(R, k.stand, b, T0)
  const v = S.verabschiede(k.stand, k.stand.personal[0].id, T0 + STD)
  assert.equal(v.erstattung, k.preis)
  assert.deepEqual(v.stand.haeuser, [])
})

test("Schon neu gestartete Stände: Rückkehrer ziehen beim nächsten Fortschreiben ein; Einstellungen bekommen eine Wohnung", () => {
  const s = S.neustart(dorf(false), T0, R).stand
  s.rueckkehrer = [{ name: "Dieter", anrede: "" }]
  const w = S.fortschreiben(s, T0 + MIN, trocken, R)
  assert.equal(w.personal[0].name, "Dieter")
  assert.ok(w.haeuser.some((h) => h.id === w.personal[0].haus))
  const id = Object.keys(R.PERSONAL).find((k) => (R.PERSONAL[k].org || "polizei") === "polizei")
  w.level = 99
  const k = S.kaufe(w, { art: "personal", id }, T0 + 2 * MIN, R)
  assert.ok(!k.fehler, k.fehler)
  const neu = k.stand.personal.at(-1)
  assert.ok(neu.haus && k.stand.haeuser.some((h) => h.id === neu.haus && h.grund === "dienstwohnung"))
})
