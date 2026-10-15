// Tests der Vorgangsregeln: node --test test/
const test = require("node:test")
const assert = require("node:assert/strict")
const V = require("../lebenswelt/pb_hooks/vorgaenge.js")

const LKA = V.LKA_STATUS

test("Wiedervorlage zwei Monate später, am Monatsende gekappt", () => {
  assert.equal(V.wiedervorlage("2026-10-14"), "2026-12-14")
  assert.equal(V.wiedervorlage("2026-11-20"), "2027-01-20")
  assert.equal(V.wiedervorlage("2026-12-31"), "2027-02-28")
  assert.equal(V.wiedervorlage("2027-12-31"), "2028-02-29")
})

test("Kalendertag in Ortszeit", () => {
  assert.equal(V.heute(Date.UTC(2026, 9, 13, 22, 30)), "2026-10-14") // 0:30 Uhr MESZ
  assert.equal(V.heute(Date.UTC(2026, 11, 31, 22, 30)), "2026-12-31") // 23:30 Uhr MEZ
})

test("Frist nur beim Wechsel auf Warten auf LKA", () => {
  const tag = "2026-10-14"
  assert.equal(V.ergaenzeFrist("vorgang", { status: "In Bearbeitung" }, { status: LKA }, { status: LKA }, tag).frist, "2026-12-14")
  assert.equal(V.ergaenzeFrist("vorgang", null, { status: LKA }, { status: LKA }, tag).frist, "2026-12-14")
  assert.equal(V.ergaenzeFrist("vorgang", { status: LKA, frist: "2026-10-31" }, { status: LKA, frist: "2026-10-31", titel: "x" }, { titel: "x" }, tag).frist, "2026-10-31")
  assert.equal(V.ergaenzeFrist("vorgang", { status: "In Bearbeitung" }, { status: "Erledigt" }, { status: "Erledigt" }, tag).frist, undefined)
  assert.equal(V.ergaenzeFrist("aufgabe", {}, { status: LKA }, { status: LKA }, tag).frist, undefined)
})

test("Mitgeschickte Frist hat Vorrang", () => {
  const neu = V.ergaenzeFrist("vorgang", { status: "In Bearbeitung" }, { status: LKA, frist: "2027-01-05" }, { status: LKA, frist: "2027-01-05" }, "2026-10-14")
  assert.equal(neu.frist, "2027-01-05")
})

test("Neue Unteraufgaben: zwei Wochen Fälligkeit, wenn keine mitkommt", () => {
  const tag = "2026-10-14"
  assert.equal(V.ergaenzeFaelligkeit("aufgabe", { titel: "x", vorgang: "v1" }, tag).faellig, "2026-10-28")
  assert.equal(V.ergaenzeFaelligkeit("aufgabe", { titel: "x", eltern: "a1" }, tag).faellig, "2026-10-28")
  assert.equal(V.ergaenzeFaelligkeit("unteraufgabe", { titel: "x" }, "2026-12-25").faellig, "2027-01-08")
  assert.equal(V.ergaenzeFaelligkeit("aufgabe", { titel: "x", vorgang: "v1", faellig: "2026-11-02" }, tag).faellig, "2026-11-02")
  assert.equal(V.ergaenzeFaelligkeit("aufgabe", { titel: "frei" }, tag).faellig, undefined)
  assert.equal(V.ergaenzeFaelligkeit("vorgang", { titel: "v" }, tag).faellig, undefined)
})

test("Erledigter Vorgang schließt offene Aufgaben, Teilaufgaben und Unteraufgaben ab", () => {
  assert.equal(V.wirdErledigt("vorgang", { status: "In Bearbeitung" }, { status: "Erledigt" }), true)
  assert.equal(V.wirdErledigt("vorgang", { status: "Erledigt" }, { status: "Erledigt" }), false)
  assert.equal(V.wirdErledigt("aufgabe", { status: "Offen" }, { status: "Erledigt" }), false)
  const liste = [
    { typ: "aufgabe", schluessel: "a1", daten: { titel: "offen", vorgang: "v1", status: "Nicht begonnen" } },
    { typ: "aufgabe", schluessel: "a2", daten: { titel: "schon fertig", vorgang: "v1", status: "Erledigt", erledigt_am: "2026-10-01" } },
    { typ: "aufgabe", schluessel: "a3", daten: { titel: "Teilaufgabe ohne vorgang", eltern: "a1", status: "In Bearbeitung" } },
    { typ: "unteraufgabe", schluessel: "u1", daten: { titel: "Unteraufgabe", vorgang: "v1", status: "Nicht begonnen" } },
    { typ: "aufgabe", schluessel: "b1", daten: { titel: "anderer Vorgang", vorgang: "v2", status: "Nicht begonnen" } },
  ]
  const treffer = V.abzuschliessen(liste, "v1", "2026-10-15T12:00:00Z")
  assert.deepEqual(treffer.map((x) => x.schluessel), ["a1", "a3", "u1"])
  for (const x of treffer) {
    assert.equal(x.daten.status, "Erledigt")
    assert.equal(x.daten.xp_offen, true)
    assert.equal(x.daten.erledigt_durch, "vorgang")
  }
  assert.equal(liste[1].daten.erledigt_am, "2026-10-01")
  assert.equal(liste[4].daten.status, "Nicht begonnen")
  assert.deepEqual(V.abzuschliessen(liste, "", "x"), [])
})
