// Gmail im Posteingang der Lebenswelt (docs/integrationen/KONZEPT.md, Abschnitt 8; Routine in GMAIL_ROUTINE.md).
// Die Datenbank-App liest Gmail nicht selbst: Eine Claude-Routine legt jeden Werktag morgens Einträge an (typ
// "eingang", quelle "gmail", Schlüssel gmail:<threadId>) mit 2 bis 4 Vorschlägen. Alex wählt in der App einen
// Vorschlag oder schreibt eine eigene Eingabe, der nächste Lauf führt das in Gmail aus und setzt den Eintrag auf
// "verarbeitet". Für jede Entscheidung gibt es einmal XP zum Abholen (Höhe im Regelwerk, POSTEINGANG_XP).
// Als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt. Die reinen Funktionen sind in Node
// getestet (test/gmail.test.js).

const TYP = "eingang"
const QUELLE = "gmail"
const STATUS = ["offen", "entschieden", "verarbeitet"]
const AKTIONEN = ["labeln", "archivieren", "to_do", "antwort_entwurf", "newsletter", "papierkorb_vorschlagen"]
const GRENZEN = { titel: 200, absender: 200, datum: 40, auszug: 300, kategorie: 60, text: 120, eingabe: 2000, ergebnis: 2000, labels: 10, label: 80, optionen_min: 2, optionen_max: 4, mails: 100 }
const THREAD_MUSTER = /^[A-Za-z0-9_-]{1,64}$/
const OPTION_MUSTER = /^[a-z0-9_-]{1,30}$/
const LINK_MUSTER = /^https:\/\/mail\.google\.com\//

/** Fehler mit HTTP-Status für die Routen (400 Eingabe, 404 nicht gefunden, 409 Zustand passt nicht). */
function fehler(status, text) {
  const err = new Error(text)
  err.status = status
  return err
}

const text = (v) => String(v == null ? "" : v).trim()

/** Text kürzen, ohne Wörter mitten im Zeichen zu teilen; leer bleibt leer. */
function kuerze(v, max) {
  const t = text(v).replace(/\s+/g, " ")
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t
}

/** Vorschläge prüfen: 2 bis 4, eindeutige IDs, bekannte Aktionen, beim Labeln die Label-IDs. */
function optionenAus(liste) {
  if (!Array.isArray(liste)) throw fehler(400, "optionen fehlt (Liste mit 2 bis 4 Vorschlägen).")
  if (liste.length < GRENZEN.optionen_min || liste.length > GRENZEN.optionen_max) throw fehler(400, "optionen braucht 2 bis 4 Vorschläge.")
  const ids = []
  return liste.map((o) => {
    const x = o || {}
    const id = text(x.id)
    if (!OPTION_MUSTER.test(id)) throw fehler(400, "Vorschlag mit ungültiger id (a-z, 0-9, _ und -, höchstens 30 Zeichen).")
    if (ids.indexOf(id) >= 0) throw fehler(400, "Vorschlag " + id + " ist doppelt.")
    ids.push(id)
    const t = text(x.text)
    if (!t) throw fehler(400, "Vorschlag " + id + " ohne text.")
    if (t.length > GRENZEN.text) throw fehler(400, "Vorschlag " + id + ": text ist zu lang (höchstens " + GRENZEN.text + " Zeichen).")
    const aktion = text(x.aktion)
    if (AKTIONEN.indexOf(aktion) < 0) throw fehler(400, "Vorschlag " + id + ": aktion muss eine von " + AKTIONEN.join(", ") + " sein.")
    const daten = x.daten && typeof x.daten === "object" && !Array.isArray(x.daten) ? x.daten : {}
    const aus = {}
    if (daten.labels !== undefined || aktion === "labeln") {
      const labels = Array.isArray(daten.labels) ? daten.labels.map(text).filter(Boolean) : []
      if (aktion === "labeln" && !labels.length) throw fehler(400, "Vorschlag " + id + ": labeln braucht daten.labels (Label-IDs).")
      if (labels.length > GRENZEN.labels || labels.some((l) => l.length > GRENZEN.label)) throw fehler(400, "Vorschlag " + id + ": zu viele oder zu lange Labels.")
      aus.labels = labels
    }
    if (daten.label_namen !== undefined) aus.label_namen = (Array.isArray(daten.label_namen) ? daten.label_namen : []).map((l) => kuerze(l, GRENZEN.label)).filter(Boolean).slice(0, GRENZEN.labels)
    if (daten.archivieren !== undefined) aus.archivieren = Boolean(daten.archivieren)
    if (daten.hinweis !== undefined) aus.hinweis = kuerze(daten.hinweis, GRENZEN.text)
    return { id, text: t, aktion, daten: aus }
  })
}

