// Paperless-ngx anbinden: Posteingang in den Eingang der Lebenswelt, Suche, Lesen, Umbenennen, Verschlagworten,
// Notizen und Aufgaben aus Dokumenten. Damit hat Claude über den Connector „Homeassistent MCP“ dauerhaft Zugriff.
// Konzept: docs/integrationen/KONZEPT.md, Abschnitt 6. Als Modul, weil PocketBase jeden Handler in einem eigenen
// Kontext ausführt. eingangAus() und kurz() sind rein und in Node getestet (test/kalender.test.js).
// Der volle Text der Dokumente wird nie in die Lebenswelt kopiert und nie ins Protokoll geschrieben.

const AUSZUG = 300
const QUELLE = "paperless"

/** Adresse und Token aus der Konfiguration der App. */
function konfig() {
  const h = require(`${__hooks}/hilfen.js`)
  const o = h.optionen()
  return { url: String(o.paperless_url || "http://ca5234a0-paperless-ngx:80").replace(/\/+$/, ""), token: String(o.paperless_token || "").trim() }
}

function eingerichtet() {
  return Boolean(konfig().token)
}

/** Anfrage an die REST-Schnittstelle von Paperless. Gibt {status, json} zurück oder wirft mit lesbarem Text. */
function anfrage(methode, pfad, body) {
  const k = konfig()
  if (!k.token) throw new Error("Paperless ist nicht eingerichtet (Option paperless_token).")
  let a
  try {
    a = $http.send({
      url: k.url + pfad,
      method: methode,
      body: body === undefined ? "" : JSON.stringify(body),
      headers: { Authorization: "Token " + k.token, Accept: "application/json", "Content-Type": "application/json" },
      timeout: 30,
    })
  } catch (err) {
    throw new Error("Paperless nicht erreichbar (" + k.url + "): " + err)
  }
  if (a.statusCode === 401 || a.statusCode === 403) throw new Error("Paperless lehnt den Token ab (HTTP " + a.statusCode + ").")
  return { status: a.statusCode, json: a.json }
}

/** Namen von Korrespondenten, Dokumenttypen und Tags (10 Minuten zwischengespeichert). */
function namen(neu) {
  const speicher = $app.store()
  const alt = speicher.get("paperless_namen")
  if (!neu && alt && Date.now() - alt.zeit < 600000) return alt
  const liste = (pfad) => {
    const r = anfrage("GET", pfad + "?page_size=1000")
    return (r.json && r.json.results) || []
  }
  const n = { zeit: Date.now(), korrespondenten: {}, typen: {}, tags: {}, posteingang: [] }
  for (const x of liste("/api/correspondents/")) n.korrespondenten[x.id] = x.name
  for (const x of liste("/api/document_types/")) n.typen[x.id] = x.name
  for (const x of liste("/api/tags/")) {
    n.tags[x.id] = x.name
    if (x.is_inbox_tag) n.posteingang.push(x.id)
  }
  speicher.set("paperless_namen", n)
  return n
}

/** Kurzform eines Dokuments für Listen (ohne vollen Text). */
function kurz(d, n, url) {
  const tags = (d.tags || []).map((id) => n.tags[id] || String(id))
  return {
    id: d.id,
    titel: d.title || "",
    korrespondent: d.correspondent ? n.korrespondenten[d.correspondent] || null : null,
    typ: d.document_type ? n.typen[d.document_type] || null : null,
    tags,
    posteingang: (d.tags || []).some((id) => n.posteingang.indexOf(id) >= 0),
    datum: String(d.created_date || d.created || "").slice(0, 10),
    hinzugefuegt: d.added || null,
    auszug: String(d.content || "").replace(/\s+/g, " ").trim().slice(0, AUSZUG),
    link: url + "/documents/" + d.id + "/details",
  }
}

/** Zeitstempel wie bei den übrigen Eingängen ("2026-09-16 07:40:30Z"). */
function zeitText(x) {
  const t = Date.parse(x)
  return isFinite(t) ? new Date(t).toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z") : ""
}

