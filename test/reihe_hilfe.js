// Hilfe für Tests: Seit dem 17.11.2026 hängen die Grenzen des Einsatzspiels an der Freischaltreihe statt am Level.
// vorspulen(R, s, n) stellt den Zeiger der Reihe auf den letzten Schritt, an dem die Stufe noch höchstens n ist (also so
// weit wie früher Level n reichte). Ab der höchsten Stufe steht der Zeiger hinter dem letzten Schritt.
function vorspulen(R, s, n) {
  const L = R.FREISCHALTREIHE
  let i = 0
  if (n >= L[L.length - 1].fortschritt) i = L.length
  else if (n > 0) while (i + 1 < L.length && L[i + 1].fortschritt <= n) i++
  s.reihe = i
  s.freischalt_guthaben = 0
  s.stufe = i < L.length ? L[i].fortschritt : L[L.length - 1].fortschritt
  return s
}

/** Index eines Schritts der Reihe (wirft, wenn es ihn nicht gibt). */
function schritt(R, id) {
  const i = R.FREISCHALTREIHE.findIndex((x) => x.id === id)
  if (i < 0) throw new Error("Kein Schritt " + id)
  return i
}

/**
 * Großlagen über die Reihe freischalten, wie es 5-Sterne-Tage am Ende der Reihe tun: Zeiger auf die erste Großlage,
 * dann je ein gemerkter Tag, der sofort eingelöst wird. t: Zeitpunkt (Standard s.bis).
 */
function grosslagenFrei(R, S, s, t = s.bis) {
  s.reihe = R.FREISCHALTREIHE.findIndex((x) => x.grosslage)
  for (const x of R.FREISCHALTREIHE.filter((y) => y.grosslage)) {
    s.freischalt_guthaben = 1
    S._intern.reiheWeiter(R, s, t)
    if (!s.einsatzarten[x.art]) throw new Error(x.art + " nicht frei")
  }
  return s
}

/**
 * Pflicht der Reihe für Polizeieinsätze (17.11.2026): n Beamtinnen oder Beamte an die Dienststelle versetzen, ab zwei mit
 * der Polizeistation (Stufe 1). Wie ein Kauf im Shop; t ist der Kaufzeitpunkt.
 */
function mitPolizei(S, R, s, n = 1, t = s.bis) {
  if (n > 1 && (s.gebaeude.dienststelle || 0) < 1) s.gebaeude.dienststelle = 1
  let st = s
  while (st.personal.filter((p) => p.org === "polizei").length < n) {
    const r = S.kaufe(st, { art: "personal", id: "polizei" }, t, R)
    if (r.fehler) throw new Error(r.fehler)
    st = r.stand
  }
  return st
}

module.exports = { vorspulen, schritt, grosslagenFrei, mitPolizei }
