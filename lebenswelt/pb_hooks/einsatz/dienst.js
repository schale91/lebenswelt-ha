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

/** Echte DWD-Warnungen der Person (Dokument „warnungen“, geschrieben vom Wetterabgleich). */
function warnungenVon(app, besitzer) {
  const r = finde(app, besitzer, WELT, "warnungen")
  return r ? lies(r).liste || [] : []
}

/**
 * Private Karte der Person (Dokument typ "karte", schluessel "dorf"), geschrieben von der App. Sie ersetzt Straßennetz,
 * Lage der Orte und Bauplätze des öffentlichen Regelwerks. So steht die echte Karte nur in der eigenen Datenbank und
 * im privaten App-Repository, nie im öffentlichen Add-on. Ohne gültige Karte gilt die erfundene Karte des Regelwerks.
 */
const karten = {}
function regelwerkFuer(app, besitzer) {
  // Elbe Springs zuerst: Seit dem Neustart spielt das Einsatzspiel dort, die Karte kommt aus dem Stadtplan der App
  let r = finde(app, besitzer, "karte", "elbe")
  if (!r || r.getBool("geloescht")) r = finde(app, besitzer, "karte", "dorf")
  if (!r || r.getBool("geloescht")) return R
  // Gleiche Karte, gleiches Objekt: So rechnet die Simulation das Wegenetz nur nach einer Änderung neu
  const stand = r.id + "|" + String(r.get("updated"))
  if (karten[besitzer] && karten[besitzer].stand === stand) return karten[besitzer].R
  const neu = mitKarte(r)
  karten[besitzer] = { stand, R: neu }
  return neu
}

/** Liest die Karte aus dem Dokument und legt sie über das Regelwerk (karte.js). */
function mitKarte(r) {
  let k
  try {
    k = lies(r)
  } catch (_) {
    return R
  }
  return require(`${__hooks}/einsatz/karte.js`).mitKarte(R, k)
}

/** Level der Person aus den Skill-XP im gespeicherten Spielstand (wie levelAusXp in der App). */
function levelVon(app, besitzer) {
  try {
    const h = require(`${__hooks}/hilfen.js`)
    const r = h.spielstandVon(app, besitzer)
    const daten = r ? JSON.parse(toString(r.get("daten")) || "null") : null
    const xp = daten && daten.state && daten.state.skillXp ? Object.values(daten.state.skillXp).reduce((n, x) => n + (Number(x) || 0), 0) : 0
    return S.levelAusXp(xp)
  } catch (_) {
    return 0
  }
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
  // Level der Lebenswelt aus dem Spielstand (nur steigend, XP gehen nie verloren); schaltet Dienste frei
  stand.level = Math.max(stand.level || 0, levelVon(app, besitzer))
  const verlauf = wetterVerlauf(app, besitzer)
  const warnungen = warnungenVon(app, besitzer)
  const bekannt = new Set(stand.laufend.map((e) => e.id))
  // Echte Wetterwarnungen setzen das Spielwetter und passende Einsätze an
  stand = S.warnungenAusloesen(R, stand, warnungen, jetzt)
  stand = S.fortschreiben(stand, jetzt, (t) => S.wetterMitWarnungen(R, warnungen, verlauf, t), R)
  meldeNeue(app, besitzer, stand.laufend.filter((e) => !bekannt.has(e.id)), jetzt)
  for (const e of stand.abgeschlossen) schreibe(app, besitzer, "einsatz", e.id, e)
  stand.abgeschlossen = []
  if (stand.ausgaben.length > AUSGABEN_MAX) stand.ausgaben = stand.ausgaben.slice(-AUSGABEN_MAX)
  schreibe(app, besitzer, WELT, "stand", stand)
  const gilt = warnungen.filter((w) => w.ab <= jetzt && jetzt < w.bis && S.warnungsRegel(R, w))
  return { stand: stand, wetter: S.wetterMitWarnungen(R, warnungen, verlauf, jetzt), warnungen: gilt.map((w) => ({ name: w.name, stufe: w.stufe, bis: w.bis })) }
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
      const ort = S.ortName(R, e.ort)
      p.sende(app, besitzer, { titel: `Einsatz: ${art.stichwort || e.art}`, text: `${wer} alarmiert${ort ? " · " + ort : ""}. Schau zu, wie es läuft.`, kanal: "einsatz", id: e.id, ttl_s: Math.max(60, Math.round(((e.ende || e.verfall) - jetzt) / 1000)) })
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
  const dwd = dwdWarnungen(h, token)
  for (const b of besitzerMitWelt(app)) {
    if (dwd) {
      // Warnungen sammeln (eine Warnung kann sich ändern: Stufe und Ende aktualisieren), nach 14 Tagen vergessen
      const liste = warnungenVon(app, b).filter((x) => x.bis > jetzt - WETTER_TAGE * 24 * 3600 * 1000)
      let geaendert = liste.length !== warnungenVon(app, b).length
      for (const n of dwd) {
        const alt = liste.find((x) => x.id === n.id)
        if (!alt) {
          liste.push(n)
          geaendert = true
        } else if (alt.bis !== n.bis || alt.stufe !== n.stufe) {
          alt.bis = n.bis
          alt.stufe = n.stufe
          geaendert = true
        }
      }
      if (geaendert) schreibe(app, b, WELT, "warnungen", { liste: liste })
    }
    const verlauf = wetterVerlauf(app, b).filter((e) => e.ab > jetzt - WETTER_TAGE * 24 * 3600 * 1000)
    if (!verlauf.length || verlauf[verlauf.length - 1].wetter !== w) {
      verlauf.push({ ab: jetzt, wetter: w })
      schreibe(app, b, WELT, "wetter", { verlauf: verlauf })
    }
  }
  return { ok: true, wetter: w, warnungen: dwd ? dwd.length : null }
}

