// Prüft das Regelwerk des Einsatzspiels auf Stimmigkeit: Verweise, Freischaltbaum, Slots, Erreichbarkeit.
// Aufruf: node werkzeuge/pruefe-regelwerk.js   (Exit-Code 1 bei Fehlern)
const path = require("path")
const R = require(path.join(__dirname, "../lebenswelt/pb_hooks/einsatz/regelwerk.js"))

const fehler = []
const hinweise = []
const f = (t) => fehler.push(t)
const ID = /^[a-z0-9_]+$/

function pruefeIds(name, obj) {
  for (const id of Object.keys(obj)) if (!ID.test(id)) f(`${name}: ungültige ID "${id}"`)
}
pruefeIds("ORTE", R.ORTE)
pruefeIds("GERAETE", R.GERAETE)
pruefeIds("FAHRZEUGE", R.FAHRZEUGE)
pruefeIds("LEHRGAENGE", R.LEHRGAENGE)
pruefeIds("EINSATZARTEN", R.EINSATZARTEN)
pruefeIds("REGELN", R.REGELN)
pruefeIds("AUSBAU", R.AUSBAU)

// Keine Überschneidung zwischen kaufbaren Geräten und abgeleiteten Merkmalen
for (const id of Object.keys(R.MERKMALE)) if (R.GERAETE[id]) f(`MERKMALE und GERAETE beide mit "${id}"`)

