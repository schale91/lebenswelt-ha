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
  // Stand der Wünsche aus der Fitness-Welt (Freigaben liegen bei der Person mit voller Lebenswelt)
  const wuensche = e.app.findRecordsByFilter("dokumente", "typ = 'freigabe' && geloescht = false", "-created", 50, 0).map((d) => f.wunschFuerFamilie(h.alsDokument(d)))
  return e.json(200, { personen: personen, wuensche: wuensche })
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
  // Fitness-Welt: neue Spaziergänge mit Nilo der Familie per Push melden (der Buggy ist eine Stunde auf der Karte)
  const f = require(`${__hooks}/familie.js`)
  const profil = h.profilVon(ich)
  let alt = null
  try {
    alt = r ? JSON.parse(toString(r.get("daten")) || "null") : null
  } catch (_) {
    alt = null
  }
  const nilo = profil === "fitness" ? f.neueNilo(alt, daten, Date.now()) : []
  if (!r) {
    r = new Record(e.app.findCollectionByNameOrId("spielstaende"))
    r.set("benutzer", ich.id)
  }
  r.set("name", ich.anzeige || ich.name)
  r.set("profil", profil)
  r.set("zeit", speicherZeit)
  r.set("daten", daten)
  e.app.save(r)
  if (nilo.length) {
    const wer = String(ich.anzeige || ich.name || "Opa").split(" ")[0]
    const p = require(`${__hooks}/push.js`)
    for (const andere of e.app.findRecordsByFilter("spielstaende", "benutzer != {:b}", "", 0, 0, { b: ich.id })) {
      p.sende(e.app, andere.getString("benutzer"), { titel: `${wer} schiebt Nilo`, text: "Eine Stunde lang mit dem Buggy auf der Karte unterwegs.", kanal: "allgemein", id: "nilo-" + nilo[0].id, ha: true })
    }
  }
  // Berichtigter Stand: das Frontend übernimmt ihn wie bei einem Konflikt
  if (nachgezogen) return e.json(409, { zeit: speicherZeit, daten: daten, nachgezogen: nachgezogen })
  return e.json(200, { zeit: zeit })
})

// Schiffsverkehr auf der Elbe (AIS, siehe ais/ais.py): aktuelle Schiffe mit Lage relativ zum Zuhause in Metern
routerAdd("GET", "/api/lebenswelt/schiffe", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  if (!h.benutzer(e)) return e.json(401, { fehler: "Keine Home-Assistant-Person übermittelt." })
  let stand
  try {
    const roh = $os.readFile($os.getenv("LEBENSWELT_AIS") || "/data/ais.json")
    stand = JSON.parse(typeof roh === "string" ? roh : toString(roh))
  } catch (_) {
    return e.json(200, { eingerichtet: false, fehler: "", schiffe: [] })
  }
  // Steht die Datei länger still, ist der Empfang weg (ais.py schreibt auch ohne Verkehr alle 10 Sekunden)
  const alt = Date.now() - Number(stand.zeit || 0)
  if (stand.eingerichtet && !stand.fehler && alt > 15 * 60000) stand.fehler = "Seit " + Math.round(alt / 60000) + " Minuten keine Schiffsdaten."
  return e.json(200, { eingerichtet: !!stand.eingerichtet, fehler: String(stand.fehler || ""), zeit: Number(stand.zeit || 0), schiffe: Array.isArray(stand.schiffe) ? stand.schiffe : [] })
})
