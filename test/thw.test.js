// THW-Ortsverband (ab Level 27): node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 13, 16) // Dienstag, 18 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const sturm = () => "sturm"

function kaufe(s, auftrag, t = T0) {
  const r = S.kaufe(s, auftrag, t, R)
  assert.ok(!r.fehler, r.fehler)
  for (const b of r.stand.baustellen.slice()) S._intern.fertigstellen(R, r.stand, b, t)
  return r.stand
}

/** Feuerwehr mit vier Kräften (Motorsäge, Helm, Truppführer), auf Wunsch mit Gruppenführer; THW mit drei Mitgliedern. */
function dorf({ level = 27, thw = true, gf = false } = {}) {
  let s = S.neuerStand(R, T0 - 24 * STD, 9)
  s.level = level
  for (const bp of ["bp01", "bp02", "bp03", "bp04", "bp05", "bp06", "bp07"]) s = kaufe(s, { art: "bauplatz", id: bp })
  s = kaufe(s, { art: "geraet", id: "motorsaege" })
  for (const p of s.personal.slice(0, 4)) {
    p.lehrgaenge.motorsaege = T0 - STD
    p.lehrgaenge.tf = T0 - STD
    p.psa.helm = 2
  }
  if (gf) s.personal[0].lehrgaenge.gf = T0 - STD
  if (thw) {
    // Drei Polizisten aus dem Dorf sind im THW (so stehen sie nicht schon im Trupp der Feuerwehr)
    for (const id of s.personal.slice(4).map((x) => x.id)) {
      const p = s.personal.find((x) => x.id === id)
      p.org = "polizei"
      p.beruf = "frei"
      s = kaufe(s, { art: "mitgliedschaft", id: "thw", ziel: id })
      const q = s.personal.find((x) => x.id === p.id)
      q.lehrgaenge.thw_grund = T0 - STD
      q.lehrgaenge.thw_motorsaege = T0 - STD
      q.lehrgang_laeuft = null
    }
    s = kaufe(s, { art: "geraet", id: "thw_motorsaegen", org: "thw" })
  }
  return s
}

function baumAufStrasse(s, t = T0 + MIN) {
  const x = JSON.parse(JSON.stringify(s))
  for (const a of Object.values(x.einsatzarten)) a.naechster = t + 1e12
  x.training_naechster = t + 1e12
  x.bis = t
  const e = S._intern.erzeuge(R, x, "th_baum_strasse", t, sturm, null, "hauptstrasse_ost")
  assert.ok(e.plan, e.grund)
  const ende = S.fortschreiben(x, t + 4 * STD, sturm, R)
  return { e, alle: ende.abgeschlossen.concat(ende.laufend) }
}

test("Vor Level 27 gibt es kein THW, der Baum auf der Straße läuft wie bisher", () => {
  const s = dorf({ level: 26, thw: false })
  assert.match(S.kaufe(s, { art: "mitgliedschaft", id: "thw", ziel: s.personal[5].id }, T0, R).fehler, /Erst ab Level 27/)
  const { alle } = baumAufStrasse(s)
  assert.ok(!alle.some((e) => R.EINSATZARTEN[e.art].org === "thw"))
})

test("Das THW tritt nie von selbst auf: alle THW-Einsätze sind Nachforderungen", () => {
  for (const [id, a] of Object.entries(R.EINSATZARTEN).filter(([, x]) => x.org === "thw")) {
    assert.ok(a.folge_nur && a.nachforderung, id)
    assert.ok(!a.start_level && !a.start, id)
  }
  const s = S.fortschreiben(dorf(), T0 + 3 * 24 * STD, sturm, R)
  assert.ok(!s.freigeschaltet.some((id) => R.EINSATZARTEN[id].org === "thw"))
})

test("Ohne eigene Helfer kommt der Ortsverband der Kreisstadt", () => {
  const { alle } = baumAufStrasse(dorf({ thw: false }))
  const r = alle.find((e) => e.art === "thw_raeumen")
  assert.ok(r, "angefordert")
  assert.equal(r.plan.extern, R.EXTERN.thw.name)
})

test("Mit Gruppenführer vor Ort wird sofort angefordert, ohne erst zehn Minuten später", () => {
  const ohne = baumAufStrasse(dorf()).alle.find((e) => e.art === "thw_raeumen")
  const mit = baumAufStrasse(dorf({ gf: true })).alle.find((e) => e.art === "thw_raeumen")
  assert.ok(!ohne.plan.extern && !mit.plan.extern)
  assert.ok(ohne.plan.faktoren.some((f) => f.grund === "nachforderung"))
  assert.ok(!mit.plan.faktoren.some((f) => f.grund === "nachforderung"))
  assert.equal(ohne.plan.eintreffen - mit.plan.eintreffen, R.NACHFORDERUNG.verzug_min * MIN)
})

test("Ausleuchten nur bei Dunkelheit", () => {
  const e = { art: "th_vu_mehrere" }
  assert.ok(R.EINSATZARTEN.thw_ausleuchten.nur_dunkel)
  assert.ok(R.EINSATZARTEN[e.art].folge.includes("thw_ausleuchten"))
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit THW", () => {
  let s = dorf({ gf: true })
  s = S.fortschreiben(s, T0, sturm, R)
  s.freigeschaltet.push("th_baum_strasse")
  s = kaufe(s, { art: "einsatzart", id: "th_baum_strasse" }, T0)
  const ende = T0 + 2 * 24 * STD
  const ganz = S.fortschreiben(s, ende, sturm, R)
  let teile = s
  for (let t = T0 + 3 * STD; t < ende; t += 5 * STD) teile = S.fortschreiben(teile, t, sturm, R)
  teile = S.fortschreiben(teile, ende, sturm, R)
  assert.deepEqual(teile, ganz)
  assert.ok(ganz.abgeschlossen.some((e) => e.art === "thw_raeumen"))
})
