// Kaufbuch: Käufe im Einsatzspiel bucht der Server von den Münzen im Spielstand ab.
// Lädt ein Gerät danach einen Spielstand hoch, der diese Ausgaben noch nicht kennt, zieht der Server sie nach.
// Reine Funktionen, in Node getestet.

/** Münzen stehen im gespeicherten zustand-Stand unter daten.state.muenzen. */
function zustand(daten) {
  if (daten && daten.state && typeof daten.state === "object") return daten.state
  return null
}

/**
 * Gleicht einen hochgeladenen Spielstand mit dem Kaufbuch ab.
 * Gibt {daten, nachgezogen} zurück; nachgezogen > 0 heißt: Münzen wurden abgezogen, das Frontend muss den Stand übernehmen.
 */
function abgleich(daten, ausgaben) {
  const st = zustand(daten)
  if (!st || !ausgaben || !ausgaben.length) return { daten: daten, nachgezogen: 0 }
  const bekannt = Number(st.einsatzAusgabenBekannt || 0)
  let summe = 0
  let bis = bekannt
  for (const a of ausgaben) {
    if (a.zeit > bekannt) {
      summe += a.betrag
      bis = Math.max(bis, a.zeit)
    }
  }
  if (!summe) return { daten: daten, nachgezogen: 0 }
  const neu = JSON.parse(JSON.stringify(daten))
  neu.state.muenzen = Math.max(0, Number(neu.state.muenzen || 0) - summe)
  neu.state.einsatzAusgabenBekannt = bis
  return { daten: neu, nachgezogen: summe }
}

/** Bucht einen Kauf: zieht ab, merkt die Ausgabe. Gibt {daten, ausgabe} oder {fehler} zurück. */
function buche(daten, preis, jetzt, text) {
  const neu = JSON.parse(JSON.stringify(daten || { state: { muenzen: 0 }, version: 3 }))
  if (!neu.state) neu.state = { muenzen: 0 }
  const muenzen = Number(neu.state.muenzen || 0)
  if (muenzen < preis) return { fehler: "Zu wenig Münzen: " + preis + " nötig, " + muenzen + " vorhanden." }
  neu.state.muenzen = muenzen - preis
  neu.state.einsatzAusgabenBekannt = jetzt
  return { daten: neu, ausgabe: { zeit: jetzt, betrag: preis, text: text } }
}

module.exports = { abgleich, buche }
