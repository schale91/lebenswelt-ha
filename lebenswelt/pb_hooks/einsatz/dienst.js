// Anbindung der Simulation an PocketBase: Stand laden und speichern, Protokoll, Wetter aus Home Assistant.
// Wird in jedem Handler per require geladen (PocketBase führt Handler in eigenen Kontexten aus).

const R = require(`${__hooks}/einsatz/regelwerk.js`)
const S = require(`${__hooks}/einsatz/simulation.js`)

const WELT = "einsatzwelt"
const AUSGABEN_MAX = 500
const WETTER_TAGE = 30

function finde(app, besitzer, typ, schluessel) {
  try {
    return app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = {:t} && schluessel = {:s}", { b: besitzer, t: typ, s: schluessel })
  } catch (_) {
    return null
  }
}

function lies(r) {
  return JSON.parse(toString(r.get("daten")) || "{}")
}

/** Wirft, wenn irgendwo im Stand eine Zahl NaN oder unendlich ist. So wird ein kaputter Stand nie gespeichert. */
function pruefeZahlen(daten) {
  JSON.stringify(daten, (k, v) => {
    if (typeof v === "number" && !isFinite(v)) throw new Error("Ungültige Zahl in " + k)
    return v
  })
}

/** Grobe Formprüfung eines geladenen Stands. */
function gueltig(stand) {
  return !!stand && typeof stand === "object" && isFinite(stand.bis) && !!stand.einsatzarten && Array.isArray(stand.laufend) && Array.isArray(stand.personal) && Array.isArray(stand.ausgaben)
}

function schreibe(app, besitzer, typ, schluessel, daten) {
  pruefeZahlen(daten)
  let r = finde(app, besitzer, typ, schluessel)
  if (!r) {
    r = new Record(app.findCollectionByNameOrId("dokumente"))
    r.set("besitzer", besitzer)
    r.set("typ", typ)
    r.set("schluessel", schluessel)
    r.set("geloescht", false)
  }
  r.set("daten", daten)
  app.save(r)
  return r
}

function wetterVerlauf(app, besitzer) {
  const r = finde(app, besitzer, WELT, "wetter")
  return r ? lies(r).verlauf || [] : []
}

/**
 * Private Karte der Person (Dokument typ "karte", schluessel "dorf"), geschrieben von der App. Sie ersetzt Straßennetz,
 * Lage der Orte und Bauplätze des öffentlichen Regelwerks. So steht die echte Karte nur in der eigenen Datenbank und
 * im privaten App-Repository, nie im öffentlichen Add-on. Ohne gültige Karte gilt die erfundene Karte des Regelwerks.
 */
const karten = {}
function regelwerkFuer(app, besitzer) {
  const r = finde(app, besitzer, "karte", "dorf")
  if (!r || r.getBool("geloescht")) return R
  // Gleiche Karte, gleiches Objekt: So rechnet die Simulation das Wegenetz nur nach einer Änderung neu
  const stand = r.id + "|" + String(r.get("updated"))
  if (karten[besitzer] && karten[besitzer].stand === stand) return karten[besitzer].R
  const neu = mitKarte(r)
  karten[besitzer] = { stand, R: neu }
  return neu
}

function mitKarte(r) {
  let k
  try {
    k = lies(r)
  } catch (_) {
    return R
  }
  if (!karteGueltig(k)) return R
  const orte = {}
  for (const [id, o] of Object.entries(R.ORTE)) orte[id] = k.orte && k.orte[id] ? Object.assign({}, o, { x: k.orte[id].x, z: k.orte[id].z }) : o
  const bauplaetze = (k.bauplaetze || R.BAUPLAETZE).map((b) => {
    const alt = R.BAUPLAETZE.find((x) => x.id === b.id)
    return Object.assign({}, alt || { preis: 500 }, { id: b.id, x: b.x, z: b.z }, b.preis ? { preis: b.preis } : {})
  })
  const neubaugebiete = R.NEUBAUGEBIETE.map((n) => (k.neubaugebiete && k.neubaugebiete[n.id] ? Object.assign({}, n, { ursprung: k.neubaugebiete[n.id] }) : n))
  return Object.assign({}, R, { STRASSEN: k.strassen, ORTE: orte, BAUPLAETZE: bauplaetze, NEUBAUGEBIETE: neubaugebiete, KARTE: "privat" })
}

function karteGueltig(k) {
  const zahl = (v) => typeof v === "number" && isFinite(v)
  const s = k && k.strassen
  if (!s || !Array.isArray(s.knoten) || !Array.isArray(s.kanten) || s.knoten.length < 2) return false
  const ids = new Set(s.knoten.map((n) => n.id))
  if (!s.knoten.every((n) => typeof n.id === "string" && zahl(n.x) && zahl(n.z))) return false
  if (!s.kanten.every((e) => ids.has(e.von) && ids.has(e.nach) && zahl(e.laenge) && e.laenge > 0)) return false
  if (k.orte && !Object.values(k.orte).every((o) => o && zahl(o.x) && zahl(o.z))) return false
  if (k.bauplaetze && !(Array.isArray(k.bauplaetze) && k.bauplaetze.every((b) => typeof b.id === "string" && zahl(b.x) && zahl(b.z)))) return false
  return true
}

