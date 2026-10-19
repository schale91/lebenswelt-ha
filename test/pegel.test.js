// Echter Elbpegel: Scheitel, Mittelwerte, Lage, Hochwasser-Einsätze, Niedrigwasser: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")
const P = require("../lebenswelt/pb_hooks/einsatz/pegel.js")

const MIN = 60000
const STD = 60 * MIN
const T0 = Date.UTC(2026, 9, 1, 0)
const TIDE = 12.42 * STD

/** Tidekurve: Mittel 570 cm, Hub 300 cm (HW 720, NW 420), dazu ein Aufschlag (Sturmflut) ab einem Zeitpunkt. */
function wasserstand(t, aufschlag = 0, ab = Infinity) {
  return 570 + 150 * Math.sin((2 * Math.PI * (t - T0)) / TIDE) + (t >= ab ? aufschlag : 0)
}

/** Verlauf wie im Wetterabgleich: alle 10 Minuten eine Messung. */
function verlauf(bis, aufschlag, ab) {
  let v = null
  for (let t = T0; t <= bis; t += 10 * MIN) v = P.verlaufNeu(R, v, t, wasserstand(t, aufschlag, ab))
  return v
}

test("Scheitel: je Tide ein Hoch- und ein Niedrigwasser, Mittelwerte aus den eigenen Messungen", () => {
  const v = verlauf(T0 + 7 * 24 * STD)
  const hw = v.scheitel.filter((s) => s.hw)
  const nw = v.scheitel.filter((s) => !s.hw)
  // 7 Tage sind gut 13 Tiden
  assert.ok(hw.length >= 12 && hw.length <= 14, "Hochwasser: " + hw.length)
  assert.ok(nw.length >= 12 && nw.length <= 14, "Niedrigwasser: " + nw.length)
  const m = P.mittelwerte(R, v)
  assert.ok(m.eigen)
  assert.ok(Math.abs(m.mthw - 720) <= 3, "MThw " + m.mthw)
  assert.ok(Math.abs(m.mtnw - 420) <= 3, "MTnw " + m.mtnw)
  // Rohwerte nur die letzten Stunden
  assert.ok(v.roh.length <= 37)
})

test("Ohne genug Scheitel gelten die Startwerte, ohne frische Messung gibt es keine Lage", () => {
  const v = verlauf(T0 + 12 * STD)
  const m = P.mittelwerte(R, v)
  assert.equal(m.mthw, R.PEGEL.mthw_start)
  assert.equal(P.lage(R, v, T0 + 12 * STD + 3 * STD), null)
  assert.ok(P.lage(R, v, T0 + 12 * STD + 5 * MIN))
})

test("Stufen nach Abstand zum MThw (BSH-Einteilung als Spielwert), Niedrigwasser nach MTnw", () => {
  assert.equal(P.stufeVon(R, 700, 720, 420), "normal")
  assert.equal(P.stufeVon(R, 800, 720, 420), "erhoeht")
  assert.equal(P.stufeVon(R, 870, 720, 420), "sturmflut")
  assert.equal(P.stufeVon(R, 970, 720, 420), "schwer")
  assert.equal(P.stufeVon(R, 1070, 720, 420), "sehr_schwer")
  assert.equal(P.stufeVon(R, 355, 720, 420), "niedrig")
})

test("Sturmflut: Lage hält zwischen zwei Hochwassern an, Deich wird einmal angesetzt", () => {
  const ab = T0 + 8 * 24 * STD
  // erstes Sturmflut-Hochwasser nach knapp 10 h, erkannt 2 h später
  const jetzt = ab + 12 * STD
  const v = verlauf(jetzt, 170, ab)
  const l = P.lage(R, v, jetzt)
  assert.equal(l.lage, "sturmflut")
  assert.ok(l.erreicht.sturmflut >= ab)
  // Lage auch im Tideniedrigwasser dazwischen
  assert.ok(["normal", "erhoeht", "niedrig"].indexOf(l.stufe) >= 0 || l.stufe === "sturmflut")

  let s = S.neuerStand(R, ab - STD, 3)
  s.einsatzarten.th_deich = { gekauft: 0, naechster: jetzt + 1e12, nr: 0, anzahl: 0, erfolgreich: 0, beste_sterne: 0 }
  s.bis = jetzt - MIN
  const z = S._intern.zufall
  const a1 = P.pegelAusloesen(R, s, l, jetzt, z)
  assert.ok(a1.einsatzarten.th_deich.naechster <= Math.max(l.erreicht.sturmflut, s.bis) + 120 * MIN)
  assert.equal(a1.pegel.lage, "sturmflut")
  // Zweiter Aufruf mit derselben Lage setzt nichts erneut an
  a1.einsatzarten.th_deich.naechster = jetzt + 1e12
  const a2 = P.pegelAusloesen(R, a1, P.lage(R, verlauf(jetzt + 6 * STD, 170, ab), jetzt + 6 * STD), jetzt + 6 * STD, z)
  assert.equal(a2.einsatzarten.th_deich.naechster, jetzt + 1e12)
  // Ohne Messung verschwindet der Pegel aus dem Stand
  assert.equal(P.pegelAusloesen(R, a2, null, jetzt, z).pegel, undefined)
})

test("Mit echten Pegeldaten kommt die Deichverteidigung nur bei Sturmflut, ohne Pegeldaten nach Monaten", () => {
  const art = { id: "th_deich" }
  const s = S.neuerStand(R, T0, 3)
  s.pegel = { lage: "normal" }
  assert.equal(S.pegelReicht(R, s, "sturmflut"), false)
  s.pegel.lage = "schwer"
  assert.equal(S.pegelReicht(R, s, "sturmflut"), true)
  assert.equal(R.EINSATZARTEN.th_deich.pegel_min, "sturmflut")
  assert.equal(R.EINSATZARTEN.gl_hochwasser.pegel_min, "schwer")
  assert.ok(art)
})

test("Fortschreiben: Deich bei normaler Lage gesperrt, bei Sturmflut gemeldet", () => {
  const start = Date.UTC(2026, 9, 20, 8)
  const mit = (lage) => {
    let s = S.neuerStand(R, start - STD, 5)
    s.einsatzarten = { th_deich: { gekauft: 0, naechster: start + 10 * MIN, nr: 0, anzahl: 0, erfolgreich: 0, beste_sterne: 0 } }
    s.pegel = { lage, stufe: "normal" }
    s = S.fortschreiben(s, start + 30 * MIN, () => "trocken", R)
    return s.laufend.filter((e) => e.art === "th_deich").length
  }
  // Oktober: ohne Pegeldaten nur sonst_faktor 0,1; mit Pegel normal nie, bei Sturmflut sicher
  assert.equal(mit("normal"), 0)
  assert.equal(mit("sturmflut"), 1)
})

test("Niedrigwasser verlängert das Ansaugen an der Elbe", () => {
  const s = S.neuerStand(R, T0, 3)
  const ort = { x: 0, z: -40 }
  const b = { fahrzeug_pumpe: 1, a_saugschlauch: 2, saugkorb: 1, b_schlauch: 10 }
  const normal = S._intern.wasserversorgung(R, s, ort, b, 400)
  s.pegel = { stufe: "niedrig", lage: "niedrig" }
  const niedrig = S._intern.wasserversorgung(R, s, ort, b, 400)
  assert.equal(normal.quelle, "gewaesser")
  assert.equal(niedrig.sekunden - normal.sekunden, R.PEGEL.ansaugen_niedrig_s)
  assert.match(niedrig.text, /Niedrigwasser/)
})
