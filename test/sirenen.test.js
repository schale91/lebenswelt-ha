// Sirenen im Dorf: Hörbarkeit, Reaktion beim Sirenenalarm, Ausbau in Stufen, Warnung bei Großlagen: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 16) // Dienstag, 18 Uhr Ortszeit
const NACHT = Date.UTC(2026, 9, 14, 1) // Mittwoch, 3 Uhr Ortszeit
const H = R.SIRENEN.hoeren
const I = S._intern

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) I.fertigstellen(R, r.stand, b, t)
  return r.stand
}

function stand(level = 30) {
  const s = S.neuerStand(R, T0 - 3600000, 7)
  s.level = level
  return s
}

const fw = R.ORTE.feuerwehrhaus
const schule = R.ORTE.schule
const weit = R.ORTE.sportplatz

test("Am Anfang gibt es nur die Motorsirene am Feuerwehrhaus", () => {
  const s = stand()
  assert.deepEqual(I.sirenenVon(R, s).map((x) => [x.id, x.stufe]), [["feuerwehrhaus", 1]])
  assert.equal(I.sireneStufe(R, s, "schule"), 0)
})

test("Reaktion beim Sirenenalarm: nah schneller, am Rand normal, außer Reichweite langsam, nachts schlechter", () => {
  const s = stand()
  const v = R.SIRENEN.stufen[1].verzug_s
  assert.equal(I.sirenenReaktion(R, s, fw, T0), v + H.nah_s)
  const rand = { x: fw.x + R.SIRENEN.stufen[1].radius * 0.8, z: fw.z }
  assert.equal(I.sirenenReaktion(R, s, rand, T0), v + H.fern_s)
  assert.equal(I.sirenenReaktion(R, s, weit, T0), H.ohne_s)
  assert.equal(I.sirenenReaktion(R, s, rand, NACHT), v + H.fern_s + H.nacht_s)
  assert.equal(I.sirenenReaktion(R, s, fw, NACHT), v + H.nah_s, "nah weckt die Sirene auch nachts")
  assert.equal(I.sirenenReaktion(R, s, weit, NACHT), H.ohne_s + H.nacht_s)
})

test("Eine Sirene an der Schule macht Häuser dort schneller, Meldeempfänger hängen nicht davon ab", () => {
  let s = stand()
  const vorher = I.sirenenReaktion(R, s, schule, T0)
  s = kaufe(s, { art: "ausbau", id: "sirene_schule_1" })
  assert.equal(I.sireneStufe(R, s, "schule"), 1)
  assert.ok(I.sirenenReaktion(R, s, schule, T0) < vorher)
  // Heimweg: los = Alarm + Reaktion; mit Meldeempfänger unverändert durch Sirenen
  s = kaufe(s, { art: "bauplatz", id: "bp07" })
  const p = s.personal[0]
  const haus = s.haeuser[0]
  const punkt = R.BAUPLAETZE.find((b) => b.id === "bp07")
  const los = I.heimweg(R, s, p, T0, "trocken").weg.los
  assert.equal(los - T0, I.sirenenReaktion(R, s, punkt, T0) * 1000)
  haus.alarmierung = "fme"
  assert.equal(I.heimweg(R, s, p, T0, "trocken").weg.los - T0, R.ALARMIERUNG.fme.reaktion_s * 1000)
})

test("Ausbau in Stufen: erst die vorige Stufe, erst ab dem Level; jede Stufe reicht weiter und löst schneller aus", () => {
  let s = stand(0)
  assert.match(S.kaufe(s, { art: "ausbau", id: "sirene_schule_1" }, T0, R).fehler, /Level/)
  s = stand()
  assert.match(S.kaufe(s, { art: "ausbau", id: "sirene_schule_2" }, T0, R).fehler, /Zuerst/)
  s = kaufe(s, { art: "ausbau", id: "sirene_schule_1" })
  s = kaufe(s, { art: "ausbau", id: "sirene_schule_2" })
  s = kaufe(s, { art: "ausbau", id: "sirene_schule_3" })
  assert.equal(I.sireneStufe(R, s, "schule"), 3)
  const st = [1, 2, 3].map((n) => R.SIRENEN.stufen[n])
  assert.ok(st[0].radius < st[1].radius && st[1].radius < st[2].radius)
  assert.ok(st[0].verzug_s > st[1].verzug_s && st[1].verzug_s >= st[2].verzug_s)
  // Die elektronische Sirene am Feuerwehrhaus behält ihre alte Kennung, die Baustelle steht an der Schule
  assert.equal(R.AUSBAU.sirene_neu.sirene.standort, "feuerwehrhaus")
  const r = S.kaufe(stand(), { art: "ausbau", id: "sirene_schule_1" }, T0, R)
  assert.deepEqual(r.stand.baustellen[0].ort, { x: schule.x, z: schule.z })
})

test("Warnung: Je mehr vom Dorf die Sirenen erreichen, desto schneller wird bei Großlagen geräumt", () => {
  let s = stand()
  const wenig = I.sirenenAbdeckung(R, s, false)
  for (const sid of Object.keys(R.SIRENEN.standorte)) {
    if (sid === "feuerwehrhaus") continue
    for (const n of [1, 2]) s = kaufe(s, { art: "ausbau", id: "sirene_" + sid + "_" + n })
  }
  const viel = I.sirenenAbdeckung(R, s, false)
  assert.ok(viel > wenig + 0.3, wenig + " → " + viel)
  // Bei Stromausfall heulen nur die Sirenen mit Akku: die Motorsirene am Feuerwehrhaus fällt aus
  assert.ok(I.sirenenAbdeckung(R, stand(), true) === 0)
  assert.ok(I.sirenenAbdeckung(R, s, true) > 0)
})

test("Bei Nachtruhe zählt die Ortszeit (22 bis 6 Uhr)", () => {
  assert.equal(I.nachtruhe(R, T0), false)
  assert.equal(I.nachtruhe(R, NACHT), true)
})
