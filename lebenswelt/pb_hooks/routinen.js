// Routinen (typ "routine"): Vorlagen für wiederkehrende Aufgaben, dienstlich wie privat. Ab 4 Uhr Ortszeit legt der
// Hintergrund jeden Tag die fälligen Aufgaben an (Schlüssel routine:<id>:<tag>, also höchstens eine je Tag, auch wenn
// sie gelöscht wurde). Dienstliche Routinen nur an Arbeitstagen laut Kalender (arbeit, homeoffice, dienst), ohne
// Kalender montags bis freitags.
//
// Unerledigtes stapelt sich nicht (Entscheidung vom 26.10.2026): Häufige Routinen (täglich oder an mehreren
// Wochentagen) verfallen am nächsten Morgen, seltene (ein Wochentag, monatlich) beim nächsten Termin. Verfallene
// Aufgaben werden weich gelöscht und bekommen verfallen: true, XP gibt es dafür keine.
//
// Daten einer Routine: {titel, rhythmus: "taeglich" | "wochentage" | "monatlich", tage: [0..6] (0 = Sonntag),
// monatstag: 1..31 (am Monatsende gekappt), sphaere, bereich, kontext, aufwand, energie, pausiert, serie, beste_serie,
// zuletzt}. Reine Funktionen in Node getestet (test/routinen.test.js). Hinweis für PocketBase (goja): ohne ?. und ??.

const TYP = "routine"
const RHYTHMEN = ["taeglich", "wochentage", "monatlich"]
const ARBEITSTAGE = ["arbeit", "homeoffice", "dienst"]
const ERLEDIGT = "Erledigt"
/** Ab dieser Stunde (Ortszeit) entstehen die Aufgaben des Tages */
const AB_STUNDE = 4

function wochentag(tag) {
  return new Date(String(tag).slice(0, 10) + "T12:00:00Z").getUTCDay()
}

function letzterTagImMonat(tag) {
  const t = String(tag).slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(t[0], t[1], 0)).getUTCDate()
}

function istDienstlich(r) {
  return String((r && r.sphaere) || "") === "Dienstlich"
}

/** Ist der Tag ein Arbeitstag? kalTag aus dem Kalender ({art}), sonst montags bis freitags. */
function arbeitstag(tag, kalTag) {
  if (kalTag && kalTag.art) return ARBEITSTAGE.indexOf(kalTag.art) >= 0
  const wt = wochentag(tag)
  return wt >= 1 && wt <= 5
}

/** Passt der Rhythmus auf den Tag (ohne Arbeitstag und Pause)? */
function imRhythmus(r, tag) {
  const rh = String(r.rhythmus || "taeglich")
  if (rh === "taeglich") return true
  if (rh === "wochentage") return (r.tage || []).map(Number).indexOf(wochentag(tag)) >= 0
  if (rh === "monatlich") {
    const soll = Math.max(1, Math.min(31, Math.floor(Number(r.monatstag) || 1)))
    const t = Number(String(tag).slice(8, 10))
    return t === Math.min(soll, letzterTagImMonat(tag))
  }
  return false
}

/** Ist die Routine an diesem Tag fällig? */
function faellig(r, tag, kalTag) {
  if (!r || r.pausiert || !String(r.titel || "").trim()) return false
  if (!imRhythmus(r, tag)) return false
  return !istDienstlich(r) || arbeitstag(tag, kalTag)
}

/** Häufige Routinen verfallen am nächsten Morgen, seltene erst beim nächsten Termin. */
function haeufig(r) {
  const rh = String(r.rhythmus || "taeglich")
  return rh === "taeglich" || (rh === "wochentage" && (r.tage || []).length >= 2)
}

/** Daten der Aufgabe für einen Tag. */
function aufgabeDaten(r, routineId, tag) {
  const d = {
    titel: String(r.titel).trim().slice(0, 200),
    status: "Nicht begonnen",
    faellig: tag,
    erstellt: tag,
    routine: routineId,
    priorisierung: "normal",
  }
  for (const k of ["sphaere", "bereich", "kontext", "aufwand", "energie"]) if (r[k]) d[k] = r[k]
  return d
}

/** Prüft eine Routine aus der App: wirft err.status = 400 bei Unsinn. */
function pruefe(r) {
  const fehler = (text) => {
    const e = new Error(text)
    e.status = 400
    return e
  }
  if (!String((r && r.titel) || "").trim()) throw fehler("titel fehlt.")
  if (RHYTHMEN.indexOf(String(r.rhythmus || "taeglich")) < 0) throw fehler("rhythmus muss taeglich, wochentage oder monatlich sein.")
  if (r.rhythmus === "wochentage" && !(r.tage || []).length) throw fehler("tage fehlen.")
  return true
}

