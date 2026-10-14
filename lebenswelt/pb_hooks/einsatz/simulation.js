// Simulation des Einsatzspiels: reine Funktionen ohne PocketBase, damit sie in Node getestet werden kann.
//
// fortschreiben(stand, bis, umwelt, R) schreibt den Stand ereignisweise bis zum Zeitpunkt `bis` (ms) fort:
// neue Einsätze erzeugen, disponieren, Eintreffen (Folgeeinsätze), Ende mit Bewertung. Alles, was für spätere
// Ereignisse nötig ist, steht im Stand. Deshalb ergibt fortschreiben(fortschreiben(s, t1), t2) dasselbe wie
// fortschreiben(s, t2). Der Zufall ist deterministisch (Startwert, Einsatzart, laufende Nummer).
//
// Kein Zugriff auf Claude oder andere KI: das Spiel kostet im Betrieb kein Guthaben.
// Hinweis für PocketBase (goja): bewusst ohne ?. und ??.

const MIN = 60 * 1000
const STD = 60 * MIN
const TRAGEN_SLOTS_JE_PERSON = 2 // spielwert: was eine Einsatzkraft zu Fuß aus dem Lager mitnehmen kann
const POLIZEI_REAKTION_S = 30 // spielwert: Streife an der Dienststelle bricht auf
const LUFTLINIE_FAKTOR = 1.3 // zu Fuß und mit dem Rad über Wege und Gärten
const ZU_FUSS_POLIZEI_MS = 1.4
const VERGEBLICH_MS = 10 * MIN // spielwert: wer umsonst zum Gerätehaus kam, ist so lange gebunden

// ---------- Hilfen ----------

function kopie(o) {
  return JSON.parse(JSON.stringify(o))
}

