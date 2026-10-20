/// <reference path="../pb_data/types.d.ts" />
// Rückfragen zu Paperless-Dokumenten (typ "frage"): abholen und Status setzen. Angelegt werden sie über
// POST /api/lebenswelt/paperless/dokument/{id}/frage (ha_daten.pb.js). Logik in fragen.js.

// Liste, optional nach Status: ?status=offen|beantwortet|verarbeitet
routerAdd("GET", "/api/lebenswelt/fragen", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    return e.json(200, { fragen: require(`${__hooks}/fragen.js`).liste(e.app, p.ich.id, e.request.url.query().get("status")) })
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})

// {status: "verarbeitet"} (oder "offen", "beantwortet"), optional {antwort}
routerAdd("PATCH", "/api/lebenswelt/fragen/{id}", (e) => {
  const p = require(`${__hooks}/ha_daten.js`).personVoll(e)
  if (p.antwort) return p.antwort
  try {
    const frage = require(`${__hooks}/fragen.js`).aendere(e.app, p.ich.id, e.request.pathValue("id"), e.requestInfo().body || {})
    return e.json(200, { ok: true, frage })
  } catch (err) {
    return e.json(err.status || 500, { fehler: String((err && err.message) || err) })
  }
})
