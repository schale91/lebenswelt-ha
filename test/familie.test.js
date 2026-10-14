// Tests der Fitness-Welt auf dem Server: node --test test/
const test = require("node:test")
const assert = require("node:assert/strict")
const F = require("../lebenswelt/pb_hooks/familie.js")

test("Fitness-Welt nach Benutzer-ID oder Anmeldename, Groß- und Kleinschreibung egal", () => {
  assert.equal(F.istFitness({ id: "abc123", name: "papa" }, ["ABC123"]), true)
  assert.equal(F.istFitness({ id: "x", name: "Papa" }, [" papa "]), true)
  assert.equal(F.istFitness({ id: "x", name: "alex" }, ["papa"]), false)
  assert.equal(F.istFitness({ id: "x", name: "" }, [""]), false)
  assert.equal(F.istFitness({ id: "x" }, undefined), false)
})

test("Bewegung aus dem Spielstand: nur gültige Einträge ab dem Stichtag, nur benötigte Felder", () => {
  const daten = {
    state: {
      schrittziel: 6000,
      bewegungen: [
        { id: "a", art: "schritte", datum: "2026-09-01", zeit: 1, schritte: 3000, xp: 30 },
        { id: "b", art: "nilo", datum: "2026-10-14", zeit: 5, minuten: 30, xp: 120, bis: 3600005, geheim: "nein" },
        { id: "c", art: "kaffee", datum: "2026-10-14", zeit: 6 },
        { id: "d", art: "schritte", datum: "2026-10-14", zeit: 7, schritte: -5, xp: 0 },
      ],
    },
  }
  const b = F.bewegungAus(daten, "2026-10-01")
  assert.deepEqual(
    b.map((x) => x.id),
    ["b", "d"],
  )
  assert.deepEqual(b[0], { id: "b", art: "nilo", datum: "2026-10-14", zeit: 5, xp: 120, minuten: 30, bis: 3600005 })
  assert.equal(b[1].schritte, undefined)
  assert.equal(F.schrittzielAus(daten), 6000)
  assert.equal(F.schrittzielAus(null), 5000)
  assert.deepEqual(F.bewegungAus({ version: 3 }, "2026-10-01"), [])
})

test("Stichtag vor n Tagen", () => {
  assert.equal(F.tagVor(Date.UTC(2026, 9, 14, 12), 14), "2026-09-30")
})
