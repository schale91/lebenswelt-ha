// Gekoppelte Geräte: Lebenswelt Fit läuft auf Papas Handy ohne Home-Assistant-Anmeldung. Alex erzeugt in seiner
// Lebenswelt einen Kopplungscode (QR-Code, 15 Minuten gültig, einmal verwendbar). Das Handy tauscht ihn gegen einen
// Geräteschlüssel, den die Weiterleitung lebenswelt_fit in Home Assistant als Kopfzeile X-Lebenswelt-Geraet
// mitschickt. Gespeichert wird nur der Hashwert des Schlüssels (Dokument typ "fit_geraet" der Person), je Person und
// App ein Gerät: Eine neue Kopplung ersetzt die alte derselben App. Widerrufen geht in Alex' Lebenswelt.
// Apps (ziel): "fit" (Lebenswelt Fit, nur Personen mit Fitness-Welt) und "trainme" (TrainMe-APK, alle Personen;
// erreicht nur /api/lebenswelt/ich und /api/lebenswelt/trainme…).

const CODE_ZEICHEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const CODE_LAENGE = 8
const CODE_GUELTIG_MS = 15 * 60 * 1000
const SCHLUESSEL_MUSTER = /^lwf_[A-Za-z0-9]{48}$/
/** Fehlversuche beim Koppeln, über alle Codes: höchstens so viele je Viertelstunde. */
const FEHLVERSUCHE_MAX = 20
const ZIELE = ["fit", "trainme"]

/** App einer Kopplung; ältere Einträge ohne Angabe gehören zu Lebenswelt Fit. */
function zielVon(z) {
  return ZIELE.indexOf(String(z || "")) >= 0 ? String(z) : "fit"
}

/** Darf ein Gerät dieser App den Pfad aufrufen? TrainMe bekommt nur seine eigenen Routen. */
function pfadErlaubt(ziel, pfad) {
  if (zielVon(ziel) !== "trainme") return true
  return /^\/api\/lebenswelt\/(ich|trainme)(\/|$)/.test(String(pfad || ""))
}

