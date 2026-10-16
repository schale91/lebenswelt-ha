/// <reference path="../pb_data/types.d.ts" />
// Einsatzspiel: Feuerwehr und Polizei auf der Hauptkarte. Die Simulation läuft hier im Hintergrund
// (Minutentakt), das Frontend holt den Stand und zeigt ihn an. Kein KI-Zugriff, kein Guthaben.

routerAdd("GET", "/api/lebenswelt/einsatz/regelwerk", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  // mit der privaten Karte der Person, falls die App eine hinterlegt hat
  return e.json(200, require(`${__hooks}/einsatz/dienst.js`).regelwerkFuer(e.app, ich.id))
})

routerAdd("GET", "/api/lebenswelt/einsatz/stand", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const jetzt = Date.now()
  const a = d.aktuell(e.app, ich.id, jetzt)
  return e.json(200, { jetzt: jetzt, version: d.R.VERSION, wetter: a.wetter, warnungen: a.warnungen, stand: a.stand })
})

// Abgeschlossene Einsätze (Protokoll), neueste zuerst. ?seit=<ms> liefert nur neuere.
routerAdd("GET", "/api/lebenswelt/einsatz/protokoll", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const seit = Number(e.request.url.query().get("seit") || 0)
  const liste = e.app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'einsatz'", "-created", 200, 0, { b: ich.id })
  const einsaetze = liste.map(d.lies).filter((x) => (x.ende || x.meldung) > seit)
  return e.json(200, { einsaetze: einsaetze })
})

// Kaufen: Stand fortschreiben, Kauf prüfen, Münzen im Spielstand abbuchen und im Kaufbuch vermerken.
routerAdd("POST", "/api/lebenswelt/einsatz/kaufen", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const kb = require(`${__hooks}/einsatz/kaufbuch.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const auftrag = e.requestInfo().body || {}
  const jetzt = Date.now()
  const a = d.aktuell(e.app, ich.id, jetzt)
  const k = d.S.kaufe(a.stand, auftrag, jetzt, d.regelwerkFuer(e.app, ich.id))
  if (k.fehler) return e.json(400, { fehler: k.fehler })

  let r = h.spielstandVon(e.app, ich.id)
  const daten = r ? JSON.parse(toString(r.get("daten")) || "null") : null
  // Erst nachziehen, was dieser Spielstand noch nicht kennt, dann den neuen Kauf buchen
  const vorher = kb.abgleich(daten, a.stand.ausgaben).daten
  const b = kb.buche(vorher, k.preis, jetzt, (auftrag.art || "") + ":" + (auftrag.id || ""))
  if (b.fehler) return e.json(409, { fehler: b.fehler })
  const stand = k.stand
  stand.ausgaben.push(b.ausgabe)
  d.speichere(e.app, ich.id, stand)
  if (!r) {
    r = new Record(e.app.findCollectionByNameOrId("spielstaende"))
    r.set("benutzer", ich.id)
    r.set("name", ich.anzeige || ich.name)
  }
  r.set("zeit", jetzt)
  r.set("daten", b.daten)
  e.app.save(r)
  return e.json(200, { ok: true, preis: k.preis, muenzen: b.daten.state.muenzen, zeit: jetzt, bekannt: jetzt, stand: stand })
})

routerAdd("POST", "/api/lebenswelt/einsatz/einraeumen", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const a = d.aktuell(e.app, ich.id, Date.now())
  const r = d.S.einraeumen(a.stand, e.requestInfo().body || {}, d.regelwerkFuer(e.app, ich.id))
  if (r.fehler) return e.json(400, { fehler: r.fehler })
  d.speichere(e.app, ich.id, r.stand)
  return e.json(200, { ok: true, stand: r.stand })
})

// Name und Anrede einer Einsatzkraft (frei wählbar; echte Namen bleiben in dieser Datenbank)
routerAdd("POST", "/api/lebenswelt/einsatz/personal", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const body = e.requestInfo().body || {}
  const a = d.aktuell(e.app, ich.id, Date.now())
  const p = a.stand.personal.find((x) => x.id === body.ziel)
  if (!p) return e.json(404, { fehler: "Unbekannte Person." })
  // Verabschieden: Person zieht weg, leeres Haus wird abgerissen, ein frischer Bauplatzkauf erstattet
  if (body.verabschieden) {
    const jetzt = Date.now()
    const v = d.S.verabschiede(a.stand, p.id, jetzt)
    if (v.fehler) return e.json(400, { fehler: v.fehler })
    if (v.erstattung > 0) {
      const kb = require(`${__hooks}/einsatz/kaufbuch.js`)
      let r = h.spielstandVon(e.app, ich.id)
      const daten = r ? JSON.parse(toString(r.get("daten")) || "null") : null
      const vorher = kb.abgleich(daten, a.stand.ausgaben).daten
      // Negativer Betrag: das Kaufbuch schreibt die Münzen wieder gut
      const b = kb.buche(vorher, -v.erstattung, jetzt, "erstattung:bauplatz:" + v.bauplatz)
      v.stand.ausgaben.push(b.ausgabe)
      if (r) {
        r.set("zeit", jetzt)
        r.set("daten", b.daten)
        e.app.save(r)
      }
    }
    d.speichere(e.app, ich.id, v.stand)
    return e.json(200, { ok: true, erstattung: v.erstattung, text: v.text, stand: v.stand })
  }
  if (body.name !== undefined) p.name = String(body.name).slice(0, 40)
  if (body.anrede !== undefined) p.anrede = String(body.anrede).slice(0, 30)
  d.speichere(e.app, ich.id, a.stand)
  return e.json(200, { ok: true, person: p })
})

// Einsatz sofort auslösen (zum Ausprobieren); ohne "art" eine zufällige gekaufte Einsatzart
routerAdd("POST", "/api/lebenswelt/einsatz/sofort", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const body = e.requestInfo().body || {}
  const jetzt = Date.now()
  const a = d.aktuell(e.app, ich.id, jetzt)
  const r = d.S.sofort(a.stand, body.art ? String(body.art) : null, jetzt, () => a.wetter, d.regelwerkFuer(e.app, ich.id))
  if (r.fehler) return e.json(400, { fehler: r.fehler })
  d.speichere(e.app, ich.id, r.stand)
  return e.json(200, { ok: true, einsatz: r.einsatz, stand: r.stand })
})

// Minutentakt: Einsätze entstehen und verfallen auch, wenn die App zu ist
cronAdd("einsatz", "* * * * *", () => {
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const jetzt = Date.now()
  for (const b of d.besitzerMitWelt($app)) {
    try {
      d.aktuell($app, b, jetzt)
    } catch (err) {
      console.log("Einsatzspiel: Fortschreiben fehlgeschlagen", err)
    }
  }
})

cronAdd("einsatz_wetter", "*/10 * * * *", () => {
  try {
    require(`${__hooks}/einsatz/dienst.js`).wetterAbgleich($app)
  } catch (err) {
    console.log("Einsatzspiel: Wetter fehlgeschlagen", err)
  }
})
