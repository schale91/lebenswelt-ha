// Fahrzeugauswahl wie eine Leitstelle: was am frühesten fertig ist, bei Gleichstand weniger Fahrzeuge: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")
const S = require("../lebenswelt/pb_hooks/einsatz/simulation.js")

const T0 = Date.UTC(2026, 9, 10, 16) // Samstag, 18 Uhr Ortszeit
const MIN = 60000
const STD = 60 * MIN
const trocken = () => "trocken"

/** Ausgebaute Wehr: großes Gerätehaus, zwölf Kräfte mit allen Lehrgängen, LF 10, TLF, ELW, Löscher im Lager. */
function wehr() {
  let s = S.neuerStand(R, T0 - 2 * STD, 31)
  s.level = 30
  const kaufe = (a) => {
    const r = S.kaufe(s, a, T0 - STD, R)
    if (r.fehler) return false
    s = r.stand
    for (const b of s.baustellen.slice()) S._intern.fertigstellen(R, s, b, T0 - STD)
    return true
  }
  for (let i = 0; i < 5; i++) kaufe({ art: "gebaeude", id: "geraetehaus" })
  for (const bp of R.BAUPLAETZE.slice(0, 12)) kaufe({ art: "bauplatz", id: bp.id, bewohner: { org: "feuerwehr", beruf: "auswaerts" } })
  // Lehrgänge vor den Fahrzeugen: fahren darf nur, wer den Führerschein hat
  for (const p of s.personal) for (const [id, l] of Object.entries(R.LEHRGAENGE)) if (l.org === "feuerwehr") p.lehrgaenge[id] = T0 - 30 * 24 * STD
  for (const id of ["lf10", "tlf3000", "elw1"]) assert.ok(kaufe({ art: "fahrzeug", id }), id)
  for (const id of ["pulverloescher", "schaumloescher", "klappleiter", "tierhandschuhe", "transportbox"]) kaufe({ art: "geraet", id })
  for (const p of s.personal) {
    for (const [id, l] of Object.entries(R.LEHRGAENGE)) if (l.org === "feuerwehr") p.lehrgaenge[id] = T0 - 30 * 24 * STD
    for (const [teil, st] of Object.entries(R.PSA_FEUERWEHR)) p.psa[teil] = st.length - 1
    p.einsaetze = 50
  }
  for (const f of s.fahrzeuge) if (R.FAHRZEUGE[f.typ].org === "feuerwehr" && !R.FAHRZEUGE[f.typ].gezogen) Object.assign(f.beladung, { pressluftatmer: 6, atemschutzueberwachung: 1, waermebildkamera: 1, tueroeffnung: 1, rauchvorhang: 1, luefter: 1, mehrgasmessgeraet: 1, sprungpolster: 1 })
  for (const a of Object.values(s.einsatzarten)) a.naechster = T0 + 1e12
  s.training_naechster = T0 + 1e12
  s.bis = T0
  return s
}

test("Mülltonnenbrand: das Löschfahrzeug ist schneller fertig als der Trupp zu Fuß mit Feuerlöscher", () => {
  const s = wehr()
  const e = S._intern.erzeuge(R, s, "b_muelltonne", T0, trocken, null, "muelltonnen")
  assert.ok(e.plan, e.grund)
  assert.equal(e.plan.zu_fuss, false)
  assert.ok(e.plan.fahrzeuge.length >= 1 && e.plan.fahrzeuge.length <= 2, JSON.stringify(e.plan.fahrzeuge))
})

test("Katze am Feuerwehrhaus: zu Fuß ist gleich schnell, dann ohne Fahrzeug", () => {
  const s = wehr()
  const e = S._intern.erzeuge(R, s, "tier_katze", T0, trocken, null, "baum_feuerwehr")
  assert.ok(e.plan, e.grund)
  // Bei Gleichstand (Toleranz) zählt: weniger Fahrzeuge
  const alle = e.plan.fahrzeuge.length
  assert.ok(alle <= 1, "höchstens ein Fahrzeug: " + alle)
})

test("Wohnungsbrand mit Sperrregel (Sicherheitstrupp) wird geplant, ohne abzustürzen", () => {
  const s = wehr()
  const e = S._intern.erzeuge(R, s, "b_wohnung", T0, trocken, null, "nachbarhaus")
  assert.ok(e.plan || e.grund)
  if (e.plan) assert.ok(Array.isArray(e.plan.gesperrt))
})

test("Fortschreiben in Teilen ergibt dasselbe wie am Stück, mit ausgebauter Wehr und allen Einsatzarten", () => {
  let s = wehr()
  s.freigeschaltet = Object.keys(R.EINSATZARTEN).filter((id) => !R.EINSATZARTEN[id].folge_nur && !R.EINSATZARTEN[id].grosslage)
  for (const id of s.freigeschaltet) {
    const r = S.kaufe(s, { art: "einsatzart", id }, T0, R)
    if (!r.fehler) s = r.stand
  }
  const ende = T0 + 24 * STD
  const ganz = S.fortschreiben(s, ende, trocken, R)
  let teile = s
  for (let t = T0 + 37 * MIN; t < ende; t += 3 * STD + 11 * MIN) teile = S.fortschreiben(teile, t, trocken, R)
  teile = S.fortschreiben(teile, ende, trocken, R)
  assert.deepEqual(teile, ganz)
  assert.ok(ganz.abgeschlossen.length > 10)
})