/** Daten eines neuen Eintrags aus einer Mail der Routine: {thread_id, titel, absender, datum, auszug, link, kategorie_vorschlag, optionen}. */
function mailDaten(m, jetzt) {
  const x = m || {}
  const thread = text(x.thread_id)
  if (!THREAD_MUSTER.test(thread)) throw fehler(400, "thread_id fehlt oder ist ungültig.")
  const link = text(x.link) || "https://mail.google.com/mail/u/0/#all/" + thread
  if (!LINK_MUSTER.test(link)) throw fehler(400, "link muss auf mail.google.com zeigen.")
  return {
    art: "Mail",
    quelle: QUELLE,
    thread_id: thread,
    titel: kuerze(x.titel, GRENZEN.titel) || "(ohne Betreff)",
    absender: kuerze(x.absender, GRENZEN.absender),
    datum: kuerze(x.datum, GRENZEN.datum),
    auszug: kuerze(x.auszug, GRENZEN.auszug),
    link,
    kategorie_vorschlag: kuerze(x.kategorie_vorschlag, GRENZEN.kategorie),
    optionen: optionenAus(x.optionen),
    auswahl: null,
    eigene_eingabe: "",
    status: "offen",
    rueckfrage: "",
    ergebnis: "",
    erfasst: new Date(jetzt).toISOString(),
    entschieden_am: null,
    verarbeitet_am: null,
    // Für die übrigen Listen der App: entschiedene Mails gelten als sortiert
    verarbeitet: false,
    xp: 0,
    xp_gebucht: false,
    xp_abgeholt: false,
  }
}

/** JSON mit sortierten Schlüsseln (PocketBase speichert Objekte mit anderer Reihenfolge der Schlüssel). */
function gleich(a, b) {
  const sortiert = (v) => (Array.isArray(v) ? v.map(sortiert) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => ((o[k] = sortiert(v[k])), o), {}) : v)
  return JSON.stringify(sortiert(a)) === JSON.stringify(sortiert(b))
}

/**
 * Bestehenden Eintrag mit einer erneut gelieferten Mail zusammenführen. Solange er offen ist, kommen Betreff, Auszug
 * und Vorschläge neu (eine offene Rückfrage bleibt stehen); über eine entschiedene oder verarbeitete Mail entscheidet
 * die Routine nicht noch einmal. XP-Felder bleiben immer. Gibt {daten, geaendert}.
 */
function zusammenfuehren(alt, neu) {
  if (alt.status && alt.status !== "offen") return { daten: alt, geaendert: false }
  const felder = ["titel", "absender", "datum", "auszug", "link", "kategorie_vorschlag", "optionen"]
  const daten = Object.assign({}, alt)
  let geaendert = false
  for (const f of felder)
    if (!gleich(alt[f], neu[f])) {
      daten[f] = neu[f]
      geaendert = true
    }
  // Eine Auswahl, die es in den neuen Vorschlägen nicht mehr gibt, fällt weg
  if (daten.auswahl && !daten.optionen.some((o) => o.id === daten.auswahl)) daten.auswahl = null
  return { daten, geaendert }
}

/** XP für eine Entscheidung: je Mail einmal, höchstens tag_max am Tag (bereits = heute schon gebuchte XP). */
function xpFuer(bereits, R) {
  const x = R || {}
  const je = Number(x.gmail_entscheidung) || 0
  const max = Number(x.tag_max) || 0
  return Math.max(0, Math.min(je, max - (Number(bereits) || 0)))
}

/**
 * Entscheidung aus der App: {auswahl?, eigene_eingabe?}. Mindestens eins von beiden; die Auswahl muss einer der
 * Vorschläge sein. Bis der nächste Lauf sie verarbeitet hat, darf sie geändert werden, XP gibt es trotzdem nur einmal.
 */