/**
 * Warnungen aus den Sensoren der Integration „DWD Weather Warnings“ (aktuelle Warnstufe und Vorwarnstufe). Option
 * warn_entitaet: einer der beiden Sensoren; ohne Option werden die Sensoren gesucht (Attribute region_id und
 * warning_count). Je Warnung: id, name (DWD-Ereignis), stufe, ab, bis. null, wenn es keine Sensoren gibt.
 */
let dwdSensoren = null
function dwdWarnungen(h, token) {
  const hole = (pfad) => {
    try {
      const a = $http.send({ url: "http://supervisor/core/api/states" + pfad, headers: { Authorization: "Bearer " + token }, timeout: 15 })
      return a.statusCode === 200 ? a.json : null
    } catch (_) {
      return null
    }
  }
  const option = String(h.optionen().warn_entitaet || "")
  let zustaende
  if (option) {
    const paar = [option, option.replace(/_aktuelle_warnstufe$/, "_vorwarnstufe").replace(/_current_warning_level$/, "_advance_warning_level")]
    zustaende = paar.filter((x, i) => i === 0 || x !== paar[0]).map((e) => hole("/" + e)).filter(Boolean)
  } else {
    if (!dwdSensoren) {
      const alle = hole("") || []
      dwdSensoren = alle.filter((z) => z.entity_id.indexOf("sensor.") === 0 && z.attributes && z.attributes.region_id !== undefined && z.attributes.warning_count !== undefined).map((z) => z.entity_id)
      if (!dwdSensoren.length) dwdSensoren = null
      return dwdSensoren ? S.dwdAus(alle.filter((z) => dwdSensoren.indexOf(z.entity_id) >= 0)) : null
    }
    zustaende = dwdSensoren.map((e) => hole("/" + e)).filter(Boolean)
  }
  return zustaende.length ? S.dwdAus(zustaende) : null
}


module.exports = { regelwerkFuer, aktuell, speichere, schreibe, finde, lies, besitzerMitWelt, wetterAbgleich, wetterAus, R, S }
