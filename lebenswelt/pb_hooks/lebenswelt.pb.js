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
  return e.json(200, ich)
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
  if (!r) {
    r = new Record(e.app.findCollectionByNameOrId("spielstaende"))
    r.set("benutzer", ich.id)
  }
  r.set("name", ich.anzeige || ich.name)
  r.set("zeit", zeit)
  r.set("daten", body.daten)
  e.app.save(r)
  return e.json(200, { zeit: zeit })
})
