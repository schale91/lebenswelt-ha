// Helfer für ha_daten.pb.js (Garmin, Kalender, Paperless). Als Modul, weil PocketBase jeden Handler in einem eigenen
// Kontext ausführt und Funktionen aus der .pb.js-Datei dort nicht sichtbar sind.

/** Person mit voller Lebenswelt ({ich}) oder eine Fehlerantwort ({antwort}). */
function personVoll(e) {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return { antwort: e.json(401, h.KEINE_PERSON) }
  if (h.profilVon(ich) === "fitness") return { antwort: e.json(403, { fehler: "Nur für die volle Lebenswelt." }) }
  return { ich }
}

/** Person, für die Hintergrundaufgaben arbeiten (Option person, sonst die einzige mit voller Lebenswelt). */
function hauptperson(app) {
  const h = require(`${__hooks}/hilfen.js`)
  const opt = String(h.optionen().person || "").trim()
  if (opt) return opt
  const einzig = h.einzigePerson(app)
  return einzig ? einzig.id : null
}

/** Kalender der nächsten Tage lesen, einordnen und als Dokument kalender/tage ablegen. */
function kalenderAbgleich(app, besitzer, anzahl) {
  const h = require(`${__hooks}/hilfen.js`)
  const S = require(`${__hooks}/einsatz/simulation.js`)
  const o = h.optionen()
  const id = String(o.kalender_entitaet || "")
  if (!id) return { fehler: "Kein Kalender eingestellt (Option kalender_entitaet)." }
  const jetzt = Date.now()
  const von = S._intern.tagVon(jetzt)
  const start = new Date(Date.parse(von + "T00:00:00Z") - 2 * 3600 * 1000).toISOString()
  const ende = new Date(Date.parse(von + "T00:00:00Z") + (anzahl + 1) * 24 * 3600 * 1000).toISOString()
  const ereignisse = h.ha("/calendars/" + id + "?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(ende), 20)
  if (!Array.isArray(ereignisse)) return { fehler: "Kalender " + id + " nicht lesbar." }
  const tage = require(`${__hooks}/kalender.js`).tage(ereignisse, von, anzahl, o.regelarbeitszeit)
  const daten = { kalender: id, stand: jetzt, tage }
  if (besitzer) require(`${__hooks}/einsatz/dienst.js`).schreibe(app, besitzer, "kalender", "tage", daten)
  return daten
}

/** Garmin-Tageswerte jetzt aus Home Assistant, null wenn Home Assistant nicht antwortet. */
function garminHeute() {
  const h = require(`${__hooks}/hilfen.js`)
  const alle = h.ha("/states", 20)
  return alle ? require(`${__hooks}/garmin.js`).tageswerte(alle, h.optionen().garmin_sensor) : null
}

/** Ruft eine Funktion des Paperless-Moduls für die volle Lebenswelt auf und übersetzt Fehler in eine Antwort. */
function paperless(e, f) {
  const p = personVoll(e)
  if (p.antwort) return p.antwort
  const pl = require(`${__hooks}/paperless.js`)
  if (!pl.eingerichtet()) return e.json(400, { fehler: "Paperless ist nicht eingerichtet: Option paperless_token in der App-Konfiguration setzen." })
  try {
    return f(pl, p.ich)
  } catch (err) {
    return e.json(502, { fehler: String((err && err.message) || err) })
  }
}

module.exports = { personVoll, hauptperson, kalenderAbgleich, garminHeute, paperless }