/** Deterministischer Zufall (mulberry32) aus einer Zeichenkette. */
function zufall(saat) {
  let h = 1779033703 ^ saat.length
  for (let i = 0; i < saat.length; i++) {
    h = Math.imul(h ^ saat.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ortszeit Deutschland (MEZ/MESZ) ohne Zeitzonendatenbank: Sommerzeit vom letzten Sonntag im März bis zum letzten im Oktober, 1 Uhr UTC. */
function ortszeit(ms) {
  const d = new Date(ms)
  const jahr = d.getUTCFullYear()
  const letzterSonntag = (monat) => {
    const t = new Date(Date.UTC(jahr, monat + 1, 0, 1))
    t.setUTCDate(t.getUTCDate() - t.getUTCDay())
    return t.getTime()
  }
  const sommer = ms >= letzterSonntag(2) && ms < letzterSonntag(9)
  const l = new Date(ms + (sommer ? 2 : 1) * STD)
  return { stunde: l.getUTCHours(), minute: l.getUTCMinutes(), wochentag: l.getUTCDay(), monat: l.getUTCMonth() + 1, tag: l.getUTCDate() }
}

/** Versatz der Ortszeit (Mitteleuropa, mit Sommerzeit) zu UTC in ms. */
const TAG_XP_MAX = 150
const TAGE_BEHALTEN = 21

function ortsversatz(ms) {
  const jahr = new Date(ms).getUTCFullYear()
  const letzterSonntag = (monat) => {
    const t = new Date(Date.UTC(jahr, monat + 1, 0, 1))
    t.setUTCDate(t.getUTCDate() - t.getUTCDay())
    return t.getTime()
  }
  return (ms >= letzterSonntag(2) && ms < letzterSonntag(9) ? 2 : 1) * STD
}

/** Kalendertag in Ortszeit als JJJJ-MM-TT. */
function tagVon(ms) {
  return new Date(ms + ortsversatz(ms)).toISOString().slice(0, 10)
}

/** Ende eines Kalendertags (Mitternacht Ortszeit) in ms. */
function tagesende(tag) {
  const mitternachtUtc = Date.parse(tag + "T00:00:00Z") + 24 * STD
  const grob = mitternachtUtc - ortsversatz(mitternachtUtc)
  return mitternachtUtc - ortsversatz(grob)
}

/** Zahl mit einer Nachkommastelle und deutschem Komma, für Texte im Protokoll. */
function komma(n) {
  return n.toFixed(1).replace(".", ",")
}

/** Level der Lebenswelt aus allen XP, wie levelAusXp in der App (Start bei 0, Schritt n auf n + 1 kostet round(100 · (n + 1)^1,4)). */
function levelAusXp(xp) {
  let level = 0
  let rest = Math.max(0, Number(xp) || 0)
  for (;;) {
    const schritt = Math.round(100 * Math.pow(level + 1, 1.4))
    if (rest < schritt) return level
    rest -= schritt
    level++
  }
}

/** Ist etwas mit diesem Level schon freigeschaltet? */
function levelReicht(s, ab) {
  return !ab || (s.level || 0) >= ab
}

function preis(R, roh) {
  if (!roh) return 0
  return Math.max(R.PREIS_MINIMUM || 10, Math.round(roh * R.PREISFAKTOR))
}

// ---------- Wege ----------

let netzCache = null
function netz(R) {
  if (netzCache && netzCache.quelle === R.STRASSEN) return netzCache
  const k = R.STRASSEN.knoten
  const idx = {}
  k.forEach((n, i) => (idx[n.id] = i))
  const n = k.length
  const d = []
  for (let i = 0; i < n; i++) {
    d.push([])
    for (let j = 0; j < n; j++) d[i].push(i === j ? 0 : Infinity)
  }
  const kanten = R.STRASSEN.kanten.map((e) => ({ a: idx[e.von], b: idx[e.nach], l: e.laenge }))
  for (const e of kanten) {
    d[e.a][e.b] = Math.min(d[e.a][e.b], e.l)
    d[e.b][e.a] = Math.min(d[e.b][e.a], e.l)
  }
  for (let m = 0; m < n; m++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (d[i][m] + d[m][j] < d[i][j]) d[i][j] = d[i][m] + d[m][j]
  netzCache = { quelle: R.STRASSEN, knoten: k, kanten, d }
  return netzCache
}

/** Nächster Punkt auf dem Straßennetz: Kante, Anteil und Abstand. */
function projektion(N, p) {
  let best = null
  N.kanten.forEach((e, i) => {
    const a = N.knoten[e.a]
    const b = N.knoten[e.b]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
    const ab = Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
    if (!best || ab < best.ab) best = { kante: i, t, ab }
  })
  return best
}

/** Weg über das Straßennetz in Welteinheiten (mit Zufahrt als Luftlinie). */
function strassenweg(R, p, q) {
  const N = netz(R)
  const a = projektion(N, p)
  const b = projektion(N, q)
  const ea = N.kanten[a.kante]
  const eb = N.kanten[b.kante]
  let innen
  if (a.kante === b.kante) innen = Math.abs(a.t - b.t) * ea.l
  else {
    innen = Infinity
    for (const [ka, da] of [[ea.a, a.t * ea.l], [ea.b, (1 - a.t) * ea.l]])
      for (const [kb, db] of [[eb.a, b.t * eb.l], [eb.b, (1 - b.t) * eb.l]]) innen = Math.min(innen, da + N.d[ka][kb] + db)
  }
  return a.ab + innen + b.ab
}

function luftlinie(p, q) {
  return Math.hypot(p.x - q.x, p.z - q.z)
}

/** Weg zu Fuß oder mit dem Rad: über Wege und Gärten, höchstens so lang wie über die Straße. */
function fussweg(R, p, q) {
  return Math.min(strassenweg(R, p, q), luftlinie(p, q) * LUFTLINIE_FAKTOR)
}

function punktVon(R, stand, ort) {
  if (R.ORTE[ort]) return R.ORTE[ort]
  if (String(ort).indexOf("baustelle:") === 0) {
    const id = ort.slice(10)
    const b = (stand.baustellen || []).concat(stand.bauchronik || []).find((x) => x.id === id)
    if (b) return b.ort
  }
  const bp = bauplatz(R, ort)
  return bp
}

/** Darf diese Einsatzart an diesem Ort stattfinden? In Schutzzonen nur harmlose Arten (Katze, Ruhestörung …). */
function ortErlaubt(R, s, art, ort) {
  const zonen = R.SCHUTZZONEN || []
  if (!zonen.length || !art || art.harmlos) return true
  const p = punktVon(R, s, ort)
  if (!p) return true
  return !zonen.some((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.r)
}

function bauplatz(R, id) {
  for (const b of R.BAUPLAETZE) if (b.id === id) return b
  for (const nb of R.NEUBAUGEBIETE) {
    if (id.indexOf(nb.id + "_") !== 0) continue
    const i = Number(id.slice(nb.id.length + 1))
    if (!(i >= 0 && i < nb.spalten * nb.reihen)) return null
    return { id, x: nb.ursprung.x + (i % nb.spalten) * nb.raster, z: nb.ursprung.z + Math.floor(i / nb.spalten) * nb.raster, preis: nb.preis, neubaugebiet: nb.id }
  }
  return null
}

// ---------- Wetter ----------

/** Wetter zu einem Zeitpunkt aus dem gespeicherten Verlauf, sonst aus der Jahreszeit. */
function wetterBei(verlauf, ms) {
  let w = null
  for (const e of verlauf || []) if (e.ab <= ms) w = e.wetter
  if (w) return w
  const m = ortszeit(ms).monat
  if (m === 12 || m <= 2) return "nass"
  if (m >= 6 && m <= 8) return "hitze"
  return "trocken"
}

// ---------- Stand ----------

/** Neuer, leerer Stand. "Katze auf Baum" ist von Anfang an gekauft (Entscheidung vom 13.10.2026). */
function neuerStand(R, jetzt, saat) {
  const s = {
    version: 2,
    level: 0,
    bis: jetzt,
    zufall: saat === undefined ? jetzt % 100000 : saat,
    einsatzarten: {},
    freigeschaltet: [],
    haeuser: [],
    personal: [],
    fahrzeuge: [],
    lager: { feuerwehr: {}, polizei: {}, werkstatt: {}, bauhof: {} },
    pflege: [],
    gebaeude: { geraetehaus: 0, dienststelle: 0, sportplatz: 0, werkstatt: 0, bauhof: 0 },
    ausbau: [],
    neubaugebiete: [],
    laufend: [],
    abgeschlossen: [],
    ausgaben: [],
    baustellen: [],
    bauchronik: [],
    zaehler: 0,
  }
  for (const [id, a] of Object.entries(R.EINSATZARTEN)) {
    if (a.start || a.start_polizei) s.freigeschaltet.push(id)
    if (a.start) aktiviereArt(R, s, id, jetzt)
  }
  return s
}

function aktiviereArt(R, s, id, jetzt) {
  const a = R.EINSATZARTEN[id]
  const r = zufall(s.zufall + ":" + id + ":start")
  s.einsatzarten[id] = { gekauft: jetzt, naechster: jetzt + Math.round(a.intervall_min * MIN * (0.3 + 0.7 * r())), nr: 0, anzahl: 0, erfolgreich: 0, beste_sterne: 0 }
}

// ---------- Bestand ----------

function frei(obj, t) {
  return !obj.belegt_bis || obj.belegt_bis <= t
}

function hatLehrgang(p, id, t) {
  return p.lehrgaenge[id] !== undefined && p.lehrgaenge[id] <= t
}

function verfuegbar(p, t) {
  return frei(p, t) && !(p.lehrgang_laeuft && p.lehrgang_laeuft.bis > t)
}

/** Gehört die Person zu dieser Organisation (Hauptorganisation oder zusätzliche Mitgliedschaft)? */
function istMitglied(p, org) {
  return p.org === org || (p.mitglied || []).indexOf(org) >= 0
}

/** Werktags in der Arbeitszeit (Ortszeit)? */
function inArbeitszeit(R, t) {
  const z = ortszeit(t)
  const a = R.ARBEITSZEIT || { tage: [], von: 0, bis: 0 }
  return a.tage.indexOf(z.wochentag) >= 0 && z.stunde >= a.von && z.stunde < a.bis
}

/** Hat die Person gerade Schicht? Der Schichtplan wiederholt sich, versetzt je Person. */
function inSchicht(R, p, t) {
  const b = R.BERUFE[p.beruf]
  if (!b || !b.schichtplan) return false
  const plan = b.schichtplan
  const versatz = (parseInt(String(p.id).replace(/\D/g, ""), 10) || 0) % plan.length
  const tag = Math.floor((t + ortsversatz(t)) / (24 * STD))
  const h = ortszeit(t).stunde
  const heute = R.SCHICHTEN[plan[(tag + versatz) % plan.length]]
  const gestern = R.SCHICHTEN[plan[(tag + versatz + plan.length - 1) % plan.length]]
  if (heute && h >= heute[0] && h < Math.min(24, heute[1])) return true
  return Boolean(gestern && gestern[1] > 24 && h < gestern[1] - 24)
}

/**
 * Kann die Person zum Zeitpunkt t für diese Organisation ausrücken? Die Polizei an der Dienststelle ist immer besetzt
 * (wie bisher). Für die Feuerwehr zählen Beruf und Schicht: Pendler fehlen in der Arbeitszeit, wer Schicht hat, auch.
 */
/** Läuft gerade der Wachdienst der DLRG (Wachturm gebaut, Sommerwochenende, Uhrzeit)? */
function wachdienstAktiv(R, s, t) {
  const W = R.WACHDIENST
  const st = W && R.GEBAEUDE.wachstation && R.GEBAEUDE.wachstation[s.gebaeude.wachstation || 0]
  if (!st || !st.wachdienst || !levelReicht(s, R.ORGANISATIONEN.dlrg.ab_level)) return false
  const z = ortszeit(t)
  return W.tage.indexOf(z.wochentag) >= 0 && W.monate.indexOf(z.monat) >= 0 && z.stunde >= W.von && z.stunde < W.bis
}

/** Sitzt die Person gerade auf dem Wachturm? Die ersten Mitglieder (nach Nummer) mit Rettungsschwimmabzeichen. */
function aufWache(R, s, p, t) {
  if (!s || !istMitglied(p, "dlrg") || !wachdienstAktiv(R, s, t)) return false
  const wache = s.personal.filter((q) => istMitglied(q, "dlrg") && hatLehrgang(q, "rs_bronze", t)).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))).slice(0, R.WACHDIENST.personen)
  return wache.some((q) => q.id === p.id)
}

function einsatzbereitFuer(R, p, org, t, s) {
  if (!verfuegbar(p, t) || !istMitglied(p, org)) return false
  // Wer auf dem Wachturm sitzt, fehlt allen anderen
  if (org !== "dlrg" && aufWache(R, s, p, t)) return false
  if (org === "polizei" && p.org === "polizei") return true
  if (org === "rettungsdienst" && p.org === "rettungsdienst") {
    // Stufe 1 der Rettungswache ist nur tagsüber besetzt
    const st = s && R.GEBAEUDE.rettungswache && R.GEBAEUDE.rettungswache[s.gebaeude.rettungswache || 0]
    if (st && st.tagdienst) {
      const h = ortszeit(t).stunde
      return h >= st.tagdienst[0] && h < st.tagdienst[1]
    }
    return true
  }
  const b = R.BERUFE[p.beruf] || {}
  if (b.abwesend && inArbeitszeit(R, t)) return false
  if (b.schichtplan && b.org !== org && inSchicht(R, p, t)) return false
  return true
}

/** Fitness der Person (Start 50, ohne Angabe ebenfalls 50). */
function fitnessVon(R, p) {
  return typeof p.fitness === "number" ? p.fitness : (R.FITNESS ? R.FITNESS.start : 50)
}

/** Tempo zu Fuß und mit dem Rad: 1 bei Startfitness. */
function fitnessTempo(R, p) {
  return R.FITNESS ? 1 + (R.FITNESS.tempo * (fitnessVon(R, p) - R.FITNESS.start)) / 100 : 1
}

/** Faktor auf die Arbeitszeit vor Ort: 1 bei Startfitness, unter 1 schneller. */
function fitnessArbeit(R, p) {
  return R.FITNESS ? 1 + (R.FITNESS.arbeit * (fitnessVon(R, p) - R.FITNESS.start)) / 100 : 1
}

/** Nächster Trainingstermin nach t (Ortszeit, Tage und Stunde aus FITNESS.training). */
function naechstesTraining(R, t) {
  const tr = R.FITNESS.training
  let tag = tagVon(t)
  for (let i = 0; i < 9; i++) {
    const beginn = tagesende(tag) - 24 * STD
    const termin = beginn + tr.stunde * STD
    if (termin > t && tr.tage.indexOf(ortszeit(termin).wochentag) >= 0) return termin
    tag = tagVon(tagesende(tag) + STD)
  }
  return t + 7 * 24 * STD
}

/** Trainingsabend: Mitglieder im Sportverein trainieren, am Trimm-dich-Pfad auch alle anderen; sonst baut Fitness ab. */
function training(R, s, t) {
  const F = R.FITNESS
  const stufe = R.GEBAEUDE.sportplatz[s.gebaeude.sportplatz || 0] || {}
  const winter = F.winter_monate.indexOf(ortszeit(t).monat) >= 0 && !stufe.licht
  const runde = (x) => Math.round(x * 10) / 10
  for (const p of s.personal) {
    const f = fitnessVon(R, p)
    let gewinn = 0
    if (verfuegbar(p, t)) {
      if (p.sportverein) gewinn = winter || !stufe.fitness ? F.joggen : stufe.fitness
      else if (stufe.trimm && !winter) gewinn = F.trimm
    }
    if (gewinn) p.fitness = runde(Math.min(F.max, f + gewinn))
    else if (f > F.start) p.fitness = runde(Math.max(F.start, f - F.abbau))
  }
  s.training_letztes = t
  s.training_naechster = naechstesTraining(R, t)
}

/** Gerät in Pflege an einem Ort (Fahrzeug-ID oder "lager:<org>"). */
function inPflege(s, wo, geraet, t) {
  let n = 0
  for (const e of s.pflege) if (e.wo === wo && e.geraet === geraet && e.bis > t) n += e.anzahl
  return n
}

function bestandVon(s, wo, liste, t) {
  const b = {}
  for (const [g, n] of Object.entries(liste)) {
    const frei = n - inPflege(s, wo, g, t)
    if (frei > 0) b[g] = frei
  }
  return b
}

function addiere(ziel, quelle) {
  for (const [k, v] of Object.entries(quelle)) ziel[k] = (ziel[k] || 0) + v
  return ziel
}

/** Erfüllt der Bestand eine Liste von Gruppen (jede Gruppe: eine Alternative vollständig vorhanden)? Gibt die fehlenden Gruppen zurück. */
function fehlendeGruppen(gruppen, bestand) {
  const fehlt = []
  for (const g of gruppen || []) {
    const ok = g.some((alt) => Object.entries(alt).every(([id, n]) => (bestand[id] || 0) >= n))
    if (!ok) fehlt.push(g)
  }
  return fehlt
}

function gruppenText(R, g) {
  return g
    .map((alt) =>
      Object.entries(alt)
        .map(([id, n]) => (n > 1 ? n + " × " : "") + ((R.GERAETE[id] || R.MERKMALE[id] || { name: id }).name))
        .join(" und "),
    )
    .join(" oder ")
}

function zaehleQualifikation(personen, id, t) {
  return personen.filter((p) => hatLehrgang(p, id, t)).length
}

function fehlendeQualifikation(q, personen, t) {
  const fehlt = []
  for (const [id, n] of Object.entries(q || {})) if (zaehleQualifikation(personen, id, t) < n) fehlt.push([id, n])
  return fehlt
}

/** Merkmale, die aus Fahrzeugen und Lage folgen. */
function merkmale(R, fahrzeuge) {
  const m = {}
  for (const f of fahrzeuge) {
    const typ = R.FAHRZEUGE[f.typ]
    if (typ.wasser_l) {
      m.fahrzeug_wasser = (m.fahrzeug_wasser || 0) + 1
      m.fahrzeug_tank_l = (m.fahrzeug_tank_l || 0) + typ.wasser_l
    }
    if (typ.pumpe_l_min) m.fahrzeug_pumpe = 1
    if (f.typ === "dlak") m.dlak_fahrzeug = 1
    if (f.typ === "elw1") m.elw_fahrzeug = 1
    if (f.typ === "tlf3000") m.tlf_fahrzeug = 1
    if (f.typ === "mzb") m.boot_fahrzeug = 1
    // weitere Merkmale aus MERKMALE (z. B. Rettungswagen)
    for (const [id, mk] of Object.entries(R.MERKMALE || {})) if (mk.aus && mk.aus.fahrzeug && mk.aus.fahrzeug.indexOf(f.typ) >= 0 && !m[id]) m[id] = 1
  }
  return m
}

// ---------- Löschwasser ----------

/** Hydranten im Ort: feste aus der Karte plus gekaufte an den Hydrantenplätzen. */
function hydrantenVon(R, s) {
  const liste = (R.HYDRANTEN || []).slice()
  for (const id of s.ausbau || []) {
    const e = R.AUSBAU[id] && R.AUSBAU[id].effekt
    const platz = e && e.hydrant_platz !== undefined && (R.HYDRANT_PLAETZE || [])[e.hydrant_platz]
    if (platz) liste.push(platz)
  }
  return liste
}

/** Nächster Punkt auf einem Linienzug. */
function naechsterPunkt(p, punkte) {
  let best = { x: punkte[0][0], z: punkte[0][1] }
  let bestD = Infinity
  for (let i = 1; i < punkte.length; i++) {
    const [ax, az] = punkte[i - 1]
    const [bx, bz] = punkte[i]
    const dx = bx - ax
    const dz = bz - az
    const l2 = dx * dx + dz * dz || 1
    const u = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / l2))
    const q = { x: ax + u * dx, z: az + u * dz }
    const d = Math.hypot(q.x - p.x, q.z - p.z)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

/**
 * Wasserversorgung für einen Brand mit Strahlrohren. Gewählt wird die schnellste Quelle: Hydrant (mit Standrohr) oder
 * offenes Gewässer (Pumpe, zwei A-Saugschläuche, Saugkorb), sofern die B- und C-Schläuche bis dorthin reichen.
 * Mit Wasser im Tank wird sofort gelöscht und die Versorgung parallel aufgebaut; Verzug entsteht erst, wenn der Tank
 * vorher leer ist. Gibt {quelle, x, z, meter, sekunden (Verzug), faktor, text} zurück.
 */
function wasserversorgung(R, s, ort, b, loeschLMin) {
  const Z = R.ZEITEN
  const m = R.METER_JE_EINHEIT
  let schlauch = 0
  for (const [id, n] of Object.entries(b)) {
    const g = R.GERAETE[id]
    if (g && g.kategorie === "schlauch" && g.effekt && (g.effekt.groesse === "B" || g.effekt.groesse === "C")) schlauch += g.effekt.laenge_m * n
  }
  const wege = []
  if (b.standrohr) {
    for (const h of hydrantenVon(R, s)) {
      const meter = Math.hypot(h.x - ort.x, h.z - ort.z) * m
      if (meter <= schlauch) wege.push({ quelle: "hydrant", x: h.x, z: h.z, meter: Math.round(meter), aufbau: Z.wasser_hydrant_s + meter / Z.leitung_m_s, text: "Hydrant in " + Math.round(meter) + " m" })
    }
  }
  const pumpe = b.fahrzeug_pumpe || Object.keys(b).some((id) => b[id] > 0 && R.GERAETE[id] && R.GERAETE[id].kategorie === "pumpe" && R.GERAETE[id].effekt && R.GERAETE[id].effekt.pumpe_l_min)
  if (pumpe && (b.a_saugschlauch || 0) >= 2 && b.saugkorb) {
    for (const g of R.GEWAESSER || []) {
      if (!g.punkte || g.punkte.length < 2) continue
      const p = naechsterPunkt(ort, g.punkte)
      const meter = Math.hypot(p.x - ort.x, p.z - ort.z) * m
      if (meter <= schlauch) wege.push({ quelle: "gewaesser", x: p.x, z: p.z, meter: Math.round(meter), aufbau: Z.wasser_ansaugen_s + meter / Z.leitung_m_s, text: "Wasser aus " + g.name + " in " + Math.round(meter) + " m" })
    }
  }
  wege.sort((x, y) => x.aufbau - y.aufbau)
  const tankS = b.fahrzeug_tank_l && loeschLMin > 0 ? (b.fahrzeug_tank_l / loeschLMin) * 60 : 0
  const w = wege[0]
  if (w) {
    const sekunden = Math.round(Math.max(0, w.aufbau - tankS))
    return { quelle: w.quelle, x: w.x, z: w.z, meter: w.meter, sekunden, text: w.text + (tankS && sekunden < w.aufbau ? ", bis dahin aus dem Tank" : "") }
  }
  if (tankS) return { quelle: "tank", sekunden: 0, faktor: Z.nur_tankwasser, text: "nur Tankwasser, keine Wasserversorgung in Reichweite" }
  return { quelle: "keine", sekunden: 0, faktor: Z.ohne_wasser, text: "kein Löschwasser in Reichweite" }
}

// ---------- Zeiten der Einsatzkräfte ----------

function ausbauEffekt(R, s, schluessel) {
  let summe = 0
  for (const id of s.ausbau) {
    const e = R.AUSBAU[id] && R.AUSBAU[id].effekt
    if (e && e[schluessel] !== undefined) summe += e[schluessel]
  }
  return summe
}

function ausbauFaktor(R, s, schluessel) {
  let f = 1
  for (const id of s.ausbau) {
    const e = R.AUSBAU[id] && R.AUSBAU[id].effekt
    if (e && e[schluessel] !== undefined) f *= e[schluessel]
  }
  return f
}

/** Wann ist die Person nach dem Alarm umgezogen am Gerätehaus? */
// ---------- Baustellen ----------

/** Ältere Stände kennen noch keine Baustellen. */
function bauFelder(s) {
  if (!s.baustellen) s.baustellen = []
  if (!s.bauchronik) s.bauchronik = []
  if (!s.tage) s.tage = {}
  // Version 2: Bewohner mit Beruf, Level, Sportplatz. Wer schon da war, bleibt "wie bisher" verfügbar.
  if (!s.version || s.version < 2) {
    for (const p of s.personal || []) if (!p.beruf) p.beruf = "frei"
    s.version = 2
  }
  if (s.level === undefined) s.level = 0
  for (const g of ["sportplatz", "werkstatt", "bauhof", "rettungswache", "drk_unterkunft", "wachstation", "thw_unterkunft"]) if (s.gebaeude && s.gebaeude[g] === undefined) s.gebaeude[g] = 0
  for (const o of ["werkstatt", "bauhof", "rettungsdienst", "drk", "dlrg", "thw"]) if (s.lager && !s.lager[o]) s.lager[o] = {}
}

/** Gebäude einer Organisation (geraetehaus, dienststelle, werkstatt, bauhof). */
function gebaeudeVon(R, org) {
  return (R.ORGANISATIONEN && R.ORGANISATIONEN[org] && R.ORGANISATIONEN[org].gebaeude) || (org === "polizei" ? "dienststelle" : "geraetehaus")
}

/** Ist die Organisation mit dem aktuellen Level schon im Spiel? */
function orgFrei(R, s, org) {
  const o = R.ORGANISATIONEN && R.ORGANISATIONEN[org]
  return !o || levelReicht(s, o.ab_level)
}

/** Einsatzarten mit start_level werden mit dem Level kaufbar (der erste Einsatz einer neuen Organisation). */
function levelFreischalten(R, s) {
  for (const [id, a] of Object.entries(R.EINSATZARTEN)) if (a.start_level && levelReicht(s, a.start_level) && s.freigeschaltet.indexOf(id) < 0) s.freigeschaltet.push(id)
}

/** Standort einer Organisation: Ort der aktuellen Gebäudestufe (z. B. RTW-Stellplatz am Feuerwehrhaus) oder GEBAEUDE_ORT. */
function standortVon(R, s, org) {
  const geb = gebaeudeVon(R, org)
  const st = R.GEBAEUDE[geb] && R.GEBAEUDE[geb][s.gebaeude[geb] || 0]
  const id = (st && st.ort) || (R.GEBAEUDE_ORT && R.GEBAEUDE_ORT[geb]) || "feuerwehrhaus"
  return R.ORTE[id] || R.ORTE.feuerwehrhaus
}

/** Personen einer Organisation, auch in Häusern, die noch gebaut werden (für Stellen). */
function orgZahl(s, org) {
  return s.personal.filter((p) => p.org === org).length + (s.baustellen || []).filter((b) => b.bewohner && b.bewohner.org === org).length
}

/**
 * Wer bringt den Notarzt? Eigenes NEF (mit Notarztvertrag, freiem Fahrzeug und Fahrer), tagsüber der
 * Rettungshubschrauber, sonst der Notarzt aus der Stadt. Gibt {quelle, name, eintreffen, fahrzeug?, fahrer?} zurück.
 */
function notarztPlan(R, s, e, alarm, besetzt) {
  const art = R.EINSATZARTEN[e.art]
  const Rt = R.RETTUNG
  if (!art.notarzt || !Rt) return null
  const ort = punktVon(R, s, e.ort)
  const wahl = []
  if (ausbauEffekt(R, s, "notarzt") > 0) {
    const nef = s.fahrzeuge.find((f) => R.FAHRZEUGE[f.typ].nef && frei(f, alarm) && besetzt.indexOf(f.id) < 0)
    const fahrer = nef && s.personal.find((p) => besetzt.indexOf(p.id) < 0 && einsatzbereitFuer(R, p, "rettungsdienst", alarm, s) && hatLehrgang(p, R.FAHRZEUGE[nef.typ].fahrer, alarm))
    if (nef && fahrer) {
      const tempo = (R.FAHRZEUGE[nef.typ].tempo_kmh / 3.6) * R.ZEITEN.sonderrechte_tempo
      const weg = strassenweg(R, standortVon(R, s, "rettungsdienst"), ort)
      const eintreffen = alarm + (R.ORGANISATIONEN.rettungsdienst.reaktion_s + R.ZEITEN.ausruecken_s) * 1000 + Math.round(((weg * R.METER_JE_EINHEIT) / tempo) * 1000)
      wahl.push({ quelle: "nef", name: "Notarzt mit dem eigenen NEF", eintreffen, fahrzeug: nef.id, fahrer: fahrer.id })
    }
  }
  if (!dunkel(R, alarm)) wahl.push({ quelle: "rth", name: Rt.rth_name, eintreffen: alarm + Math.round((Rt.rth_min + ausbauEffekt(R, s, "rth_min")) * MIN) })
  wahl.push({ quelle: "stadt", name: "Notarzt aus der Stadt", eintreffen: alarm + Rt.notarzt_stadt_min * MIN })
  wahl.sort((a, b) => a.eintreffen - b.eintreffen)
  return wahl[0]
}

/** Kann das DRK verpflegen? Feldküche mit Zugfahrzeug frei und jemand mit Verpflegungsausbildung, der nicht schon mitfährt. */
function drkVerpflegung(R, s, t, schon) {
  if (!orgFrei(R, s, "drk")) return false
  const ids = schon.map((p) => p.id)
  const kueche = s.fahrzeuge.find((f) => f.typ === "feldkueche" && frei(f, t))
  const zug = kueche && s.fahrzeuge.find((f) => (R.FAHRZEUGE.feldkueche.voraussetzung_fahrzeug || []).indexOf(f.typ) >= 0 && frei(f, t))
  return Boolean(zug && s.personal.some((p) => ids.indexOf(p.id) < 0 && einsatzbereitFuer(R, p, "drk", t, s) && hatLehrgang(p, "verpflegungshelfer", t)))
}

/** Wiederherstellung des Fahrzeugs nach dem Transport (Desinfizieren, Auffüllen), in ms. */
function wiederherstellungMs(R, s, art, leute, t) {
  let min = R.RETTUNG.wiederherstellung_min * ausbauFaktor(R, s, "wiederherstellung_faktor")
  if (art.infektion) min *= R.RETTUNG.infektion_faktor * (leute.some((p) => hatLehrgang(p, "desinfektor", t)) ? 0.5 : 1)
  return Math.round(min * MIN)
}

/** Ein öffentlicher Defibrillator in der Nähe der Einsatzstelle? */
function aedInDerNaehe(R, s, ort) {
  for (const id of s.ausbau) {
    const e = R.AUSBAU[id] && R.AUSBAU[id].effekt
    const o = e && e.aed_ort && R.ORTE[e.aed_ort]
    if (o && luftlinie(o, ort) <= R.RETTUNG.aed_umkreis) return true
  }
  return false
}

/**
 * Wie es dem Patienten geht (kein Tod im Spiel): Minuten vom Notruf bis zur Versorgung, Erste Hilfe davor zählt zur
 * Hälfte, bei Reanimation helfen Telefonreanimation und ein Defibrillator in der Nähe.
 */
function patientErgebnis(R, s, e) {
  const art = R.EINSATZARTEN[e.art]
  const Rt = R.RETTUNG
  const pl = e.plan
  const notruf = e.notruf || e.meldung
  let versorgt = pl.eintreffen
  if (pl.notarzt && pl.notarzt.eintreffen < versorgt) versorgt = pl.notarzt.eintreffen
  let ohne = (versorgt - notruf) / MIN
  const hilfen = []
  if (e.erste_hilfe && e.erste_hilfe < versorgt) {
    ohne -= (Rt.erste_hilfe_anteil * (versorgt - e.erste_hilfe)) / MIN
    hilfen.push("Erste Hilfe vor Ort")
  }
  if (art.reanimation && ausbauEffekt(R, s, "telefonreanimation") > 0) {
    ohne -= Rt.telefon_bonus_min
    hilfen.push("Telefonreanimation")
  }
  if (art.reanimation && aedInDerNaehe(R, s, punktVon(R, s, e.ort))) {
    ohne -= Rt.aed_bonus_min
    hilfen.push("Defibrillator in der Nähe")
  }
  ohne = Math.max(0, ohne)
  const grenzen = Rt.patient[art.patient] || Rt.patient.gelb
  const ergebnis = ohne <= grenzen[0] ? "stabil" : ohne <= grenzen[1] ? "verzoegert" : "verschlechtert"
  const text = { stabil: "stabil übergeben", verzoegert: "mit Verzögerung übergeben", verschlechtert: "Zustand hat sich verschlechtert" }[ergebnis]
  return { dringlichkeit: art.patient, ergebnis, text, minuten: Math.round(ohne * 10) / 10, hilfen }
}

/** Glätte und Schnee wirken auf gestreuten Straßen wie Nässe (Winterdienst des Bauhofs). */
function wetterGestreut(s, w, t) {
  return (w === "glaette" || w === "schnee") && s.gestreut_bis && t < s.gestreut_bis ? "nass" : w
}

/** Offene Einsätze, die eine Straße blockieren (Panne, Bergung, Reinigung), nahe einem der Punkte. */
function sperrungenAmWeg(R, s, punkte, t, ohne) {
  const r = R.BAU.verkehr.radius
  const aus = []
  for (const x of s.laufend) {
    const a = R.EINSATZARTEN[x.art]
    if (!a || !a.sperrt || x.id === ohne || x.meldung > t || t >= (x.ende || x.verfall)) continue
    const p = punktVon(R, s, x.ort)
    if (p && punkte.some((q) => q && luftlinie(q, p) <= r)) aus.push({ name: a.name, ort: p })
  }
  return aus
}

function bauPhasen(R, b) {
  if (b.phasen && R.BAU["phasen_" + b.phasen]) return R.BAU["phasen_" + b.phasen]
  return b.klein ? R.BAU.phasen_klein : R.BAU.phasen
}

/** Phase einer Baustelle zum Zeitpunkt t (null: noch nicht begonnen oder fertig). */
function bauPhase(R, b, t) {
  if (t < b.start || t >= b.ende) return null
  const anteil = (t - b.start) / Math.max(1, b.ende - b.start)
  let summe = 0
  for (const ph of bauPhasen(R, b)) {
    summe += ph.anteil
    if (anteil < summe) return ph
  }
  const alle = bauPhasen(R, b)
  return alle[alle.length - 1]
}

/** Wird am Gerätehaus bzw. an der Dienststelle gebaut (Behelfsbetrieb)? Abnahme und kleine Ausbauten zählen nicht. */
function behelfAktiv(R, s, gebaeude, t) {
  return (s.baustellen || []).some((b) => {
    const am = (b.art === "gebaeude" && b.ziel === gebaeude) || (b.art === "ausbau" && !b.klein && R.AUSBAU[b.ziel] && R.AUSBAU[b.ziel].gebaeude === gebaeude)
    const ph = am && bauPhase(R, b, t)
    return Boolean(ph && ph.id !== "abnahme")
  })
}

/** Baustellen in lauten Phasen nahe einem der Punkte (Baustellenampel, Baufahrzeuge auf der Straße). */
function baustellenAmWeg(R, s, punkte, t) {
  const r = R.BAU.verkehr.radius
  return (s.baustellen || []).filter((b) => {
    const ph = bauPhase(R, b, t)
    return ph && ph.laut && punkte.some((p) => p && luftlinie(p, b.ort) <= r)
  })
}

/** Neue Baustelle anlegen; die Baufirma hat R.BAU.parallel_max Kolonnen, weitere Aufträge warten. */
function beginneBau(R, s, jetzt, b) {
  bauFelder(s)
  const kolonnen = []
  for (let i = 0; i < R.BAU.parallel_max; i++) kolonnen.push(jetzt)
  for (const x of s.baustellen.slice().sort((p, q) => p.start - q.start)) {
    let i = 0
    for (let k = 1; k < kolonnen.length; k++) if (kolonnen[k] < kolonnen[i]) i = k
    kolonnen[i] = Math.max(kolonnen[i], x.ende)
  }
  const start = Math.max(jetzt, Math.min.apply(null, kolonnen))
  s.zaehler += 1
  const neu = Object.assign({ id: "b" + s.zaehler, start, ende: start + Math.round(b.bauzeit_h * STD), gekauft: jetzt, wetter_geprueft: false, verzug_ms: 0 }, b)
  delete neu.bauzeit_h
  s.baustellen.push(neu)
  // Baustellen-Einsätze werden mit der ersten Baustelle aktiv
  for (const [id, a] of Object.entries(R.EINSATZARTEN)) if (a.baustelle && !s.einsatzarten[id]) aktiviereArt(R, s, id, start)
  return neu
}

/** Ist am Ziel schon eine Baustelle offen? */
function imBau(s, art, ziel) {
  return (s.baustellen || []).some((b) => b.art === art && b.ziel === ziel)
}

/** Baustelle fertig: Wirkung eintragen, in die Bauchronik übernehmen. */
function fertigstellen(R, s, b, t) {
  if (b.art === "gebaeude") s.gebaeude[b.ziel] = b.stufe
  else if (b.art === "ausbau") {
    if (s.ausbau.indexOf(b.ziel) < 0) s.ausbau.push(b.ziel)
  } else if (b.art === "haus") {
    const h = s.haeuser.find((x) => x.id === b.ziel)
    if (h) {
      h.im_bau = false
      const bw = b.bewohner || { org: "feuerwehr", beruf: "frei" }
      s.personal.push(neuePerson(s, bw.org, h.id, t, bw))
    }
  } else if (b.art === "haus_ausbau") {
    const h = s.haeuser.find((x) => x.id === b.ziel)
    const a = R.HAUS_AUSBAU[b.ausbau]
    if (h && a) {
      if (h.ausbau.indexOf(b.ausbau) < 0) h.ausbau.push(b.ausbau)
      const bw = b.bewohner || { org: "feuerwehr", beruf: "frei" }
      for (let i = 0; i < (a.bewohner || 0); i++) s.personal.push(neuePerson(s, bw.org, h.id, t, bw))
    }
  } else if (b.art === "neubaugebiet") {
    if (s.neubaugebiete.indexOf(b.ziel) < 0) s.neubaugebiete.push(b.ziel)
  }
  s.baustellen = s.baustellen.filter((x) => x !== b)
  s.bauchronik.push({ id: b.id, art: b.art, ziel: b.ziel, name: b.name, ort: b.ort, start: b.start, fertig: t, verzug_ms: b.verzug_ms })
  if (s.bauchronik.length > 30) s.bauchronik = s.bauchronik.slice(-30)
}

/** Einmal am Ende: Zeit, die bei schlechtem Wetter verloren ging, wird angehängt (stündlich abgetastet). */
function wetterVerzug(R, b, wetter) {
  let verlust = 0
  for (let t = b.start; t < b.ende; t += STD) verlust += (R.BAU.wetter_verzug[wetter(t)] || 0) * Math.min(STD, b.ende - t)
  return Math.round(verlust)
}

// ---------- Ausrüstung und Licht ----------

/** Wirkung der persönlichen Ausrüstung einer Person: Werte der jeweils gekauften Stufe, fehlende Werte neutral. */
function psaEffekt(R, p, org) {
  const tabelle = (org || p.org) === "polizei" ? R.PSA_POLIZEI : R.PSA_FEUERWEHR
  const e = { tempo: 1, stolpern: 0, arbeit: 1, arbeit_th: 1, nacht: 0, umziehen_s: 0, reaktion_s: 0 }
  for (const [teil, stufen] of Object.entries(tabelle || {})) {
    const st = stufen[Math.min(stufen.length - 1, (p.psa && p.psa[teil]) || 0)]
    const w = (st && st.effekt) || {}
    if (w.tempo !== undefined) e.tempo *= w.tempo
    if (w.stolpern !== undefined) e.stolpern += w.stolpern
    if (w.arbeit !== undefined) e.arbeit *= w.arbeit
    if (w.arbeit_th !== undefined) e.arbeit_th *= w.arbeit_th
    if (w.nacht !== undefined) e.nacht = Math.max(e.nacht, w.nacht)
    if (w.umziehen_s !== undefined) e.umziehen_s += w.umziehen_s
    if (w.reaktion_s !== undefined) e.reaktion_s += w.reaktion_s
  }
  // Fitness: schneller zu Fuß und bei der Arbeit (bei Startfitness neutral)
  e.tempo *= fitnessTempo(R, p)
  e.arbeit *= fitnessArbeit(R, p)
  return e
}

/** Ausrüstung eines Trupps: der Langsamste und Unsicherste bestimmen den Weg, die Arbeit im Mittel. */
function truppEffekt(R, leute, org) {
  const alle = leute.map((p) => psaEffekt(R, p, org))
  const mittel = (k) => alle.reduce((n, x) => n + x[k], 0) / Math.max(1, alle.length)
  return {
    tempo: Math.min.apply(null, alle.map((x) => x.tempo).concat([1])),
    stolpern: Math.max.apply(null, alle.map((x) => x.stolpern).concat([0])),
    arbeit: mittel("arbeit"),
    arbeit_th: mittel("arbeit_th"),
    nacht: Math.min.apply(null, alle.map((x) => x.nacht).concat([alle.length ? 1 : 0])),
  }
}

/** Ist es zum Zeitpunkt dunkel (Ortszeit, Sonnenzeiten je Monat)? */
function dunkel(R, t) {
  const z = ortszeit(t)
  const h = z.stunde + (z.minute || 0) / 60
  const sonne = (R.SONNE || [])[z.monat - 1]
  return sonne ? h < sonne[0] || h >= sonne[1] : false
}

/** Licht an der Einsatzstelle (0 bis 1): Flutlicht, Taschenlampen je Person oder Helmlampen bei allen. */
function licht(R, bestand, leute, trupp) {
  let l = trupp.nacht
  for (const [id, n] of Object.entries(bestand)) {
    const g = R.GERAETE[id]
    if (!g || !g.effekt || !g.effekt.nacht || !n) continue
    // Taschenlampen helfen erst, wenn jede Person eine hat
    const voll = g.effekt.nacht >= 1 ? true : n >= leute
    if (voll) l = Math.max(l, g.effekt.nacht)
  }
  return Math.min(1, l)
}

function feuerwehrBereit(R, s, p, alarm, wetter) {
  const haus = s.haeuser.find((h) => h.id === p.haus)
  const beruf = R.BERUFE[p.beruf] || {}
  const ag = beruf.arbeitgeber && R.ARBEITGEBER[p.arbeitgeber]
  // In der Arbeitszeit kommt, wer im Dorf arbeitet, vom Arbeitsplatz und muss erst die Arbeit unterbrechen
  const vonArbeit = Boolean(ag && R.ORTE[ag.ort] && inArbeitszeit(R, alarm))
  const start = vonArbeit ? R.ORTE[ag.ort] : haus ? bauplatz(R, haus.bauplatz) : R.ORTE.feuerwehrhaus
  const al = R.ALARMIERUNG[(haus && haus.alarmierung) || "sirene"]
  const reaktion = Math.max(5, al.reaktion_s + ausbauEffekt(R, s, "reaktion_s"))
  const wf = R.WETTER[wetter] ? R.WETTER[wetter].tempo : 1
  const m = fussweg(R, start, R.ORTE.feuerwehrhaus) * R.METER_JE_EINHEIT
  let beste = Infinity
  for (const art of (haus && haus.ausbau.length ? haus.ausbau : []).concat(["zu_fuss"])) {
    const a = R.HAUS_AUSBAU[art]
    if (!a || !a.tempo_ms) continue
    let extra = a.extra_s || 0
    if (art === "auto") extra += ausbauEffekt(R, s, "auto_extra_s")
    if (art === "fahrrad" || art === "ebike") extra += ausbauEffekt(R, s, "fahrrad_extra_s")
    if (vonArbeit) extra += beruf.extra_s || 0
    const ft = art === "auto" ? 1 : fitnessTempo(R, p)
    beste = Math.min(beste, m / (a.tempo_ms * wf * ft) + Math.max(0, extra))
  }
  const stufe = R.GEBAEUDE.geraetehaus[s.gebaeude.geraetehaus]
  const behelf = behelfAktiv(R, s, "geraetehaus", alarm) ? R.BAU.behelf.umziehen_s : 0
  const umziehen = Math.max(10, stufe.umziehen_s + ausbauEffekt(R, s, "umziehen_s") + psaEffekt(R, p, "feuerwehr").umziehen_s + behelf)
  return alarm + Math.round((reaktion + beste + umziehen) * 1000)
}

function hatRueckmeldung(R, s, p) {
  const haus = s.haeuser.find((h) => h.id === p.haus)
  return Boolean(haus && R.ALARMIERUNG[haus.alarmierung] && R.ALARMIERUNG[haus.alarmierung].rueckmeldung)
}

// ---------- Disposition ----------

function teilmengen(liste, max) {
  const ergebnis = [[]]
  for (const x of liste) {
    const n = ergebnis.length
    for (let i = 0; i < n; i++) if (ergebnis[i].length < max) ergebnis.push(ergebnis[i].concat([x]))
  }
  return ergebnis
}

/** Was ein Trupp zu Fuß aus dem Lager mitnimmt: zuerst, was für "mindestens" fehlt, dann für "optimal". */
function tragen(R, art, lager, schon, personen) {
  let platz = personen * TRAGEN_SLOTS_JE_PERSON
  const mit = {}
  const bestand = Object.assign({}, schon)
  const gruppen = (art.mindestens.geraete || []).concat(art.optimal && art.optimal.geraete ? art.optimal.geraete : [])
  for (const g of gruppen) {
    if (!fehlendeGruppen([g], bestand).length) continue
    for (const alt of g) {
      const bedarf = Object.entries(alt)
      const slots = bedarf.reduce((sum, [id, n]) => sum + (R.GERAETE[id] ? R.GERAETE[id].slots * Math.max(0, n - (bestand[id] || 0)) : Infinity), 0)
      // im Lager muss noch liegen, was über den vorhandenen Bestand hinaus gebraucht wird
      const da = bedarf.every(([id, n]) => R.GERAETE[id] && (lager[id] || 0) - (mit[id] || 0) >= Math.max(0, n - (bestand[id] || 0)))
      if (!da || slots > platz) continue
      for (const [id, n] of bedarf) {
        const noch = Math.max(0, n - (bestand[id] || 0))
        mit[id] = (mit[id] || 0) + noch
        bestand[id] = (bestand[id] || 0) + noch
      }
      platz -= slots
      break
    }
  }
  return mit
}

/**
 * Plant den Einsatz: wer rückt mit welchem Fahrzeug aus, wann ist er da, wie lange dauert die Arbeit.
 * Gibt {plan} oder {grund} (warum nicht ausgerückt werden kann) zurück.
 */
function plane(R, s, e, alarm, umwelt) {
  const art = R.EINSATZARTEN[e.art]
  const org = art.org
  const wetter = e.wetter
  const wf = R.WETTER[wetter] ? R.WETTER[wetter].tempo : 1
  const ort = punktVon(R, s, e.ort)
  const geb = gebaeudeVon(R, org)
  const basis = standortVon(R, s, org)
  const personen = s.personal.filter((p) => einsatzbereitFuer(R, p, org, alarm, s))
  if (!personen.length) return externerPlan(R, s, e, alarm) || { grund: org === "polizei" ? "Keine Beamtin und kein Beamter verfügbar." : org === "feuerwehr" ? "Keine Einsatzkraft verfügbar." : "Niemand im Dienst." }

  // Bereitschaftszeit je Person: Feuerwehr von zu Hause, alle anderen sind an ihrem Gebäude im Dienst
  const reaktionS = (p) =>
    org === "polizei"
      ? POLIZEI_REAKTION_S + psaEffekt(R, p, "polizei").reaktion_s + (behelfAktiv(R, s, "dienststelle", alarm) ? R.BAU.behelf.reaktion_s : 0)
      : org === "dlrg" && aufWache(R, s, p, alarm)
        ? R.WACHDIENST.reaktion_s
        : ((R.ORGANISATIONEN && R.ORGANISATIONEN[org] && R.ORGANISATIONEN[org].reaktion_s) || 120) + (behelfAktiv(R, s, geb, alarm) ? R.BAU.behelf.reaktion_s : 0)
  const bereit = personen
    .map((p) => ({ p, t: org === "feuerwehr" ? feuerwehrBereit(R, s, p, alarm, wetter) : alarm + reaktionS(p) * 1000 }))
    .sort((a, b) => a.t - b.t || (a.p.id < b.p.id ? -1 : 1))

  const fahrzeuge = s.fahrzeuge.filter((f) => R.FAHRZEUGE[f.typ].org === org && frei(f, alarm))
  const lager = bestandVon(s, "lager:" + org, s.lager[org] || {}, alarm)
  const falschparker = org === "feuerwehr" && s.laufend.some((x) => x.art === "p_falschparker" && x.status !== "abgeschlossen" && x.meldung <= alarm && !(x.plan && x.plan.arbeit_ende <= alarm) && !(x.umgesetzt && x.umgesetzt <= alarm))
  const zf = falschparker ? R.EINSATZARTEN.p_falschparker.wirkung.fahrzeit_faktor : 1
  const behelfAus = org === "feuerwehr" && behelfAktiv(R, s, "geraetehaus", alarm) ? R.BAU.behelf.ausruecken_s : 0
  const ausruecken = Math.max(0, R.ZEITEN.ausruecken_s + ausbauEffekt(R, s, "ausruecken_s") + (org === "rettungsdienst" ? ausbauEffekt(R, s, "rd_ausruecken_s") : 0) + behelfAus) * 1000
  const amWeg = baustellenAmWeg(R, s, [basis, ort], alarm).concat(sperrungenAmWeg(R, s, [basis, ort], alarm, e.id)).slice(0, 2)
  const mind = art.mindestens || {}
  const opt = art.optimal || {}

  let bester = null
  let naechsterGrund = null
  for (const auswahl of teilmengen(fahrzeuge, 4)) {
    const motor = auswahl.filter((f) => !R.FAHRZEUGE[f.typ].gezogen && !R.FAHRZEUGE[f.typ].anhaenger && R.FAHRZEUGE[f.typ].tempo_kmh > 6)
    // Anhänger nur mit Zugfahrzeug
    if (auswahl.some((a) => R.FAHRZEUGE[a.typ].anhaenger && !motor.some((f) => (R.FAHRZEUGE[a.typ].voraussetzung_fahrzeug || []).indexOf(f.typ) >= 0))) continue
    const sitze = motor.reduce((n, f) => n + R.FAHRZEUGE[f.typ].besatzung[0] + R.FAHRZEUGE[f.typ].besatzung[1], 0)
    const zuFuss = motor.length === 0
    const kapazitaet = zuFuss ? bereit.length : Math.min(sitze, bereit.length)
    // Wer mitkommt: die Ersten, dazu weitere, die innerhalb der Wartezeit fertig sind
    const minP = Math.max(1, mind.personen || 1)
    if (kapazitaet < minP && !zuFuss) {
      naechsterGrund = naechsterGrund || "Nicht genug Sitzplätze."
      continue
    }
    if (bereit.length < minP) {
      naechsterGrund = "Nur " + bereit.length + " von " + minP + " Einsatzkräften verfügbar."
      continue
    }
    const grenze = bereit[minP - 1].t + R.ZEITEN.warten_auf_staerke_max_s * 1000
    // Ausgerückt wird höchstens mit der optimalen Stärke; wer darüber hinaus kommt, wird nicht gebraucht
    const ziel = Math.max(minP, opt.personen || minP)
    const trupp = bereit.filter((b, i) => i < minP || (b.t <= grenze && i < kapazitaet)).slice(0, Math.min(kapazitaet, ziel))
    const leute = trupp.map((b) => b.p)
    // Fahrer
    let fahrerFehlt = false
    const fahrerFrei = leute.slice()
    for (const f of motor) {
      const q = R.FAHRZEUGE[f.typ].fahrer
      if (!q) continue
      const i = fahrerFrei.findIndex((p) => hatLehrgang(p, q, alarm))
      if (i < 0) fahrerFehlt = true
      else fahrerFrei.splice(i, 1)
    }
    if (fahrerFehlt) {
      naechsterGrund = naechsterGrund || "Niemand mit Fahrberechtigung für das Fahrzeug."
      continue
    }
    // Geräte
    const bestand = {}
    for (const f of auswahl) addiere(bestand, bestandVon(s, f.id, f.beladung, alarm))
    addiere(bestand, merkmale(R, motor))
    const mit = zuFuss ? tragen(R, art, lager, bestand, leute.length) : {}
    addiere(bestand, mit)
    const fehltG = fehlendeGruppen(mind.geraete, bestand)
    const fehltQ = fehlendeQualifikation(mind.qualifikation, leute, alarm)
    if (fehltG.length || fehltQ.length) {
      naechsterGrund = fehltG.length ? "Es fehlt: " + gruppenText(R, fehltG[0]) + "." : "Es fehlt die Qualifikation " + R.LEHRGAENGE[fehltQ[0][0]].name + "."
      continue
    }
    // Zeiten
    const abfahrt = Math.max.apply(null, trupp.map((b) => b.t)) + (zuFuss ? 0 : ausruecken)
    let tempo
    let weg
    if (zuFuss) {
      const handzug = auswahl.some((f) => R.FAHRZEUGE[f.typ].gezogen)
      tempo = org === "polizei" ? ZU_FUSS_POLIZEI_MS : handzug ? R.ZEITEN.handzugwagen_ms : R.ZEITEN.zu_fuss_mit_leiter_ms
      weg = fussweg(R, basis, ort)
    } else {
      const sonderrechte = motor.some((f) => R.FAHRZEUGE[f.typ].ohne_sonderrechte) ? 1 : R.ZEITEN.sonderrechte_tempo
      tempo = (Math.min.apply(null, motor.map((f) => R.FAHRZEUGE[f.typ].tempo_kmh)) / 3.6) * sonderrechte
      weg = strassenweg(R, basis, ort)
    }
    // Zu Fuß bestimmen Stiefel, Wetter und Licht das Tempo
    const te = truppEffekt(R, leute, org)
    let fussFaktor = 1
    if (zuFuss) {
      fussFaktor = (1 / te.tempo) * (1 + te.stolpern * ((R.ZEITEN.stolpern_wetter || {})[wetter] || 1))
      if (dunkel(R, abfahrt)) fussFaktor *= 1 + (R.ZEITEN.nacht_zu_fuss - 1) * (1 - licht(R, bestand, leute.length, te))
    }
    const bauVerzug = amWeg.length * (zuFuss ? R.BAU.verkehr.zu_fuss_s : R.BAU.verkehr.fahrzeug_s) * 1000
    const fahrzeit = Math.round(((weg * R.METER_JE_EINHEIT) / (tempo * wf)) * zf * fussFaktor * 1000) + bauVerzug
    const eintreffen = abfahrt + fahrzeit
    const kandidat = { auswahl, motor, trupp, leute, bestand, mit, abfahrt, fahrzeit, eintreffen, te, fussFaktor, bauVerzug }
    const punkte = (k) => [k.auswahl.length, -fehlendeGruppen(opt.geraete, k.bestand).length * 0 - Math.min(k.leute.length, opt.personen || 0), k.eintreffen]
    if (!bester) bester = kandidat
    else {
      const a = punkte(kandidat)
      const b = punkte(bester)
      // weniger Fahrzeuge zuerst, dann mehr Leute bis optimal, dann früher da
      for (let i = 0; i < a.length; i++) {
        if (a[i] < b[i]) {
          bester = kandidat
          break
        }
        if (a[i] > b[i]) break
      }
    }
  }
  if (!bester) return externerPlan(R, s, e, alarm) || { grund: naechsterGrund || "Keine passende Ausrüstung." }

  // Arbeit vor Ort. Jeder Faktor wird mit Grund vermerkt, damit das Protokoll erklärt, was Zeit gekostet hat.
  const vorhanden = bester.leute.length
  const verzugMin = Math.max(0, (bester.eintreffen - e.meldung) / MIN)
  const faktoren = []
  const merke = (grund, faktor, text) => {
    if (Math.abs(faktor - 1) >= 0.01) faktoren.push({ grund, faktor: Math.round(faktor * 100) / 100, text })
  }
  if (bester.fussFaktor > 1.01) merke("zu_fuss", bester.fussFaktor, "Weg zu Fuß: Stiefel, Wetter und Licht")
  if (bester.bauVerzug) faktoren.push({ grund: "baustelle", sekunden: Math.round(bester.bauVerzug / 1000), text: "Hindernis an der Strecke (" + amWeg.map((b) => b.name).join(", ") + ")" })
  if (behelfAus) faktoren.push({ grund: "behelf", sekunden: behelfAus + R.BAU.behelf.umziehen_s, text: "Behelfsbetrieb wegen Umbau am Gerätehaus" })
  merke("personen", Math.pow(Math.max(1, (opt.personen || vorhanden) / vorhanden), 0.5), vorhanden + " von optimal " + (opt.personen || vorhanden) + " Einsatzkräften")
  const fehltOpt = fehlendeGruppen(opt.geraete, bester.bestand)
  const fehltOptQ = fehlendeQualifikation(opt.qualifikation, bester.leute, alarm)
  if (fehltOpt.length + fehltOptQ.length)
    merke(
      "geraete",
      1 + R.ZEITEN.fehlendes_geraet_arbeit * (fehltOpt.length + fehltOptQ.length),
      "ohne " + fehltOpt.map((g) => gruppenText(R, g)).concat(fehltOptQ.map(([id]) => R.LEHRGAENGE[id].name)).join("; "),
    )
  const sperren = []
  for (const r of art.regeln || []) {
    const regel = R.REGELN[r]
    if (regel.sperrt && !regelErfuellt(R, s, regel, bester, e, alarm)) {
      sperren.push(r)
      merke(r, 1.5, regel.name + " fehlt, nur Außenangriff")
    }
  }
  // Löschleistung: ohne Verteiler nur ein Strahlrohr, mit Verteiler bis zu drei, je Rohr ein Trupp
  const rohreMoeglich = Math.min(bester.bestand.verteiler ? R.ZEITEN.verteiler_abgaenge : 1, Math.max(1, Math.floor(vorhanden / R.ZEITEN.personen_je_rohr)))
  const rohre = []
  const sonstige = []
  for (const [id, n] of Object.entries(bester.bestand)) {
    const g = R.GERAETE[id]
    if (!g || !g.effekt || !g.effekt.loeschen_l_min) continue
    for (let i = 0; i < n; i++) (g.kategorie === "strahlrohr" ? rohre : sonstige).push(g.effekt.loeschen_l_min)
  }
  rohre.sort((x, y) => y - x)
  sonstige.sort((x, y) => y - x)
  const loesch = rohre.slice(0, rohreMoeglich).reduce((n, x) => n + x, 0) + sonstige.slice(0, Math.max(0, vorhanden - Math.min(rohre.length, rohreMoeglich))).reduce((n, x) => n + x, 0)
  if (art.wachstum && loesch > 0) {
    const text = rohre.length > 1 && !bester.bestand.verteiler ? "nur ein Strahlrohr, kein Verteiler" : "Löschleistung " + loesch + " l/min"
    merke("loeschen", Math.max(0.7, Math.min(2.5, Math.sqrt(200 / loesch))), text)
  }
  // Löschwasser: Ohne Strahlrohre (Löscher, Kübelspritze) braucht es keine Versorgung
  let wasser = null
  if (art.wachstum && rohre.length && loesch > 0) {
    wasser = wasserversorgung(R, s, ort, bester.bestand, loesch)
    if (wasser.sekunden) faktoren.push({ grund: "wasser", sekunden: wasser.sekunden, text: "Wasserversorgung: " + wasser.text })
    if (wasser.faktor) merke("wasser", wasser.faktor, wasser.text)
  }
  const wasserMin = wasser ? wasser.sekunden / 60 : 0
  if (art.wachstum && verzugMin + wasserMin > 0) merke("ausbreitung", 1 + art.wachstum * (verzugMin + wasserMin), wasserMin ? "Feuer hat sich bis zum Eintreffen und bis zur Wasserversorgung ausgebreitet" : "Feuer hat sich bis zum Eintreffen ausgebreitet")
  const th = String(art.stichwort || "").indexOf("TH") === 0
  merke("ausruestung", bester.te.arbeit * (th ? bester.te.arbeit_th : 1), "persönliche Ausrüstung")
  if (dunkel(R, bester.eintreffen)) merke("dunkel", 1 + (R.ZEITEN.nacht_arbeit - 1) * (1 - licht(R, bester.bestand, vorhanden, bester.te)), "Dunkelheit")
  let arbeit = faktoren.filter((f) => f.faktor && f.grund !== "zu_fuss").reduce((n, f) => n * f.faktor, art.arbeit_min)
  // Lange Einsätze: Mit Verpflegung durch das DRK (Feldküche und Feldkoch frei) geht die Arbeit danach schneller
  const Rt = R.RETTUNG
  if (Rt && Rt.verpflegung_ab_min && arbeit > Rt.verpflegung_ab_min && org !== "drk" && drkVerpflegung(R, s, alarm, bester.leute)) {
    const vorher = arbeit
    arbeit = Rt.verpflegung_ab_min + (arbeit - Rt.verpflegung_ab_min) * Rt.verpflegung_faktor
    faktoren.push({ grund: "verpflegung", faktor: Math.round((arbeit / vorher) * 100) / 100, text: "Verpflegung durch das DRK" })
  }
  const arbeitEnde = bester.eintreffen + Math.round(arbeit * MIN) + Math.round(wasserMin * MIN)
  let zurueck = arbeitEnde + Math.round(bester.fahrzeit * R.ZEITEN.rueckfahrt_faktor / R.ZEITEN.sonderrechte_tempo)
  // Rettungsdienst: Transport ins Krankenhaus, Übergabe, Rückfahrt, danach Wiederherstellung
  let transport = null
  let wiederherstellung = 0
  if (art.patient && R.RETTUNG && bester.motor.length) {
    const Rt = R.RETTUNG
    transport = { ab: arbeitEnde, klinik: arbeitEnde + Rt.transport_min * MIN, zurueck: arbeitEnde + (2 * Rt.transport_min + Rt.uebergabe_min) * MIN }
    zurueck = transport.zurueck
    wiederherstellung = wiederherstellungMs(R, s, art, bester.leute, alarm)
  }
  // Notarzt: eigenes NEF fährt mit (und begleitet den Transport), sonst Hubschrauber oder Notarzt aus der Stadt
  const notarzt = notarztPlan(R, s, e, alarm, bester.leute.map((p) => p.id).concat(bester.auswahl.map((f) => f.id)))
  // Ohne Rückmeldung kommen alle Alarmierten zum Gerätehaus, auch wer nicht mehr gebraucht wird
  const imTrupp = {}
  for (const b of bester.trupp) imTrupp[b.p.id] = true
  const vergeblich = org === "feuerwehr"
    ? bereit
        .filter((b) => !imTrupp[b.p.id] && !hatRueckmeldung(R, s, b.p))
        .map((b) => ({ id: b.p.id, bis: b.t + VERGEBLICH_MS }))
    : []
  const personenPlan = bester.trupp.map((b) => ({ id: b.p.id, umgezogen: b.t }))
  const fahrzeugePlan = bester.auswahl.map((f) => f.id)
  if (notarzt && notarzt.fahrzeug) {
    personenPlan.push({ id: notarzt.fahrer, umgezogen: alarm })
    fahrzeugePlan.push(notarzt.fahrzeug)
  }
  return {
    plan: {
      alarm,
      personen: personenPlan,
      fahrzeuge: fahrzeugePlan,
      mitgenommen: bester.mit,
      bestand: bester.bestand,
      zu_fuss: bester.motor.length === 0,
      abfahrt: bester.abfahrt,
      fahrzeit: bester.fahrzeit,
      eintreffen: bester.eintreffen,
      arbeit_ende: arbeitEnde,
      zurueck,
      einsatzbereit: zurueck + (bester.motor.length ? (transport ? wiederherstellung : R.ZEITEN.einsatzbereit_s * 1000) : 0),
      verzug_min: Math.round(verzugMin * 10) / 10,
      transport,
      notarzt: notarzt ? { quelle: notarzt.quelle, name: notarzt.name, eintreffen: notarzt.eintreffen } : null,
      wasser: wasser ? (wasser.x === undefined ? { quelle: wasser.quelle, sekunden: wasser.sekunden } : { quelle: wasser.quelle, x: wasser.x, z: wasser.z, meter: wasser.meter, sekunden: wasser.sekunden }) : null,
      faktoren,
      gesperrt: sperren,
      vergeblich,
    },
  }
}

/**
 * Grundversorgung von außen (EXTERN): Kann im Dorf niemand ausrücken, übernimmt die Einheit von außerhalb mit fester
 * Anfahrt. Ohne Personen und Fahrzeuge im Dorf, höchstens max_sterne. Nur für Organisationen mit EXTERN-Eintrag ab ihrem Level.
 */
function externerPlan(R, s, e, alarm) {
  const art = R.EINSATZARTEN[e.art]
  const x = R.EXTERN && R.EXTERN[art.org]
  if (!x || !levelReicht(s, x.ab_level)) return null
  const eintreffen = alarm + x.anfahrt_min * MIN
  const arbeitEnde = eintreffen + Math.round((art.arbeit_min || 0) * MIN)
  return {
    plan: {
      alarm,
      extern: x.name,
      personen: [],
      fahrzeuge: [],
      mitgenommen: {},
      bestand: {},
      zu_fuss: false,
      abfahrt: alarm,
      fahrzeit: eintreffen - alarm,
      eintreffen,
      arbeit_ende: arbeitEnde,
      zurueck: arbeitEnde,
      einsatzbereit: arbeitEnde,
      verzug_min: Math.round(((eintreffen - e.meldung) / MIN) * 10) / 10,
      wasser: null,
      faktoren: [{ grund: "extern", sekunden: x.anfahrt_min * 60, text: x.name + " mit langer Anfahrt" }],
      gesperrt: [],
      vergeblich: [],
      notarzt: (function () {
        const na = notarztPlan(R, Object.assign({}, s, { ausbau: [] }), e, alarm, [])
        return na ? { quelle: na.quelle, name: na.name, eintreffen: na.eintreffen } : null
      })(),
    },
  }
}

// ---------- Regeln und Bewertung ----------

function polizeiVorOrt(s, e, bis) {
  for (const x of s.laufend.concat(s.abgeschlossen)) {
    if (x.folge_von !== e.id) continue
    const org = x.art.indexOf("p_") === 0
    if (org && x.plan && x.plan.eintreffen <= bis) return true
  }
  return false
}

function regelErfuellt(R, s, regel, k, e, t) {
  const p = regel.pruefung || {}
  if (p.personen_mindestens && k.leute.length < p.personen_mindestens) return false
  if (p.qualifikation && fehlendeQualifikation(p.qualifikation, k.leute, t).length) return false
  const bestand = Object.assign({}, k.bestand)
  if (polizeiVorOrt(s, e, Infinity)) bestand.polizei_vor_ort = 1
  if (p.geraete && fehlendeGruppen(p.geraete, bestand).length) return false
  if (p.polizei_vor_ort && !bestand.polizei_vor_ort) return false
  if (p.hrt_je_trupp) {
    const trupps = Math.floor((k.bestand.pressluftatmer || 0) / 2)
    if ((k.bestand.hrt || 0) < trupps * p.hrt_je_trupp) return false
  }
  return true
}

/** Minuten von der Meldung bis zum Einsatzende für volle Sterne. */
function zielEnde(art) {
  return art.ziel_ende_min || (art.ziel_eintreffen_min || art.ablauf_min) + (art.arbeit_min || 0)
}

function bewerte(R, s, e) {
  const art = R.EINSATZARTEN[e.art]
  const pl = e.plan
  const leute = pl.personen.map((x) => s.personal.find((p) => p.id === x.id)).filter(Boolean)
  const k = { leute, bestand: Object.assign({}, pl.bestand) }
  if (polizeiVorOrt(s, e, pl.arbeit_ende)) k.bestand.polizei_vor_ort = 1
  const abzuege = []
  const ziehe = (grund, sterne, text) => abzuege.push({ grund, sterne, text })
  // Zeit bis zum Einsatzende gegen das Ziel der Einsatzart; die Faktoren aus der Planung erklären, was gedauert hat
  const dauerMin = (pl.arbeit_ende - e.meldung) / MIN
  const ziel = zielEnde(art)
  const anteil = dauerMin / ziel - 1
  let ab = 0
  for (const stufe of R.STERNE.einsatzende) if (anteil > stufe.ueber && stufe.abzug > ab) ab = stufe.abzug
  if (ab) {
    const bremsen = (pl.faktoren || []).filter((f) => f.faktor > 1 || f.sekunden > 0).sort((x, y) => (y.faktor || 1) - (x.faktor || 1))
    const warum = bremsen.length ? " Länger dauerte es durch: " + bremsen.map((f) => f.text + (f.sekunden ? " (+" + f.sekunden + " s)" : " (+" + Math.round((f.faktor - 1) * 100) + " %)")).join(", ") + "." : ""
    ziehe("einsatzende", ab, "Einsatz beendet nach " + komma(dauerMin) + " Minuten, Ziel waren " + komma(ziel) + "." + warum)
  }
  if (art.psa) {
    const tabelle = art.org === "polizei" ? R.PSA_POLIZEI : R.PSA_FEUERWEHR
    const mangel = Object.entries(art.psa).filter(([teil, stufe]) => tabelle[teil] && leute.some((p) => (p.psa[teil] || 0) < stufe))
    if (mangel.length) ziehe("psa", R.STERNE.psa_unzureichend, "Schutzausrüstung reicht nicht: " + mangel.map(([t]) => (R.PSA_NAMEN && R.PSA_NAMEN[t]) || t).join(", ") + ".")
  }
  if (art.wachstum && art.wachstum * pl.verzug_min > 1) ziehe("schaden", R.STERNE.schaden_hoch, "Das Feuer hatte sich bis zum Eintreffen stark ausgebreitet.")
  for (const r of art.regeln || []) {
    const regel = R.REGELN[r]
    if (regel.sperrt) {
      if (pl.gesperrt.indexOf(r) >= 0) ziehe(r, 1, regel.text + " Deshalb nur Außenangriff, das dauerte länger.")
      continue
    }
    if (!regelErfuellt(R, s, regel, k, e, pl.eintreffen)) ziehe(r, regel.abzug, regel.text)
  }
  if (art.patient && R.RETTUNG) {
    const notruf = e.notruf || e.meldung
    if (art.notarzt) {
      const na = pl.notarzt
      if (!na) ziehe("notarzt", 1, "Kein Notarzt, obwohl einer nötig war.")
      else if ((na.eintreffen - notruf) / MIN > R.RETTUNG.notarzt_ziel_min)
        ziehe("notarzt", 0.5, na.name + " war erst nach " + komma((na.eintreffen - notruf) / MIN) + " Minuten da" + (na.quelle !== "nef" ? ". Mit eigenem NEF und Notarztvertrag geht es schneller." : "."))
    }
    if (!pl.extern && art.patient !== "gruen" && !leute.some((p) => hatLehrgang(p, "nfs", pl.eintreffen)))
      ziehe("besetzung", 0.5, "Keine Notfallsanitäterin und kein Notfallsanitäter im RTW (§ 10 NRettDG).")
    const pe = patientErgebnis(R, s, e)
    e.patient = pe
    if (pe.ergebnis === "verschlechtert") ziehe("patient", 1, "Der Zustand des Patienten hat sich verschlechtert: " + komma(pe.minuten) + " Minuten ohne Versorgung.")
  }
  if (pl.extern) {
    const x = R.EXTERN[art.org]
    const vorher = Math.max(1, Math.round((R.STERNE.max - abzuege.reduce((n, a) => n + a.sterne, 0)) * 2) / 2)
    if (vorher > x.max_sterne) ziehe("extern", vorher - x.max_sterne, x.name + " hat übernommen. Mit eigenem Betrieb im Dorf geht es schneller.")
  }
  const summe = abzuege.reduce((n, a) => n + a.sterne, 0)
  const sterne = Math.max(1, Math.round((R.STERNE.max - summe) * 2) / 2)
  return { sterne, abzuege }
}

// ---------- Ereignisse ----------

function bedingungFaktor(art, t, wetter) {
  const b = art.bedingung
  if (!b) return 1
  const z = ortszeit(t)
  const datum = (z.monat < 10 ? "0" : "") + z.monat + "-" + (z.tag < 10 ? "0" : "") + z.tag
  const passt = (!b.wetter || b.wetter.indexOf(wetter) >= 0) && (!b.monate || b.monate.indexOf(z.monat) >= 0) && (!b.stunden || b.stunden.indexOf(z.stunde) >= 0) && (!b.wochentage || b.wochentage.indexOf(z.wochentag) >= 0) && (!b.daten || b.daten.indexOf(datum) >= 0)
  if (passt) return b.faktor === undefined ? 1 : b.faktor
  return b.sonst_faktor === undefined ? 1 : b.sonst_faktor
}

function erzeuge(R, s, id, t, umwelt, folgeVon, ortFest) {
  const art = R.EINSATZARTEN[id]
  s.zaehler += 1
  const r = zufall(s.zufall + ":" + id + ":ort:" + s.zaehler)
  // Nur Orte außerhalb der Schutzzonen, außer die Art ist harmlos; gibt es keinen, bleibt die ganze Liste
  const frei = (art.orte || []).filter((o) => ortErlaubt(R, s, art, o))
  const auswahl = frei.length ? frei : art.orte
  const ort = ortFest || (folgeVon ? folgeVon.ort : auswahl[Math.floor(r() * auswahl.length)])
  const e = {
    id: "e_" + t + "_" + id + "_" + s.zaehler,
    art: id,
    ort,
    meldung: t,
    verfall: t + art.ablauf_min * MIN,
    status: "gemeldet",
    wetter: umwelt(t),
    plan: null,
    bewertung: null,
    folge_von: folgeVon ? folgeVon.id : null,
    folgen_erzeugt: false,
  }
  if (art.patient) {
    // Für den Patienten zählt die Zeit ab dem ersten Notruf; Erste Hilfe leistet die Feuerwehr ab ihrem Eintreffen
    e.notruf = folgeVon ? folgeVon.notruf || folgeVon.meldung : t
    const fp = folgeVon && folgeVon.plan
    const helfer = folgeVon && ["feuerwehr", "drk", "dlrg"].indexOf(R.EINSATZARTEN[folgeVon.art].org) >= 0
    // Sanitätswachdienst vor Ort: Erste Hilfe sofort
    const wache = s.laufend.find((x) => R.EINSATZARTEN[x.art].wache && x.ort === ort && x.plan && x.plan.eintreffen <= t && x.plan.arbeit_ende > t)
    if (wache || (R.WACHDIENST && ort === R.WACHDIENST.ort && wachdienstAktiv(R, s, t))) e.erste_hilfe = t
    else if (fp && fp.eintreffen && helfer) {
      const leute = fp.personen.map((x) => s.personal.find((q) => q.id === x.id)).filter(Boolean)
      if ((fp.bestand && fp.bestand.notfallrucksack) || leute.some((q) => hatLehrgang(q, "erste_hilfe", fp.eintreffen))) e.erste_hilfe = fp.eintreffen
    }
  }
  const ergebnis = plane(R, s, e, t, umwelt)
  if (ergebnis.grund && !ergebnis.plan) {
    // Niemand frei oder Gerät fehlt: Der Einsatz bleibt offen und wartet. Jede volle Minute und nach jedem Kauf wird
    // neu alarmiert; erst wenn die Frist abläuft, verfällt er.
    e.wartet = true
    e.grund = ergebnis.grund
  } else if (ergebnis.grund || ergebnis.plan.eintreffen > e.verfall) {
    e.status = "verfallen"
    e.grund = ergebnis.grund || "Zu spät: Eintreffen nach " + komma((ergebnis.plan.eintreffen - t) / MIN) + " Minuten, verfallen nach " + art.ablauf_min + "."
    if (ergebnis.plan) {
      // Wer schon unterwegs war, kehrt um
      const pl = ergebnis.plan
      const unterwegs = Math.max(0, e.verfall - pl.abfahrt)
      const zurueck = e.verfall + Math.min(unterwegs, pl.fahrzeit)
      e.plan = Object.assign({}, pl, { eintreffen: null, arbeit_ende: null, zurueck, einsatzbereit: zurueck })
      belege(R, s, e, e.plan.zurueck)
    }
    e.ende = e.verfall
  } else {
    e.plan = ergebnis.plan
    e.status = "alarmiert"
    // Folgeeinsätze, die so lange laufen wie der Auslöser
    if (folgeVon && art.dauer_wie_ausloeser && folgeVon.plan && folgeVon.plan.arbeit_ende > e.plan.eintreffen) {
      e.plan.arbeit_ende = folgeVon.plan.arbeit_ende
      e.plan.zurueck = e.plan.arbeit_ende + Math.round(e.plan.fahrzeit * R.ZEITEN.rueckfahrt_faktor / R.ZEITEN.sonderrechte_tempo)
      e.plan.einsatzbereit = e.plan.zurueck + (e.plan.zu_fuss ? 0 : R.ZEITEN.einsatzbereit_s * 1000)
    }
    belege(R, s, e, e.plan.einsatzbereit)
    e.ende = e.plan.arbeit_ende
  }
  s.laufend.push(e)
  // Helfer vor Ort des DRK parallel zum Rettungsdienst (Leitstelle): überbrückt die Zeit bis zum RTW
  if (art.patient && art.patient !== "gruen" && (e.status === "alarmiert" || e.wartet) && ausbauEffekt(R, s, "hvo_parallel") > 0 && orgFrei(R, s, "drk") && R.EINSATZARTEN.drk_hvo_parallel && ortErlaubt(R, s, R.EINSATZARTEN.drk_hvo_parallel, e.ort)) {
    const h = erzeuge(R, s, "drk_hvo_parallel", t, umwelt, e)
    if (h.plan && h.plan.eintreffen && h.status === "alarmiert" && !h.plan.extern && (!e.erste_hilfe || h.plan.eintreffen < e.erste_hilfe)) e.erste_hilfe = h.plan.eintreffen
  }
  // Strukturierte Notrufabfrage: Der Rettungsdienst wird gleich mit alarmiert, nicht erst beim Eintreffen nachgefordert
  if (e.status === "alarmiert" && !folgeVon && art.org !== "rettungsdienst" && ausbauEffekt(R, s, "notrufabfrage") > 0) {
    for (const id of art.folge || []) {
      const fa = R.EINSATZARTEN[id]
      if (!fa || fa.org !== "rettungsdienst" || !orgFrei(R, s, fa.org) || !ortErlaubt(R, s, fa, e.ort)) continue
      e.folgen_sofort = (e.folgen_sofort || []).concat([id])
      erzeuge(R, s, id, t, umwelt, e)
    }
  }
  return e
}

/** Wartende Einsätze erneut alarmieren (wenn inzwischen jemand frei ist oder etwas gekauft wurde). */
function versucheWartende(R, s, t, umwelt) {
  for (const e of s.laufend) {
    if (!e.wartet || t >= e.verfall) continue
    const ergebnis = plane(R, s, e, t, umwelt)
    if (ergebnis.grund || !ergebnis.plan) {
      if (ergebnis.grund) e.grund = ergebnis.grund
      continue
    }
    if (ergebnis.plan.eintreffen > e.verfall) {
      e.grund = "Zu spät: Eintreffen erst nach " + komma((ergebnis.plan.eintreffen - e.meldung) / MIN) + " Minuten, verfallen nach " + R.EINSATZARTEN[e.art].ablauf_min + "."
      continue
    }
    e.wartet = false
    delete e.grund
    e.alarm_spaeter_s = Math.round((t - e.meldung) / 1000)
    e.plan = ergebnis.plan
    e.status = "alarmiert"
    belege(R, s, e, e.plan.einsatzbereit)
    e.ende = e.plan.arbeit_ende
    meldePartner(s, e)
  }
}

function belege(R, s, e, bis) {
  for (const v of e.plan.vergeblich || []) {
    const p = s.personal.find((q) => q.id === v.id)
    if (p) p.belegt_bis = Math.max(p.belegt_bis || 0, v.bis)
  }
  for (const x of e.plan.personen) {
    const p = s.personal.find((q) => q.id === x.id)
    if (p) p.belegt_bis = Math.max(p.belegt_bis || 0, bis)
  }
  for (const id of e.plan.fahrzeuge) {
    const f = s.fahrzeuge.find((q) => q.id === id)
    if (f) f.belegt_bis = Math.max(f.belegt_bis || 0, bis)
  }
}

function folgen(R, s, e, umwelt) {
  e.folgen_erzeugt = true
  e.status = "vor_ort"
  const art = R.EINSATZARTEN[e.art]
  const t = e.plan.eintreffen
  const ids = (art.folge || []).slice()
  if (art.zufall && art.zufall.folge_bei_echt) {
    const r = zufall(s.zufall + ":" + e.id + ":echt")
    if (r() >= art.zufall.fehlalarm) ids.push(art.zufall.folge_bei_echt)
  }
  for (const id of ids) {
    const fa = R.EINSATZARTEN[id]
    if (!fa) continue
    if (e.folgen_sofort && e.folgen_sofort.indexOf(id) >= 0) continue
    // Organisationen, die erst mit einem Level kommen (Werkstatt, Bauhof), gibt es vorher nicht
    if (!orgFrei(R, s, fa.org)) continue
    const extern = R.EXTERN && R.EXTERN[fa.org] && levelReicht(s, R.EXTERN[fa.org].ab_level)
    const partner = art.gemeinsam && fa.org === "polizei"
    // Nur, wenn die andere Organisation jemanden hat oder von außen kommt (sonst entsteht der Folgeeinsatz nicht)
    if (!extern && !s.personal.some((p) => istMitglied(p, fa.org))) {
      if (partner) e.gemeinsam = { art: id, fehlt: "An der Dienststelle arbeitet noch niemand." }
      continue
    }
    // Kein dramatischer Folgeeinsatz in einer Schutzzone
    if (!ortErlaubt(R, s, fa, e.ort)) continue
    // Ausleuchten nur, wenn es dunkel ist
    if (fa.nur_dunkel && !dunkel(R, t)) continue
    const f = erzeuge(R, s, id, t, umwelt, e)
    // Nachforderung (THW): ohne Führungskraft vor Ort wird später angefordert
    if (fa.nachforderung && f.plan && f.status === "alarmiert" && R.NACHFORDERUNG) {
      const leute = e.plan.personen.map((x) => s.personal.find((q) => q.id === x.id)).filter(Boolean)
      if (!leute.some((p) => R.NACHFORDERUNG.fuehrung.some((l) => hatLehrgang(p, l, t)))) verzoegere(R, s, f, R.NACHFORDERUNG.verzug_min * MIN, "Nachforderung verzögert: keine Gruppen- oder Zugführung vor Ort")
    }
    if (partner) e.gemeinsam = partnerStand(f)
  }
}

/** Einen alarmierten Einsatz um ms verschieben (spätere Anforderung); Kräfte und Fahrzeuge bleiben entsprechend länger gebunden. */
function verzoegere(R, s, f, ms, text) {
  const pl = f.plan
  for (const k of ["abfahrt", "eintreffen", "arbeit_ende", "zurueck", "einsatzbereit"]) if (pl[k]) pl[k] += ms
  pl.faktoren = (pl.faktoren || []).concat([{ grund: "nachforderung", sekunden: Math.round(ms / 1000), text }])
  f.ende = pl.arbeit_ende
  belege(R, s, f, pl.einsatzbereit)
}

/** Was der Ausloeser über seinen Partner bei einem gemeinsamen Einsatz weiß. */
function partnerStand(f) {
  return { art: f.art, partner: f.id, status: f.wartet ? "wartet" : f.status, eintreffen: f.plan && f.plan.eintreffen ? f.plan.eintreffen : null }
}

/** Nach einer Änderung am Partner (alarmiert, verfallen) den Auslöser aktualisieren. */
function meldePartner(s, f) {
  if (!f.folge_von) return
  const e = s.laufend.find((x) => x.id === f.folge_von)
  if (e && e.gemeinsam && e.gemeinsam.partner === f.id) e.gemeinsam = partnerStand(f)
}

/**
 * Zusammenarbeit bei gemeinsamen Einsätzen (1 bis 5 Sterne, zählt nicht in die Sterne des Einsatzes): Wie schnell nach
 * der Feuerwehr war der Partner da? Ziel aus gemeinsam.ziel_min; je halbes Ziel zu spät ein Stern weniger.
 */
function bewerteZusammenarbeit(R, s, e) {
  const art = R.EINSATZARTEN[e.art]
  const g = e.gemeinsam || {}
  const partner = g.art && R.EINSATZARTEN[g.art] ? R.EINSATZARTEN[g.art].name : "Partner"
  if (g.fehlt) return { sterne: 1, text: g.fehlt + " „" + partner + "“ fiel aus." }
  if (!g.partner) return { sterne: 1, text: "„" + partner + "“ kam nicht zustande." }
  if (g.status === "verfallen") return { sterne: 1, text: "„" + partner + "“ ist verfallen, niemand kam." }
  if (!g.eintreffen || g.eintreffen > e.plan.arbeit_ende) return { sterne: 1, text: "„" + partner + "“ war erst nach dem Ende vor Ort." }
  const ziel = art.gemeinsam.ziel_min
  const spaet = Math.max(0, (g.eintreffen - e.plan.eintreffen) / MIN - ziel)
  const sterne = Math.max(1, 5 - Math.ceil(spaet / Math.max(1, ziel / 2)))
  return { sterne, text: sterne === 5 ? "„" + partner + "“ war rechtzeitig da." : "„" + partner + "“ kam " + komma(spaet) + " Minuten später als geplant." }
}

function abschliessen(R, s, e) {
  const art = R.EINSATZARTEN[e.art]
  const st = s.einsatzarten[e.art]
  if (e.status !== "verfallen") {
    e.bewertung = bewerte(R, s, e)
    if (art.wirkung && art.wirkung.gestreut_h) {
      const stufe = R.GEBAEUDE.bauhof && R.GEBAEUDE.bauhof[s.gebaeude.bauhof || 0]
      const h = art.wirkung.gestreut_h + ((stufe && stufe.gestreut_h) || 0)
      s.gestreut_bis = Math.max(s.gestreut_bis || 0, e.plan.arbeit_ende + Math.round(h * STD))
    }
    if (e.art === "ab_umsetzen" && e.folge_von) {
      const fp = s.laufend.find((x) => x.id === e.folge_von)
      if (fp) fp.umgesetzt = e.plan.arbeit_ende
    }
    if (art.patient && art.patient !== "gruen" && R.RETTUNG) {
      const ok = (e.plan.eintreffen - e.meldung) / MIN <= R.RETTUNG.hilfsfrist_min
      s.hilfsfrist = (s.hilfsfrist || []).concat([{ id: e.id, ok }]).slice(-50)
    }
    if (art.gemeinsam) {
      e.bewertung.zusammenarbeit = bewerteZusammenarbeit(R, s, e)
      s.zusammenarbeit = (s.zusammenarbeit || []).concat([{ id: e.id, sterne: e.bewertung.zusammenarbeit.sterne }]).slice(-20)
    }
    e.status = "abgeschlossen"
    for (const x of e.plan.personen) {
      const p = s.personal.find((q) => q.id === x.id)
      if (p) p.einsaetze = (p.einsaetze || 0) + 1
    }
    pflege(R, s, e)
  } else {
    e.bewertung = { sterne: 0, abzuege: [{ grund: "verfallen", sterne: 5, text: e.grund }] }
    if (art.patient && art.patient !== "gruen" && R.RETTUNG) s.hilfsfrist = (s.hilfsfrist || []).concat([{ id: e.id, ok: false }]).slice(-50)
  }
  if (st) {
    st.anzahl += 1
    if (e.status === "abgeschlossen") st.erfolgreich += 1
    st.beste_sterne = Math.max(st.beste_sterne || 0, e.bewertung.sterne)
    st.letzte = { id: e.id, sterne: e.bewertung.sterne, ende: e.ende, status: e.status }
  }
  // Tagesbilanz: alle Einsätze des Tages zählen, verfallene mit 0 Sternen. Abgerechnet wird um Mitternacht.
  const tag = tagVon(e.ende || e.verfall)
  const d = s.tage[tag] || (s.tage[tag] = { anzahl: 0, sterne: 0, erfolgreich: 0, arten: [], abgerechnet: false })
  d.anzahl += 1
  d.sterne += e.bewertung.sterne
  if (e.status === "abgeschlossen") {
    d.erfolgreich += 1
    if (d.arten.indexOf(e.art) < 0) d.arten.push(e.art)
  }
  e.tag = tag
  s.laufend = s.laufend.filter((x) => x !== e)
  e.abgeschlossen_am = e.ende
  s.abgeschlossen.push(e)
  void art
}

/**
 * Abrechnung eines Tages um Mitternacht: Durchschnitt der Sterne aller Einsätze, XP daraus, und Freischaltung
 * neuer Einsatzarten, wenn der Durchschnitt reicht und die vorausgesetzte Art an diesem Tag erfolgreich war.
 */
function tagesabschluss(R, s, tag) {
  const d = s.tage[tag]
  if (!d || d.abgerechnet) return
  d.durchschnitt = d.anzahl ? Math.round((d.sterne / d.anzahl) * 10) / 10 : 0
  d.xp = d.anzahl ? Math.min(TAG_XP_MAX, Math.round(d.durchschnitt * 10 * Math.sqrt(d.anzahl))) : 0
  d.freigeschaltet = []
  for (const [id, a] of Object.entries(R.EINSATZARTEN)) {
    if (!a.freischaltung || s.freigeschaltet.indexOf(id) >= 0) continue
    if (d.arten.indexOf(a.freischaltung.nach) >= 0 && d.durchschnitt >= a.freischaltung.sterne) {
      s.freigeschaltet.push(id)
      d.freigeschaltet.push(id)
    }
  }
  d.abgerechnet = true
  // nur die letzten Wochen behalten
  const tage = Object.keys(s.tage).sort()
  for (const t of tage.slice(0, Math.max(0, tage.length - TAGE_BEHALTEN))) if (s.tage[t].abgerechnet) delete s.tage[t]
}

/** Einsatz sofort auslösen (zum Ausprobieren). Ohne `id` eine zufällige gekaufte Art. */
function sofort(stand, id, jetzt, umwelt, R) {
  const s = fortschreiben(stand, jetzt, umwelt, R)
  const wetter = umwelt || ((t) => wetterBei(null, t))
  const gekauft = Object.keys(s.einsatzarten).filter((x) => R.EINSATZARTEN[x] && !R.EINSATZARTEN[x].baustelle)
  if (id && gekauft.indexOf(id) < 0) return { fehler: "Diese Einsatzart ist noch nicht gekauft." }
  if (!gekauft.length) return { fehler: "Noch keine Einsatzart gekauft." }
  const art = id || gekauft[Math.floor(zufall(s.zufall + ":sofort:" + s.zaehler)() * gekauft.length)]
  const e = erzeuge(R, s, art, jetzt, wetter, null)
  e.sofort = true
  return { stand: s, einsatz: e }
}

/** Benutzte Schläuche und Atemschutzgeräte gehen in die Pflege. */
function pflege(R, s, e) {
  const art = R.EINSATZARTEN[e.art]
  if (art.org !== "feuerwehr") return
  const ende = e.plan.zurueck
  const schlauchH = R.ZEITEN.schlauchpflege_h * ausbauFaktor(R, s, "schlauchpflege_faktor")
  const atemH = R.ZEITEN.atemschutz_pflege_h * ausbauFaktor(R, s, "atemschutz_pflege_faktor")
  const benutzt = {}
  for (const g of (art.mindestens.geraete || []).concat((art.optimal && art.optimal.geraete) || [])) {
    for (const alt of g) {
      if (!Object.entries(alt).every(([id, n]) => (e.plan.bestand[id] || 0) >= n)) continue
      for (const [id, n] of Object.entries(alt)) benutzt[id] = Math.max(benutzt[id] || 0, n)
      break
    }
  }
  for (const [id, n] of Object.entries(benutzt)) {
    const g = R.GERAETE[id]
    if (!g) continue
    const h = g.kategorie === "schlauch" ? schlauchH : id === "pressluftatmer" ? atemH : 0
    if (!h) continue
    // aus welchem Fahrzeug bzw. Lager
    let rest = n
    for (const fid of e.plan.fahrzeuge) {
      const f = s.fahrzeuge.find((q) => q.id === fid)
      const da = Math.min(rest, (f && f.beladung[id]) || 0)
      if (da > 0) {
        s.pflege.push({ wo: fid, geraet: id, anzahl: da, bis: ende + Math.round(h * STD) })
        rest -= da
      }
    }
    if (rest > 0 && e.plan.mitgenommen[id]) s.pflege.push({ wo: "lager:feuerwehr", geraet: id, anzahl: Math.min(rest, e.plan.mitgenommen[id]), bis: ende + Math.round(h * STD) })
  }
}

/** Lehrgänge abschließen und abgelaufene Pflege entfernen, die bis `t` vorbei sind. */
function aufraeumen(s, t) {
  for (const p of s.personal) {
    if (p.lehrgang_laeuft && p.lehrgang_laeuft.bis <= t) {
      p.lehrgaenge[p.lehrgang_laeuft.id] = p.lehrgang_laeuft.bis
      p.lehrgang_laeuft = null
    }
  }
  s.pflege = s.pflege.filter((e) => e.bis > t)
}

/** Nächstes Ereignis bis `bis`: {t, typ, id}. Reihenfolge bei Gleichstand: Ende, Eintreffen, Meldung; dann nach ID. */
function naechstesEreignis(s, bis, vorher) {
  let best = null
  const nimm = (t, typ, rang, id) => {
    if (t > bis) return
    if (!best || t < best.t || (t === best.t && (rang < best.rang || (rang === best.rang && id < best.id)))) best = { t, typ, rang, id }
  }
  let wartet = false
  for (const e of s.laufend) {
    if (e.wartet) {
      wartet = true
      nimm(e.verfall, "verfall", 0, e.id)
    } else if (e.status === "verfallen") nimm(e.ende, "ende", 0, e.id)
    else if (!e.folgen_erzeugt) nimm(e.plan.eintreffen, "eintreffen", 1, e.id)
    else nimm(e.ende, "ende", 0, e.id)
  }
  for (const [id, a] of Object.entries(s.einsatzarten)) nimm(a.naechster, "meldung", 2, id)
  for (const b of s.baustellen || []) nimm(b.ende, "bau", 3, b.id)
  for (const [tag, d] of Object.entries(s.tage || {})) if (!d.abgerechnet) nimm(tagesende(tag), "tag", 4, tag)
  if (s.training_naechster) nimm(s.training_naechster, "training", 6, "")
  // Solange ein Einsatz wartet: zu jeder vollen Minute neu alarmieren (festes Raster, damit Teilrechnungen gleich bleiben)
  if (wartet) nimm(Math.floor(vorher / MIN) * MIN + MIN, "warten", 5, "")
  return best
}

/**
 * Schreibt den Stand bis `bis` fort. umwelt(t) liefert das Wetter (Schlüssel aus R.WETTER).
 * Gibt einen neuen Stand zurück; der übergebene bleibt unverändert.
 */
function fortschreiben(stand, bis, umwelt, R) {
  const s = kopie(stand)
  bauFelder(s)
  if (bis <= s.bis) return s
  const roh = umwelt || ((t) => wetterBei(null, t))
  const wetter = (t) => wetterGestreut(s, roh(t), t)
  levelFreischalten(R, s)
  if (!s.training_naechster && R.FITNESS) s.training_naechster = naechstesTraining(R, s.bis)
  let schutz = 0
  let vorher = s.bis
  for (;;) {
    const ev = naechstesEreignis(s, bis, vorher)
    if (!ev) break
    vorher = ev.t
    if (++schutz > 200000) throw new Error("Simulation: zu viele Ereignisse")
    aufraeumen(s, ev.t)
    if (ev.typ === "meldung") {
      const art = R.EINSATZARTEN[ev.id]
      const st = s.einsatzarten[ev.id]
      st.nr += 1
      const r = zufall(s.zufall + ":" + ev.id + ":" + st.nr)
      const f = bedingungFaktor(art, ev.t, wetter(ev.t))
      // Baustellen-Einsätze nur, solange eine passende Baustelle läuft
      const bst = art.baustelle ? s.baustellen.find((b) => { const ph = bauPhase(R, b, ev.t); return ph && (!art.phasen || art.phasen.indexOf(ph.id) >= 0) }) : null
      if (f > 0 && (!art.baustelle || (bst && ortErlaubt(R, s, art, "baustelle:" + bst.id))) && r() < Math.min(1, f)) erzeuge(R, s, ev.id, ev.t, wetter, null, bst ? "baustelle:" + bst.id : undefined)
      st.naechster = ev.t + Math.round(art.intervall_min * MIN * (0.7 + 0.6 * r()) / Math.max(1, f))
    } else if (ev.typ === "warten") {
      versucheWartende(R, s, ev.t, wetter)
    } else if (ev.typ === "verfall") {
      const e = s.laufend.find((x) => x.id === ev.id)
      e.wartet = false
      e.status = "verfallen"
      e.grund = e.grund || "Keine Einsatzkraft verfügbar."
      e.ende = e.verfall
      meldePartner(s, e)
    } else if (ev.typ === "tag") {
      tagesabschluss(R, s, ev.id)
    } else if (ev.typ === "training") {
      training(R, s, ev.t)
    } else if (ev.typ === "bau") {
      const b = s.baustellen.find((x) => x.id === ev.id)
      if (!b.wetter_geprueft) {
        b.wetter_geprueft = true
        const verlust = wetterVerzug(R, b, wetter)
        if (verlust >= MIN) {
          b.verzug_ms = verlust
          b.ende += verlust
          continue
        }
      }
      fertigstellen(R, s, b, ev.t)
    } else {
      const e = s.laufend.find((x) => x.id === ev.id)
      if (ev.typ === "eintreffen") folgen(R, s, e, wetter)
      else abschliessen(R, s, e)
    }
  }
  aufraeumen(s, bis)
  s.bis = bis
  return s
}

// ---------- Kaufen und Einrichten ----------

function lagerSlots(R, s, org) {
  return Object.entries(s.lager[org] || {}).reduce((n, [id, k]) => n + (R.GERAETE[id] ? R.GERAETE[id].slots * k : 0), 0)
}

function fahrzeugSlots(R, f) {
  return Object.entries(f.beladung).reduce((n, [id, k]) => n + (R.GERAETE[id] ? R.GERAETE[id].slots * k : 0), 0)
}

function stellplaetzeBelegt(R, s, org) {
  return s.fahrzeuge.filter((f) => R.FAHRZEUGE[f.typ].org === org).reduce((n, f) => n + R.FAHRZEUGE[f.typ].stellplatz, 0)
}

/** Was jede Person ihrer Organisation beim Einzug oder bei der Einstellung mitbringt. */
const GRUNDAUSBILDUNG = { feuerwehr: "tm1", polizei: "pk", rettungsdienst: "rs", werkstatt: "kfz", bauhof: "gemeindearbeit" }

function neuePerson(s, org, haus, jetzt, bewohner) {
  s.zaehler += 1
  const bw = bewohner || {}
  const p = {
    id: "p" + s.zaehler,
    org,
    name: "",
    anrede: "",
    haus,
    beruf: bw.beruf || (org === "polizei" ? "schicht" : org === "rettungsdienst" && haus ? "rettungswache" : "frei"),
    lehrgaenge: {},
    lehrgang_laeuft: null,
    psa: {},
    fitness: 50,
    einsaetze: 0,
    belegt_bis: 0,
  }
  if (GRUNDAUSBILDUNG[org]) p.lehrgaenge[GRUNDAUSBILDUNG[org]] = jetzt
  if (bw.arbeitgeber) p.arbeitgeber = bw.arbeitgeber
  return p
}

/** Freie Stellen bei einem Arbeitgeber im Dorf (Bewohner in Häusern, die noch gebaut werden, zählen mit). */
function freieStellen(R, s, id) {
  const ag = R.ARBEITGEBER[id]
  if (!ag) return 0
  if (ag.gebaeude && (s.gebaeude[ag.gebaeude] || 0) < (ag.ab_stufe || 0)) return 0
  const besetzt = s.personal.filter((p) => p.arbeitgeber === id).length + (s.baustellen || []).filter((b) => b.bewohner && b.bewohner.arbeitgeber === id).length
  return Math.max(0, ag.stellen - besetzt)
}

/** Polizei mit Wohnsitz oder Versetzung, auch in Häusern im Bau. */
function polizeiZahl(s) {
  return s.personal.filter((p) => p.org === "polizei").length + (s.baustellen || []).filter((b) => b.bewohner && b.bewohner.org === "polizei").length
}

/**
 * Wer einzieht: {org, beruf, arbeitgeber}. Feuerwehr: im Dorf (mit freier Stelle) oder pendelt; Polizei: Schichtdienst an
 * der Dienststelle, zählt zu deren Personal. Ohne Angabe (ältere App) wie bisher: Feuerwehr, immer verfügbar.
 * Gibt {bewohner} oder {fehler} zurück.
 */
function pruefeBewohner(R, s, roh) {
  if (!roh) return { bewohner: { org: "feuerwehr", beruf: "frei" } }
  if (roh.org === "rettungsdienst") {
    if (!orgFrei(R, s, "rettungsdienst")) return { fehler: "Erst ab Level " + R.ORGANISATIONEN.rettungsdienst.ab_level + "." }
    const st = R.GEBAEUDE.rettungswache[s.gebaeude.rettungswache || 0]
    if (orgZahl(s, "rettungsdienst") >= (st.personal_max || 0)) return { fehler: st.personal_max ? "An der Rettungswache sind alle Stellen besetzt. Erst ausbauen." : "Erst die Rettungswache bauen." }
    return { bewohner: { org: "rettungsdienst", beruf: "rettungswache" } }
  }
  const org = roh.org === "polizei" ? "polizei" : "feuerwehr"
  if (org === "polizei") {
    const max = R.GEBAEUDE.dienststelle[s.gebaeude.dienststelle].personal_max
    if (polizeiZahl(s) >= max) return { fehler: "Die Dienststelle ist voll besetzt. Erst ausbauen." }
    return { bewohner: { org, beruf: "schicht" } }
  }
  const beruf = roh.beruf
  if (beruf === "auswaerts") return { bewohner: { org, beruf } }
  if (beruf === "dorf") {
    if (!R.ARBEITGEBER[roh.arbeitgeber]) return { fehler: "Unbekannter Arbeitgeber." }
    if (!freieStellen(R, s, roh.arbeitgeber)) return { fehler: "Bei " + R.ARBEITGEBER[roh.arbeitgeber].name + " ist keine Stelle frei." }
    return { bewohner: { org, beruf, arbeitgeber: roh.arbeitgeber } }
  }
  return { fehler: "Bitte einen Beruf wählen: im Dorf oder auswärts." }
}

/**
 * Kauft etwas. Gibt {stand, preis} oder {fehler} zurück. Münzen bucht der Aufrufer (Route) ab.
 * auftrag: {art, id, ziel?, anzahl?, stufe?}
 */
function kaufe(stand, auftrag, jetzt, R) {
  const s = kopie(stand)
  bauFelder(s)
  levelFreischalten(R, s)
  const art = auftrag.art
  const id = auftrag.id
  const anzahl = Math.max(1, Math.floor(auftrag.anzahl || 1))
  const fehler = (t) => ({ fehler: t })
  const person = () => s.personal.find((p) => p.id === auftrag.ziel)
  const haus = () => s.haeuser.find((h) => h.id === auftrag.ziel)
  let roh = 0

  if (art === "einsatzart") {
    const a = R.EINSATZARTEN[id]
    if (!a || a.folge_nur) return fehler("Diese Einsatzart gibt es nicht zu kaufen.")
    if (s.einsatzarten[id]) return fehler("Schon gekauft.")
    if (s.freigeschaltet.indexOf(id) < 0) return fehler("Noch nicht freigeschaltet.")
    if (!levelReicht(s, a.ab_level)) return fehler("Erst ab Level " + a.ab_level + ".")
    for (const [g, st] of Object.entries(a.braucht_gebaeude || {})) if ((s.gebaeude[g] || 0) < st) return fehler("Dafür braucht es " + R.GEBAEUDE[g][st].name + ".")
    roh = a.preis
    aktiviereArt(R, s, id, jetzt)
  } else if (art === "bauplatz") {
    const bp = bauplatz(R, id)
    if (!bp) return fehler("Diesen Bauplatz gibt es nicht.")
    if (bp.neubaugebiet && s.neubaugebiete.indexOf(bp.neubaugebiet) < 0) return fehler("Das Neubaugebiet ist noch nicht erschlossen.")
    if (s.haeuser.some((h) => h.bauplatz === id)) return fehler("Der Bauplatz ist schon bebaut.")
    const bw = pruefeBewohner(R, s, auftrag.bewohner)
    if (bw.fehler) return fehler(bw.fehler)
    roh = bp.preis
    s.zaehler += 1
    // Erst wird gebaut, mit dem fertigen Haus zieht die Bewohnerin oder der Bewohner ein
    const h = { id: "h" + s.zaehler, bauplatz: id, gekauft: jetzt, ausbau: [], alarmierung: "sirene", im_bau: true }
    s.haeuser.push(h)
    beginneBau(R, s, jetzt, { art: "haus", ziel: h.id, name: "Haus auf " + id.toUpperCase(), ort: { x: bp.x, z: bp.z }, bauzeit_h: R.BAU.haus_h, klein: false, bewohner: bw.bewohner })
  } else if (art === "haus_ausbau") {
    const h = haus()
    const a = R.HAUS_AUSBAU[id]
    if (!h || !a || id === "zu_fuss") return fehler("Unbekanntes Haus oder unbekannter Ausbau.")
    if (h.ausbau.indexOf(id) >= 0) return fehler("Schon vorhanden.")
    if (a.voraussetzung && h.ausbau.indexOf(a.voraussetzung) < 0) return fehler("Zuerst " + R.HAUS_AUSBAU[a.voraussetzung].name + ".")
    let bw = null
    if (a.bewohner) {
      bw = pruefeBewohner(R, s, auftrag.bewohner)
      if (bw.fehler) return fehler(bw.fehler)
    }
    roh = a.preis
    if (a.bauzeit_h) {
      if (imBau(s, "haus_ausbau", h.id)) return fehler("Am Haus wird schon gebaut.")
      const bp = bauplatz(R, h.bauplatz)
      beginneBau(R, s, jetzt, Object.assign({ art: "haus_ausbau", ziel: h.id, ausbau: id, name: a.name.split(" (")[0] + " auf " + h.bauplatz.toUpperCase(), ort: { x: bp.x, z: bp.z }, bauzeit_h: a.bauzeit_h, klein: false }, bw ? { bewohner: bw.bewohner } : {}))
    } else h.ausbau.push(id)
  } else if (art === "alarmierung") {
    const h = haus()
    const a = R.ALARMIERUNG[id]
    if (!h || !a) return fehler("Unbekanntes Haus oder unbekannte Alarmierung.")
    if (h.alarmierung === id) return fehler("Schon vorhanden.")
    roh = a.preis
    h.alarmierung = id
  } else if (art === "lehrgang") {
    const p = person()
    const l = R.LEHRGAENGE[id]
    if (!p || !l || !istMitglied(p, l.org)) return fehler("Unbekannte Person oder unpassender Lehrgang.")
    if (p.lehrgaenge[id] !== undefined) return fehler("Schon abgeschlossen.")
    if (p.lehrgang_laeuft) return fehler("Die Person ist schon in einem Lehrgang.")
    for (const v of l.voraussetzung || []) if (!hatLehrgang(p, v, jetzt)) return fehler("Voraussetzung fehlt: " + R.LEHRGAENGE[v].name + ".")
    for (const [g, st] of Object.entries(l.gebaeude || {})) if ((s.gebaeude[g] || 0) < st) return fehler("Dafür braucht es " + R.GEBAEUDE[g][st].name + ".")
    if (l.fitness_min && fitnessVon(R, p) < l.fitness_min) return fehler("Dafür braucht es Fitness " + l.fitness_min + ". Training im Sportverein hilft.")
    roh = l.preis
    p.lehrgang_laeuft = { id, bis: jetzt + Math.round(l.dauer_h * STD * ausbauFaktor(R, s, "lehrgang_faktor")) }
  } else if (art === "psa") {
    const p = person()
    const porg = (p && auftrag.org) || (p && p.org)
    if (p && !istMitglied(p, porg)) return fehler("Die Person ist nicht in dieser Organisation.")
    const tabelle = p && (porg === "polizei" ? R.PSA_POLIZEI : R.PSA_FEUERWEHR)
    const stufe = Math.floor(auftrag.stufe || 0)
    if (!p || !tabelle[id] || !tabelle[id][stufe]) return fehler("Unbekanntes Ausrüstungsteil oder Stufe.")
    if ((p.psa[id] || 0) >= stufe) return fehler("Diese Stufe ist schon vorhanden.")
    roh = tabelle[id][stufe].preis
    p.psa[id] = stufe
  } else if (art === "geraet") {
    const g = R.GERAETE[id]
    const org = auftrag.org || (g && g.org !== "beide" ? g.org : "feuerwehr")
    if (!g || (g.org !== "beide" && g.org !== org)) return fehler("Unbekanntes Gerät.")
    if (!orgFrei(R, s, org)) return fehler("Erst ab Level " + R.ORGANISATIONEN[org].ab_level + ".")
    if (!s.lager[org]) s.lager[org] = {}
    const gl = gebaeudeVon(R, org)
    const max = R.GEBAEUDE[gl][s.gebaeude[gl] || 0].lager_slots
    if (lagerSlots(R, s, org) + g.slots * anzahl > max) return fehler("Im Lager ist kein Platz mehr. Erst in ein Fahrzeug einräumen oder das Gebäude ausbauen.")
    roh = g.preis * anzahl
    s.lager[org][id] = (s.lager[org][id] || 0) + anzahl
  } else if (art === "fahrzeug") {
    const f = R.FAHRZEUGE[id]
    if (!f) return fehler("Unbekanntes Fahrzeug.")
    if (!orgFrei(R, s, f.org)) return fehler("Erst ab Level " + R.ORGANISATIONEN[f.org].ab_level + ".")
    const geb = gebaeudeVon(R, f.org)
    const plaetze = R.GEBAEUDE[geb][s.gebaeude[geb] || 0].stellplaetze
    if (f.stellplatz && stellplaetzeBelegt(R, s, f.org) + f.stellplatz > plaetze) return fehler("Kein freier Stellplatz. Erst das Gebäude ausbauen.")
    if (f.voraussetzung_fahrzeug && !s.fahrzeuge.some((x) => f.voraussetzung_fahrzeug.indexOf(x.typ) >= 0)) return fehler("Braucht ein Zugfahrzeug.")
    roh = f.preis
    s.zaehler += 1
    s.fahrzeuge.push({ id: "f" + s.zaehler, typ: id, beladung: Object.assign({}, f.grundbeladung), belegt_bis: 0 })
  } else if (art === "gebaeude") {
    const stufen = R.GEBAEUDE[id]
    if (!stufen) return fehler("Unbekanntes Gebäude.")
    if (imBau(s, "gebaeude", id)) return fehler("Hier wird schon gebaut.")
    const neu = (s.gebaeude[id] || 0) + 1
    const st = stufen[neu]
    if (!st) return fehler("Schon die höchste Stufe.")
    if (!levelReicht(s, st.ab_level)) return fehler("Erst ab Level " + st.ab_level + ".")
    roh = st.preis
    const ortId = st.ort || (R.GEBAEUDE_ORT && R.GEBAEUDE_ORT[id]) || "feuerwehrhaus"
    const winter = st.bauzeit_winter_h && R.FITNESS.winter_monate.indexOf(ortszeit(jetzt).monat) >= 0
    const bau = { art: "gebaeude", ziel: id, stufe: neu, name: st.name, ort: { x: R.ORTE[ortId].x, z: R.ORTE[ortId].z }, bauzeit_h: (winter ? st.bauzeit_winter_h : st.bauzeit_h) || 1, klein: false }
    if (st.phasen) bau.phasen = st.phasen
    beginneBau(R, s, jetzt, bau)
  } else if (art === "ausbau") {
    const a = R.AUSBAU[id]
    if (!a) return fehler("Unbekannter Ausbau.")
    if (s.ausbau.indexOf(id) >= 0) return fehler("Schon vorhanden.")
    if (imBau(s, "ausbau", id)) return fehler("Wird schon gebaut.")
    if (!levelReicht(s, a.ab_level)) return fehler("Erst ab Level " + a.ab_level + ".")
    if (a.gebaeude !== "ort" && (s.gebaeude[a.gebaeude] || 0) < a.ab_stufe) return fehler("Das Gebäude ist dafür noch zu klein.")
    roh = a.preis
    const platz = a.effekt && a.effekt.hydrant_platz !== undefined && (R.HYDRANT_PLAETZE || [])[a.effekt.hydrant_platz]
    if (a.effekt && a.effekt.hydrant_platz !== undefined && !platz) return fehler("Für diesen Hydranten gibt es auf der Karte keinen Platz.")
    const aedOrt = a.effekt && a.effekt.aed_ort && R.ORTE[a.effekt.aed_ort]
    const wo = platz || aedOrt || (id === "landestelle" && R.ORTE.sportplatz) || (a.gebaeude === "dienststelle" ? R.ORTE.dienststelle : a.gebaeude === "rettungswache" ? standortVon(R, s, "rettungsdienst") : a.gebaeude === "ort" && R.ORTE.kreuzung ? R.ORTE.kreuzung : R.ORTE.feuerwehrhaus)
    beginneBau(R, s, jetzt, { art: "ausbau", ziel: id, name: a.name, ort: { x: wo.x, z: wo.z }, bauzeit_h: a.bauzeit_h || 1, klein: Boolean(a.klein) })
  } else if (art === "neubaugebiet") {
    const nb = R.NEUBAUGEBIETE.find((n) => n.id === id)
    if (!nb) return fehler("Unbekanntes Neubaugebiet.")
    if (s.neubaugebiete.indexOf(id) >= 0) return fehler("Schon erschlossen.")
    if (imBau(s, "neubaugebiet", id)) return fehler("Wird schon erschlossen.")
    if (s.gebaeude.geraetehaus < nb.ab_geraetehaus) return fehler("Erst das Gerätehaus ausbauen.")
    roh = nb.erschliessung
    const mitte = { x: nb.ursprung.x + ((nb.spalten - 1) * nb.raster) / 2, z: nb.ursprung.z + ((nb.reihen - 1) * nb.raster) / 2 }
    beginneBau(R, s, jetzt, { art: "neubaugebiet", ziel: id, name: nb.name, ort: mitte, bauzeit_h: nb.bauzeit_h || 24, klein: false })
  } else if (art === "mitgliedschaft") {
    const p = person()
    const m = R.MITGLIEDSCHAFTEN[id]
    if (!p || !m) return fehler("Unbekannte Person oder Mitgliedschaft.")
    if (!levelReicht(s, m.ab_level)) return fehler("Erst ab Level " + m.ab_level + ".")
    if (id === "sportverein") {
      if (p.sportverein) return fehler("Schon im Sportverein.")
      p.sportverein = true
    } else {
      if (istMitglied(p, id)) return fehler("Schon Mitglied.")
      if (m.fuer_org && m.fuer_org.indexOf(p.org) < 0) return fehler("Diese Mitgliedschaft passt nicht zur Person.")
      if (m.braucht_haus && !p.haus) return fehler("Nur wer im Dorf wohnt, kann eintreten.")
      if ((p.mitglied || []).length >= 1) return fehler("Mehr als zwei Organisationen sind nicht möglich.")
      if (p.lehrgang_laeuft) return fehler("Die Person ist gerade in einem Lehrgang.")
      if (m.fitness_min && fitnessVon(R, p) < m.fitness_min) return fehler("Dafür braucht es Fitness " + m.fitness_min + ". Training im Sportverein hilft.")
      p.mitglied = (p.mitglied || []).concat([id])
      if (m.grundausbildung) p.lehrgang_laeuft = { id: m.grundausbildung, bis: jetzt + Math.round(m.grundausbildung_h * STD) }
    }
    roh = m.eintritt
  } else if (art === "personal") {
    const P = R.PERSONAL[id]
    if (!P) return fehler("Unbekannt.")
    const porg = P.org || "polizei"
    if (!orgFrei(R, s, porg)) return fehler("Erst ab Level " + R.ORGANISATIONEN[porg].ab_level + ".")
    const pg = gebaeudeVon(R, porg)
    const max = R.GEBAEUDE[pg][s.gebaeude[pg] || 0].personal_max || 0
    const zahl = porg === "polizei" ? polizeiZahl(s) : orgZahl(s, porg)
    if (zahl >= max) return fehler(porg === "polizei" ? "Die Dienststelle ist voll besetzt. Erst ausbauen." : "Alle Stellen sind besetzt. Erst ausbauen.")
    roh = P.preis
    const neu = neuePerson(s, porg, null, jetzt)
    if (P.lehrgaenge) {
      neu.lehrgaenge = {}
      for (const l of P.lehrgaenge) neu.lehrgaenge[l] = jetzt
    }
    if (porg !== "polizei") neu.beruf = "frei"
    s.personal.push(neu)
  } else return fehler("Unbekannte Kaufart.")

  // Vielleicht kann ein wartender Einsatz jetzt alarmiert werden
  versucheWartende(R, s, jetzt, (t) => wetterBei(null, t))
  return { stand: s, preis: preis(R, roh) }
}

/** Gerät zwischen Lager und Fahrzeug bewegen. richtung "ein" (Lager → Fahrzeug) oder "aus". */
function einraeumen(stand, auftrag, R) {
  const s = kopie(stand)
  const f = s.fahrzeuge.find((x) => x.id === auftrag.fahrzeug)
  const g = R.GERAETE[auftrag.geraet]
  const n = Math.max(1, Math.floor(auftrag.anzahl || 1))
  if (!f || !g) return { fehler: "Unbekanntes Fahrzeug oder Gerät." }
  const org = R.FAHRZEUGE[f.typ].org
  if (auftrag.richtung === "aus") {
    if ((f.beladung[auftrag.geraet] || 0) < n) return { fehler: "So viele sind nicht auf dem Fahrzeug." }
    f.beladung[auftrag.geraet] -= n
    s.lager[org][auftrag.geraet] = (s.lager[org][auftrag.geraet] || 0) + n
  } else {
    if ((s.lager[org][auftrag.geraet] || 0) < n) return { fehler: "So viele liegen nicht im Lager." }
    if (fahrzeugSlots(R, f) + g.slots * n > R.FAHRZEUGE[f.typ].slots) return { fehler: "Auf dem Fahrzeug ist kein Platz mehr." }
    s.lager[org][auftrag.geraet] -= n
    f.beladung[auftrag.geraet] = (f.beladung[auftrag.geraet] || 0) + n
  }
  return { stand: s }
}

module.exports = {
  fortschreiben,
  kaufe,
  sofort,
  einraeumen,
  neuerStand,
  wetterBei,
  strassenweg,
  fussweg,
  ortszeit,
  preis,
  levelAusXp,
  // für Tests
  _intern: { verzoegere, wachdienstAktiv, aufWache, drkVerpflegung, notarztPlan, patientErgebnis, standortVon, aedInDerNaehe, externerPlan, sperrungenAmWeg, wetterGestreut, levelFreischalten, bewerteZusammenarbeit, bedingungFaktor, einsatzbereitFuer, inSchicht, inArbeitszeit, training, naechstesTraining, fitnessTempo, freieStellen, ortErlaubt, wasserversorgung, hydrantenVon, tagVon, tagesende, tagesabschluss, plane, bewerte, erzeuge, feuerwehrBereit, zufall, psaEffekt, dunkel, zielEnde, bauPhase, behelfAktiv, fertigstellen, baustellenAmWeg },
}
