/// <reference path="../pb_data/types.d.ts" />
// App-Protokoll (siehe app_protokoll.js): Einträge der App ablegen und für Claude lesen.

// Ablegen: {geraet, name?, tag, eintraege:[{i, z, a, t, d?}]}. Antwort {ok, anzahl}. Alte Tage der Person fallen weg.
routerAdd("POST", "/api/lebenswelt/app-protokoll", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const P = require(`${__hooks}/app_protokoll.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  const a = P.pruefe(e.requestInfo().body)
  if (a.fehler) return e.json(400, { fehler: "app-protokoll: " + a.fehler })
  const schluessel = a.tag + ":" + a.geraet
  let anzahl = 0
  e.app.runInTransaction((tx) => {
    let r = null
    try {
      r = tx.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = 'applog' && schluessel = {:s}", { b: ich.id, s: schluessel })
    } catch (_) {
      r = null
    }
    const alt = r ? JSON.parse(toString(r.get("daten")) || "{}") : {}
    const eintraege = P.zusammen(alt.eintraege, a.eintraege)
    anzahl = eintraege.length
    if (!r) {
      r = new Record(tx.findCollectionByNameOrId("dokumente"))
      r.set("besitzer", ich.id)
      r.set("typ", "applog")
      r.set("schluessel", schluessel)
    }
    r.set("daten", { tag: a.tag, geraet: a.geraet, name: a.name || alt.name || "", eintraege: eintraege })
    r.set("geloescht", false)
    tx.save(r)
    // Aufräumen: Tage vor der Frist (Schlüssel beginnt mit dem Tag, also genügt der Textvergleich)
    const grenze = P.ersterTag(new Date().toISOString().slice(0, 10), P.TAGE)
    for (const weg of tx.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'applog' && schluessel < {:g}", "", 200, 0, { b: ich.id, g: grenze })) tx.delete(weg)
  })
  return e.json(200, { ok: true, anzahl: anzahl })
})

// Lesen (nur volle Lebenswelt): ?tage=3 (1 bis 14). Antwort {protokolle:[{person, name, tag, geraet, geraet_name, eintraege}]}
routerAdd("GET", "/api/lebenswelt/app-protokoll", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const P = require(`${__hooks}/app_protokoll.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  if (h.profilVon(ich) === "fitness") return e.json(403, { fehler: "Das App-Protokoll liest nur die volle Lebenswelt." })
  const tage = Math.min(P.TAGE, Math.max(1, parseInt(String(e.request.url.query().get("tage") || "3"), 10) || 3))
  const grenze = P.ersterTag(new Date().toISOString().slice(0, 10), tage)
  const namen = {}
  for (const s of e.app.findRecordsByFilter("spielstaende", "benutzer != ''", "", 0, 0)) namen[s.getString("benutzer")] = s.getString("name")
  const liste = e.app.findRecordsByFilter("dokumente", "typ = 'applog' && geloescht = false && schluessel >= {:g}", "schluessel", 0, 0, { g: grenze })
  return e.json(200, {
    protokolle: liste.map((r) => {
      const d = JSON.parse(toString(r.get("daten")) || "{}")
      const person = r.getString("besitzer")
      return { person: person, name: namen[person] || "", tag: d.tag || "", geraet: d.geraet || "", geraet_name: d.name || "", eintraege: d.eintraege || [] }
    }),
  })
})
