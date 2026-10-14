/// <reference path="../pb_data/types.d.ts" />
// Schnittstelle der Lebenswelt. Die Identität kommt aus dem Ingress von Home Assistant
// (X-Remote-User-Id), deshalb gibt es hier keine eigene Anmeldung.

routerUse((e) => {
  const h = require(`${__hooks}/hilfen.js`)
  if (!h.erlaubt(e)) return e.json(403, { fehler: "Nur über Home Assistant erreichbar." })
  return e.next()
})

routerAdd("GET", "/api/lebenswelt/ich", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  return e.json(200, Object.assign({}, ich, { profil: h.profilVon(ich) }))
})

// Familie in Bewegung: Bewegung der letzten 14 Tage aller Personen, die etwas eingetragen haben (Fitness-Welt).
// Daraus zeigt jede Karte den Buggy, wenn Papa Nilo schiebt, und Alex eine kleine Wochenübersicht.
routerAdd("GET", "/api/lebenswelt/familie", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const f = require(`${__hooks}/familie.js`)
  if (!h.benutzer(e)) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  const ab = f.tagVor(Date.now(), 14)
  const personen = []
  for (const r of e.app.findRecordsByFilter("spielstaende", "benutzer != ''", "", 0, 0)) {
    let daten = null
    try {
      daten = JSON.parse(toString(r.get("daten")) || "null")
    } catch (_) {
      continue
    }
    const bewegungen = f.bewegungAus(daten, ab)
    if (!bewegungen.length) continue
    personen.push({ id: r.getString("benutzer"), name: r.getString("name") || "Opa", bewegungen: bewegungen, schrittziel: f.schrittzielAus(daten) })
  }
  return e.json(200, { personen: personen })
})

routerAdd("GET", "/api/lebenswelt/spielstand", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  const r = h.spielstandVon(e.app, ich.id)
  if (!r) return e.json(200, { zeit: 0, daten: null })
  return e.json(200, { zeit: r.getInt("zeit"), daten: r.get("daten") })
})

// Speichert den Spielstand, wenn er neuer ist als der gespeicherte. Sonst 409 mit dem gespeicherten Stand.
routerAdd("PUT", "/api/lebenswelt/spielstand", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  const body = e.requestInfo().body || {}
  const zeit = Number(body.zeit)
  if (!Number.isFinite(zeit) || zeit <= 0) return e.json(400, { fehler: "zeit fehlt oder ist ungültig." })
  if (body.daten === null || typeof body.daten !== "object") return e.json(400, { fehler: "daten muss ein Objekt sein." })

  let r = h.spielstandVon(e.app, ich.id)
  if (r && r.getInt("zeit") > zeit) {
    return e.json(409, { zeit: r.getInt("zeit"), daten: r.get("daten") })
  }
  // Kaufbuch des Einsatzspiels: Käufe, die dieser Stand noch nicht kennt, nachträglich abziehen
  let daten = body.daten
  let speicherZeit = zeit
  let nachgezogen = 0
  try {
    const welt = e.app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = 'einsatzwelt' && schluessel = 'stand'", { b: ich.id })
    const ausgaben = JSON.parse(toString(welt.get("daten")) || "{}").ausgaben || []
    const ab = require(`${__hooks}/einsatz/kaufbuch.js`).abgleich(daten, ausgaben)
    daten = ab.daten
    nachgezogen = ab.nachgezogen
    if (nachgezogen) speicherZeit = Math.max(zeit, Date.now())
  } catch (_) {
    // noch keine Einsatzwelt
  }
  if (!r) {
    r = new Record(e.app.findCollectionByNameOrId("spielstaende"))
    r.set("benutzer", ich.id)
  }
  r.set("name", ich.anzeige || ich.name)
  r.set("zeit", speicherZeit)
  r.set("daten", daten)
  e.app.save(r)
  // Berichtigter Stand: das Frontend übernimmt ihn wie bei einem Konflikt
  if (nachgezogen) return e.json(409, { zeit: speicherZeit, daten: daten, nachgezogen: nachgezogen })
  return e.json(200, { zeit: zeit })
})
