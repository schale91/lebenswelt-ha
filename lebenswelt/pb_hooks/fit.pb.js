/// <reference path="../pb_data/types.d.ts" />
// Lebenswelt Fit auf Papas Handy: läuft ohne Netz, gleicht ab, sobald es Netz hat. Erreicht diese Routen über die
// Weiterleitung lebenswelt_fit in Home Assistant (/api/lebenswelt_fit/… → /api/lebenswelt/…) mit Geräteschlüssel
// (geraete.js). Das Einsatzspiel rechnet auf dem Handy mit demselben Code wie der Server (Einsatz-Paket); der Server
// hebt den Stand als Sicherung auf (Dokument einsatzwelt/stand_geraet) und rechnet für diese Person nicht mehr mit.

// ---------- Koppeln (Alex' Lebenswelt) ----------

// Personen mit Fitness-Welt und gekoppelte Geräte
routerAdd("GET", "/api/lebenswelt/geraete", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurVoll(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const g = require(`${__hooks}/geraete.js`)
  // ich: die volle Lebenswelt selbst, koppelbar nur für TrainMe
  return e.json(200, { personen: g.fitnessPersonen(e.app), ich: { id: v.ich.id, name: v.ich.anzeige || v.ich.name || "Ich" }, geraete: g.geraete(e.app) })
})

// Kopplungscode für eine Person erzeugen: {person, ziel?: "fit" | "trainme"}. Antwort mit Code und Gültigkeit; die
// App zeigt ihn als QR-Code.
routerAdd("POST", "/api/lebenswelt/geraete/kopplung", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurVoll(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const body = e.requestInfo().body || {}
  const k = require(`${__hooks}/geraete.js`).neueKopplung(e.app, String(body.person || ""), body.ziel, v.ich)
  if (k.fehler) return e.json(400, k)
  return e.json(200, k)
})

routerAdd("DELETE", "/api/lebenswelt/geraete/{id}", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurVoll(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const ok = require(`${__hooks}/geraete.js`).entkoppeln(e.app, e.request.pathValue("id"))
  return ok ? e.json(200, { ok: true }) : e.json(404, { fehler: "Gerät nicht gefunden." })
})

// ---------- Lebenswelt Fit ----------

// Code gegen Geräteschlüssel tauschen: {code, name, ziel?}. Ohne Anmeldung erreichbar (siehe routerUse in
// lebenswelt.pb.js). Auch die TrainMe-APK koppelt hier (ziel "trainme").
routerAdd("POST", "/api/lebenswelt/fit/koppeln", (e) => {
  const g = require(`${__hooks}/geraete.js`)
  const body = e.requestInfo().body || {}
  const k = g.koppeln(e.app, body.code, body.name, body.ziel ? String(body.ziel) : "")
  if (k.fehler) return e.json(k.status || 400, { fehler: k.fehler })
  return e.json(200, { schluessel: k.schluessel, person: k.person, name: k.name, ziel: k.ziel, paket: g.paketPfad() })
})

// Umwelt fürs Handy: Wetter der Karte, Umwelt der Einsatzwelt (Warnungen, Pegel, Abfuhr), Ordner der Web-App
routerAdd("GET", "/api/lebenswelt/fit/umwelt", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const h = require(`${__hooks}/hilfen.js`)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const w = h.ha("/states/" + String(h.optionen().wetter_entitaet || "weather.forecast_home"))
  const u = d.umweltFuer(e.app, v.ich.id)
  return e.json(200, {
    jetzt: Date.now(),
    name: v.ich.anzeige || v.ich.name,
    profil: h.profilVon(v.ich),
    wetter: w ? { zustand: String(w.state || ""), temperatur: Number(w.attributes && w.attributes.temperature) } : null,
    einsatz: { warnungen: u.warnungen, wetter: u.wetter, pegel: u.pegel, abfall: u.abfall },
    paket: require(`${__hooks}/geraete.js`).paketPfad(),
  })
})

// Code der Einsatzwelt (dieselben Dateien wie auf dem Server). ?version= spart die Übertragung, wenn sie gleich ist.
routerAdd("GET", "/api/lebenswelt/fit/einsatzpaket", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const speicher = $app.store()
  let paket = speicher.get("einsatzpaket")
  if (!paket) {
    const module = {}
    for (const n of require(`${__hooks}/geraete.js`).EINSATZ_MODULE) {
      const roh = $os.readFile(`${__hooks}/einsatz/${n}`)
      module[n] = typeof roh === "string" ? roh : toString(roh)
    }
    paket = { version: $security.sha256(Object.keys(module).map((n) => module[n]).join("\n")).slice(0, 16), module: module }
    speicher.set("einsatzpaket", paket)
  }
  if (e.request.url.query().get("version") === paket.version) return e.json(200, { version: paket.version })
  return e.json(200, paket)
})