/** Code aus der Eingabe: groß, ohne Leer- und Trennzeichen (der Code selbst enthält kein I, L, O, 0 und 1). */
function codeNormal(c) {
  return String(c || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

/** Gilt der Kopplungscode (Dokument daten {bis}) noch? */
function kopplungGilt(daten, jetzt) {
  return !!daten && Number(daten.bis) > jetzt
}

function schluesselGueltig(s) {
  return SCHLUESSEL_MUSTER.test(String(s || ""))
}

/** Gerätename aus der Anfrage, kurz und ohne Steuerzeichen. */
function geraetName(n) {
  return String(n || "Handy").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) || "Handy"
}

// ---------- ab hier mit PocketBase ----------

function hash(schluessel) {
  return $security.sha256("lebenswelt-geraet:" + schluessel)
}

function lies(r) {
  return JSON.parse(toString(r.get("daten")) || "{}")
}

/** Person zum Geräteschlüssel oder null. Zwischengespeichert für eine Minute. */
function geraetVon(app, schluessel) {
  if (!schluesselGueltig(schluessel)) return null
  const h = hash(schluessel)
  const speicher = $app.store()
  const k = "geraet:" + (speicher.get("geraete_stand") || 0) + ":" + h
  const z = speicher.get(k)
  if (z && Date.now() - z.zeit < 60000) return z.geraet
  let geraet = null
  try {
    const r = app.findFirstRecordByFilter("dokumente", "typ = 'fit_geraet' && schluessel = {:s} && geloescht = false", { s: h })
    const d = lies(r)
    geraet = { id: r.id, person: r.getString("besitzer"), name: String(d.person_name || ""), geraet: String(d.name || ""), ziel: zielVon(d.ziel) }
    // Zuletzt gesehen, höchstens stündlich geschrieben
    if (!d.zuletzt || Date.now() - Date.parse(d.zuletzt) > 3600000) {
      d.zuletzt = new Date().toISOString()
      r.set("daten", d)
      app.save(r)
    }
  } catch (_) {
    geraet = null
  }
  speicher.set(k, { zeit: Date.now(), geraet: geraet })
  return geraet
}

/** Zwischenspeicher verwerfen (nach Koppeln und Widerrufen): neuer Stand, neue Schlüssel im Speicher. */
function vergiss() {
  const speicher = $app.store()
  speicher.set("geraete_stand", (speicher.get("geraete_stand") || 0) + 1)
}

/** Namen der Personen in Home Assistant je Benutzer-ID (Entitäten person.*, Attribut user_id). */
function haNamen() {
  const namen = {}
  for (const z of require(`${__hooks}/hilfen.js`).ha("/states") || []) {
    if (String(z.entity_id).indexOf("person.") === 0 && z.attributes && z.attributes.user_id) namen[z.attributes.user_id] = String(z.attributes.friendly_name || "")
  }
  return namen
}

/**
 * Personen mit Fitness-Welt (Option fitness_personen). Name aus dem Spielstand, sonst aus der Person in Home
 * Assistant (vor dem ersten Start hat die Person noch keinen Spielstand), sonst „Papa“.
 */
function fitnessPersonen(app) {
  const h = require(`${__hooks}/hilfen.js`)
  let namen = null
  const liste = []
  for (const eintrag of h.optionen().fitness_personen || []) {
    const id = String(eintrag || "").trim()
    if (!id) continue
    let r = h.spielstandVon(app, id)
    if (!r) {
      // Option mit Benutzernamen statt ID: über den gespeicherten Spielstand finden
      try {
        r = app.findFirstRecordByFilter("spielstaende", "profil = 'fitness' && name ~ {:n}", { n: id })
      } catch (_) {
        r = null
      }
    }
    // Ohne Spielstand ist die Person nur mit ihrer ID koppelbar (die steht in Home Assistant unter Personen)
    if (!r && !/^[0-9a-f]{32}$/.test(id)) continue
    const pid = r ? r.getString("benutzer") : id
    if (liste.some((p) => p.id === pid)) continue
    let name = r ? r.getString("name") : ""
    if (!name) {
      if (!namen) namen = haNamen()
      name = namen[pid] || "Papa"
    }
    liste.push({ id: pid, name: name })
  }
  return liste
}

/** Gekoppelte Geräte aller Personen (für Alex' Übersicht), ohne Hashwerte. */
function geraete(app) {
  return app.findRecordsByFilter("dokumente", "typ = 'fit_geraet' && geloescht = false", "-created", 50, 0).map((r) => {
    const d = lies(r)
    return { id: r.id, person: r.getString("besitzer"), person_name: String(d.person_name || ""), name: String(d.name || ""), ziel: zielVon(d.ziel), erstellt: String(d.erstellt || ""), zuletzt: String(d.zuletzt || "") }
  })
}

/**
 * Neuer Kopplungscode für eine Person; ein noch offener alter Code derselben App verfällt. Lebenswelt Fit nur für
 * Personen mit Fitness-Welt, TrainMe auch für die fragende Person selbst (ich).
 */
function neueKopplung(app, person, ziel, ich) {
  ziel = zielVon(ziel)
  let p = fitnessPersonen(app).find((x) => x.id === person)
  if (!p && ziel === "trainme" && ich && ich.id === person) p = { id: ich.id, name: String(ich.anzeige || ich.name || "Ich") }
  if (!p) return { fehler: ziel === "trainme" ? "Unbekannte Person." : "Diese Person hat keine Fitness-Welt (Option fitness_personen)." }
  for (const alt of app.findRecordsByFilter("dokumente", "typ = 'fit_kopplung' && besitzer = {:b}", "", 0, 0, { b: p.id })) if (zielVon(lies(alt).ziel) === ziel) app.delete(alt)
  const code = $security.randomStringWithAlphabet(CODE_LAENGE, CODE_ZEICHEN)
  const bis = Date.now() + CODE_GUELTIG_MS
  const r = new Record(app.findCollectionByNameOrId("dokumente"))
  r.set("besitzer", p.id)
  r.set("typ", "fit_kopplung")
  r.set("schluessel", code)
  r.set("geloescht", false)
  r.set("daten", { bis: bis, person_name: p.name, ziel: ziel })
  app.save(r)
  return { code: code, bis: bis, person: p, ziel: ziel }
}

/**
 * Code gegen einen Geräteschlüssel tauschen. ziel (optional): App, die koppeln will; ein Code einer anderen App wird
 * dann nicht verbraucht. Gibt {schluessel, person, name, ziel} oder {status, fehler} zurück.
 */
function koppeln(app, code, name, ziel) {
  const speicher = $app.store()
  const fehl = speicher.get("kopplung_fehl") || { ab: Date.now(), n: 0 }
  if (Date.now() - fehl.ab > CODE_GUELTIG_MS) {
    fehl.ab = Date.now()
    fehl.n = 0
  }
  if (fehl.n >= FEHLVERSUCHE_MAX) return { status: 429, fehler: "Zu viele Versuche. Bitte in einer Viertelstunde noch einmal." }
  const c = codeNormal(code)
  let r = null
  try {
    if (c.length === CODE_LAENGE) r = app.findFirstRecordByFilter("dokumente", "typ = 'fit_kopplung' && schluessel = {:c}", { c: c })
  } catch (_) {
    r = null
  }
  const d = r ? lies(r) : null
  if (!r || !kopplungGilt(d, Date.now())) {
    fehl.n++
    speicher.set("kopplung_fehl", fehl)
    if (r) app.delete(r)
    return { status: 403, fehler: "Der Code stimmt nicht oder ist abgelaufen. Bitte in Alex' Lebenswelt einen neuen erzeugen." }
  }
  if (ziel && zielVon(ziel) !== zielVon(d.ziel)) return { status: 400, fehler: zielVon(d.ziel) === "trainme" ? "Dieser Code ist für TrainMe." : "Dieser Code ist für Lebenswelt Fit." }
  const person = r.getString("besitzer")
  ziel = zielVon(d.ziel)
  app.delete(r)
  // Ein Gerät je Person und App: Die alte Kopplung derselben App endet
  for (const alt of app.findRecordsByFilter("dokumente", "typ = 'fit_geraet' && besitzer = {:b}", "", 0, 0, { b: person })) if (zielVon(lies(alt).ziel) === ziel) app.delete(alt)
  vergiss()
  const schluessel = "lwf_" + $security.randomString(48)
  const g = new Record(app.findCollectionByNameOrId("dokumente"))
  g.set("besitzer", person)
  g.set("typ", "fit_geraet")
  g.set("schluessel", hash(schluessel))
  g.set("geloescht", false)
  g.set("daten", { name: geraetName(name), person_name: String(d.person_name || ""), ziel: ziel, erstellt: new Date().toISOString(), zuletzt: new Date().toISOString() })
  app.save(g)
  return { schluessel: schluessel, person: person, name: String(d.person_name || ""), ziel: ziel }
}

function entkoppeln(app, id) {
  try {
    const r = app.findRecordById("dokumente", id)
    if (r.getString("typ") !== "fit_geraet") return false
    app.delete(r)
    vergiss()
    return true
  } catch (_) {
    return false
  }
}

/** Ordner der App unter /local/ (für Updates der eingebauten Web-App auf dem Handy), z. B. "/local/lebenswelt-abc/". */
function paketPfad() {
  try {
    const o = require(`${__hooks}/app_paket.js`).zielordner()[0]
    return o ? "/local/" + o.split("/").pop() + "/" : ""
  } catch (_) {
    return ""
  }
}

/** Nur die volle Lebenswelt (Alex) koppelt Geräte. Gibt {ich} oder {status, fehler} für die Antwort zurück. */
function nurVoll(e) {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return { status: 401, fehler: h.KEINE_PERSON }
  if (ich.art === "geraet" || h.profilVon(ich) !== "voll") return { status: 403, fehler: { fehler: "Geräte koppeln geht nur in der vollen Lebenswelt." } }
  return { ich: ich }
}

function nurPerson(e) {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  return ich ? { ich: ich } : { status: 401, fehler: h.KEINE_PERSON }
}

/** Dateien der Einsatzwelt, die das Handy vom Server lädt (Reihenfolge = Ladereihenfolge). */
const EINSATZ_MODULE = ["regelwerk.js", "simulation.js", "pegel.js", "muell.js", "karte.js", "ablauf.js"]
const EINSATZ_ID = /^[A-Za-z0-9_:.-]{1,80}$/

module.exports = { nurVoll, nurPerson, EINSATZ_MODULE, EINSATZ_ID, ZIELE, zielVon, pfadErlaubt, codeNormal, kopplungGilt, schluesselGueltig, geraetName, geraetVon, fitnessPersonen, geraete, neueKopplung, koppeln, entkoppeln, paketPfad, CODE_ZEICHEN, CODE_LAENGE }
