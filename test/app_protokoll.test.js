// App-Protokoll: Einträge prüfen, zusammenführen, Frist
const test = require("node:test")
const assert = require("node:assert/strict")
const P = require("../lebenswelt/pb_hooks/app_protokoll.js")

test("App-Protokoll: nur gültige Einträge, Text gekürzt, Kennzahlen begrenzt", () => {
  const e = P.bereinige([
    { i: "a1", z: 1794800000000, a: "start", t: "App gestartet", d: { version: "1.324", ueberApps: true } },
    { i: "a2", z: 1794800001000, a: "fehler", t: "x".repeat(500) },
    { i: "a3", z: 1794800002000, a: "Falsch!", t: "ungültige Art" },
    { i: "", z: 1794800003000, a: "start" },
    { i: "a5", z: "nein", a: "start" },
    { i: "a6", z: 1794800004000, a: "gross", d: { text: "y".repeat(2000) } },
    null,
  ])
  assert.deepEqual(e.map((x) => x.i), ["a1", "a2", "a6"])
  assert.equal(e[1].t.length, 300)
  assert.deepEqual(e[0].d, { version: "1.324", ueberApps: true })
  assert.equal(e[2].d, undefined)
})

test("App-Protokoll: zusammenführen ohne Doppelte, sortiert, die neuesten bleiben", () => {
  const alt = [{ i: "b", z: 2, a: "x", t: "" }, { i: "a", z: 1, a: "x", t: "" }]
  const neu = [{ i: "b", z: 2, a: "x", t: "" }, { i: "c", z: 3, a: "x", t: "" }]
  assert.deepEqual(P.zusammen(alt, neu).map((x) => x.i), ["a", "b", "c"])
  const viele = Array.from({ length: P.MAX_JE_DOK + 5 }, (_, k) => ({ i: "n" + k, z: k + 1, a: "x", t: "" }))
  const r = P.zusammen([], viele)
  assert.equal(r.length, P.MAX_JE_DOK)
  assert.equal(r[0].i, "n5")
})

test("App-Protokoll: Anfrage prüfen und Frist", () => {
  assert.ok(P.pruefe({ tag: "2026-11-16", eintraege: [{ i: "a", z: 1, a: "x" }] }).fehler)
  assert.ok(P.pruefe({ geraet: "app-1", tag: "16.11.2026", eintraege: [{ i: "a", z: 1, a: "x" }] }).fehler)
  assert.ok(P.pruefe({ geraet: "app-1", tag: "2026-11-16", eintraege: [] }).fehler)
  const ok = P.pruefe({ geraet: "app-1", name: "Android 1.324", tag: "2026-11-16", eintraege: [{ i: "a", z: 1, a: "x" }] })
  assert.equal(ok.fehler, undefined)
  assert.equal(ok.eintraege.length, 1)
  assert.equal(P.ersterTag("2026-11-16", 14), "2026-11-03")
  assert.equal(P.ersterTag("2026-11-16", 1), "2026-11-16")
})
