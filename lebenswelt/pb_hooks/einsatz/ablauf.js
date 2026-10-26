// Ein Schritt der Einsatzwelt ohne Datenbank: Warnungen, Pegel, Müllabfuhr und Simulation bis „jetzt“. Läuft auf dem
// Server (dienst.js, Minutentakt) und unverändert in Lebenswelt Fit auf dem Handy, das diese Datei mit regelwerk.js,
// simulation.js, pegel.js, muell.js und karte.js vom Server lädt (/api/lebenswelt/fit/einsatzpaket). So gelten auf
// beiden Seiten dieselben Regeln. Reine Funktionen, in Node getestet.

const HOOKS = typeof __hooks === "undefined" ? __dirname + "/.." : __hooks
const S = require(`${HOOKS}/einsatz/simulation.js`)
const P = require(`${HOOKS}/einsatz/pegel.js`)
const M = require(`${HOOKS}/einsatz/muell.js`)

/** Grobe Formprüfung eines geladenen Stands. */
function gueltig(stand) {
  return !!stand && typeof stand === "object" && isFinite(stand.bis) && !!stand.einsatzarten && Array.isArray(stand.laufend) && Array.isArray(stand.personal) && Array.isArray(stand.ausgaben)
}

/** Wirft, wenn irgendwo im Stand eine Zahl NaN oder unendlich ist. So wird ein kaputter Stand nie gespeichert. */
function pruefeZahlen(daten) {
  JSON.stringify(daten, (k, v) => {
    if (typeof v === "number" && !isFinite(v)) throw new Error("Ungültige Zahl in " + k)
    return v
  })
}

/** Zeiträume mit einer Unwetterwarnung ab UNWETTER_BEREITSCHAFT.stufe_min: [ab, bis] (für die Gerätehausbesetzung). */
function bereitschaftAus(R, warnungen) {
  const B = R.UNWETTER_BEREITSCHAFT
  if (!B) return []
  return warnungen
    .filter((w) => (Number(w.stufe) || 0) >= B.stufe_min)
    .map((w) => [w.ab, w.bis])
    .sort((a, b) => a[0] - b[0])
    .slice(-20)
}

/**
 * Schreibt den Stand bis jetzt fort. umwelt: {level, warnungen, wetter (Verlauf), pegel (Verlauf oder null),
 * abfall (Termine oder null)}. Gibt {stand, neu (neu entstandene Einsätze), wetter, warnungen (gerade geltende)} zurück.
 * Abgeschlossenes steht danach in stand.abgeschlossen; wohin es kommt, entscheidet der Aufrufer.
 */
function fortschreiben(R, stand, umwelt, jetzt) {
  const u = umwelt || {}
  const warnungen = Array.isArray(u.warnungen) ? u.warnungen : []
  const verlauf = Array.isArray(u.wetter) ? u.wetter : []
  // Level der Lebenswelt (nur steigend, XP gehen nie verloren); schaltet Dienste frei
  stand.level = Math.max(stand.level || 0, Number(u.level) || 0)
  const bekannt = new Set(stand.laufend.map((e) => e.id))
  // Echte Wetterwarnungen setzen das Spielwetter und passende Einsätze an
  stand = S.warnungenAusloesen(R, stand, warnungen, jetzt)
  stand.bereitschaft = bereitschaftAus(R, warnungen)
  // Echter Elbpegel: Lage, Hochwasser-Einsätze, Niedrigwasser beim Ansaugen
  stand = P.pegelAusloesen(R, stand, P.lage(R, u.pegel || null, jetzt), jetzt, S._intern.zufall)
  // Müllabfuhr nach dem Abfallkalender: Tonnen, Müllautos, Deponie
  stand = M.fortschreiben(R, stand, u.abfall || null, jetzt)
  stand = S.fortschreiben(stand, jetzt, (t) => S.wetterMitWarnungen(R, warnungen, verlauf, t), R)
  const gilt = warnungen.filter((w) => w.ab <= jetzt && jetzt < w.bis && S.warnungsRegel(R, w))
  return {
    stand: stand,
    neu: stand.laufend.filter((e) => !bekannt.has(e.id)),
    wetter: S.wetterMitWarnungen(R, warnungen, verlauf, jetzt),
    warnungen: gilt.map((w) => ({ name: w.name, stufe: w.stufe, bis: w.bis })),
  }
}

module.exports = { fortschreiben, gueltig, pruefeZahlen, bereitschaftAus }