/**
 * Was an einem Tag mit einer Routine passiert. instanzen: [{id, tag, status, geloescht}] (alle bisherigen Aufgaben
 * dieser Routine). Ergebnis: {anlegen: bool, verfallen: [ids], serie}.
 */
function plane(r, instanzen, tag, kalTag) {
  const heuteFaellig = faellig(r, tag, kalTag)
  const verfallen = []
  for (const i of instanzen) {
    if (i.geloescht || i.status === ERLEDIGT || i.tag >= tag) continue
    if (haeufig(r) || heuteFaellig) verfallen.push(i.id)
  }
  const schonDa = instanzen.some((i) => i.tag === tag)
  const anlegen = heuteFaellig && !schonDa
  let serie = Number(r.serie) || 0
  if (anlegen) {
    const vorher = instanzen.filter((i) => i.tag < tag).sort((a, b) => (a.tag < b.tag ? 1 : -1))[0]
    serie = vorher && vorher.status === ERLEDIGT ? serie + 1 : 0
  }
  return { anlegen, verfallen, serie }
}

// ---------------------------------------------------------------- Datenbank (nur in PocketBase)

function kalenderTag(app, besitzer, tag) {
  const d = require(`${__hooks}/einsatz/dienst.js`)
  const r = d.finde(app, besitzer, "kalender", "tage")
  if (!r) return null
  const tage = d.lies(r).tage || []
  for (const t of tage) if (t.tag === tag) return t
  return null
}

function lies(r) {
  return JSON.parse(toString(r.get("daten")) || "{}")
}

/** Fällige Aufgaben aller Routinen anlegen und Unerledigtes verfallen lassen. Gibt {angelegt, verfallen} zurück. */
function lauf(app, jetzt, nurBesitzer) {
  const S = require(`${__hooks}/einsatz/simulation.js`)
  const ms = jetzt === undefined ? Date.now() : jetzt
  if (S.ortszeit(ms).stunde < AB_STUNDE) return { angelegt: 0, verfallen: 0, zu_frueh: true }
  const tag = S._intern.tagVon(ms)
  const filter = nurBesitzer ? "typ = 'routine' && geloescht = false && besitzer = {:b}" : "typ = 'routine' && geloescht = false"
  const kalender = {}
  let angelegt = 0
  let verfallen = 0
  for (const rr of app.findRecordsByFilter("dokumente", filter, "created", 0, 0, { b: nurBesitzer || "" })) {
    const r = lies(rr)
    const besitzer = rr.getString("besitzer")
    if (!(besitzer in kalender)) kalender[besitzer] = kalenderTag(app, besitzer, tag)
    const praefix = "routine:" + rr.id + ":"
    const recs = app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = 'aufgabe' && schluessel ~ {:p}", "", 0, 0, { b: besitzer, p: praefix })
    const instanzen = recs.map((x) => {
      const d = lies(x)
      return { id: x.id, rec: x, daten: d, tag: x.getString("schluessel").slice(praefix.length), status: d.status, geloescht: x.getBool("geloescht") }
    })
    const p = plane(r, instanzen, tag, kalender[besitzer])
    for (const i of instanzen) {
      if (p.verfallen.indexOf(i.id) < 0) continue
      i.daten.verfallen = true
      i.rec.set("daten", i.daten)
      i.rec.set("geloescht", true)
      app.save(i.rec)
      verfallen++
    }
    if (!p.anlegen) continue
    const neu = new Record(app.findCollectionByNameOrId("dokumente"))
    neu.set("besitzer", besitzer)
    neu.set("typ", "aufgabe")
    neu.set("schluessel", praefix + tag)
    neu.set("geloescht", false)
    neu.set("daten", aufgabeDaten(r, rr.id, tag))
    app.save(neu)
    r.serie = p.serie
    r.beste_serie = Math.max(Number(r.beste_serie) || 0, p.serie)
    r.zuletzt = tag
    rr.set("daten", r)
    app.save(rr)
    angelegt++
  }
  return { angelegt, verfallen, tag }
}

module.exports = { TYP, RHYTHMEN, AB_STUNDE, wochentag, arbeitstag, imRhythmus, faellig, haeufig, aufgabeDaten, pruefe, plane, lauf }
