// Echte Wetterwarnungen des DWD: Spielwetter und angesetzte Einsätze: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 16)
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"
const warnung = (name, stufe, ab = T0, dauer = 6 * STD) => ({ id: name + "|" + ab, name, stufe, ab, bis: ab + dauer })

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Dorf mit gekauften Sturm- und Glätte-Einsätzen, deren nächste Meldung weit weg liegt. */
function dorf() {
  let s = S.neuerStand(R, T0 - STD, 7)
  s.freigeschaltet.push("th_baum_strasse", "bh_ast", "bh_streuen", "p_vu_sachschaden")
  for (const id of ["th_baum_strasse", "p_vu_sachschaden"]) s = kaufe(s, { art: "einsatzart", id })
  // Eine Polizistin im Dorf, sonst entsteht kein Polizeieinsatz
  s = kaufe(s, { art: "bauplatz", id: "bp01", bewohner: { org: "polizei", beruf: "schicht" } })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  s.bis = T0 - MIN
  return s
}

test("Regeln: Sturm erst ab markantem Wetter, Glätte immer, Gewitter mit Orkanböen zählt als Sturm, Frost allein nicht", () => {
  const r = (name, stufe) => S.warnungsRegel(R, { name, stufe })
  assert.equal(r("STURMBÖEN", 2).wetter, "sturm")
  assert.equal(r("WINDBÖEN", 1), null)
  assert.equal(r("GLÄTTE", 1).wetter, "glaette")
  assert.equal(r("GLATTEIS", 3).wetter, "glaette")
  assert.equal(r("SCHWERES GEWITTER mit ORKANBÖEN", 3).wetter, "sturm")
  assert.equal(r("STARKREGEN", 2).wetter, "nass")
  assert.equal(r("FROST", 1), null)
})

test("Spielwetter: gilt nur während der Warnung, Glätte geht vor Sturm", () => {
  const w = [warnung("STURMBÖEN", 2), warnung("GLÄTTE", 1, T0 + STD)]
  assert.equal(S.wetterAusWarnungen(R, w, T0 - MIN), null)
  assert.equal(S.wetterAusWarnungen(R, w, T0 + 10 * MIN), "sturm")
  assert.equal(S.wetterAusWarnungen(R, w, T0 + 2 * STD), "glaette")
  assert.equal(S.wetterAusWarnungen(R, w, T0 + 7 * STD), null)
  assert.equal(S.wetterMitWarnungen(R, w, [{ ab: 0, wetter: "trocken" }], T0 + 10 * MIN), "sturm")
  assert.equal(S.wetterMitWarnungen(R, w, [{ ab: 0, wetter: "trocken" }], T0 + 8 * STD), "trocken")
})

test("Eine neue Sturmwarnung setzt Baum auf der Straße an, einmal; nicht gekaufte Einsatzarten bleiben aus", () => {
  const s = dorf()
  const w = [warnung("STURMBÖEN", 2)]
  const a = S.warnungenAusloesen(R, s, w, T0 + MIN)
  const n = a.einsatzarten.th_baum_strasse.naechster
  assert.ok(n >= T0 + 20 * MIN && n <= T0 + 90 * MIN, new Date(n).toISOString())
  assert.ok(!a.einsatzarten.bh_ast, "nicht gekauft")
  assert.deepEqual(a.warnungen_gesehen, [w[0].id])
  // Zweiter Aufruf ändert nichts mehr
  const b = S.warnungenAusloesen(R, a, w, T0 + 5 * MIN)
  assert.deepEqual(b, a)
  // Der Ausgangsstand bleibt unverändert
  assert.equal(s.einsatzarten.th_baum_strasse.naechster, T0 + 1e12)
  // Eine Warnung, die erst später beginnt, wartet
  const spaeter = S.warnungenAusloesen(R, s, [warnung("STURMBÖEN", 2, T0 + 3 * STD)], T0 + MIN)
  assert.equal(spaeter.einsatzarten.th_baum_strasse.naechster, T0 + 1e12)
})

test("Von der Warnung bis zum Einsatz: Sturm legt einen Baum auf die Straße, Glätte bringt Unfälle", () => {
  const w = [warnung("STURMBÖEN", 2)]
  let s = S.warnungenAusloesen(R, dorf(), w, T0 + MIN)
  s = S.fortschreiben(s, T0 + 2 * STD, (t) => S.wetterMitWarnungen(R, w, [], t), R)
  const alle = s.laufend.concat(s.abgeschlossen || [])
  assert.ok(alle.some((e) => e.art === "th_baum_strasse"), alle.map((e) => e.art).join(", "))
  const g = [warnung("GLÄTTE", 1)]
  let s2 = S.warnungenAusloesen(R, dorf(), g, T0 + MIN)
  s2 = S.fortschreiben(s2, T0 + 4 * STD, (t) => S.wetterMitWarnungen(R, g, [], t), R)
  assert.ok(s2.laufend.concat(s2.abgeschlossen || []).some((e) => e.art === "p_vu_sachschaden"))
  // Ohne Warnung kein Baum in derselben Zeit
  const ohne = S.fortschreiben(dorf(), T0 + 2 * STD, trocken, R)
  assert.ok(!ohne.laufend.concat(ohne.abgeschlossen || []).some((e) => e.art === "th_baum_strasse"))
})

test("Sensoren der Integration DWD Weather Warnings werden gelesen", () => {
  const z = [
    { entity_id: "sensor.ort_aktuelle_warnstufe", attributes: { region_id: 803353040, warning_count: 1, warning_1_name: "STURMBÖEN", warning_1_level: 2, warning_1_start: "2026-10-13T16:00:00+00:00", warning_1_end: "2026-10-13T22:00:00+00:00" } },
    { entity_id: "sensor.ort_vorwarnstufe", attributes: { region_id: 803353040, warning_count: 2, warning_1_name: "STURMBÖEN", warning_1_level: 2, warning_1_start: "2026-10-13T16:00:00+00:00", warning_1_end: "2026-10-13T22:00:00+00:00", warning_2_name: "GLÄTTE", warning_2_level: 1, warning_2_start: "2026-10-14T02:00:00+00:00" } },
  ]
  const w = S.dwdAus(z)
  assert.equal(w.length, 2)
  assert.deepEqual(w[0], { id: "STURMBÖEN|" + Date.UTC(2026, 9, 13, 16), name: "STURMBÖEN", stufe: 2, ab: Date.UTC(2026, 9, 13, 16), bis: Date.UTC(2026, 9, 13, 22) })
  assert.equal(w[1].bis - w[1].ab, 6 * STD, "ohne Ende: sechs Stunden")
})
