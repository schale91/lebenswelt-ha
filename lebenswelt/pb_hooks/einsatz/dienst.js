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

/** Stand laden, bis jetzt fortschreiben, Abgeschlossenes ins Protokoll verschieben, speichern. */
function aktuell(app, besitzer, jetzt) {
  const r = finde(app, besitzer, WELT, "stand")
  let stand = r ? lies(r) : S.neuerStand(R, jetzt)
  if (!gueltig(stand)) {
    // Sollte nie vorkommen; damit die Einsatzwelt nicht dauerhaft stehen bleibt, Rest sichern und neu beginnen
    console.log("Einsatzspiel: ungültiger Stand, wird gesichert und neu angelegt")
    schreibe(app, besitzer, WELT, "defekt_" + jetzt, { roh: stand })
    stand = S.neuerStand(R, jetzt)
  }
  const verlauf = wetterVerlauf(app, besitzer)
  stand = S.fortschreiben(stand, jetzt, (t) => S.wetterBei(verlauf, t), R)
  for (const e of stand.abgeschlossen) schreibe(app, besitzer, "einsatz", e.id, e)
  stand.abgeschlossen = []
  if (stand.ausgaben.length > AUSGABEN_MAX) stand.ausgaben = stand.ausgaben.slice(-AUSGABEN_MAX)
  schreibe(app, besitzer, WELT, "stand", stand)
  return { stand: stand, wetter: S.wetterBei(verlauf, jetzt) }
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

module.exports = { aktuell, speichere, schreibe, finde, lies, besitzerMitWelt, wetterAbgleich, wetterAus, R, S }
