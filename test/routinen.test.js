// Routinen (typ "routine"): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/routinen.js")

// 2026-10-26 ist ein Montag
const MO = "2026-10-26"
const SA = "2026-10-31"

test("Rhythmus: täglich, an Wochentagen, monatlich mit Monatsende", () => {
  assert.equal(R.wochentag(MO), 1)
  assert.equal(R.imRhythmus({ rhythmus: "taeglich" }, SA), true)
  assert.equal(R.imRhythmus({ rhythmus: "wochentage", tage: [1, 3] }, MO), true)
  assert.equal(R.imRhythmus({ rhythmus: "wochentage", tage: [2] }, MO), false)
  assert.equal(R.imRhythmus({ rhythmus: "monatlich", monatstag: 26 }, MO), true)
  assert.equal(R.imRhythmus({ rhythmus: "monatlich", monatstag: 31 }, "2026-11-30"), true)
  assert.equal(R.imRhythmus({ rhythmus: "monatlich", monatstag: 31 }, "2026-11-29"), false)
})

test("dienstlich nur an Arbeitstagen laut Kalender, ohne Kalender Montag bis Freitag", () => {
  const r = { titel: "Wiedervorlagen sichten", rhythmus: "taeglich", sphaere: "Dienstlich" }
  assert.equal(R.faellig(r, MO, null), true)
  assert.equal(R.faellig(r, SA, null), false)
  assert.equal(R.faellig(r, MO, { art: "urlaub" }), false)
  assert.equal(R.faellig(r, MO, { art: "homeoffice" }), true)
  assert.equal(R.faellig(r, SA, { art: "dienst" }), true)
  assert.equal(R.faellig({ ...r, sphaere: "Privat" }, SA, { art: "wochenende" }), true)
  assert.equal(R.faellig({ ...r, pausiert: true }, MO, null), false)
})

test("Aufgabe des Tages trägt Routine, Fälligkeit und Felder", () => {
  const d = R.aufgabeDaten({ titel: " Post sichten ", sphaere: "Privat", kontext: "Zuhause", aufwand: "unter 15 min" }, "r1", MO)
  assert.deepEqual(d, { titel: "Post sichten", status: "Nicht begonnen", faellig: MO, erstellt: MO, routine: "r1", priorisierung: "normal", sphaere: "Privat", kontext: "Zuhause", aufwand: "unter 15 min" })
})

test("Planung: anlegen, Verfall und Serie", () => {
  const t = { titel: "Feierabend", rhythmus: "taeglich", serie: 3 }
  // gestern erledigt: Serie wächst, nichts verfällt
  let p = R.plane(t, [{ id: "a", tag: "2026-10-25", status: "Erledigt" }], MO, null)
  assert.deepEqual(p, { anlegen: true, verfallen: [], serie: 4 })
  // gestern offen: verfällt, Serie reißt
  p = R.plane(t, [{ id: "a", tag: "2026-10-25", status: "Nicht begonnen" }], MO, null)
  assert.deepEqual(p, { anlegen: true, verfallen: ["a"], serie: 0 })
  // heute schon angelegt (auch gelöscht): nicht doppelt
  p = R.plane(t, [{ id: "b", tag: MO, status: "Nicht begonnen", geloescht: true }], MO, null)
  assert.equal(p.anlegen, false)
  // seltene Routine bleibt bis zum nächsten Termin stehen
  const w = { titel: "Wochenplanung", rhythmus: "wochentage", tage: [1] }
  p = R.plane(w, [{ id: "c", tag: "2026-10-19", status: "In Bearbeitung" }], "2026-10-22", null)
  assert.deepEqual(p.verfallen, [])
  p = R.plane(w, [{ id: "c", tag: "2026-10-19", status: "In Bearbeitung" }], MO, null)
  assert.deepEqual(p.verfallen, ["c"])
  assert.equal(p.anlegen, true)
  // häufige dienstliche Routine am Wochenende: Freitag verfällt, nichts Neues
  const d = { titel: "Wiedervorlagen", rhythmus: "taeglich", sphaere: "Dienstlich" }
  p = R.plane(d, [{ id: "f", tag: "2026-10-30", status: "Nicht begonnen" }], SA, null)
  assert.deepEqual(p, { anlegen: false, verfallen: ["f"], serie: 0 })
})

test("Prüfung beim Anlegen", () => {
  assert.throws(() => R.pruefe({ titel: " " }), (e) => e.status === 400)
  assert.throws(() => R.pruefe({ titel: "x", rhythmus: "jaehrlich" }), (e) => e.status === 400)
  assert.throws(() => R.pruefe({ titel: "x", rhythmus: "wochentage", tage: [] }), (e) => e.status === 400)
  assert.equal(R.pruefe({ titel: "x", rhythmus: "monatlich", monatstag: 1 }), true)
})
