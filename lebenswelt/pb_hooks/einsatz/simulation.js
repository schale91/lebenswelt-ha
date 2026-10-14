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
  return { stunde: l.getUTCHours(), minute: l.getUTCMinutes(), wochentag: l.getUTCDay(), monat: l.getUTCMonth() + 1 }
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
    version: 1,
    bis: jetzt,
    zufall: saat === undefined ? jetzt % 100000 : saat,
    einsatzarten: {},
    freigeschaltet: [],
    haeuser: [],
    personal: [],
    fahrzeuge: [],
    lager: { feuerwehr: {}, polizei: {} },
    pflege: [],
    gebaeude: { geraetehaus: 0, dienststelle: 0 },
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
    if (typ.wasser_l) m.fahrzeug_wasser = (m.fahrzeug_wasser || 0) + 1
    if (f.typ === "dlak") m.dlak_fahrzeug = 1
    if (f.typ === "elw1") m.elw_fahrzeug = 1
    if (f.typ === "tlf3000") m.tlf_fahrzeug = 1
    if (f.typ === "mzb") m.boot_fahrzeug = 1
  }
  return m
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
}

function bauPhasen(R, b) {
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
      s.personal.push(neuePerson(s, "feuerwehr", h.id, t))
    }
  } else if (b.art === "haus_ausbau") {
    const h = s.haeuser.find((x) => x.id === b.ziel)
    const a = R.HAUS_AUSBAU[b.ausbau]
    if (h && a) {
      if (h.ausbau.indexOf(b.ausbau) < 0) h.ausbau.push(b.ausbau)
      for (let i = 0; i < (a.bewohner || 0); i++) s.personal.push(neuePerson(s, "feuerwehr", h.id, t))
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
function psaEffekt(R, p) {
  const tabelle = p.org === "polizei" ? R.PSA_POLIZEI : R.PSA_FEUERWEHR
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
  return e
}

/** Ausrüstung eines Trupps: der Langsamste und Unsicherste bestimmen den Weg, die Arbeit im Mittel. */
function truppEffekt(R, leute) {
  const alle = leute.map((p) => psaEffekt(R, p))
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
  const start = haus ? bauplatz(R, haus.bauplatz) : R.ORTE.feuerwehrhaus
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
    beste = Math.min(beste, m / (a.tempo_ms * wf) + Math.max(0, extra))
  }
  const stufe = R.GEBAEUDE.geraetehaus[s.gebaeude.geraetehaus]
  const behelf = behelfAktiv(R, s, "geraetehaus", alarm) ? R.BAU.behelf.umziehen_s : 0
  const umziehen = Math.max(10, stufe.umziehen_s + ausbauEffekt(R, s, "umziehen_s") + psaEffekt(R, p).umziehen_s + behelf)
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
  const basis = org === "polizei" ? R.ORTE.dienststelle : R.ORTE.feuerwehrhaus
  const personen = s.personal.filter((p) => p.org === org && verfuegbar(p, alarm))
  if (!personen.length) return { grund: org === "polizei" ? "Keine Beamtin und kein Beamter verfügbar." : "Keine Einsatzkraft verfügbar." }

  // Bereitschaftszeit je Person
  const bereit = personen
    .map((p) => ({ p, t: org === "polizei" ? alarm + (POLIZEI_REAKTION_S + psaEffekt(R, p).reaktion_s + (behelfAktiv(R, s, "dienststelle", alarm) ? R.BAU.behelf.reaktion_s : 0)) * 1000 : feuerwehrBereit(R, s, p, alarm, wetter) }))
    .sort((a, b) => a.t - b.t || (a.p.id < b.p.id ? -1 : 1))

  const fahrzeuge = s.fahrzeuge.filter((f) => R.FAHRZEUGE[f.typ].org === org && frei(f, alarm))
  const lager = bestandVon(s, "lager:" + org, s.lager[org] || {}, alarm)
  const falschparker = org === "feuerwehr" && s.laufend.some((x) => x.art === "p_falschparker" && x.status !== "abgeschlossen" && x.meldung <= alarm && !(x.plan && x.plan.arbeit_ende <= alarm))
  const zf = falschparker ? R.EINSATZARTEN.p_falschparker.wirkung.fahrzeit_faktor : 1
  const behelfAus = org === "feuerwehr" && behelfAktiv(R, s, "geraetehaus", alarm) ? R.BAU.behelf.ausruecken_s : 0
  const ausruecken = Math.max(0, R.ZEITEN.ausruecken_s + ausbauEffekt(R, s, "ausruecken_s") + behelfAus) * 1000
  const amWeg = baustellenAmWeg(R, s, [basis, ort], alarm).slice(0, 2)
  const mind = art.mindestens || {}
  const opt = art.optimal || {}

  let bester = null
  let naechsterGrund = null
  for (const auswahl of teilmengen(fahrzeuge, 4)) {
    const motor = auswahl.filter((f) => !R.FAHRZEUGE[f.typ].gezogen && !R.FAHRZEUGE[f.typ].anhaenger && R.FAHRZEUGE[f.typ].tempo_kmh > 6)
    // Anhänger nur mit Zugfahrzeug
    if (auswahl.some((f) => R.FAHRZEUGE[f.typ].anhaenger) && !motor.some((f) => (R.FAHRZEUGE.tsa.voraussetzung_fahrzeug || []).indexOf(f.typ) >= 0)) continue
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
      tempo = Math.min.apply(null, motor.map((f) => R.FAHRZEUGE[f.typ].tempo_kmh)) / 3.6 * R.ZEITEN.sonderrechte_tempo
      weg = strassenweg(R, basis, ort)
    }
    // Zu Fuß bestimmen Stiefel, Wetter und Licht das Tempo
    const te = truppEffekt(R, leute)
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
  if (!bester) return { grund: naechsterGrund || "Keine passende Ausrüstung." }

  // Arbeit vor Ort. Jeder Faktor wird mit Grund vermerkt, damit das Protokoll erklärt, was Zeit gekostet hat.
  const vorhanden = bester.leute.length
  const verzugMin = Math.max(0, (bester.eintreffen - e.meldung) / MIN)
  const faktoren = []
  const merke = (grund, faktor, text) => {
    if (Math.abs(faktor - 1) >= 0.01) faktoren.push({ grund, faktor: Math.round(faktor * 100) / 100, text })
  }
  if (bester.fussFaktor > 1.01) merke("zu_fuss", bester.fussFaktor, "Weg zu Fuß: Stiefel, Wetter und Licht")
  if (bester.bauVerzug) faktoren.push({ grund: "baustelle", sekunden: Math.round(bester.bauVerzug / 1000), text: "Baustelle an der Strecke (" + amWeg.map((b) => b.name).join(", ") + ")" })
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
  if (art.wachstum && verzugMin > 0) merke("ausbreitung", 1 + art.wachstum * verzugMin, "Feuer hat sich bis zum Eintreffen ausgebreitet")
  const th = String(art.stichwort || "").indexOf("TH") === 0
  merke("ausruestung", bester.te.arbeit * (th ? bester.te.arbeit_th : 1), "persönliche Ausrüstung")
  if (dunkel(R, bester.eintreffen)) merke("dunkel", 1 + (R.ZEITEN.nacht_arbeit - 1) * (1 - licht(R, bester.bestand, vorhanden, bester.te)), "Dunkelheit")
  const arbeit = faktoren.filter((f) => f.faktor && f.grund !== "zu_fuss").reduce((n, f) => n * f.faktor, art.arbeit_min)
  const arbeitEnde = bester.eintreffen + Math.round(arbeit * MIN)
  const zurueck = arbeitEnde + Math.round(bester.fahrzeit * R.ZEITEN.rueckfahrt_faktor / R.ZEITEN.sonderrechte_tempo)
  // Ohne Rückmeldung kommen alle Alarmierten zum Gerätehaus, auch wer nicht mehr gebraucht wird
  const imTrupp = {}
  for (const b of bester.trupp) imTrupp[b.p.id] = true
  const vergeblich = org === "feuerwehr"
    ? bereit
        .filter((b) => !imTrupp[b.p.id] && !hatRueckmeldung(R, s, b.p))
        .map((b) => ({ id: b.p.id, bis: b.t + VERGEBLICH_MS }))
    : []
  return {
    plan: {
      alarm,
      personen: bester.trupp.map((b) => ({ id: b.p.id, umgezogen: b.t })),
      fahrzeuge: bester.auswahl.map((f) => f.id),
      mitgenommen: bester.mit,
      bestand: bester.bestand,
      zu_fuss: bester.motor.length === 0,
      abfahrt: bester.abfahrt,
      fahrzeit: bester.fahrzeit,
      eintreffen: bester.eintreffen,
      arbeit_ende: arbeitEnde,
      zurueck,
      einsatzbereit: zurueck + (bester.motor.length ? R.ZEITEN.einsatzbereit_s * 1000 : 0),
      verzug_min: Math.round(verzugMin * 10) / 10,
      faktoren,
      gesperrt: sperren,
      vergeblich,
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
  const summe = abzuege.reduce((n, a) => n + a.sterne, 0)
  const sterne = Math.max(1, Math.round((R.STERNE.max - summe) * 2) / 2)
  return { sterne, abzuege }
}

// ---------- Ereignisse ----------

function bedingungFaktor(art, t, wetter) {
  const b = art.bedingung
  if (!b) return 1
  const z = ortszeit(t)
  const passt = (!b.wetter || b.wetter.indexOf(wetter) >= 0) && (!b.monate || b.monate.indexOf(z.monat) >= 0) && (!b.stunden || b.stunden.indexOf(z.stunde) >= 0) && (!b.wochentage || b.wochentage.indexOf(z.wochentag) >= 0)
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
  const ergebnis = plane(R, s, e, t, umwelt)
  if (ergebnis.grund || ergebnis.plan.eintreffen > e.verfall) {
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
  return e
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
    // Nur, wenn die andere Organisation überhaupt jemanden hat (sonst entsteht der Folgeeinsatz nicht)
    if (!s.personal.some((p) => p.org === fa.org)) continue
    // Kein dramatischer Folgeeinsatz in einer Schutzzone
    if (!ortErlaubt(R, s, fa, e.ort)) continue
    erzeuge(R, s, id, t, umwelt, e)
  }
}

function abschliessen(R, s, e) {
  const art = R.EINSATZARTEN[e.art]
  const st = s.einsatzarten[e.art]
  if (e.status !== "verfallen") {
    e.bewertung = bewerte(R, s, e)
    e.status = "abgeschlossen"
    for (const x of e.plan.personen) {
      const p = s.personal.find((q) => q.id === x.id)
      if (p) p.einsaetze = (p.einsaetze || 0) + 1
    }
    pflege(R, s, e)
  } else e.bewertung = { sterne: 0, abzuege: [{ grund: "verfallen", sterne: 5, text: e.grund }] }
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
function naechstesEreignis(s, bis) {
  let best = null
  const nimm = (t, typ, rang, id) => {
    if (t > bis) return
    if (!best || t < best.t || (t === best.t && (rang < best.rang || (rang === best.rang && id < best.id)))) best = { t, typ, rang, id }
  }
  for (const e of s.laufend) {
    if (e.status === "verfallen") nimm(e.ende, "ende", 0, e.id)
    else if (!e.folgen_erzeugt) nimm(e.plan.eintreffen, "eintreffen", 1, e.id)
    else nimm(e.ende, "ende", 0, e.id)
  }
  for (const [id, a] of Object.entries(s.einsatzarten)) nimm(a.naechster, "meldung", 2, id)
  for (const b of s.baustellen || []) nimm(b.ende, "bau", 3, b.id)
  for (const [tag, d] of Object.entries(s.tage || {})) if (!d.abgerechnet) nimm(tagesende(tag), "tag", 4, tag)
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
  const wetter = umwelt || ((t) => wetterBei(null, t))
  let schutz = 0
  for (;;) {
    const ev = naechstesEreignis(s, bis)
    if (!ev) break
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
    } else if (ev.typ === "tag") {
      tagesabschluss(R, s, ev.id)
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

function neuePerson(s, org, haus, jetzt) {
  s.zaehler += 1
  return {
    id: "p" + s.zaehler,
    org,
    name: "",
    anrede: "",
    haus,
    lehrgaenge: org === "feuerwehr" ? { tm1: jetzt } : { pk: jetzt },
    lehrgang_laeuft: null,
    psa: {},
    einsaetze: 0,
    belegt_bis: 0,
  }
}

/**
 * Kauft etwas. Gibt {stand, preis} oder {fehler} zurück. Münzen bucht der Aufrufer (Route) ab.
 * auftrag: {art, id, ziel?, anzahl?, stufe?}
 */
function kaufe(stand, auftrag, jetzt, R) {
  const s = kopie(stand)
  bauFelder(s)
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
    roh = a.preis
    aktiviereArt(R, s, id, jetzt)
  } else if (art === "bauplatz") {
    const bp = bauplatz(R, id)
    if (!bp) return fehler("Diesen Bauplatz gibt es nicht.")
    if (bp.neubaugebiet && s.neubaugebiete.indexOf(bp.neubaugebiet) < 0) return fehler("Das Neubaugebiet ist noch nicht erschlossen.")
    if (s.haeuser.some((h) => h.bauplatz === id)) return fehler("Der Bauplatz ist schon bebaut.")
    roh = bp.preis
    s.zaehler += 1
    // Erst wird gebaut, mit dem fertigen Haus zieht die Einsatzkraft ein
    const h = { id: "h" + s.zaehler, bauplatz: id, gekauft: jetzt, ausbau: [], alarmierung: "sirene", im_bau: true }
    s.haeuser.push(h)
    beginneBau(R, s, jetzt, { art: "haus", ziel: h.id, name: "Haus auf " + id.toUpperCase(), ort: { x: bp.x, z: bp.z }, bauzeit_h: R.BAU.haus_h, klein: false })
  } else if (art === "haus_ausbau") {
    const h = haus()
    const a = R.HAUS_AUSBAU[id]
    if (!h || !a || id === "zu_fuss") return fehler("Unbekanntes Haus oder unbekannter Ausbau.")
    if (h.ausbau.indexOf(id) >= 0) return fehler("Schon vorhanden.")
    if (a.voraussetzung && h.ausbau.indexOf(a.voraussetzung) < 0) return fehler("Zuerst " + R.HAUS_AUSBAU[a.voraussetzung].name + ".")
    roh = a.preis
    if (a.bauzeit_h) {
      if (imBau(s, "haus_ausbau", h.id)) return fehler("Am Haus wird schon gebaut.")
      const bp = bauplatz(R, h.bauplatz)
      beginneBau(R, s, jetzt, { art: "haus_ausbau", ziel: h.id, ausbau: id, name: a.name.split(" (")[0] + " auf " + h.bauplatz.toUpperCase(), ort: { x: bp.x, z: bp.z }, bauzeit_h: a.bauzeit_h, klein: false })
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
    if (!p || !l || l.org !== p.org) return fehler("Unbekannte Person oder unpassender Lehrgang.")
    if (p.lehrgaenge[id] !== undefined) return fehler("Schon abgeschlossen.")
    if (p.lehrgang_laeuft) return fehler("Die Person ist schon in einem Lehrgang.")
    for (const v of l.voraussetzung || []) if (!hatLehrgang(p, v, jetzt)) return fehler("Voraussetzung fehlt: " + R.LEHRGAENGE[v].name + ".")
    roh = l.preis
    p.lehrgang_laeuft = { id, bis: jetzt + Math.round(l.dauer_h * STD * ausbauFaktor(R, s, "lehrgang_faktor")) }
  } else if (art === "psa") {
    const p = person()
    const tabelle = p && (p.org === "polizei" ? R.PSA_POLIZEI : R.PSA_FEUERWEHR)
    const stufe = Math.floor(auftrag.stufe || 0)
    if (!p || !tabelle[id] || !tabelle[id][stufe]) return fehler("Unbekanntes Ausrüstungsteil oder Stufe.")
    if ((p.psa[id] || 0) >= stufe) return fehler("Diese Stufe ist schon vorhanden.")
    roh = tabelle[id][stufe].preis
    p.psa[id] = stufe
  } else if (art === "geraet") {
    const g = R.GERAETE[id]
    const org = auftrag.org || (g && g.org === "polizei" ? "polizei" : "feuerwehr")
    if (!g || (g.org !== "beide" && g.org !== org)) return fehler("Unbekanntes Gerät.")
    const max = R.GEBAEUDE[org === "polizei" ? "dienststelle" : "geraetehaus"][s.gebaeude[org === "polizei" ? "dienststelle" : "geraetehaus"]].lager_slots
    if (lagerSlots(R, s, org) + g.slots * anzahl > max) return fehler("Im Lager ist kein Platz mehr. Erst in ein Fahrzeug einräumen oder das Gebäude ausbauen.")
    roh = g.preis * anzahl
    s.lager[org][id] = (s.lager[org][id] || 0) + anzahl
  } else if (art === "fahrzeug") {
    const f = R.FAHRZEUGE[id]
    if (!f) return fehler("Unbekanntes Fahrzeug.")
    const geb = f.org === "polizei" ? "dienststelle" : "geraetehaus"
    const plaetze = R.GEBAEUDE[geb][s.gebaeude[geb]].stellplaetze
    if (f.stellplatz && stellplaetzeBelegt(R, s, f.org) + f.stellplatz > plaetze) return fehler("Kein freier Stellplatz. Erst das Gebäude ausbauen.")
    if (f.voraussetzung_fahrzeug && !s.fahrzeuge.some((x) => f.voraussetzung_fahrzeug.indexOf(x.typ) >= 0)) return fehler("Braucht ein Zugfahrzeug.")
    roh = f.preis
    s.zaehler += 1
    s.fahrzeuge.push({ id: "f" + s.zaehler, typ: id, beladung: Object.assign({}, f.grundbeladung), belegt_bis: 0 })
  } else if (art === "gebaeude") {
    const stufen = R.GEBAEUDE[id]
    if (!stufen) return fehler("Unbekanntes Gebäude.")
    if (imBau(s, "gebaeude", id)) return fehler("Hier wird schon gebaut.")
    const neu = s.gebaeude[id] + 1
    if (!stufen[neu]) return fehler("Schon die höchste Stufe.")
    roh = stufen[neu].preis
    beginneBau(R, s, jetzt, { art: "gebaeude", ziel: id, stufe: neu, name: stufen[neu].name, ort: id === "dienststelle" ? R.ORTE.dienststelle : R.ORTE.feuerwehrhaus, bauzeit_h: stufen[neu].bauzeit_h || 1, klein: false })
  } else if (art === "ausbau") {
    const a = R.AUSBAU[id]
    if (!a) return fehler("Unbekannter Ausbau.")
    if (s.ausbau.indexOf(id) >= 0) return fehler("Schon vorhanden.")
    if (imBau(s, "ausbau", id)) return fehler("Wird schon gebaut.")
    if (a.gebaeude !== "ort" && s.gebaeude[a.gebaeude] < a.ab_stufe) return fehler("Das Gebäude ist dafür noch zu klein.")
    roh = a.preis
    const wo = a.gebaeude === "dienststelle" ? R.ORTE.dienststelle : a.gebaeude === "ort" && R.ORTE.kreuzung ? R.ORTE.kreuzung : R.ORTE.feuerwehrhaus
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
  } else if (art === "personal") {
    const P = R.PERSONAL[id]
    if (!P) return fehler("Unbekannt.")
    const max = R.GEBAEUDE.dienststelle[s.gebaeude.dienststelle].personal_max
    if (s.personal.filter((p) => p.org === "polizei").length >= max) return fehler("Die Dienststelle ist voll besetzt. Erst ausbauen.")
    roh = P.preis
    s.personal.push(neuePerson(s, "polizei", null, jetzt))
  } else return fehler("Unbekannte Kaufart.")

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
  // für Tests
  _intern: { ortErlaubt, tagVon, tagesende, tagesabschluss, plane, bewerte, erzeuge, feuerwehrBereit, zufall, psaEffekt, dunkel, zielEnde, bauPhase, behelfAktiv, fertigstellen, baustellenAmWeg },
}
