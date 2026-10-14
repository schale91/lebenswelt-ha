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

test("Push bei Nilo nur für neue, frische Spaziergänge", () => {
  const jetzt = 10 * 3600000
  const alt = { state: { bewegungen: [{ id: "n1", art: "nilo", datum: "2026-10-14", zeit: jetzt - 600000, minuten: 20 }] } }
  const neu = {
    state: {
      bewegungen: [
        { id: "n1", art: "nilo", datum: "2026-10-14", zeit: jetzt - 600000, minuten: 20 },
        { id: "n2", art: "nilo", datum: "2026-10-14", zeit: jetzt - 60000, schritte: 2000 },
        { id: "n3", art: "nilo", datum: "2026-10-13", zeit: jetzt - 5 * 3600000, minuten: 30 },
        { id: "s1", art: "schritte", datum: "2026-10-14", zeit: jetzt, schritte: 4000 },
      ],
    },
  }
  assert.deepEqual(
    F.neueNilo(alt, neu, jetzt).map((b) => b.id),
    ["n2"],
  )
  assert.equal(F.neueNilo(null, { state: {} }, jetzt).length, 0)
})

test("Erinnerung am Abend nur ohne Eintrag am selben Tag", () => {
  const daten = { state: { bewegungen: [{ id: "a", art: "schritte", datum: "2026-10-13", zeit: 1, schritte: 3000 }] } }
  assert.equal(F.braucheErinnerung(daten, "2026-10-14"), true)
  assert.equal(F.braucheErinnerung(daten, "2026-10-13"), false)
  assert.equal(F.braucheErinnerung(null, "2026-10-14"), true)
})

test("Wünsche für die Familie ohne Aufbereitung, unbekannter Status gilt als offen", () => {
  const w = F.wunschFuerFamilie({ id: "x", daten: { vorschlag: "Drehleiter", titel: "Drehleiter DLK 23/12", status: "freigegeben", aufbereitung: "lang", anmerkung: "ab Stufe 3" } })
  assert.deepEqual(w, { id: "x", vorschlag: "Drehleiter", titel: "Drehleiter DLK 23/12", status: "freigegeben", anmerkung: "ab Stufe 3" })
  assert.equal(F.wunschFuerFamilie({ id: "y", daten: { status: "quatsch" } }).status, "offen")
  assert.equal(F.offeneFreigaben([{ typ: "freigabe", daten: {} }, { typ: "freigabe", daten: { status: "freigegeben" } }, { typ: "aufgabe", daten: {} }]), 1)
})
