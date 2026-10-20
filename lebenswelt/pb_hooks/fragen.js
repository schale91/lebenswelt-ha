// Rückfragen zu Paperless-Dokumenten (typ "frage"). Der tägliche Claude-Lauf legt eine Frage an, die App zeigt sie
// im Posteingang mit Antwortfeld, der nächste Lauf holt beantwortete Fragen ab und setzt sie auf "verarbeitet".
// Als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt. frageDaten() und statusAendern() sind
// rein und in Node getestet (test/fragen.test.js).

const TYP = "frage"
const STATUS = ["offen", "beantwortet", "verarbeitet"]
/** Grenze für Frage und Antwort; reicht für ausführliche Rückfragen, schützt die Datenbank vor Ausreißern */
const TEXT_MAX = 8000

/** Fehler mit HTTP-Status für die Routen (400 Eingabe, 404 nicht gefunden). */
function fehler(status, text) {
  const err = new Error(text)
  err.status = status
  return err
}

/** Daten einer neuen Frage aus der Kurzform eines Paperless-Dokuments (paperless.js kurz/dokument). */
function frageDaten(dok, text, jetzt) {
  const t = String(text == null ? "" : text).trim()
  if (!t) throw fehler(400, "text fehlt.")
  if (t.length > TEXT_MAX) throw fehler(400, "text ist zu lang (höchstens " + TEXT_MAX + " Zeichen).")
  return {
    text: t,
    paperless_id: dok.id,
    titel: String(dok.titel || "Dokument " + dok.id).slice(0, 200),
    link: dok.link || "",
    status: "offen",
    antwort: "",
    erstellt: new Date(jetzt).toISOString(),
    beantwortet_am: null,
    verarbeitet_am: null,
  }
}

/**
 * Neue Daten nach einer Statusänderung: {status, antwort?}. Antwort setzen heißt beantwortet; "verarbeitet" setzt
 * den Zeitpunkt, an dem der Claude-Lauf die Antwort übernommen hat.
 */
function statusAendern(alt, body, jetzt) {
  const b = body || {}
  const neu = Object.assign({}, alt)
  const zeit = new Date(jetzt).toISOString()
  if (b.antwort !== undefined) {
    const a = String(b.antwort == null ? "" : b.antwort).trim()
    if (a.length > TEXT_MAX) throw fehler(400, "antwort ist zu lang (höchstens " + TEXT_MAX + " Zeichen).")
    neu.antwort = a
  }
  if (b.status === undefined && b.antwort === undefined) throw fehler(400, "status oder antwort fehlt.")
  const status = b.status === undefined ? (neu.antwort ? "beantwortet" : neu.status) : String(b.status)
  if (STATUS.indexOf(status) < 0) throw fehler(400, "status muss offen, beantwortet oder verarbeitet sein.")
  if (status === "beantwortet" && !neu.antwort) throw fehler(400, "Ohne Antwort kann die Frage nicht beantwortet sein.")
  neu.status = status
  if (status === "beantwortet" && !neu.beantwortet_am) neu.beantwortet_am = zeit
  if (status === "verarbeitet") neu.verarbeitet_am = zeit
  if (status === "offen") {
    neu.beantwortet_am = null
    neu.verarbeitet_am = null
  }
  return neu
}

/** Status aus der Abfrage prüfen; leer heißt alle. */
function statusFilter(wert) {
  const s = String(wert || "").trim()
  if (!s) return null
  if (STATUS.indexOf(s) < 0) throw fehler(400, "status muss offen, beantwortet oder verarbeitet sein.")
  return s
}

// ---------------------------------------------------------------- Datenbank (nur in PocketBase)

function lege(app, besitzer, dok, text) {
  const daten = frageDaten(dok, text, Date.now())
  const rec = new Record(app.findCollectionByNameOrId("dokumente"))
  rec.set("besitzer", besitzer)
  rec.set("typ", TYP)
  rec.set("schluessel", "")
  rec.set("geloescht", false)
  rec.set("daten", daten)
  app.save(rec)
  return require(`${__hooks}/hilfen.js`).alsDokument(rec)
}

function liste(app, besitzer, status) {
  const h = require(`${__hooks}/hilfen.js`)
  const s = statusFilter(status)
  const recs = app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = {:t} && geloescht = false", "created", 0, 0, { b: besitzer, t: TYP })
  return recs.map(h.alsDokument).filter((d) => !s || d.daten.status === s)
}

function aendere(app, besitzer, id, body) {
  const h = require(`${__hooks}/hilfen.js`)
  let r
  try {
    r = app.findFirstRecordByFilter("dokumente", "id = {:id} && besitzer = {:b} && typ = {:t} && geloescht = false", { id: String(id), b: besitzer, t: TYP })
  } catch (_) {
    throw fehler(404, "Frage nicht gefunden.")
  }
  const alt = JSON.parse(toString(r.get("daten")) || "{}")
  r.set("daten", statusAendern(alt, body, Date.now()))
  app.save(r)
  return h.alsDokument(r)
}

module.exports = { TYP, STATUS, TEXT_MAX, frageDaten, statusAendern, statusFilter, lege, liste, aendere }
