// Karte von Elbe Springs über dem Regelwerk: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")
const { mitKarte } = require("../lebenswelt/pb_hooks/einsatz/karte.js")

const T0 = Date.UTC(2026, 9, 13, 8)
const STD = 3600000

/** Kleine Stadt: eine Straße von x 0 bis 20 bei z 5, Feuerwehr bei x 2 */
function karte(hausX) {
  const knoten = []
  const kanten = []
  for (let i = 0; i <= 10; i++) {
    knoten.push({ id: "k" + i, x: i * 2, z: 5 })
    if (i) kanten.push({ von: "k" + (i - 1), nach: "k" + i, laenge: 2 })
  }
  const orte = {}
  for (const id of Object.keys(R.ORTE)) orte[id] = { x: 10, z: 6 }
  orte.feuerwehrhaus = { x: 2, z: 6 }
  return { welt: "elbe", meter_je_einheit: 10, strassen: { knoten, kanten }, orte, bauplaetze: [{ id: "bp20", x: hausX, z: 6 }], hydranten: [{ id: "h1", x: 4, z: 5 }], schutz: [] }
}

test("Elbe-Karte: Maßstab, keine Gebiete, kein Gelände, nur bebaute Plätze verschoben", () => {
  const E = mitKarte(R, karte(4))
  assert.equal(E.METER_JE_EINHEIT, 10)
  assert.equal(E.GEBIETE, null)
  assert.equal(E.GELAENDE, null)
  assert.equal(E.KARTE, "elbe")
  assert.equal(E.BAUPLAETZE.length, R.BAUPLAETZE.length)
  assert.deepEqual([E.BAUPLAETZE.find((b) => b.id === "bp20").x, E.BAUPLAETZE.find((b) => b.id === "bp20").z], [4, 6])
  assert.equal(E.BAUPLAETZE.find((b) => b.id === "bp01").x, R.BAUPLAETZE.find((b) => b.id === "bp01").x)
  // Die Dorf-Karte bleibt wie bisher
  assert.equal(mitKarte(R, { ...karte(4), welt: undefined }).METER_JE_EINHEIT, R.METER_JE_EINHEIT)
})

test("Wer näher an der Feuerwehr wohnt, ist schneller da", () => {
  const zeit = (hausX) => {
    const E = mitKarte(R, karte(hausX))
    let s = S.neuerStand(E, T0, 1)
    const k = S.kaufe(s, { art: "bauplatz", id: "bp20" }, T0, E)
    s = k.stand
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(E, s, b, T0)
    const p = s.personal[0]
    return S._intern.heimweg(E, s, p, T0 + 20 * STD, "trocken").umgezogen - (T0 + 20 * STD)
  }
  const nah = zeit(4)
  const fern = zeit(20)
  assert.ok(nah < fern, `nah ${nah} fern ${fern}`)
  // 16 Kacheln mehr sind 160 m mehr Weg
  assert.ok(fern - nah > 60_000)
})
