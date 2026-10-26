/// <reference path="../pb_data/types.d.ts" />
// TrainMe in der Lebenswelt (siehe trainme.js): Stand laden und speichern, einmalige Übernahme aus dem Kraftbuch und
// Gesundheitswerte. Erreichbar über den Ingress (eingebettet in die Lebenswelt), aus Lebenswelt Fit und mit dem
// Geräteschlüssel der gekoppelten TrainMe-APK über die Weiterleitung lebenswelt_fit.

// Stand: Stamm und Tage, mit ?seit= (Wert "jetzt" der letzten Antwort) nur Änderungen
routerAdd("GET", "/api/lebenswelt/trainme", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const seit = String(e.request.url.query().get("seit") || "")
  return e.json(200, require(`${__hooks}/trainme.js`).laden(e.app, v.ich.id, seit))
})

// Speichern: {stamm?: {zeit, daten}, tage?: [{tag, zeit, protokoll, erledigt}]}. Antwort {ok, gespeichert, zurueck}:
// zurueck.stamm ist der neuere Stamm des Servers (das Gerät übernimmt ihn), zurueck.tage zusammengeführte Tage.
routerAdd("PUT", "/api/lebenswelt/trainme", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const body = e.requestInfo().body || {}
  try {
    return e.json(200, require(`${__hooks}/trainme.js`).speichern(e.app, v.ich.id, body))
  } catch (err) {
    return e.json(400, { fehler: String((err && err.message) || err) })
  }
})

// Dokumente des früheren Kraftbuchs (Plan, Protokoll, Maxima, Verletzungen, Geräte, Bandfarben, 1RM-Verlauf)
routerAdd("GET", "/api/lebenswelt/trainme/kraftbuch", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  return e.json(200, { dokumente: require(`${__hooks}/trainme.js`).kraftbuch(e.app, v.ich.id) })
})

// Garmin-Werte der letzten Tage (nur die Person mit der Uhr) und das letzte Körpergewicht
routerAdd("GET", "/api/lebenswelt/trainme/gesundheit", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  try {
    return e.json(200, require(`${__hooks}/trainme.js`).gesundheit(e.app, v.ich))
  } catch (err) {
    return e.json(200, { quelle: "garmin", stand: "", tage: {}, gewicht: null, fehler: String(err) })
  }
})