// Übernahme aufs Handy: gesicherter Stand vom Handy oder (beim ersten Mal) die bisherige Welt vom Server, bis jetzt
// fortgeschrieben. Danach rechnet der Server für diese Person nicht mehr. Dazu Protokoll und private Karte.
routerAdd("GET", "/api/lebenswelt/fit/einsatz", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const id = v.ich.id
  let stand = null
  const sicherung = d.finde(e.app, id, "einsatzwelt", "stand_geraet")
  if (sicherung) stand = d.lies(sicherung)
  else if (d.finde(e.app, id, "einsatzwelt", "stand")) {
    stand = d.aktuell(e.app, id, Date.now()).stand
    d.schreibe(e.app, id, "einsatzwelt", "stand_geraet", stand)
    e.app.delete(d.finde(e.app, id, "einsatzwelt", "stand"))
  }
  const karte = d.finde(e.app, id, "karte", "elbe")
  const protokoll = e.app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'einsatz'", "-created", 200, 0, { b: id }).map(d.lies)
  return e.json(200, { stand: stand, protokoll: protokoll, karte: karte && !karte.getBool("geloescht") ? d.lies(karte) : null })
})

// Sicherung vom Handy: {stand, protokoll: [abgeschlossene Einsätze seit der letzten Sicherung]}
routerAdd("PUT", "/api/lebenswelt/fit/einsatz", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const A = require(`${__hooks}/einsatz/ablauf.js`)
  const body = e.requestInfo().body || {}
  const id = v.ich.id
  if (d.finde(e.app, id, "einsatzwelt", "stand")) return e.json(409, { fehler: "Das Einsatzspiel dieser Person läuft noch auf dem Server." })
  if (!A.gueltig(body.stand)) return e.json(400, { fehler: "Stand ungültig." })
  try {
    A.pruefeZahlen(body.stand)
  } catch (err) {
    return e.json(400, { fehler: String(err) })
  }
  const liste = Array.isArray(body.protokoll) ? body.protokoll.slice(0, 100) : []
  for (const x of liste) if (x && require(`${__hooks}/geraete.js`).EINSATZ_ID.test(String(x.id || ""))) d.schreibe(e.app, id, "einsatz", String(x.id), x)
  d.schreibe(e.app, id, "einsatzwelt", "stand_geraet", body.stand)
  return e.json(200, { ok: true, protokoll: liste.length })
})

// Wunsch für das Sonntags-Update in die Vorschlagsliste von Home Assistant: {item, description}
routerAdd("POST", "/api/lebenswelt/fit/wunsch", (e) => {
  const v = require(`${__hooks}/geraete.js`).nurPerson(e)
  if (!v.ich) return e.json(v.status, v.fehler)
  const body = e.requestInfo().body || {}
  const item = String(body.item || "").trim().slice(0, 300)
  if (!item) return e.json(400, { fehler: "Wunsch fehlt." })
  const token = $os.getenv("SUPERVISOR_TOKEN")
  if (!token) return e.json(503, { fehler: "Home Assistant nicht erreichbar." })
  try {
    const a = $http.send({
      url: "http://supervisor/core/api/services/todo/add_item",
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: "todo.lebenswelt_vorschlage", item: item, description: String(body.description || "").slice(0, 1000) }),
      timeout: 15,
    })
    if (a.statusCode !== 200) return e.json(502, { fehler: "Home Assistant: HTTP " + a.statusCode })
  } catch (err) {
    return e.json(502, { fehler: "Home Assistant nicht erreichbar: " + err })
  }
  return e.json(200, { ok: true })
})

// Läuft das Einsatzspiel einer Person auf ihrem Handy, rechnet der Server es nicht nebenher weiter
routerUse((e) => {
  const pfad = String(e.request.url.path || "")
  if (!/^\/api\/lebenswelt\/(einsatz|muell)(\/|$)/.test(pfad)) return e.next()
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (ich && require(`${__hooks}/einsatz/dienst.js`).finde(e.app, ich.id, "einsatzwelt", "stand_geraet")) {
    return e.json(409, { fehler: "Dieses Einsatzspiel läuft auf dem gekoppelten Handy (Lebenswelt Fit)." })
  }
  return e.next()
})
