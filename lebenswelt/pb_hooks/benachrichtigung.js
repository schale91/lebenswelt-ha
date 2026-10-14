// Benachrichtigung über die Home-Assistant-App auf dem Handy (notify.mobile_app_…), ganz ohne Firebase.
// Gilt nur für die Person mit voller Lebenswelt und nur für Nachrichten, die das ausdrücklich wollen (ha: true):
// Wünsche zur Freigabe, Spaziergang mit Nilo, Wiedervorlage beim LKA. Einsätze und Garmin bleiben in der eigenen App.
// Reine Funktionen, in Node getestet; der Aufruf an Home Assistant steht in push.js.

const DIENST = /^[a-z0-9_]{1,80}$/

/**
 * Name des notify-Dienstes (ohne "notify."), wenn diese Nachricht an diese Person über Home Assistant gehen soll.
 * vollePerson: ID der Person mit voller Lebenswelt (Option person oder die einzige ohne Fitness-Welt).
 */
function haDienst(optionen, besitzer, vollePerson, nachricht) {
  if (!nachricht || !nachricht.ha) return null
  const roh = String((optionen && optionen.ha_benachrichtigung) || "").trim().replace(/^notify\./, "")
  if (!DIENST.test(roh)) return null
  if (!vollePerson || String(besitzer) !== String(vollePerson)) return null
  return roh
}

/** Daten für den Dienstaufruf: Titel, Text, dazu tag und group, damit gleiche Nachrichten sich ersetzen. */
function haDaten(nachricht) {
  return {
    title: String(nachricht.titel || "Lebenswelt").slice(0, 120),
    message: String(nachricht.text || "").slice(0, 500),
    data: { tag: "lebenswelt-" + String(nachricht.id || "allgemein").slice(0, 60), group: "lebenswelt" },
  }
}

module.exports = { haDienst, haDaten }
