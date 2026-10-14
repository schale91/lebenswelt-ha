// Fitness-Welt und Familie. Personen in der Option fitness_personen bekommen in der App nur die Fitness-Welt:
// dieselbe Karte, dasselbe Einsatzspiel und derselbe Shop, aber kein Smarthome, keine Aufgaben, kein Kraftbuch und
// kein Update-Knopf. Ihre Bewegung (Schritte, Physio, Nilo schieben) sieht die ganze Familie, damit der Buggy auf
// jeder Karte schiebt. Reine Funktionen, in Node getestet.

/** Steht die Person (HA-Benutzer-ID oder Anmeldename, Groß- und Kleinschreibung egal) in der Liste? */
function istFitness(ich, liste) {
  if (!ich || !Array.isArray(liste)) return false
  const namen = liste.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
  return namen.indexOf(String(ich.id || "").toLowerCase()) >= 0 || (!!ich.name && namen.indexOf(String(ich.name).toLowerCase()) >= 0)
}

const ARTEN = ["schritte", "heimphysio", "praxisphysio", "nilo"]
const zahlOder = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : undefined)

/**
 * Bewegung aus einem gespeicherten Spielstand (zustand: daten.state.bewegungen), nur ab dem Tag `ab` (JJJJ-MM-TT) und
 * nur die Felder, die die Familie braucht. Unbrauchbare Einträge fallen heraus.
 */
function bewegungAus(daten, ab) {
  const st = daten && daten.state && typeof daten.state === "object" ? daten.state : null
  const liste = st && Array.isArray(st.bewegungen) ? st.bewegungen : []
  const raus = []
  for (const b of liste) {
    if (!b || ARTEN.indexOf(b.art) < 0 || typeof b.datum !== "string" || b.datum < ab) continue
    const e = { id: String(b.id || ""), art: b.art, datum: b.datum, zeit: Number(b.zeit) || 0, xp: Number(b.xp) || 0 }
    const s = zahlOder(b.schritte)
    const m = zahlOder(b.minuten)
    const bis = zahlOder(b.bis)
    if (s !== undefined) e.schritte = s
    if (m !== undefined) e.minuten = m
    if (bis !== undefined) e.bis = bis
    raus.push(e)
  }
  return raus
}

/** Schrittziel aus dem Spielstand, sonst 5000. */
function schrittzielAus(daten) {
  const z = daten && daten.state ? Number(daten.state.schrittziel) : NaN
  return isFinite(z) && z > 0 ? z : 5000
}

/** Tag (JJJJ-MM-TT) vor n Tagen, in UTC gerechnet; ein Tag Unschärfe ist hier egal. */
function tagVor(jetzt, tage) {
  return new Date(jetzt - tage * 86400000).toISOString().slice(0, 10)
}

/** Neue Spaziergänge mit Nilo in einem hochgeladenen Spielstand (nicht im alten, höchstens zwei Stunden alt). */
function neueNilo(alt, neu, jetzt) {
  const bekannt = new Set(bewegungAus(alt, "0000").map((b) => b.id))
  return bewegungAus(neu, "0000").filter((b) => b.art === "nilo" && !bekannt.has(b.id) && b.zeit > jetzt - 2 * 3600000)
}

/** Erinnerung am Abend: heute (JJJJ-MM-TT, Ortszeit) noch keine Bewegung eingetragen? */
function braucheErinnerung(daten, heute) {
  return !bewegungAus(daten, heute).some((b) => b.datum === heute)
}

const WUNSCH_STATUS = ["offen", "freigegeben", "abgelehnt", "umgesetzt"]

/**
 * Wunsch zur Freigabe (Dokument typ "freigabe", aufbereitet von der Samstags-Routine) für die Familie: nur was der
 * Wünschende über den Stand seines Wunsches wissen muss, ohne die Aufbereitung.
 */
function wunschFuerFamilie(d) {
  const x = d && d.daten ? d.daten : {}
  return {
    id: String(d.id || ""),
    vorschlag: String(x.vorschlag || ""),
    titel: String(x.titel || ""),
    status: WUNSCH_STATUS.indexOf(x.status) >= 0 ? x.status : "offen",
    anmerkung: String(x.anmerkung || ""),
  }
}

/** Wie viele neu angelegte Freigaben warten noch? Für die Push-Nachricht nach dem Anlegen. */
function offeneFreigaben(dokumente) {
  return (dokumente || []).filter((d) => d.typ === "freigabe" && (!d.daten || !d.daten.status || d.daten.status === "offen")).length
}

module.exports = { istFitness, bewegungAus, schrittzielAus, tagVor, neueNilo, braucheErinnerung, wunschFuerFamilie, offeneFreigaben }
