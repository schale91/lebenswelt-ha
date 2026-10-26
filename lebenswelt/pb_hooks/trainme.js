// TrainMe in der Lebenswelt: Der Trainingsplaner TrainMe (eigenes Repository, auch als APK) ersetzt das Kraftbuch.
// Seine Daten liegen je Person in dieser Datenbank, damit die Lebenswelt (eingebettet), die gekoppelte TrainMe-APK und
// Lebenswelt Fit dieselben Daten sehen und die Lebenswelt XP dafür vergibt.
//
// Dokumente: typ "trainme" / schluessel "stamm" (Profil, eigener Plan, Maxima, Tests, Bandfarben) und je Trainingstag
// typ "trainme_tag" / schluessel "JJJJ-MM-TT" (Protokoll und erledigte Einheiten dieses Tages). Jedes trägt die Zeit
// der letzten Änderung auf dem Gerät (zeit, ms). Der Stamm gilt als Ganzes (neuere Zeit gewinnt), Tage werden
// zusammengeführt, damit zwei Geräte am selben Tag nichts verlieren. Die Funktionen bis zur Trennlinie sind rein und
// in Node getestet (test/trainme.test.js).

const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/
const STAMM_MAX = 2 * 1024 * 1024
const TAG_MAX = 256 * 1024
const TAGE_MAX = 400
/** Dokumente des früheren Kraftbuchs, die TrainMe einmal übernimmt. */
const KRAFTBUCH_TYPEN = ["plantag", "trainingslog", "maxwert", "verletzung", "geraet", "bandfarbe", "kraft_verlauf"]

const zeitVon = (x) => (x && Number.isFinite(Number(x.zeit)) ? Number(x.zeit) : 0)

/** Prüft einen hochgeladenen Stamm {zeit, daten}. Gibt ihn bereinigt oder null zurück. */
function stammGueltig(s) {
  if (!s || typeof s !== "object" || !s.daten || typeof s.daten !== "object" || Array.isArray(s.daten)) return null
  const zeit = zeitVon(s)
  if (zeit <= 0) return null
  if (JSON.stringify(s.daten).length > STAMM_MAX) return null
  return { zeit: zeit, daten: s.daten }
}

/** Prüft einen hochgeladenen Tag {tag, zeit, protokoll, erledigt}. */
function tagGueltig(t) {
  if (!t || typeof t !== "object" || !TAG_MUSTER.test(String(t.tag || ""))) return null
  const zeit = zeitVon(t)
  if (zeit <= 0) return null
  const protokoll = Array.isArray(t.protokoll) ? t.protokoll.filter((p) => p && typeof p.uebung === "string" && Array.isArray(p.saetze)) : []
  const erledigt = Array.isArray(t.erledigt) ? t.erledigt.filter((e) => e && typeof e.titel === "string") : []
  const aus = { tag: String(t.tag), zeit: zeit, protokoll: protokoll, erledigt: erledigt }
  if (JSON.stringify(aus).length > TAG_MAX) return null
  return aus
}

/**
 * Zwei Stände desselben Tages zusammenführen. Protokolle sind je Übung (und Datum) eindeutig, erledigte Einheiten je
 * Titel; bei gleichem Schlüssel gewinnt der neuere Stand, alles andere bleibt erhalten.
 */
function tagZusammen(alt, neu) {
  if (!alt) return neu
  const neuer = zeitVon(neu) >= zeitVon(alt)
  const [vorn, hinten] = neuer ? [neu, alt] : [alt, neu]
  const vereine = (a, b, schluessel) => {
    const gesehen = {}
    const aus = []
    for (const x of a.concat(b)) {
      const k = schluessel(x)
      if (gesehen[k]) continue
      gesehen[k] = true
      aus.push(x)
    }
    return aus
  }
  return {
    tag: neu.tag || alt.tag,
    zeit: Math.max(zeitVon(alt), zeitVon(neu)),
    protokoll: vereine(vorn.protokoll || [], hinten.protokoll || [], (p) => p.uebung + "|" + (p.datum || "")),
    erledigt: vereine(vorn.erledigt || [], hinten.erledigt || [], (e) => e.titel + "|" + (e.datum || "")),
  }
}

