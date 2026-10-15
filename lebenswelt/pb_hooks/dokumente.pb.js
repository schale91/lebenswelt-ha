/// <reference path="../pb_data/types.d.ts" />
// Dokumente der Lebenswelt: lesen, anlegen oder zusammenführen, ändern, löschen, suchen.
// Alle Routen arbeiten nur mit den Dokumenten der fragenden Person.

// Liste, optional nach Typ und nur Änderungen seit einem Zeitpunkt (Wert "jetzt" der letzten Antwort)
routerAdd("GET", "/api/lebenswelt/dokumente", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const q = e.request.url.query()
  const typen = String(q.get("typ") || "").split(",").map((t) => t.trim()).filter((t) => h.TYP_MUSTER.test(t))
  const seit = String(q.get("seit") || "")
  let filter = "besitzer = {:b}"
  const p = { b: ich.id }
  if (typen.length) {
    filter += " && (" + typen.map((_, i) => "typ = {:t" + i + "}").join(" || ") + ")"
    typen.forEach((t, i) => (p["t" + i] = t))
  } else {
    // Einsatzspiel (Stand ändert sich jede Minute, Protokoll wächst) nur über die eigenen Routen bzw. ausdrücklich per typ
    filter += " && typ != 'einsatzwelt' && typ != 'einsatz'"
  }
  if (seit) {
    filter += " && updated > {:seit}"
    p.seit = seit
  } else {
    filter += " && geloescht = false"
  }
  const jetzt = new DateTime().string()
  const liste = e.app.findRecordsByFilter("dokumente", filter, "updated", 0, 0, p)
  return e.json(200, { jetzt: jetzt, dokumente: liste.map(h.alsDokument) })
})

// Anlegen oder zusammenführen, auch mehrere auf einmal: {dokumente:[{id?, typ, schluessel?, daten, ersetzen?}]}
routerAdd("POST", "/api/lebenswelt/dokumente", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const body = e.requestInfo().body || {}
  const liste = Array.isArray(body.dokumente) ? body.dokumente : []
  if (!liste.length || liste.length > 500) return e.json(400, { fehler: "dokumente: 1 bis 500 Einträge." })
  const sammlung = e.app.findCollectionByNameOrId("dokumente")
  const vorgaenge = require(`${__hooks}/vorgaenge.js`)
  const ergebnis = []
  e.app.runInTransaction((tx) => {
    for (const d of liste) {
      const typ = String(d.typ || "")
      if (!h.TYP_MUSTER.test(typ)) throw new BadRequestError("Ungültiger Typ: " + typ)
      if (h.spielDokument(typ)) throw new BadRequestError(h.NUR_LESEN.fehler)
      const schluessel = String(d.schluessel || "").slice(0, 200)
      let r = null
      try {
        if (d.id) r = tx.findFirstRecordByFilter("dokumente", "id = {:id} && besitzer = {:b}", { id: String(d.id), b: ich.id })
        else if (schluessel) r = tx.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = {:t} && schluessel = {:s}", { b: ich.id, t: typ, s: schluessel })
      } catch (_) {
        r = null
      }
      if (r && h.spielDokument(r.getString("typ"))) throw new BadRequestError(h.NUR_LESEN.fehler)
      const neu = d.daten && typeof d.daten === "object" ? d.daten : {}
      let erledigt = false
      if (r) {
        const alt = JSON.parse(toString(r.get("daten")) || "{}")
        const daten = vorgaenge.ergaenzeFrist(typ, alt, d.ersetzen ? neu : h.verschmelze(alt, neu), neu)
        erledigt = vorgaenge.wirdErledigt(typ, alt, daten)
        r.set("daten", daten)
        r.set("geloescht", false)
      } else {
        r = new Record(sammlung)
        r.set("besitzer", ich.id)
        r.set("typ", typ)
        r.set("schluessel", schluessel)
        r.set("daten", vorgaenge.ergaenzeFaelligkeit(typ, vorgaenge.ergaenzeFrist(typ, null, h.verschmelze({}, neu), neu)))
      }
      tx.save(r)
      // Vorgang erledigt: offene Aufgaben und Unteraufgaben mit abschließen
      if (erledigt) vorgaenge.schliesseUnteraufgabenAb(tx, ich.id, r.getString("schluessel"))
      ergebnis.push(h.alsDokument(r))
    }
  })
  // Neue Wünsche zur Freigabe (Samstags-Routine): Push an die Person, die freigeben soll
  const offen = require(`${__hooks}/familie.js`).offeneFreigaben(ergebnis)
  if (offen) {
    require(`${__hooks}/push.js`).sende(e.app, ich.id, {
      titel: "Wünsche zur Freigabe",
      text: offen === 1 ? "Ein Wunsch aus der Fitness-Welt wartet auf dich (Store)." : `${offen} Wünsche aus der Fitness-Welt warten auf dich (Store).`,
      kanal: "allgemein",
      id: "freigabe",
      ha: true,
    })
  }
  return e.json(200, { dokumente: ergebnis })
})

