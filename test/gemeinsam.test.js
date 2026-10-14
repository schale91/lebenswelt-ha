// Gemeinsame Einsätze von Feuerwehr und Polizei (ab Level 8): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 8) // Dienstag, 10 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Feuerwehr mit zwei Kräften und Türöffnungswerkzeug, Polizei nach Wunsch. */
function dorf(polizei) {
  let s = S.neuerStand(R, T0, 3)
  s.level = 8
  s = kaufe(s, { art: "bauplatz", id: "bp01" })
  s = kaufe(s, { art: "bauplatz", id: "bp02" })
  s = kaufe(s, { art: "geraet", id: "tueroeffnung" })
  if (polizei) s = kaufe(s, { art: "personal", id: "polizei" })
  return s
}

/** Einsatz auslösen und bis zum Ende fortschreiben; keine anderen Meldungen. */
function einsatz(s, art, ort, t = T0 + MIN) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  const e = S._intern.erzeuge(R, x, art, t, trocken, null, ort)
  const fertig = S.fortschreiben(x, t + 3 * STD, trocken, R)
  return { e: fertig.abgeschlossen.find((a) => a.id === e.id), stand: fertig }
}

test("Gemeinsame Einsätze sind erst ab Level 8 kaufbar", () => {
  let s = dorf(false)
  s.freigeschaltet.push("th_kind_auto")
  s.level = 7
  assert.match(S.kaufe(s, { art: "einsatzart", id: "th_kind_auto" }, T0, R).fehler, /Erst ab Level 8/)
  s.level = 8
  s = kaufe(s, { art: "einsatzart", id: "th_kind_auto" })
  assert.ok(s.einsatzarten.th_kind_auto)
})

test("Jeder gemeinsame Einsatz hat einen Polizei-Teil, der nur als Folge entsteht", () => {
  const gemeinsam = Object.entries(R.EINSATZARTEN).filter(([, a]) => a.gemeinsam)
  assert.equal(gemeinsam.filter(([, a]) => a.ab_level === R.FREISCHALTUNG_LEVEL.zusammenarbeit).length, 8)
  for (const [id, a] of gemeinsam) {
    assert.ok([R.FREISCHALTUNG_LEVEL.zusammenarbeit, R.FREISCHALTUNG_LEVEL.rettungsdienst].includes(a.ab_level), id)
    const partner = R.EINSATZARTEN[a.folge[0]]
    assert.ok(partner && partner.folge_nur && partner.org === "polizei", id)
  }
})

test("Kind im Auto mit Polizei: Feuerwehr öffnet, Polizei ist rechtzeitig da, Zusammenarbeit 5 Sterne", () => {
  const { e, stand } = einsatz(dorf(true), "th_kind_auto", "schule")
  assert.equal(e.status, "abgeschlossen")
  assert.equal(e.gemeinsam.art, "p_halter")
  assert.ok(e.bewertung.zusammenarbeit, "Zusammenarbeit bewertet")
  assert.ok(e.bewertung.zusammenarbeit.sterne >= 4, JSON.stringify(e.bewertung.zusammenarbeit))
  assert.equal(stand.zusammenarbeit.length, 1)
})

test("Ohne Polizei im Dorf: der Einsatz läuft, die Zusammenarbeit bekommt 1 Stern mit Begründung", () => {
  const { e } = einsatz(dorf(false), "th_kind_auto", "schule")
  assert.equal(e.status, "abgeschlossen")
  assert.equal(e.bewertung.zusammenarbeit.sterne, 1)
  assert.match(e.bewertung.zusammenarbeit.text, /Dienststelle/)
})

test("Zusammenarbeit: je halbes Ziel zu spät ein Stern weniger, nach dem Ende nur noch 1", () => {
  const e = { art: "th_kind_auto", plan: { eintreffen: T0, arbeit_ende: T0 + 60 * MIN }, gemeinsam: { art: "p_halter", partner: "x", status: "alarmiert", eintreffen: T0 + 6 * MIN } }
  assert.equal(S._intern.bewerteZusammenarbeit(R, {}, e).sterne, 5)
  e.gemeinsam.eintreffen = T0 + 10 * MIN // 4 min zu spät, Ziel 6 → 2 halbe Ziele
  assert.equal(S._intern.bewerteZusammenarbeit(R, {}, e).sterne, 3)
  e.gemeinsam.eintreffen = T0 + 61 * MIN
  assert.equal(S._intern.bewerteZusammenarbeit(R, {}, e).sterne, 1)
  e.gemeinsam.status = "verfallen"
  assert.match(S._intern.bewerteZusammenarbeit(R, {}, e).text, /verfallen/)
})

test("Silvesternacht nur am 31.12. und 1.1. in der Nacht", () => {
  const art = R.EINSATZARTEN.silvester
  const f = (t) => S._intern.bedingungFaktor(art, t, "trocken")
  assert.equal(f(Date.UTC(2026, 11, 31, 22)), 1) // 23 Uhr Ortszeit
  assert.equal(f(Date.UTC(2027, 0, 1, 0)), 1) // 1 Uhr
  assert.equal(f(Date.UTC(2026, 11, 30, 22)), 0)
  assert.equal(f(Date.UTC(2026, 11, 31, 12)), 0) // 13 Uhr
  assert.equal(f(Date.UTC(2027, 0, 31, 22)), 0)
})

test("Kind im Auto kommt im Sommer häufiger als im Winter", () => {
  const art = R.EINSATZARTEN.th_kind_auto
  assert.equal(S._intern.bedingungFaktor(art, Date.UTC(2026, 6, 1, 10), "trocken"), 1)
  assert.equal(S._intern.bedingungFaktor(art, Date.UTC(2026, 11, 1, 10), "trocken"), 0.2)
})
