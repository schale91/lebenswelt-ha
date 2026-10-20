/// <reference path="../pb_data/types.d.ts" />
// Daten aus Home Assistant für die Lebenswelt und für Claude: Garmin-Tageswerte, Kalender (Arbeit, frei, Termine) und
// Paperless-ngx (Posteingang, Suche, Bearbeiten). Konzept: docs/integrationen/KONZEPT.md, Abschnitte 5 bis 7.
// Nur für die volle Lebenswelt, nicht für die Fitness-Welt. Helfer in ha_daten.js.

// ---------- Garmin ----------

routerAdd("GET", "/api/lebenswelt/garmin/heute", (e) => {
  const x = require(`${__hooks}/ha_daten.js`)
  const p = x.personVoll(e)
  if (p.antwort) return p.antwort
  const werte = x.garminHeute()
  if (!werte) return e.json(503, { fehler: "Home Assistant nicht erreichbar." })
  // Vorschau: so viele XP gäbe es, wenn der Tag jetzt endete (gebucht wird um 23:55 Uhr)
  return e.json(200, { jetzt: Date.now(), werte, xp_vorschau: require(`${__hooks}/garmin.js`).xpAus(werte) })
})

// XP der Garmin-Tage abholen (die App bucht sie, wie bei der Müllabfuhr). Antwort {xp, tage}
routerAdd("POST", "/api/lebenswelt/garmin/abholen", (e) => {
  const x = require(`${__hooks}/ha_daten.js`)
  const p = x.personVoll(e)
  if (p.antwort) return p.antwort
  return e.json(200, Object.assign({ ok: true }, x.garminAbholen(e.app, p.ich.id)))
})

// Um 23:55 Ortszeit den Tag als Dokument garmin_tag (Schlüssel = Datum) ablegen, für Verläufe in der App
cronAdd("garmin_tag", "55 * * * *", () => {
  try {
    const S = require(`${__hooks}/einsatz/simulation.js`)
    const x = require(`${__hooks}/ha_daten.js`)
    const jetzt = Date.now()
    if (S.ortszeit(jetzt).stunde !== 23) return
    const person = x.hauptperson($app)
    const werte = person ? x.garminHeute() : null
    if (werte) x.garminTagSpeichern($app, person, S._intern.tagVon(jetzt), werte)
  } catch (err) {
    console.log("Garmin-Tag fehlgeschlagen", err)
  }
})

// ---------- Kalender ----------

// Je Tag Arbeit, Homeoffice, Dienst, frei, Urlaub, Feiertag, Wochenende mit Terminen. ?tage=14 (1 bis 31)
routerAdd("GET", "/api/lebenswelt/kalender", (e) => {
  const x = require(`${__hooks}/ha_daten.js`)
  const p = x.personVoll(e)
  if (p.antwort) return p.antwort
  const anzahl = Math.max(1, Math.min(31, Math.floor(Number(e.request.url.query().get("tage")) || 14)))
  const k = x.kalenderAbgleich(e.app, p.ich.id, anzahl)
  return e.json(k.fehler ? 400 : 200, k)
})

cronAdd("kalender", "13 * * * *", () => {
  try {
    const x = require(`${__hooks}/ha_daten.js`)
    const person = x.hauptperson($app)
    if (person) x.kalenderAbgleich($app, person, 14)
  } catch (err) {
    console.log("Kalender fehlgeschlagen", err)
  }
})

// ---------- Paperless-ngx ----------

routerAdd("GET", "/api/lebenswelt/paperless", (e) => {
  const x = require(`${__hooks}/ha_daten.js`)
  const p = x.personVoll(e)
  if (p.antwort) return p.antwort
  const pl = require(`${__hooks}/paperless.js`)
  return e.json(200, { eingerichtet: pl.eingerichtet(), url: pl.konfig().url, letzter_abgleich: $app.store().get("paperless_abgleich") || null })
})