/** Daten eines Eingangs aus einem Dokument im Posteingang (Kurzform). */
function eingangAus(k) {
  const wer = [k.korrespondent, k.typ].filter(Boolean).join(", ")
  return {
    art: "Dokument",
    titel: k.titel || "Dokument " + k.id,
    details: (wer ? wer + ". " : "") + k.auszug,
    erfasst: zeitText(k.hinzugefuegt),
    erstellt: k.datum,
    quelle: QUELLE,
    paperless_id: k.id,
    link: k.link,
    verarbeitet: false,
  }
}

function suche(q, posteingang, seite) {
  const n = namen()
  const p = ["page_size=25", "page=" + Math.max(1, Math.floor(Number(seite) || 1)), "ordering=-created"]
  if (q) p.push("query=" + encodeURIComponent(String(q).slice(0, 200)))
  if (posteingang) p.push("is_in_inbox=true")
  const r = anfrage("GET", "/api/documents/?" + p.join("&"))
  if (r.status !== 200) throw new Error("Suche fehlgeschlagen (HTTP " + r.status + ").")
  const url = konfig().url
  return { anzahl: r.json.count || 0, weitere: Boolean(r.json.next), dokumente: (r.json.results || []).map((d) => kurz(d, n, url)) }
}

/** Ein Dokument mit vollem Text und Notizen. */
function dokument(id) {
  const n = namen()
  const r = anfrage("GET", "/api/documents/" + Number(id) + "/")
  if (r.status === 404) return null
  if (r.status !== 200) throw new Error("Dokument nicht lesbar (HTTP " + r.status + ").")
  const k = kurz(r.json, n, konfig().url)
  k.text = String(r.json.content || "")
  k.dateiname = r.json.original_file_name || null
  const no = anfrage("GET", "/api/documents/" + Number(id) + "/notes/")
  k.notizen = no.status === 200 && Array.isArray(no.json) ? no.json.map((x) => ({ text: x.note, zeit: x.created })) : []
  return k
}

/** Id eines Korrespondenten, Typs oder Tags per Name; mit neu_anlegen wird er angelegt, sonst Fehler. */
function idVon(art, name, neuAnlegen) {
  const n = namen()
  const tabelle = art === "korrespondent" ? n.korrespondenten : art === "typ" ? n.typen : n.tags
  const gesucht = String(name).trim().toLowerCase()
  for (const [id, x] of Object.entries(tabelle)) if (String(x).toLowerCase() === gesucht) return Number(id)
  if (!neuAnlegen) throw new Error("„" + name + "“ gibt es in Paperless noch nicht. Mit neu_anlegen: true wird es angelegt.")
  const pfad = art === "korrespondent" ? "/api/correspondents/" : art === "typ" ? "/api/document_types/" : "/api/tags/"
  const r = anfrage("POST", pfad, { name: String(name).trim().slice(0, 120) })
  if (r.status !== 201 && r.status !== 200) throw new Error("Anlegen fehlgeschlagen (HTTP " + r.status + ").")
  namen(true)
  return r.json.id
}

/**
 * Metadaten ändern: {titel, korrespondent, dokumenttyp, tags_dazu, tags_weg, datum, aus_posteingang, neu_anlegen}.
 * Namen werden in Ids übersetzt. Gibt die neue Kurzform zurück.
 */
function aendere(id, b) {
  const alt = anfrage("GET", "/api/documents/" + Number(id) + "/")
  if (alt.status !== 200) throw new Error("Dokument nicht gefunden.")
  const neu = !!b.neu_anlegen
  const patch = {}
  if (b.titel !== undefined) patch.title = String(b.titel).slice(0, 128)
  if (b.korrespondent !== undefined) patch.correspondent = b.korrespondent ? idVon("korrespondent", b.korrespondent, neu) : null
  if (b.dokumenttyp !== undefined) patch.document_type = b.dokumenttyp ? idVon("typ", b.dokumenttyp, neu) : null
  let tags = (alt.json.tags || []).slice()
  for (const t of b.tags_dazu || []) {
    const tid = idVon("tag", t, neu)
    if (tags.indexOf(tid) < 0) tags.push(tid)
  }
  const weg = (b.tags_weg || []).map((t) => idVon("tag", t, false))
  if (b.aus_posteingang) for (const p of namen().posteingang) weg.push(p)
  tags = tags.filter((x) => weg.indexOf(x) < 0)
  if ((b.tags_dazu || []).length || weg.length) patch.tags = tags
  if (b.datum !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum))) patch.created = String(b.datum)
  let r = anfrage("PATCH", "/api/documents/" + Number(id) + "/", patch)
  // Ältere Paperless-Versionen erwarten beim Datum eine Uhrzeit
  if (r.status === 400 && patch.created) {
    patch.created = patch.created + "T12:00:00"
    r = anfrage("PATCH", "/api/documents/" + Number(id) + "/", patch)
  }
  if (r.status !== 200) throw new Error("Ändern fehlgeschlagen (HTTP " + r.status + "): " + JSON.stringify(r.json).slice(0, 300))
  return kurz(r.json, namen(), konfig().url)
}