function quelle(ort, q) {
  if (q !== undefined && !R.QUELLEN[q]) f(`${ort}: unbekannte Quelle "${q}"`)
}
for (const [k, q] of Object.entries(R.QUELLEN)) if (!/^https:\/\//.test(q.url)) f(`QUELLEN.${k}: Adresse muss mit https:// beginnen`)

function geraeteGruppen(ort, gruppen) {
  if (gruppen === undefined) return
  if (!Array.isArray(gruppen)) return f(`${ort}: geraete muss eine Liste von Gruppen sein`)
  gruppen.forEach((gruppe, i) => {
    if (!Array.isArray(gruppe) || !gruppe.length) return f(`${ort}: Gruppe ${i} muss eine nicht leere Liste von Alternativen sein`)
    for (const alt of gruppe) {
      if (!alt || typeof alt !== "object" || Array.isArray(alt)) { f(`${ort}: Alternative muss ein Objekt sein`); continue }
      for (const [id, n] of Object.entries(alt)) {
        if (!R.GERAETE[id] && !R.MERKMALE[id]) f(`${ort}: unbekanntes Gerät/Merkmal "${id}"`)
        if (!(Number.isInteger(n) && n > 0)) f(`${ort}: Anzahl für "${id}" muss eine positive ganze Zahl sein`)
      }
    }
  })
}

function qualifikation(ort, q) {
  for (const id of Object.keys(q || {})) if (!R.LEHRGAENGE[id]) f(`${ort}: unbekannter Lehrgang "${id}"`)
}

function psa(ort, p) {
  for (const [teil, stufe] of Object.entries(p || {})) {
    const liste = R.PSA_FEUERWEHR[teil] || R.PSA_POLIZEI[teil]
    if (!liste) f(`${ort}: unbekanntes PSA-Teil "${teil}"`)
    else if (!(stufe >= 0 && stufe < liste.length)) f(`${ort}: PSA-Stufe ${stufe} für "${teil}" gibt es nicht`)
  }
}

// Ausrüstung: jede Stufe mit Wirkung, ab Stufe 1 mit Vorteilstext; bekannte Wirkungen
const PSA_WIRKUNGEN = ["tempo", "stolpern", "arbeit", "arbeit_th", "nacht", "umziehen_s", "reaktion_s"]
for (const [tabelle, teile] of [["PSA_FEUERWEHR", R.PSA_FEUERWEHR], ["PSA_POLIZEI", R.PSA_POLIZEI]]) {
  for (const [teil, stufen] of Object.entries(teile)) {
    if (!R.PSA_NAMEN[teil]) f(`${tabelle}.${teil}: Name fehlt in PSA_NAMEN`)
    stufen.forEach((st, i) => {
      if (!st.effekt || typeof st.effekt !== "object") f(`${tabelle}.${teil}[${i}]: effekt fehlt`)
      for (const k of Object.keys(st.effekt || {})) if (PSA_WIRKUNGEN.indexOf(k) < 0) f(`${tabelle}.${teil}[${i}]: unbekannte Wirkung "${k}"`)
      if (i > 0 && !st.vorteil) f(`${tabelle}.${teil}[${i}]: vorteil fehlt`)
      if (i > 0 && !(st.preis > stufen[i - 1].preis)) f(`${tabelle}.${teil}[${i}]: höhere Stufe muss mehr kosten`)
    })
  }
}
// Bauen: Phasen ergeben zusammen 1, Bauzeiten an jeder Ausbaustufe
for (const [name, liste] of Object.entries(R.BAU).filter(([k, v]) => k.startsWith("phasen") && Array.isArray(v))) {
  const summe = liste.reduce((n, p) => n + p.anteil, 0)
  if (Math.abs(summe - 1) > 1e-9) f(`BAU.${name}: Anteile ergeben ${summe} statt 1`)
}
for (const [geb, stufen] of Object.entries(R.GEBAEUDE)) stufen.forEach((st, i) => { if (i > 0 && !(st.bauzeit_h > 0)) f(`GEBAEUDE.${geb}[${i}]: bauzeit_h fehlt`) })
for (const [id, a] of Object.entries(R.AUSBAU)) if (!(a.bauzeit_h > 0)) f(`AUSBAU.${id}: bauzeit_h fehlt`)
// Gebäude: Sonderphasen, Level aufsteigend, Ort zum Bauen
for (const [geb, stufen] of Object.entries(R.GEBAEUDE)) {
  if (!R.GEBAEUDE_ORT || !R.GEBAEUDE_ORT[geb] || !R.ORTE[R.GEBAEUDE_ORT[geb]]) f(`GEBAEUDE.${geb}: Ort zum Bauen fehlt in GEBAEUDE_ORT`)
  stufen.forEach((st, i) => {
    if (st.phasen && !R.BAU["phasen_" + st.phasen]) f(`GEBAEUDE.${geb}[${i}]: unbekannte Phasen "${st.phasen}"`)
    if (i > 0 && (st.ab_level || 0) < (stufen[i - 1].ab_level || 0)) f(`GEBAEUDE.${geb}[${i}]: ab_level kleiner als bei der Stufe davor`)
  })
}
// Bewohner: Berufe, Schichten, Arbeitgeber, Mitgliedschaften, Fitness
for (const [id, b] of Object.entries(R.BERUFE)) for (const sch of b.schichtplan || []) if (sch !== "frei" && !R.SCHICHTEN[sch]) f(`BERUFE.${id}: unbekannte Schicht "${sch}"`)
for (const [id, a] of Object.entries(R.ARBEITGEBER)) {
  if (!R.ORTE[a.ort]) f(`ARBEITGEBER.${id}: unbekannter Ort "${a.ort}"`)
  if (!(a.stellen > 0)) f(`ARBEITGEBER.${id}: stellen fehlt`)
  if (a.gebaeude && !(R.GEBAEUDE[a.gebaeude] && R.GEBAEUDE[a.gebaeude][a.ab_stufe])) f(`ARBEITGEBER.${id}: Gebäudestufe gibt es nicht`)
}
for (const [id, m] of Object.entries(R.MITGLIEDSCHAFTEN)) {
  if (m.grundausbildung && !R.LEHRGAENGE[m.grundausbildung]) f(`MITGLIEDSCHAFTEN.${id}: unbekannte Grundausbildung`)
  if (!(m.eintritt > 0)) f(`MITGLIEDSCHAFTEN.${id}: eintritt fehlt`)
}
if (!(R.FITNESS && R.FITNESS.start > 0 && R.FITNESS.max > R.FITNESS.start)) f("FITNESS: start und max prüfen")
for (const [id, o] of Object.entries(R.ORGANISATIONEN)) {
  if (!R.GEBAEUDE[o.gebaeude]) f(`ORGANISATIONEN.${id}: unbekanntes Gebäude`)
  if (R.EXTERN[id] && !(R.EXTERN[id].anfahrt_min > 0 && R.EXTERN[id].max_sterne >= 1)) f(`EXTERN.${id}: anfahrt_min und max_sterne prüfen`)
}
for (const [id, P] of Object.entries(R.PERSONAL)) for (const l of P.lehrgaenge || []) if (!R.LEHRGAENGE[l]) f(`PERSONAL.${id}: unbekannter Lehrgang "${l}"`)
for (const [k, v] of Object.entries(R.FREISCHALTUNG_LEVEL)) if (!(Number.isInteger(v) && v > 0)) f(`FREISCHALTUNG_LEVEL.${k}: ganze Zahl über 0 nötig`)
// Rettungsdienst: Patienten, Notarzt, Gebäude-Voraussetzungen, Defibrillatoren
if (!R.RETTUNG || !(R.RETTUNG.hilfsfrist_min > 0)) f("RETTUNG: hilfsfrist_min fehlt")
for (const [id, a] of Object.entries(R.EINSATZARTEN)) {
  if (a.patient && !(R.RETTUNG.patient[a.patient])) f(`EINSATZARTEN.${id}: unbekannte Dringlichkeit "${a.patient}"`)
  if ((a.notarzt || a.reanimation) && !a.patient) f(`EINSATZARTEN.${id}: notarzt oder reanimation ohne patient`)
  for (const [g, st] of Object.entries(a.braucht_gebaeude || {})) if (!(R.GEBAEUDE[g] && R.GEBAEUDE[g][st])) f(`EINSATZARTEN.${id}: Gebäudestufe ${g}[${st}] gibt es nicht`)
}
for (const [id, l] of Object.entries(R.LEHRGAENGE)) for (const [g, st] of Object.entries(l.gebaeude || {})) if (!(R.GEBAEUDE[g] && R.GEBAEUDE[g][st])) f(`LEHRGAENGE.${id}: Gebäudestufe ${g}[${st}] gibt es nicht`)
for (const [id, a] of Object.entries(R.AUSBAU)) {
  if (a.effekt && a.effekt.aed_ort && !R.ORTE[a.effekt.aed_ort]) f(`AUSBAU.${id}: unbekannter Ort "${a.effekt.aed_ort}"`)
  if (a.gebaeude !== "ort" && !R.GEBAEUDE[a.gebaeude]) f(`AUSBAU.${id}: unbekanntes Gebäude "${a.gebaeude}"`)
}
for (const [geb, stufen] of Object.entries(R.GEBAEUDE)) stufen.forEach((st, i) => { if (st.ort && !R.ORTE[st.ort]) f(`GEBAEUDE.${geb}[${i}]: unbekannter Ort "${st.ort}"`) })
for (const nb of R.NEUBAUGEBIETE) if (!(nb.bauzeit_h > 0)) f(`NEUBAUGEBIETE.${nb.id}: bauzeit_h fehlt`)
if (!Array.isArray(R.SONNE) || R.SONNE.length !== 12) f("SONNE: zwölf Monate nötig")
else R.SONNE.forEach(([auf, unter], i) => { if (!(auf > 0 && auf < unter && unter < 24)) f(`SONNE[${i}]: ungültig`) })

// Lehrgänge: Voraussetzungen bekannt und ohne Kreis
for (const [id, l] of Object.entries(R.LEHRGAENGE)) {
  quelle(`LEHRGAENGE.${id}`, l.quelle)
  for (const v of l.voraussetzung || []) {
    if (!R.LEHRGAENGE[v]) f(`LEHRGAENGE.${id}: unbekannte Voraussetzung "${v}"`)
    else if (R.LEHRGAENGE[v].org !== l.org) f(`LEHRGAENGE.${id}: Voraussetzung "${v}" gehört zu einer anderen Organisation`)
  }
}
function kreisfrei(name, knoten, nachfolger) {
  const zustand = {}
  const besuche = (k, pfad) => {
    if (zustand[k] === 2) return
    if (zustand[k] === 1) return f(`${name}: Kreis ${pfad.concat(k).join(" → ")}`)
    zustand[k] = 1
    for (const n of nachfolger(k)) if (knoten.includes(n)) besuche(n, pfad.concat(k))
    zustand[k] = 2
  }
  knoten.forEach((k) => besuche(k, []))
}
kreisfrei("LEHRGAENGE", Object.keys(R.LEHRGAENGE), (k) => R.LEHRGAENGE[k].voraussetzung || [])

// Dienstgrade und Funktionen
R.DIENSTGRADE_FEUERWEHR.forEach((d) => d.lehrgaenge.forEach((l) => R.LEHRGAENGE[l] || f(`DIENSTGRADE ${d.kurz}: unbekannter Lehrgang "${l}"`)))
for (const [id, fu] of Object.entries(R.FUNKTIONEN_FEUERWEHR)) if (!R.LEHRGAENGE[fu.lehrgang]) f(`FUNKTIONEN.${id}: unbekannter Lehrgang "${fu.lehrgang}"`)

// Geräte
for (const [id, g] of Object.entries(R.GERAETE)) {
  quelle(`GERAETE.${id}`, g.quelle)
  if (!(g.slots >= 0)) f(`GERAETE.${id}: slots fehlt`)
  if (!(g.preis > 0)) f(`GERAETE.${id}: preis muss positiv sein`)
  if (!["beide"].concat(Object.keys(R.ORGANISATIONEN)).includes(g.org)) f(`GERAETE.${id}: org ungültig`)
}

// Fahrzeuge: Beladung bekannt, passt in die Slots, Fahrer ist ein Lehrgang
for (const [id, fz] of Object.entries(R.FAHRZEUGE)) {
  quelle(`FAHRZEUGE.${id}`, fz.quelle)
  if (!R.ORGANISATIONEN[fz.org]) f(`FAHRZEUGE.${id}: org ungültig`)
  if (fz.fahrer !== null && !R.LEHRGAENGE[fz.fahrer]) f(`FAHRZEUGE.${id}: Fahrer-Lehrgang "${fz.fahrer}" unbekannt`)
  if (fz.fahrer && R.LEHRGAENGE[fz.fahrer] && R.LEHRGAENGE[fz.fahrer].org !== fz.org) f(`FAHRZEUGE.${id}: Fahrer-Lehrgang gehört zu einer anderen Organisation`)
  for (const v of fz.voraussetzung_fahrzeug || []) if (!R.FAHRZEUGE[v]) f(`FAHRZEUGE.${id}: unbekanntes Zugfahrzeug "${v}"`)
  let belegt = 0
  for (const [g, n] of Object.entries(fz.grundbeladung || {})) {
    if (!R.GERAETE[g]) { f(`FAHRZEUGE.${id}: Grundbeladung "${g}" unbekannt`); continue }
    if (R.GERAETE[g].org !== "beide" && R.GERAETE[g].org !== fz.org) f(`FAHRZEUGE.${id}: Grundbeladung "${g}" gehört zu einer anderen Organisation`)
    belegt += R.GERAETE[g].slots * n
  }
  if (belegt > fz.slots) f(`FAHRZEUGE.${id}: Grundbeladung braucht ${belegt} Slots, Fahrzeug hat ${fz.slots}`)
  else if (fz.slots - belegt < 1 && fz.slots > 1) hinweise.push(`FAHRZEUGE.${id}: nur ${(fz.slots - belegt).toFixed(2)} Slots frei nach Grundbeladung`)
}

// Gebäude und Ausbau
for (const [art, stufen] of Object.entries(R.GEBAEUDE)) stufen.forEach((s, i) => quelle(`GEBAEUDE.${art}[${i}]`, s.quelle))
for (const [id, a] of Object.entries(R.AUSBAU)) {
  quelle(`AUSBAU.${id}`, a.quelle)
  if (a.gebaeude !== "ort" && !R.GEBAEUDE[a.gebaeude]) f(`AUSBAU.${id}: unbekanntes Gebäude "${a.gebaeude}"`)
  else if (a.gebaeude !== "ort" && a.ab_stufe >= R.GEBAEUDE[a.gebaeude].length) f(`AUSBAU.${id}: Stufe ${a.ab_stufe} gibt es nicht`)
}
for (const [id, h] of Object.entries(R.HAUS_AUSBAU)) if (h.voraussetzung && !R.HAUS_AUSBAU[h.voraussetzung]) f(`HAUS_AUSBAU.${id}: unbekannte Voraussetzung`)
for (const [id, a] of Object.entries(R.AUSBAU)) if (a.voraussetzung && !R.AUSBAU[a.voraussetzung]) f(`AUSBAU.${id}: unbekannte Voraussetzung`)
// Echte DWD-Warnungen: Spielwetter bekannt, ausgelöste Einsatzarten gibt es
for (const [i, r] of R.DWD_WARNUNGEN.regeln.entries()) {
  if (!R.WETTER[r.wetter]) f(`DWD_WARNUNGEN.regeln[${i}]: unbekanntes Wetter "${r.wetter}"`)
  for (const a of r.ausloesen) if (!R.EINSATZARTEN[a.art] || !(a.min[0] <= a.min[1])) f(`DWD_WARNUNGEN.regeln[${i}]: Einsatzart "${a.art}" fehlt oder Zeitspanne falsch`)
}
// Sirenen: Standorte an bekannten Orten, Stufen mit Reichweite, Ausbauten zeigen auf Standort und Stufe
for (const [id, st] of Object.entries(R.SIRENEN.standorte)) if (!R.ORTE[st.ort]) f(`SIRENEN.standorte.${id}: unbekannter Ort "${st.ort}"`)
for (const [n, st] of Object.entries(R.SIRENEN.stufen)) if (!(st.radius > 0) || !(st.preis > 0)) f(`SIRENEN.stufen.${n}: Reichweite oder Preis fehlt`)
for (const [id, a] of Object.entries(R.AUSBAU)) {
  if (!a.sirene) continue
  if (!R.SIRENEN.standorte[a.sirene.standort]) f(`AUSBAU.${id}: unbekannter Sirenenstandort`)
  if (!R.SIRENEN.stufen[a.sirene.stufe]) f(`AUSBAU.${id}: unbekannte Sirenenstufe`)
}

// Bauplätze: eindeutig und nicht übereinander
const plaetze = R.BAUPLAETZE.slice()
for (const nb of R.NEUBAUGEBIETE) {
  if (nb.ab_geraetehaus >= R.GEBAEUDE.geraetehaus.length) f(`NEUBAUGEBIETE.${nb.id}: Gerätehausstufe gibt es nicht`)
  for (let r = 0; r < nb.reihen; r++) for (let s = 0; s < nb.spalten; s++) plaetze.push({ id: `${nb.id}_${r}_${s}`, x: nb.ursprung.x + s * nb.raster, z: nb.ursprung.z + r * nb.raster })
}
const ids = new Set()
plaetze.forEach((p, i) => {
  if (ids.has(p.id)) f(`Bauplatz doppelt: ${p.id}`)
  ids.add(p.id)
  for (let j = i + 1; j < plaetze.length; j++) {
    const q = plaetze[j]
    if (Math.hypot(p.x - q.x, p.z - q.z) < 8) f(`Bauplätze ${p.id} und ${q.id} liegen zu dicht (< 8 Einheiten)`)
  }
  for (const [oid, o] of Object.entries(R.ORTE)) if (o.fest && Math.hypot(p.x - o.x, p.z - o.z) < 8) f(`Bauplatz ${p.id} liegt auf ${oid}`)
})
const maxBewohner = plaetze.length * (1 + (R.HAUS_AUSBAU.einliegerwohnung ? R.HAUS_AUSBAU.einliegerwohnung.bewohner : 0))

// Einsatzarten
const arten = R.EINSATZARTEN
for (const [id, e] of Object.entries(arten)) {
  const ort = `EINSATZARTEN.${id}`
  quelle(ort, e.quelle)
  if (!R.ORGANISATIONEN[e.org]) f(`${ort}: org ungültig`)
  if (!e.folge_nur) {
    if (!(e.preis > 0) && !e.baustelle && !e.grosslage) f(`${ort}: preis fehlt`)
    if (!(e.intervall_min > 0)) f(`${ort}: intervall_min fehlt`)
    if (!(e.orte && e.orte.length)) f(`${ort}: orte fehlen`)
    if (!e.start && !e.start_polizei && !e.start_level && !e.freischaltung && !e.baustelle && !e.grosslage) f(`${ort}: weder Start noch Freischaltung`)
    if (e.grosslage && !(e.ab_level > 0)) f(`${ort}: Großlage ohne ab_level`)
    if (e.baustelle && e.phasen) for (const ph of e.phasen) if (!R.BAU.phasen.concat(R.BAU.phasen_klein).some((x) => x.id === ph)) f(`${ort}: unbekannte Bauphase "${ph}"`)
  }
  for (const o of e.orte || []) if (!R.ORTE[o] && !(o === "baustelle" && e.baustelle)) f(`${ort}: unbekannter Ort "${o}"`)
  for (const g of e.ort_gruppen || []) if (!R.ZUFALLSORT_NAMEN[g]) f(`${ort}: unbekannte Ortsgruppe "${g}"`)
  if (!(e.ablauf_min > 0)) f(`${ort}: ablauf_min fehlt`)
  if (!(e.arbeit_min >= 0)) f(`${ort}: arbeit_min fehlt`)
  if (!(e.ziel_eintreffen_min > 0)) f(`${ort}: ziel_eintreffen_min fehlt`)
  if (e.ziel_ende_min !== undefined && !(e.ziel_ende_min >= e.ziel_eintreffen_min)) f(`${ort}: ziel_ende_min liegt vor dem Eintreffen`)
  if (e.ziel_eintreffen_min > e.ablauf_min) f(`${ort}: Ziel-Eintreffzeit liegt nach dem Verfall`)
  if (e.freischaltung) {
    if (!arten[e.freischaltung.nach]) f(`${ort}: Freischaltung nach unbekanntem "${e.freischaltung.nach}"`)
    else if (arten[e.freischaltung.nach].folge_nur) f(`${ort}: Freischaltung nach Folgeeinsatz nicht möglich`)
    if (!(e.freischaltung.sterne >= 1 && e.freischaltung.sterne <= R.STERNE.max)) f(`${ort}: Sterne für Freischaltung ungültig`)
  }
  for (const fo of e.folge || []) if (!arten[fo]) f(`${ort}: unbekannter Folgeeinsatz "${fo}"`)
  for (const r of e.regeln || []) if (!R.REGELN[r]) f(`${ort}: unbekannte Regel "${r}"`)
  for (const teil of ["mindestens", "optimal"]) {
    const a = e[teil]
    if (!a) { f(`${ort}: ${teil} fehlt`); continue }
    if (!(a.personen >= 1)) f(`${ort}: ${teil}.personen fehlt`)
    if (a.einheit && !R.EINHEITEN[a.einheit]) f(`${ort}: unbekannte Einheit "${a.einheit}"`)
    if (a.einheit && a.personen < R.EINHEITEN[a.einheit].staerke[2]) f(`${ort}: ${teil}.personen kleiner als Stärke der Einheit ${a.einheit}`)
    qualifikation(`${ort}.${teil}`, a.qualifikation)
    geraeteGruppen(`${ort}.${teil}`, a.geraete)
    for (const [q, n] of Object.entries(a.qualifikation || {})) if (n > a.personen) f(`${ort}: ${teil} verlangt ${n}× ${q}, aber nur ${a.personen} Personen`)
  }
  if (e.mindestens && e.optimal && e.mindestens.personen > e.optimal.personen) f(`${ort}: mindestens.personen > optimal.personen`)
  if (e.mindestens && e.mindestens.personen > maxBewohner) f(`${ort}: braucht ${e.mindestens.personen} Personen, das Dorf fasst höchstens ${maxBewohner}`)
  psa(ort, e.psa)
  for (const fr of e.mindestens ? Object.keys(e.mindestens.qualifikation || {}) : []) {
    if (R.LEHRGAENGE[fr] && R.LEHRGAENGE[fr].org !== e.org) f(`${ort}: Qualifikation "${fr}" passt nicht zur Organisation`)
  }
  if (e.zufall && e.zufall.folge_bei_echt && !arten[e.zufall.folge_bei_echt]) f(`${ort}: unbekannter Folgeeinsatz bei echtem Alarm`)
}

// Regeln
for (const [id, r] of Object.entries(R.REGELN)) {
  quelle(`REGELN.${id}`, r.quelle)
  if (!r.abzug && !r.sperrt) f(`REGELN.${id}: weder abzug noch sperrt`)
  geraeteGruppen(`REGELN.${id}`, r.pruefung && r.pruefung.geraete)
  qualifikation(`REGELN.${id}`, r.pruefung && r.pruefung.qualifikation)
}

// Freischaltbaum: kreisfrei, jede kaufbare Art ist von einem Start aus erreichbar
const kaufbar = Object.keys(arten).filter((k) => !arten[k].folge_nur && !arten[k].baustelle && !arten[k].grosslage)
kreisfrei("Freischaltbaum", kaufbar, (k) => (arten[k].freischaltung ? [arten[k].freischaltung.nach] : []))
const erreichbar = new Set(kaufbar.filter((k) => arten[k].start || arten[k].start_polizei || arten[k].start_level))
let neu = true
while (neu) {
  neu = false
  for (const k of kaufbar) if (!erreichbar.has(k) && arten[k].freischaltung && erreichbar.has(arten[k].freischaltung.nach)) { erreichbar.add(k); neu = true }
}
for (const k of kaufbar) if (!erreichbar.has(k)) f(`EINSATZARTEN.${k}: vom Start aus nicht erreichbar`)

// Ergebnis
if (hinweise.length) console.log("Hinweise:\n  " + hinweise.join("\n  "))
console.log(`Regelwerk v${R.VERSION}: ${kaufbar.length} Einsatzarten (+${Object.keys(arten).length - kaufbar.length} Folgeeinsätze), ${Object.keys(R.GERAETE).length} Geräte, ${Object.keys(R.FAHRZEUGE).length} Fahrzeuge, ${Object.keys(R.LEHRGAENGE).length} Lehrgänge, ${plaetze.length} Bauplätze`)
if (process.argv.includes("--baum")) {
  const tiefe = (k) => (arten[k].freischaltung ? 1 + tiefe(arten[k].freischaltung.nach) : 0)
  kaufbar.sort((a, b) => tiefe(a) - tiefe(b) || arten[a].preis - arten[b].preis).forEach((k) => {
    const e = arten[k]
    console.log(`${"  ".repeat(tiefe(k))}${e.name} [${e.org}] ${e.preis} Münzen, alle ${e.intervall_min} min, Verfall ${e.ablauf_min} min${e.freischaltung ? `, nach ${e.freischaltung.nach} ≥ ${e.freischaltung.sterne}★` : ""}`)
  })
}
if (fehler.length) {
  console.error(`${fehler.length} Fehler:\n  ` + fehler.join("\n  "))
  process.exit(1)
}
console.log("Keine Fehler.")