/** Neuerer Stamm gewinnt. Gibt {behalten: true} zurück, wenn der gespeicherte neuer ist. */
function stammEntscheiden(alt, neu) {
  return alt && zeitVon(alt) > zeitVon(neu) ? { behalten: true } : { behalten: false }
}

/**
 * Gesundheitswerte für TrainMe aus den Garmin-Werten der Lebenswelt: je Tag Schritte, Schlaf, Ruhepuls und HRV, nur
 * Werte über null (eine nicht getragene Uhr liefert Nullen oder nichts). stand: letzte Synchronisierung der Uhr.
 */
function gesundheitAus(heute, heuteTag, tage) {
  const aus = {}
  const feld = (w) => {
    const t = {}
    const n = (x) => (typeof x === "number" && isFinite(x) && x > 0 ? Math.round(x) : undefined)
    if (n(w.schritte) !== undefined) t.schritte = n(w.schritte)
    if (n(w.schlaf_min) !== undefined) t.schlaf_min = n(w.schlaf_min)
    if (n(w.ruhepuls) !== undefined) t.ruhepuls = n(w.ruhepuls)
    if (n(w.hrv_nacht) !== undefined) t.hrv = n(w.hrv_nacht)
    return t
  }
  for (const [tag, w] of Object.entries(tage || {})) {
    if (!TAG_MUSTER.test(tag) || !w) continue
    const t = feld(w)
    if (Object.keys(t).length) aus[tag] = t
  }
  if (heute && TAG_MUSTER.test(heuteTag)) {
    const t = feld(heute)
    if (Object.keys(t).length) aus[heuteTag] = Object.assign({}, aus[heuteTag] || {}, t)
  }
  const stand = heute && typeof heute.synchronisiert === "string" && !isNaN(Date.parse(heute.synchronisiert)) ? heute.synchronisiert : ""
  return { quelle: "garmin", stand: stand, tage: aus }
}

// ---------- ab hier mit PocketBase ----------

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

function schreibe(app, besitzer, typ, schluessel, daten) {
  let r = finde(app, besitzer, typ, schluessel)
  if (!r) {
    r = new Record(app.findCollectionByNameOrId("dokumente"))
    r.set("besitzer", besitzer)
    r.set("typ", typ)
    r.set("schluessel", schluessel)
  }
  r.set("geloescht", false)
  r.set("daten", daten)
  app.save(r)
  return r
}

/** Stand für ein Gerät: Stamm und Tage, mit seit nur Änderungen danach. */
function laden(app, besitzer, seit) {
  const jetzt = new DateTime().string()
  let filter = "besitzer = {:b} && (typ = 'trainme' || typ = 'trainme_tag')"
  const p = { b: besitzer }
  if (seit) {
    filter += " && updated > {:seit}"
    p.seit = seit
  }
  let stamm = null
  const tage = []
  for (const r of app.findRecordsByFilter("dokumente", filter, "updated", 0, 0, p)) {
    const d = lies(r)
    if (r.getString("typ") === "trainme") {
      if (r.getString("schluessel") === "stamm" && !r.getBool("geloescht")) stamm = { zeit: zeitVon(d), daten: d.daten || {} }
    } else tage.push({ tag: r.getString("schluessel"), zeit: zeitVon(d), protokoll: d.protokoll || [], erledigt: d.erledigt || [], geloescht: r.getBool("geloescht") })
  }
  let kraftbuch = false
  try {
    kraftbuch = app.findRecordsByFilter("dokumente", "besitzer = {:b} && (typ = 'plantag' || typ = 'trainingslog') && geloescht = false", "", 1, 0, { b: besitzer }).length > 0
  } catch (_) {
    kraftbuch = false
  }
  return { jetzt: jetzt, stamm: stamm, tage: tage, kraftbuch: kraftbuch }
}