function entscheide(alt, body, jetzt, xpHeute, R) {
  const b = body || {}
  if (alt.status === "verarbeitet") throw fehler(409, "Die Mail ist schon verarbeitet.")
  const auswahl = b.auswahl == null || b.auswahl === "" ? null : text(b.auswahl)
  if (auswahl !== null && !(alt.optionen || []).some((o) => o.id === auswahl)) throw fehler(400, "auswahl ist keiner der Vorschläge.")
  const eingabe = text(b.eigene_eingabe)
  if (eingabe.length > GRENZEN.eingabe) throw fehler(400, "eigene_eingabe ist zu lang (höchstens " + GRENZEN.eingabe + " Zeichen).")
  if (auswahl === null && !eingabe) throw fehler(400, "auswahl oder eigene_eingabe fehlt.")
  const neu = Object.assign({}, alt, { auswahl, eigene_eingabe: eingabe, status: "entschieden", entschieden_am: new Date(jetzt).toISOString(), verarbeitet: true })
  if (!alt.xp_gebucht) {
    neu.xp = xpFuer(xpHeute, R)
    neu.xp_gebucht = true
    neu.xp_abgeholt = false
  }
  return neu
}

/**
 * Änderung durch die Routine: {status: "verarbeitet", ergebnis?} nach dem Ausführen in Gmail, oder {status: "offen",
 * rueckfrage, optionen?} wenn die eigene Eingabe mehrdeutig war. Die Rückfrage setzt die Entscheidung zurück, die
 * eigene Eingabe bleibt als vorherige Eingabe sichtbar.
 */
function routineAendern(alt, body, jetzt) {
  const b = body || {}
  const status = text(b.status)
  if (STATUS.indexOf(status) < 0) throw fehler(400, "status muss offen, entschieden oder verarbeitet sein.")
  const zeit = new Date(jetzt).toISOString()
  const neu = Object.assign({}, alt)
  if (status === "verarbeitet") {
    if (alt.status !== "entschieden" && alt.status !== "verarbeitet") throw fehler(409, "Nur entschiedene Mails können verarbeitet werden.")
    const ergebnis = text(b.ergebnis)
    if (ergebnis.length > GRENZEN.ergebnis) throw fehler(400, "ergebnis ist zu lang (höchstens " + GRENZEN.ergebnis + " Zeichen).")
    return Object.assign(neu, { status, ergebnis, verarbeitet_am: zeit, verarbeitet: true })
  }
  if (status === "offen") {
    const rueckfrage = text(b.rueckfrage)
    if (!rueckfrage) throw fehler(400, "Zurück auf offen nur mit rueckfrage.")
    if (rueckfrage.length > GRENZEN.eingabe) throw fehler(400, "rueckfrage ist zu lang (höchstens " + GRENZEN.eingabe + " Zeichen).")
    if (alt.status === "verarbeitet") throw fehler(409, "Die Mail ist schon verarbeitet.")
    if (b.optionen !== undefined) neu.optionen = optionenAus(b.optionen)
    return Object.assign(neu, { status, rueckfrage, vorherige_eingabe: alt.eigene_eingabe || "", auswahl: null, eigene_eingabe: "", entschieden_am: null, verarbeitet: false })
  }
  throw fehler(400, "Die Routine setzt nur verarbeitet oder offen (mit Rückfrage).")
}

/** Status aus der Abfrage prüfen; leer heißt alle. */
function statusFilter(wert) {
  const s = text(wert)
  if (!s) return null
  if (STATUS.indexOf(s) < 0) throw fehler(400, "status muss offen, entschieden oder verarbeitet sein.")
  return s
}

/** Push-Text: nur die Anzahl, keine Inhalte der Mails. */
const pushText = (n) => (n === 1 ? "Eine neue Mail wartet im Posteingang auf deine Entscheidung." : n + " neue Mails warten im Posteingang auf deine Entscheidung.")

// ---------------------------------------------------------------- Datenbank (nur in PocketBase)

const lies = (r) => JSON.parse(toString(r.get("daten")) || "{}")

function alleGmail(app, besitzer) {
  return app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = {:t} && schluessel ~ 'gmail:%' && geloescht = false", "created", 0, 0, { b: besitzer, t: TYP })
}

function finde(app, besitzer, id) {
  try {
    return app.findFirstRecordByFilter("dokumente", "id = {:id} && besitzer = {:b} && typ = {:t} && schluessel ~ 'gmail:%' && geloescht = false", { id: String(id), b: besitzer, t: TYP })
  } catch (_) {
    throw fehler(404, "Mail nicht gefunden.")
  }
}

