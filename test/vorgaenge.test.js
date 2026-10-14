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