/** Hochgeladenes übernehmen. Antwort mit dem, was der Server anders (neuer oder zusammengeführt) hat. */
function speichern(app, besitzer, body) {
  const zurueck = { stamm: null, tage: [] }
  let gespeichert = 0
  app.runInTransaction((tx) => {
    if (body.stamm !== undefined) {
      const neu = stammGueltig(body.stamm)
      if (!neu) throw new BadRequestError("stamm ungültig.")
      const r = finde(tx, besitzer, "trainme", "stamm")
      const alt = r ? lies(r) : null
      if (stammEntscheiden(alt, neu).behalten) zurueck.stamm = { zeit: zeitVon(alt), daten: alt.daten || {} }
      else {
        schreibe(tx, besitzer, "trainme", "stamm", neu)
        gespeichert++
      }
    }
    const liste = Array.isArray(body.tage) ? body.tage : []
    if (liste.length > TAGE_MAX) throw new BadRequestError("Höchstens " + TAGE_MAX + " Tage auf einmal.")
    for (const roh of liste) {
      const neu = tagGueltig(roh)
      if (!neu) throw new BadRequestError("Tag ungültig: " + String((roh && roh.tag) || ""))
      const r = finde(tx, besitzer, "trainme_tag", neu.tag)
      const alt = r && !r.getBool("geloescht") ? Object.assign({ tag: neu.tag }, lies(r)) : null
      const zusammen = tagZusammen(alt, neu)
      schreibe(tx, besitzer, "trainme_tag", neu.tag, { zeit: zusammen.zeit, protokoll: zusammen.protokoll, erledigt: zusammen.erledigt })
      gespeichert++
      // Hatte der Server mehr oder Neueres als das Gerät, bekommt es den zusammengeführten Tag zurück (Anzahl statt
      // Textvergleich: die Reihenfolge der Felder ist bei hochgeladenen Objekten nicht fest)
      if (alt && (zeitVon(alt) > zeitVon(neu) || zusammen.protokoll.length !== neu.protokoll.length || zusammen.erledigt.length !== neu.erledigt.length)) zurueck.tage.push(zusammen)
    }
  })
  return { ok: true, gespeichert: gespeichert, zurueck: zurueck }
}

/** Dokumente des früheren Kraftbuchs (zur einmaligen Übernahme in TrainMe). */
function kraftbuch(app, besitzer) {
  const h = require(`${__hooks}/hilfen.js`)
  const filter = "besitzer = {:b} && geloescht = false && (" + KRAFTBUCH_TYPEN.map((t) => "typ = '" + t + "'").join(" || ") + ")"
  return app.findRecordsByFilter("dokumente", filter, "created", 0, 0, { b: besitzer }).map(h.alsDokument)
}

/** Garmin-Werte (nur für die Hauptperson, deren Uhr es ist) und das letzte Körpergewicht. */
function gesundheit(app, ich) {
  const x = require(`${__hooks}/ha_daten.js`)
  const S = require(`${__hooks}/einsatz/simulation.js`)
  const haupt = x.hauptperson(app)
  let ergebnis = { quelle: "garmin", stand: "", tage: {} }
  if (haupt && haupt === ich.id) {
    const tage = {}
    for (const r of app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'garmin_tag' && geloescht = false", "-schluessel", 8, 0, { b: ich.id })) tage[r.getString("schluessel")] = lies(r)
    ergebnis = gesundheitAus(x.garminHeute(), S._intern.tagVon(Date.now()), tage)
  }
  let gewicht = null
  const liste = app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'gewicht' && geloescht = false", "-schluessel", 1, 0, { b: ich.id })
  const d = liste.length ? lies(liste[0]) : null
  if (d && Number(d.kg) > 0) gewicht = { kg: Number(d.kg), datum: liste[0].getString("schluessel") }
  return Object.assign(ergebnis, { gewicht: gewicht })
}

module.exports = { TAG_MUSTER, KRAFTBUCH_TYPEN, stammGueltig, tagGueltig, tagZusammen, stammEntscheiden, gesundheitAus, laden, speichern, kraftbuch, gesundheit }