// Volltextsuche: ?q=…&posteingang=1&seite=1
routerAdd("GET", "/api/lebenswelt/paperless/suche", (e) =>
  require(`${__hooks}/ha_daten.js`).paperless(e, (pl) => {
    const q = e.request.url.query()
    return e.json(200, pl.suche(q.get("q") || "", q.get("posteingang") === "1", q.get("seite")))
  }),
)

routerAdd("GET", "/api/lebenswelt/paperless/dokument/{id}", (e) =>
  require(`${__hooks}/ha_daten.js`).paperless(e, (pl) => {
    const d = pl.dokument(e.request.pathValue("id"))
    return d ? e.json(200, d) : e.json(404, { fehler: "Dokument nicht gefunden." })
  }),
)

// {titel, korrespondent, dokumenttyp, tags_dazu, tags_weg, datum, aus_posteingang, neu_anlegen}
routerAdd("PATCH", "/api/lebenswelt/paperless/dokument/{id}", (e) =>
  require(`${__hooks}/ha_daten.js`).paperless(e, (pl) => e.json(200, { ok: true, dokument: pl.aendere(e.request.pathValue("id"), e.requestInfo().body || {}) })),
)

routerAdd("POST", "/api/lebenswelt/paperless/dokument/{id}/notiz", (e) =>
  require(`${__hooks}/ha_daten.js`).paperless(e, (pl) => {
    const text = String((e.requestInfo().body || {}).text || "").trim()
    if (!text) return e.json(400, { fehler: "text fehlt." })
    pl.notiz(e.request.pathValue("id"), text)
    return e.json(200, { ok: true })
  }),
)

// {titel, faellig, sphaere, kontext}: Aufgabe in der Lebenswelt mit Verweis auf das Dokument
routerAdd("POST", "/api/lebenswelt/paperless/dokument/{id}/aufgabe", (e) =>
  require(`${__hooks}/ha_daten.js`).paperless(e, (pl, ich) => e.json(200, { ok: true, aufgabe: pl.aufgabe(e.app, ich.id, e.request.pathValue("id"), e.requestInfo().body || {}) })),
)

// {text}: Rückfrage zu einem Dokument (typ "frage"), erscheint in der App im Posteingang mit Antwortfeld.
// Beantwortete holt GET /api/lebenswelt/fragen?status=beantwortet ab (fragen.pb.js).
routerAdd("POST", "/api/lebenswelt/paperless/dokument/{id}/frage", (e) =>
  require(`${__hooks}/ha_daten.js`).paperless(e, (pl, ich) => {
    const fr = require(`${__hooks}/fragen.js`)
    const text = String((e.requestInfo().body || {}).text || "").trim()
    if (!text) return e.json(400, { fehler: "text fehlt." })
    if (text.length > fr.TEXT_MAX) return e.json(400, { fehler: "text ist zu lang (höchstens " + fr.TEXT_MAX + " Zeichen)." })
    const dok = pl.dokument(e.request.pathValue("id"))
    if (!dok) return e.json(404, { fehler: "Dokument nicht gefunden." })
    const frage = fr.lege(e.app, ich.id, dok, text)
    require(`${__hooks}/push.js`).sende(e.app, ich.id, {
      titel: "Rückfrage zu einem Dokument",
      text: (dok.titel || "Dokument " + dok.id) + ": Claude hat eine Frage. Antwort im Posteingang.",
      kanal: "allgemein",
      id: "frage",
      ha: true,
    })
    return e.json(200, { ok: true, frage })
  }),
)

routerAdd("POST", "/api/lebenswelt/paperless/abgleich", (e) => require(`${__hooks}/ha_daten.js`).paperless(e, (pl, ich) => e.json(200, pl.abgleich(e.app, ich.id))))

// Posteingang alle 15 Minuten in den Eingang der Lebenswelt übernehmen
cronAdd("paperless", "*/15 * * * *", () => {
  try {
    const pl = require(`${__hooks}/paperless.js`)
    if (!pl.eingerichtet()) return
    const person = require(`${__hooks}/ha_daten.js`).hauptperson($app)
    if (person) pl.abgleich($app, person)
  } catch (err) {
    console.log("Paperless-Abgleich fehlgeschlagen:", String((err && err.message) || err))
  }
})
