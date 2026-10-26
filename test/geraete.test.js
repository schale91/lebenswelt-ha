// Lebenswelt Fit: Kopplung, Geräteschlüssel und der gemeinsame Ablauf der Einsatzwelt: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const G = require("../lebenswelt/pb_hooks/geraete.js")
const A = require("../lebenswelt/pb_hooks/einsatz/ablauf.js")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

test("Kopplungscode: Eingabe wird angeglichen, Alphabet ohne verwechselbare Zeichen", () => {
  assert.equal(G.codeNormal(" ab-cd ef2h "), "ABCDEF2H")
  for (const z of "IL01O") assert.ok(!G.CODE_ZEICHEN.includes(z))
  assert.equal(G.CODE_LAENGE, 8)
})

test("Kopplungscode gilt nur bis zur Ablaufzeit", () => {
  assert.equal(G.kopplungGilt({ bis: 2000 }, 1000), true)
  assert.equal(G.kopplungGilt({ bis: 1000 }, 1000), false)
  assert.equal(G.kopplungGilt(null, 0), false)
})

test("Geräteschlüssel: festes Format, alles andere wird gar nicht erst gesucht", () => {
  assert.equal(G.schluesselGueltig("lwf_" + "a".repeat(48)), true)
  assert.equal(G.schluesselGueltig("lwf_" + "a".repeat(47)), false)
  assert.equal(G.schluesselGueltig("lwf_" + "a".repeat(47) + "'"), false)
  assert.equal(G.schluesselGueltig(""), false)
})

test("Gerätename: kurz und ohne Steuerzeichen", () => {
  assert.equal(G.geraetName(""), "Handy")
  assert.equal(G.geraetName("Papa\n\tHandy"), "PapaHandy")
  assert.equal(G.geraetName("x".repeat(80)).length, 40)
})

test("Einsatz-Paket: alle Module, die das Handy braucht, liegen im Hooks-Ordner", () => {
  const fs = require("node:fs")
  for (const n of G.EINSATZ_MODULE) assert.ok(fs.existsSync(`${__dirname}/../lebenswelt/pb_hooks/einsatz/${n}`), n)
  assert.equal(G.EINSATZ_MODULE.at(-1), "ablauf.js")
})

test("Ablauf: schreibt einen neuen Stand ohne Umwelt fort, Level steigt nur", () => {
  const t0 = Date.UTC(2026, 9, 26, 8)
  let s = S.neuerStand(R, t0, 7)
  s.level = 3
  const f = A.fortschreiben(R, s, { level: 1 }, t0 + 6 * 3600 * 1000)
  assert.ok(A.gueltig(f.stand))
  assert.equal(f.stand.level, 3)
  assert.equal(f.stand.bis, t0 + 6 * 3600 * 1000)
  assert.ok(Array.isArray(f.neu))
  assert.deepEqual(f.warnungen, [])
  assert.doesNotThrow(() => A.pruefeZahlen(f.stand))
})

test("Ablauf: kaputte Zahlen werden nie gespeichert", () => {
  assert.throws(() => A.pruefeZahlen({ a: { b: NaN } }))
  assert.equal(A.gueltig({ bis: 1 }), false)
})