/** Mails der Routine anlegen oder zusammenführen. Gibt {neu, aktualisiert, unveraendert, fehler: [{thread_id, fehler}]}. */
function anlegen(app, besitzer, mails) {
  if (!Array.isArray(mails)) throw fehler(400, "mails fehlt (Liste).")
  if (mails.length > GRENZEN.mails) throw fehler(400, "Höchstens " + GRENZEN.mails + " Mails je Aufruf.")
  const h = require(`${__hooks}/hilfen.js`)
  const sammlung = app.findCollectionByNameOrId("dokumente")
  const aus = { neu: 0, aktualisiert: 0, unveraendert: 0, fehler: [], dokumente: [] }
  const jetzt = Date.now()
  for (const m of mails) {
    let daten
    try {
      daten = mailDaten(m, jetzt)
    } catch (err) {
      aus.fehler.push({ thread_id: text(m && m.thread_id), fehler: String(err.message || err) })
      continue
    }
    const schluessel = QUELLE + ":" + daten.thread_id
    let rec = null
    try {
      // Auch gelöschte Einträge finden: ein gelöschter Thread kommt nicht wieder
      rec = app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = {:t} && schluessel = {:s}", { b: besitzer, t: TYP, s: schluessel })
    } catch (_) {
      // neu
    }
    if (rec) {
      if (rec.getBool("geloescht")) {
        aus.unveraendert++
        continue
      }
      const z = zusammenfuehren(lies(rec), daten)
      if (!z.geaendert) {
        aus.unveraendert++
        continue
      }
      rec.set("daten", z.daten)
      app.save(rec)
      aus.aktualisiert++
      aus.dokumente.push(h.alsDokument(rec))
      continue
    }
    rec = new Record(sammlung)
    rec.set("besitzer", besitzer)
    rec.set("typ", TYP)
    rec.set("schluessel", schluessel)
    rec.set("geloescht", false)
    rec.set("daten", daten)
    app.save(rec)
    aus.neu++
    aus.dokumente.push(h.alsDokument(rec))
  }
  if (aus.neu) {
    try {
      require(`${__hooks}/push.js`).sende(app, besitzer, { titel: "Posteingang", text: pushText(aus.neu), kanal: "allgemein", id: "gmail", ha: true })
    } catch (err) {
      console.log("Push für Gmail fehlgeschlagen", err)
    }
  }
  return aus
}

function liste(app, besitzer, status) {
  const h = require(`${__hooks}/hilfen.js`)
  const s = statusFilter(status)
  return alleGmail(app, besitzer).map(h.alsDokument).filter((d) => !s || d.daten.status === s)
}

/** Heute schon für Entscheidungen gebuchte XP (Ortszeit), für die Obergrenze je Tag. */
function xpHeute(app, besitzer, jetzt) {
  const heute = require(`${__hooks}/vorgaenge.js`).heute(jetzt)
  const tagVon = (iso) => require(`${__hooks}/vorgaenge.js`).heute(Date.parse(iso))
  let summe = 0
  for (const r of alleGmail(app, besitzer)) {
    const d = lies(r)
    if (d.xp_gebucht && d.entschieden_am && tagVon(d.entschieden_am) === heute) summe += Number(d.xp) || 0
  }
  return summe
}

function entscheiden(app, besitzer, id, body) {
  const h = require(`${__hooks}/hilfen.js`)
  const R = require(`${__hooks}/einsatz/regelwerk.js`).POSTEINGANG_XP
  const r = finde(app, besitzer, id)
  const jetzt = Date.now()
  r.set("daten", entscheide(lies(r), body, jetzt, xpHeute(app, besitzer, jetzt), R))
  app.save(r)
  return h.alsDokument(r)
}

function aendern(app, besitzer, id, body) {
  const h = require(`${__hooks}/hilfen.js`)
  const r = finde(app, besitzer, id)
  r.set("daten", routineAendern(lies(r), body, Date.now()))
  app.save(r)
  return h.alsDokument(r)
}

/** XP der Entscheidungen abholen, die noch offen sind. Gibt {xp, skill, eintraege: [{id, titel, xp}]}; die App bucht sie. */
function abholen(app, besitzer) {
  const R = require(`${__hooks}/einsatz/regelwerk.js`).POSTEINGANG_XP
  const aus = { xp: 0, skill: R.skill, eintraege: [] }
  for (const r of alleGmail(app, besitzer)) {
    const d = lies(r)
    if (!d.xp_gebucht || d.xp_abgeholt) continue
    d.xp_abgeholt = true
    r.set("daten", d)
    app.save(r)
    if (!d.xp) continue
    aus.xp += d.xp
    aus.eintraege.push({ id: r.id, titel: d.titel, xp: d.xp })
  }
  return aus
}

module.exports = { TYP, QUELLE, STATUS, AKTIONEN, GRENZEN, optionenAus, mailDaten, zusammenfuehren, xpFuer, entscheide, routineAendern, statusFilter, pushText, anlegen, liste, entscheiden, aendern, abholen, xpHeute }
