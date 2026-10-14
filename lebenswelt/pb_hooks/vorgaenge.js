// Regeln für Vorgänge (Alex OS), als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt.
//
// Warten auf LKA (KTA PMK): Bis zur Rückmeldung gibt es nichts zu tun. Wer einen Vorgang auf diesen Status setzt,
// bekommt automatisch eine Wiedervorlage in zwei Monaten als Frist, egal ob aus der App oder über Claude.
//
// Unteraufgaben (Aufgaben in einem Vorgang oder Projekt, Teilaufgaben, Unteraufgaben) bekommen beim Anlegen
// zwei Wochen als Fälligkeit, wenn keine mitkommt. Ändern lässt sie sich danach jederzeit.

const LKA_STATUS = "Warten auf LKA (KTA PMK)"
const WIEDERVORLAGE_MONATE = 2
const STD = 3600000
const UNTERAUFGABE_TAGE = 14

/** Kalendertag in Ortszeit (MEZ/MESZ) als JJJJ-MM-TT, wie im Einsatzspiel ohne Zeitzonendatenbank. */
function heute(ms) {
  const jetzt = ms === undefined ? Date.now() : ms
  const jahr = new Date(jetzt).getUTCFullYear()
  const letzterSonntag = (monat) => {
    const t = new Date(Date.UTC(jahr, monat + 1, 0, 1))
    t.setUTCDate(t.getUTCDate() - t.getUTCDay())
    return t.getTime()
  }
  const versatz = (jetzt >= letzterSonntag(2) && jetzt < letzterSonntag(9) ? 2 : 1) * STD
  return new Date(jetzt + versatz).toISOString().slice(0, 10)
}

/** Zwei Monate nach dem Tag, am Monatsende gekappt (31.12. wird 28. oder 29.02.). */
function wiedervorlage(tag) {
  const teile = String(tag).slice(0, 10).split("-").map(Number)
  const ziel = teile[1] - 1 + WIEDERVORLAGE_MONATE
  const jahr = teile[0] + Math.floor(ziel / 12)
  const monat = (ziel % 12) + 1
  const t = Math.min(teile[2], new Date(Date.UTC(jahr, monat, 0)).getUTCDate())
  const zwei = (n) => ("0" + n).slice(-2)
  return jahr + "-" + zwei(monat) + "-" + zwei(t)
}

/**
 * Ergänzt die Wiedervorlage, wenn ein Vorgang neu auf „Warten auf LKA“ steht. Eine Frist, die in derselben
 * Änderung mitkommt, bleibt unangetastet. Gibt die (eventuell ergänzten) Daten zurück.
 */
function ergaenzeFrist(typ, alt, neu, eingabe, tag) {
  if (typ !== "vorgang" || !neu || neu.status !== LKA_STATUS) return neu
  if (alt && alt.status === LKA_STATUS) return neu
  if (eingabe && Object.prototype.hasOwnProperty.call(eingabe, "frist")) return neu
  neu.frist = wiedervorlage(tag || heute())
  return neu
}

/** Tag plus n Kalendertage als JJJJ-MM-TT. */
function plusTage(tag, n) {
  const d = new Date(String(tag).slice(0, 10) + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Neue Unteraufgabe ohne Fälligkeit: zwei Wochen ab heute. Nur beim Anlegen, nicht bei Änderungen. */
function ergaenzeFaelligkeit(typ, neu, tag) {
  if (typ !== "aufgabe" && typ !== "unteraufgabe") return neu
  if (!neu || neu.faellig || neu.status === "Erledigt") return neu
  if (!neu.vorgang && !neu.eltern && typ !== "unteraufgabe") return neu
  neu.faellig = plusTage(tag || heute(), UNTERAUFGABE_TAGE)
  return neu
}

/** Zahl der Vorgänge beim LKA, deren Wiedervorlage genau heute fällig ist, je Besitzer. */
function heuteFaellig(app, tag) {
  const liste = app.findRecordsByFilter("dokumente", "typ = 'vorgang' && geloescht = false", "", 0, 0)
  const zahl = {}
  for (const r of liste) {
    const d = JSON.parse(toString(r.get("daten")) || "{}")
    if (d.status !== LKA_STATUS || String(d.frist || "").slice(0, 10) !== tag) continue
    const b = r.getString("besitzer")
    zahl[b] = (zahl[b] || 0) + 1
  }
  return zahl
}

/** Morgens an fällige Wiedervorlagen erinnern. Dienstliches bleibt in der Datenbank: kein Titel, keine Nummer. */
function erinnere(app) {
  const tag = heute()
  const zahl = heuteFaellig(app, tag)
  const push = require(`${__hooks}/push.js`)
  for (const b of Object.keys(zahl)) {
    const n = zahl[b]
    push.sende(app, b, {
      titel: "Wiedervorlage LKA (KTA PMK)",
      text: n === 1 ? "Ein Vorgang wartet seit zwei Monaten auf das LKA. Bitte Stand prüfen." : n + " Vorgänge warten seit zwei Monaten auf das LKA. Bitte Stand prüfen.",
      kanal: "allgemein",
      id: "lka-" + tag,
    })
  }
}

module.exports = { LKA_STATUS, heute, wiedervorlage, ergaenzeFrist, ergaenzeFaelligkeit, erinnere }