// Ändern: {daten:{feld: wert, "verschachtelt.feld": wert, entfernt: null}}
routerAdd("PATCH", "/api/lebenswelt/dokumente/{id}", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  let r
  try {
    r = e.app.findFirstRecordByFilter("dokumente", "id = {:id} && besitzer = {:b}", { id: e.request.pathValue("id"), b: ich.id })
  } catch (_) {
    return e.json(404, { fehler: "Dokument nicht gefunden." })
  }
  if (h.spielDokument(r.getString("typ"))) return e.json(403, h.NUR_LESEN)
  const body = e.requestInfo().body || {}
  if (!body.daten || typeof body.daten !== "object") return e.json(400, { fehler: "daten muss ein Objekt sein." })
  const vorgaenge = require(`${__hooks}/vorgaenge.js`)
  const alt = JSON.parse(toString(r.get("daten")) || "{}")
  // Neu auf „Warten auf LKA“: Wiedervorlage in zwei Monaten, sofern keine Frist mitkommt
  const daten = vorgaenge.ergaenzeFrist(r.getString("typ"), alt, h.verschmelze(alt, body.daten), body.daten)
  r.set("daten", daten)
  e.app.save(r)
  // Vorgang erledigt: offene Aufgaben und Unteraufgaben mit abschließen (XP bucht die App beim nächsten Abgleich)
  if (vorgaenge.wirdErledigt(r.getString("typ"), alt, daten)) vorgaenge.schliesseUnteraufgabenAb(e.app, ich.id, r.getString("schluessel"))
  return e.json(200, h.alsDokument(r))
})

routerAdd("DELETE", "/api/lebenswelt/dokumente/{id}", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  let r
  try {
    r = e.app.findFirstRecordByFilter("dokumente", "id = {:id} && besitzer = {:b}", { id: e.request.pathValue("id"), b: ich.id })
  } catch (_) {
    return e.json(404, { fehler: "Dokument nicht gefunden." })
  }
  if (h.spielDokument(r.getString("typ"))) return e.json(403, h.NUR_LESEN)
  r.set("geloescht", true)
  e.app.save(r)
  return e.json(200, { ok: true })
})

// Suche im Titel, z. B. für "Ich habe X erledigt": /api/lebenswelt/suche?q=reifen&typ=aufgabe,unteraufgabe&offen=1
routerAdd("GET", "/api/lebenswelt/suche", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const q = e.request.url.query()
  const worte = String(q.get("q") || "").toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  const typen = String(q.get("typ") || "aufgabe,unteraufgabe,vorgang,eingang").split(",").filter((t) => h.TYP_MUSTER.test(t))
  const nurOffen = String(q.get("offen") || "") === "1"
  const p = { b: ich.id }
  const filter = "besitzer = {:b} && geloescht = false && (" + typen.map((_, i) => "typ = {:t" + i + "}").join(" || ") + ")"
  typen.forEach((t, i) => (p["t" + i] = t))
  const liste = e.app.findRecordsByFilter("dokumente", filter, "-updated", 0, 0, p).map(h.alsDokument)
  const treffer = liste
    .filter((d) => !nurOffen || (d.daten.status !== "Erledigt" && d.daten.verarbeitet !== true))
    .map((d) => {
      const text = (String(d.daten.titel || "") + " " + String(d.daten.nummer || "")).toLowerCase()
      return { d: d, punkte: worte.filter((w) => text.indexOf(w) !== -1).length }
    })
    .filter((x) => worte.length === 0 || x.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 20)
    .map((x) => ({ id: x.d.id, typ: x.d.typ, titel: x.d.daten.titel, status: x.d.daten.status, vorgang: x.d.daten.vorgang || null, faellig: x.d.daten.faellig || null }))
  return e.json(200, { treffer: treffer })
})

// Bekannte Personen (für die Einrichtung des Claude-Zugangs)
routerAdd("GET", "/api/lebenswelt/personen", (e) => {
  const liste = e.app.findRecordsByFilter("spielstaende", "benutzer != ''", "", 0, 0)
  return e.json(200, { personen: liste.map((r) => ({ id: r.getString("benutzer"), name: r.getString("name") })) })
})

// Garmin-Abgleich sofort auslösen (sonst alle 15 Minuten)
routerAdd("POST", "/api/lebenswelt/garmin", (e) => {
  return e.json(200, require(`${__hooks}/hintergrund.js`).garminAbgleich() || { ok: false })
})

// Update der App per Knopf: Stand ansehen, sofort nachsehen, bereitliegende Version installieren
routerAdd("GET", "/api/lebenswelt/app-paket", (e) => {
  return e.json(200, require(`${__hooks}/app_paket.js`).zustand())
})
routerAdd("POST", "/api/lebenswelt/app-paket", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  // Fitness-Welt (Papa) spielt keine Updates ein, das bleibt bei der vollen Lebenswelt
  if (h.profilVon(ich) === "fitness") return e.json(403, { fehler: "Updates spielt nur die volle Lebenswelt ein." })
  return e.json(200, require(`${__hooks}/app_paket.js`).pruefe())
})
routerAdd("POST", "/api/lebenswelt/app-paket/installieren", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  // Fitness-Welt (Papa) spielt keine Updates ein, das bleibt bei der vollen Lebenswelt
  if (h.profilVon(ich) === "fitness") return e.json(403, { fehler: "Updates spielt nur die volle Lebenswelt ein." })
  const z = require(`${__hooks}/app_paket.js`).installiere()
  return e.json(z.fehler ? 500 : 200, z)
})

// Push-Nachrichten an die Android-App: Gerät anmelden, Stand, Test
routerAdd("POST", "/api/lebenswelt/push/geraet", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  const body = e.requestInfo().body || {}
  try {
    return e.json(200, require(`${__hooks}/push.js`).melde(e.app, ich.id, String(body.token || ""), body.name))
  } catch (err) {
    return e.json(400, { fehler: String(err && err.message ? err.message : err) })
  }
})
routerAdd("GET", "/api/lebenswelt/push", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  const p = require(`${__hooks}/push.js`)
  return e.json(200, { eingerichtet: p.eingerichtet(), geraete: p.anzahl(e.app, ich.id) })
})
routerAdd("POST", "/api/lebenswelt/push/test", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  return e.json(200, require(`${__hooks}/push.js`).sende(e.app, ich.id, { titel: "Lebenswelt", text: "Push-Nachrichten funktionieren.", kanal: "allgemein", id: "test", ha: true }))
})
