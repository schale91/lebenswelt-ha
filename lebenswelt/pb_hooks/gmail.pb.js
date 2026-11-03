/// <reference path="../pb_data/types.d.ts" />
// Gmail im Posteingang der Lebenswelt: Routen für die Claude-Routine (anlegen, abholen, verarbeitet setzen) und für
// die App (entscheiden, XP abholen). Nur für die volle Lebenswelt. Logik und Prüfungen in gmail.js.

const gmailAntwort = (e, f) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    return f(require(`${__hooks}/gmail.js`), p.ich.id)
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
}

// Liste, optional nach Status: ?status=offen|entschieden|verarbeitet
routerAdd("GET", "/api/lebenswelt/gmail", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    return e.json(200, { mails: require(`${__hooks}/gmail.js`).liste(e.app, p.ich.id, e.request.url.query().get("status")) })
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})

// Routine: {mails: [{thread_id, titel, absender, datum, auszug, link, kategorie_vorschlag, optionen}]}
routerAdd("POST", "/api/lebenswelt/gmail/eingang", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    const body = e.requestInfo().body || {}
    return e.json(200, Object.assign({ ok: true }, require(`${__hooks}/gmail.js`).anlegen(e.app, p.ich.id, body.mails)))
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})

// App: {auswahl?, eigene_eingabe?}
routerAdd("POST", "/api/lebenswelt/gmail/{id}/entscheidung", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    const mail = require(`${__hooks}/gmail.js`).entscheiden(e.app, p.ich.id, e.request.pathValue("id"), e.requestInfo().body || {})
    return e.json(200, { ok: true, mail })
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})

// Routine: {status: "verarbeitet", ergebnis?} oder {status: "offen", rueckfrage, optionen?}
routerAdd("PATCH", "/api/lebenswelt/gmail/{id}", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    const mail = require(`${__hooks}/gmail.js`).aendern(e.app, p.ich.id, e.request.pathValue("id"), e.requestInfo().body || {})
    return e.json(200, { ok: true, mail })
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})

// App: XP der Entscheidungen abholen (die App bucht sie). Antwort {xp, skill, eintraege}
routerAdd("POST", "/api/lebenswelt/gmail/abholen", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    return e.json(200, Object.assign({ ok: true }, require(`${__hooks}/gmail.js`).abholen(e.app, p.ich.id)))
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})
