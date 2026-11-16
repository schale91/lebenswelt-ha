// App-Protokoll: technische Ereignisse der Lebenswelt-App (Web und Android, auch Lebenswelt Fit), damit Claude
// Abstürze, unerwartete Neustarts und den Pausentimer nachvollziehen kann (Wunsch von Alex, 16.11.2026). Nur Technik:
// Art des Ereignisses, kurzer Text, ein paar Kennzahlen, keine Inhalte. Je Person, Gerät und Tag ein Dokument
// (typ applog), nach TAGE Tagen gelöscht. Lesen darf alle Protokolle nur die volle Lebenswelt (Alex), nie die
// Fitness-Welt. Die Funktionen hier sind rein und in Node getestet (test/app_protokoll.test.js).

const TAGE = 14
const MAX_JE_DOK = 600
const MAX_JE_ANFRAGE = 200
const ART = /^[a-z_]{1,30}$/
const GERAET = /^[A-Za-z0-9_-]{1,40}$/
const TAG = /^\d{4}-\d{2}-\d{2}$/
const ID = /^[A-Za-z0-9]{1,16}$/

/** Nur gültige Einträge: {i, z, a, t, d?}. Text auf 300 Zeichen, Kennzahlen (d) höchstens 1000 Zeichen JSON. */
function bereinige(eintraege) {
  const aus = []
  for (const e of Array.isArray(eintraege) ? eintraege.slice(0, MAX_JE_ANFRAGE) : []) {
    if (!e || typeof e !== "object") continue
    const z = Number(e.z)
    if (!ID.test(String(e.i || "")) || !isFinite(z) || z <= 0 || !ART.test(String(e.a || ""))) continue
    const x = { i: String(e.i), z: Math.round(z), a: String(e.a), t: String(e.t == null ? "" : e.t).slice(0, 300) }
    if (e.d && typeof e.d === "object" && !Array.isArray(e.d)) {
      const j = JSON.stringify(e.d)
      if (j.length <= 1000) x.d = JSON.parse(j)
    }
    aus.push(x)
  }
  return aus
}

/** Zusammenführen ohne Doppelte (gleiche i), nach Zeit sortiert, höchstens MAX_JE_DOK (die neuesten bleiben). */
function zusammen(alt, neu) {
  const je = {}
  for (const e of (alt || []).concat(neu || [])) if (e && e.i) je[e.i] = e
  return Object.keys(je)
    .map((k) => je[k])
    .sort((a, b) => a.z - b.z)
    .slice(-MAX_JE_DOK)
}

/** Erster Tag (JJJJ-MM-TT), der noch zählt, wenn heute der Tag `heute` ist und tage Tage bleiben. */
function ersterTag(heute, tage) {
  const d = new Date(Date.parse(heute + "T12:00:00Z") - (tage - 1) * 86400000)
  return d.toISOString().slice(0, 10)
}

/** Anfrage prüfen: {geraet, name?, tag, eintraege}. Ergebnis {fehler} oder {geraet, name, tag, eintraege}. */
function pruefe(body) {
  const b = body || {}
  const geraet = String(b.geraet || "")
  const tag = String(b.tag || "")
  if (!GERAET.test(geraet)) return { fehler: "geraet fehlt oder ist ungültig" }
  if (!TAG.test(tag)) return { fehler: "tag fehlt oder ist ungültig (JJJJ-MM-TT)" }
  const eintraege = bereinige(b.eintraege)
  if (!eintraege.length) return { fehler: "keine gültigen Einträge" }
  return { geraet: geraet, name: String(b.name || "").slice(0, 80), tag: tag, eintraege: eintraege }
}

module.exports = { TAGE, MAX_JE_DOK, bereinige, zusammen, ersterTag, pruefe }
