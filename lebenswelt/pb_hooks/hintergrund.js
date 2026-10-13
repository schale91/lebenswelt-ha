// Hintergrundaufgaben (als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt).
function garminAbgleich() {
  const h = require(`${__hooks}/hilfen.js`)
  const token = $os.getenv("SUPERVISOR_TOKEN")
  if (!token) return { ok: false, grund: "kein SUPERVISOR_TOKEN (homeassistant_api fehlt?)" }
  const person = h.benutzer({ request: { remoteAddr: "127.0.0.1:0", header: { get: () => "" } }, app: $app })
  if (!person) return { ok: false, grund: "keine Person bekannt" }
  const sensor = String(h.optionen().garmin_sensor || "sensor.garmin_connect_last_activities")
  let antwort
  try {
    antwort = $http.send({ url: "http://supervisor/core/api/states/" + sensor, headers: { Authorization: "Bearer " + token }, timeout: 20 })
  } catch (err) {
    console.log("Garmin-Abgleich: Home Assistant nicht erreichbar", err)
    return { ok: false, grund: "Home Assistant nicht erreichbar: " + err }
  }
  if (antwort.statusCode !== 200) return { ok: false, grund: "HTTP " + antwort.statusCode }
  const liste = (antwort.json && antwort.json.attributes && antwort.json.attributes.last_activities) || []
  const sammlung = $app.findCollectionByNameOrId("dokumente")
  let neu = 0
  for (const a of liste) {
    if (!a || !a.activityId) continue
    const schluessel = String(a.activityId)
    try {
      $app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = 'aktivitaet' && schluessel = {:s}", { b: person.id, s: schluessel })
      continue
    } catch (_) {
      // noch nicht vorhanden
    }
    const r = new Record(sammlung)
    r.set("besitzer", person.id)
    r.set("typ", "aktivitaet")
    r.set("schluessel", schluessel)
    r.set("daten", {
      quelle: "garmin",
      art: a.activityType || "",
      titel: a.activityName || "",
      start: a.startTime || "",
      dauer_s: Math.round(a.duration || 0),
      distanz_m: Math.round(a.distance || 0),
      kalorien: a.calories || null,
      puls_schnitt: a.averageHR || null,
      puls_max: a.maxHR || null,
      tempo_ms: a.averageSpeed || null,
      trittfrequenz: a.averageRunningCadenceInStepsPerMinute || null,
      leistung: a.avgPower || null,
      aerob: a.aerobicTrainingEffect || null,
      anaerob: a.anaerobicTrainingEffect || null,
      effekt: a.trainingEffectLabel || "",
      belastung: a.activityTrainingLoad || null,
      saetze: a.totalSets || null,
      intensiv_min: (a.moderateIntensityMinutes || 0) + 2 * (a.vigorousIntensityMinutes || 0),
      hf_zonen_s: [1, 2, 3, 4, 5].map((z) => Math.round(a["hrTimeInZone_" + z] || 0)),
    })
    $app.save(r)
    neu++
  }
  if (neu) console.log("Garmin-Abgleich: " + neu + " neue Aktivitäten")
  return { ok: true, gefunden: liste.length, neu: neu }
}

function anonymisiereVorgaenge() {
  const liste = $app.findRecordsByFilter("dokumente", "typ = 'vorgang' && geloescht = false", "", 0, 0)
  let n = 0
  for (const r of liste) {
    const d = JSON.parse(toString(r.get("daten")) || "{}")
    if (d.status !== "Erledigt" || d.anonymisiert) continue
    d.titel = d.nummer ? String(d.nummer) : "Erledigter Vorgang"
    d.naechster_schritt = ""
    d.warten_auf = ""
    d.anonymisiert = true
    r.set("daten", d)
    $app.save(r)
    n++
  }
  if (n) console.log("Anonymisiert: " + n + " Vorgänge")
}


module.exports = { garminAbgleich, anonymisiereVorgaenge }