function notiz(id, text) {
  const r = anfrage("POST", "/api/documents/" + Number(id) + "/notes/", { note: String(text).slice(0, 5000) })
  if (r.status !== 200 && r.status !== 201) throw new Error("Notiz fehlgeschlagen (HTTP " + r.status + ").")
  return true
}

/**
 * Posteingang von Paperless in den Eingang der Lebenswelt übernehmen (typ eingang, Schlüssel paperless:<id>). Was in
 * Paperless nicht mehr im Posteingang liegt, wird als verarbeitet markiert. Gibt {neu, verarbeitet, im_posteingang}.
 */
function abgleich(app, besitzer) {
  const n = namen(true)
  const url = konfig().url
  const r = anfrage("GET", "/api/documents/?is_in_inbox=true&page_size=100&ordering=-added")
  if (r.status !== 200) throw new Error("Posteingang nicht lesbar (HTTP " + r.status + ").")
  const offen = (r.json.results || []).map((d) => kurz(d, n, url))
  const sammlung = app.findCollectionByNameOrId("dokumente")
  let neu = 0
  for (const k of offen) {
    try {
      app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = 'eingang' && schluessel = {:s}", { b: besitzer, s: "paperless:" + k.id })
      continue
    } catch (_) {
      // noch nicht übernommen
    }
    const rec = new Record(sammlung)
    rec.set("besitzer", besitzer)
    rec.set("typ", "eingang")
    rec.set("schluessel", "paperless:" + k.id)
    rec.set("geloescht", false)
    rec.set("daten", eingangAus(k))
    app.save(rec)
    neu++
  }
  const ids = offen.map((k) => k.id)
  let verarbeitet = 0
  for (const rec of app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'eingang' && schluessel ~ 'paperless:%' && geloescht = false", "", 0, 0, { b: besitzer })) {
    const d = JSON.parse(toString(rec.get("daten")) || "{}")
    if (d.verarbeitet || ids.indexOf(d.paperless_id) >= 0) continue
    d.verarbeitet = true
    rec.set("daten", d)
    app.save(rec)
    verarbeitet++
  }
  $app.store().set("paperless_abgleich", { zeit: Date.now(), im_posteingang: offen.length })
  return { neu, verarbeitet, im_posteingang: offen.length }
}

/** Aufgabe in der Lebenswelt aus einem Dokument: {titel, faellig, sphaere, kontext}. */
function aufgabe(app, besitzer, id, b) {
  const k = dokument(id)
  if (!k) throw new Error("Dokument nicht gefunden.")
  if (b.faellig && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.faellig))) throw new Error("faellig als JJJJ-MM-TT.")
  const rec = new Record(app.findCollectionByNameOrId("dokumente"))
  rec.set("besitzer", besitzer)
  rec.set("typ", "aufgabe")
  rec.set("schluessel", "")
  rec.set("geloescht", false)
  const daten = {
    titel: String(b.titel || k.titel).slice(0, 200),
    status: "Nicht begonnen",
    erstellt: new Date().toISOString().slice(0, 10),
    eingang: "paperless:" + k.id,
    paperless_id: k.id,
    link: k.link,
  }
  if (b.faellig) daten.faellig = String(b.faellig)
  if (b.sphaere) daten.sphaere = String(b.sphaere).slice(0, 40)
  if (b.kontext) daten.kontext = String(b.kontext).slice(0, 40)
  rec.set("daten", daten)
  app.save(rec)
  return require(`${__hooks}/hilfen.js`).alsDokument(rec)
}

module.exports = { eingerichtet, konfig, suche, dokument, aendere, notiz, abgleich, aufgabe, eingangAus, kurz }