/** Stand laden, bis jetzt fortschreiben, Abgeschlossenes ins Protokoll verschieben, speichern. */
function aktuell(app, besitzer, jetzt) {
  const R = regelwerkFuer(app, besitzer)
  const r = finde(app, besitzer, WELT, "stand")
  let stand = r ? lies(r) : S.neuerStand(R, jetzt)
  if (!gueltig(stand)) {
    // Sollte nie vorkommen; damit die Einsatzwelt nicht dauerhaft stehen bleibt, Rest sichern und neu beginnen
    console.log("Einsatzspiel: ungültiger Stand, wird gesichert und neu angelegt")
    schreibe(app, besitzer, WELT, "defekt_" + jetzt, { roh: stand })
    stand = S.neuerStand(R, jetzt)
  }
  const verlauf = wetterVerlauf(app, besitzer)
  const bekannt = new Set(stand.laufend.map((e) => e.id))
  stand = S.fortschreiben(stand, jetzt, (t) => S.wetterBei(verlauf, t), R)
  meldeNeue(app, besitzer, stand.laufend.filter((e) => !bekannt.has(e.id)), jetzt)
  for (const e of stand.abgeschlossen) schreibe(app, besitzer, "einsatz", e.id, e)
  stand.abgeschlossen = []
  if (stand.ausgaben.length > AUSGABEN_MAX) stand.ausgaben = stand.ausgaben.slice(-AUSGABEN_MAX)
  schreibe(app, besitzer, WELT, "stand", stand)
  return { stand: stand, wetter: S.wetterBei(verlauf, jetzt) }
}

/** Push für neue Einsätze (höchstens drei, nur frische, nicht nach langer Pause alles nachholen). */
function meldeNeue(app, besitzer, neu, jetzt) {
  const frisch = neu.filter((e) => e.status !== "verfallen" && e.meldung >= jetzt - 5 * 60 * 1000).slice(0, 3)
  if (!frisch.length) return
  try {
    const p = require(`${__hooks}/push.js`)
    if (!p.eingerichtet()) return
    for (const e of frisch) {
      const art = R.EINSATZARTEN[e.art] || {}
      const wer = art.org === "polizei" ? "Polizei" : "Feuerwehr"
      const ort = (R.ORTE[e.ort] && R.ORTE[e.ort].name) || ""
      p.sende(app, besitzer, { titel: `Einsatz: ${art.stichwort || e.art}`, text: `${wer} alarmiert${ort ? " · " + ort : ""}. Schau zu, wie es läuft.`, kanal: "einsatz", id: e.id, ttl_s: Math.max(60, Math.round((e.verfall - jetzt) / 1000)) })
    }
  } catch (err) {
    console.log("Einsatzspiel: Push fehlgeschlagen", err)
  }
}

function speichere(app, besitzer, stand) {
  schreibe(app, besitzer, WELT, "stand", stand)
}

/** Alle Personen mit einer Einsatzwelt (für den Minutentakt). */
function besitzerMitWelt(app) {
  try {
    return app.findRecordsByFilter("dokumente", "typ = {:t} && schluessel = 'stand'", "", 0, 0, { t: WELT }).map((r) => r.getString("besitzer"))
  } catch (_) {
    return []
  }
}

/**
 * Wetterlage aus der Wetter-Entität von Home Assistant ableiten.
 * Zustände nach der Wetter-Integration: sunny, clear-night, partlycloudy, cloudy, fog, rainy, pouring,
 * snowy, snowy-rainy, hail, lightning, lightning-rainy, windy, windy-variant, exceptional.
 */
function wetterAus(zustand, temperatur) {
  const t = Number(temperatur)
  const nass = ["rainy", "pouring", "snowy-rainy", "hail", "lightning-rainy"].indexOf(zustand) >= 0
  if (Number.isFinite(t) && t <= 0 && (nass || zustand === "fog")) return "glaette"
  if (zustand === "snowy") return "schnee"
  if (["lightning", "lightning-rainy", "windy", "windy-variant"].indexOf(zustand) >= 0) return "sturm"
  if (nass) return "nass"
  if (Number.isFinite(t) && t >= 28 && (zustand === "sunny" || zustand === "partlycloudy")) return "hitze"
  return "trocken"
}

/** Liest die Wetter-Entität und hängt eine Änderung an den Verlauf jeder Person an. */
function wetterAbgleich(app) {
  const h = require(`${__hooks}/hilfen.js`)
  const token = $os.getenv("SUPERVISOR_TOKEN")
  if (!token) return { ok: false, grund: "kein SUPERVISOR_TOKEN" }
  const entitaet = String(h.optionen().wetter_entitaet || "weather.forecast_home")
  let antwort
  try {
    antwort = $http.send({ url: "http://supervisor/core/api/states/" + entitaet, headers: { Authorization: "Bearer " + token }, timeout: 15 })
  } catch (err) {
    return { ok: false, grund: "Home Assistant nicht erreichbar: " + err }
  }
  if (antwort.statusCode !== 200) return { ok: false, grund: "HTTP " + antwort.statusCode }
  const j = antwort.json || {}
  const w = wetterAus(j.state, j.attributes && j.attributes.temperature)
  const jetzt = Date.now()
  for (const b of besitzerMitWelt(app)) {
    const verlauf = wetterVerlauf(app, b).filter((e) => e.ab > jetzt - WETTER_TAGE * 24 * 3600 * 1000)
    if (!verlauf.length || verlauf[verlauf.length - 1].wetter !== w) {
      verlauf.push({ ab: jetzt, wetter: w })
      schreibe(app, b, WELT, "wetter", { verlauf: verlauf })
    }
  }
  return { ok: true, wetter: w }
}

module.exports = { regelwerkFuer, aktuell, speichere, schreibe, finde, lies, besitzerMitWelt, wetterAbgleich, wetterAus, R, S }
