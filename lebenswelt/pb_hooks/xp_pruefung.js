// Sonntagsprüfung: Levelt jemand zu schnell, oder ist er einfach fleißig?
// Als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt.
//
// Grundlage ist das XP-Tagebuch der App im Spielstand (zustand: daten.state.xpTage: {tag: {xp, n}}) und als Nachweis, was in der
// Datenbank in der Woche erledigt oder eingetragen wurde (Aufgaben, Vorgänge, Garmin, Kraftbuch, Bewegungen).
// Mehr XP bei entsprechend mehr Erledigtem gilt als Fleiß. Auffällig ist, wenn XP ohne passende Nachweise steigen.
// Ergebnis: ein Dokument typ "xp_pruefung" bei der Person mit voller Lebenswelt und, wenn etwas auffällt,
// eine Nachricht an sie (auch für Personen mit Fitness-Welt).

const TAG_MS = 86400000
const VERGLEICHSWOCHEN = 4
const MIN_XP_AUFFAELLIG = 300

function plusTage(tag, n) {
  const d = new Date(String(tag).slice(0, 10) + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function tageVon(montag) {
  const liste = []
  for (let i = 0; i < 7; i++) liste.push(plusTage(montag, i))
  return liste
}

const datumDe = (tag) => tag.slice(8, 10) + "." + tag.slice(5, 7) + "."
const rund = (x) => Math.round(x)

function median(werte) {
  const s = werte.slice().sort((a, b) => a - b)
  if (!s.length) return 0
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Level wie in der App (regeln.ts): der Schritt von Level n auf n + 1 kostet 100 · (n + 1)^1,4 XP. */
function levelAusXp(xp) {
  let level = 0
  let rest = xp
  while (rest >= Math.round(100 * Math.pow(level + 1, 1.4))) {
    rest -= Math.round(100 * Math.pow(level + 1, 1.4))
    level++
  }
  return level
}

/**
 * Bewertet die Woche, die am Sonntag `sonntag` endet.
 * eingabe: { name, profil, xpTage: {tag: {xp, n}}, nachweise: {tag: zahl}, gesamtXp }
 */
function bewerte(eingabe, sonntag) {
  const xpTage = eingabe.xpTage || {}
  const nachweise = eingabe.nachweise || {}
  const xpAm = (t) => (xpTage[t] && Number(xpTage[t].xp)) || 0
  const nAm = (t) => Number(nachweise[t]) || 0
  const woche = tageVon(plusTage(sonntag, -6))
  const xpWoche = rund(woche.reduce((a, t) => a + xpAm(t), 0))
  const nWoche = woche.reduce((a, t) => a + nAm(t), 0)

  // Vergleich: die vier Wochen davor, soweit es dafür schon Tagebuch gibt
  const vorher = []
  for (let k = 1; k <= VERGLEICHSWOCHEN; k++) {
    const tage = tageVon(plusTage(sonntag, -6 - 7 * k))
    if (!tage.some((t) => xpTage[t])) continue
    vorher.push({ xp: tage.reduce((a, t) => a + xpAm(t), 0), n: tage.reduce((a, t) => a + nAm(t), 0) })
  }
  const schnittXp = vorher.length ? vorher.reduce((a, w) => a + w.xp, 0) / vorher.length : null
  const schnittN = vorher.length ? vorher.reduce((a, w) => a + w.n, 0) / vorher.length : null

  const hinweise = []
  let fleissig = false
  if (schnittXp !== null && xpWoche >= MIN_XP_AUFFAELLIG && xpWoche > 2 * schnittXp) {
    const mehrErledigt = schnittN !== null && nWoche >= 1.5 * Math.max(schnittN, 1)
    const proNachweis = nWoche ? xpWoche / nWoche : Infinity
    const schnittProNachweis = schnittN ? schnittXp / schnittN : null
    const passendJeEintrag = schnittProNachweis === null || proNachweis <= 1.5 * schnittProNachweis
    if (mehrErledigt && passendJeEintrag) fleissig = true
    else hinweise.push(`${xpWoche} XP statt sonst etwa ${rund(schnittXp)}, aber nicht entsprechend mehr erledigt oder eingetragen (${nWoche} statt etwa ${rund(schnittN || 0)}).`)
  }
  if (xpWoche >= MIN_XP_AUFFAELLIG && nWoche === 0) hinweise.push(`${xpWoche} XP in der Woche, aber nichts Erledigtes oder Eingetragenes gefunden.`)

  // Ausreißertage gegen die üblichen Tage der letzten Wochen (nur Tage mit XP)
  const frueher = Object.keys(xpTage).filter((t) => t < woche[0] && xpAm(t) > 0)
  if (frueher.length >= 5) {
    const ueblichXp = median(frueher.map(xpAm))
    const ueblichN = median(frueher.map(nAm))
    for (const t of woche) {
      if (xpAm(t) >= 200 && xpAm(t) >= 3 * ueblichXp && nAm(t) <= Math.max(ueblichN, 1)) {
        hinweise.push(`Am ${datumDe(t)}: ${rund(xpAm(t))} XP an einem Tag (sonst etwa ${rund(ueblichXp)}), dabei nur ${nAm(t)} Nachweise.`)
      }
    }
  }

  const gesamt = Number(eingabe.gesamtXp) || 0
  const levelJetzt = levelAusXp(gesamt)
  const levelVorher = levelAusXp(Math.max(0, gesamt - xpWoche))
  const levelSprung = levelJetzt - levelVorher
  if (levelSprung >= 2 && !fleissig) hinweise.push(`${levelSprung} Level in einer Woche (${levelVorher} auf ${levelJetzt}). Vielleicht ist die Levelkurve zu großzügig.`)

  return {
    name: eingabe.name || "",
    profil: eingabe.profil || "voll",
    woche: { von: woche[0], bis: sonntag },
    xpWoche: xpWoche,
    nachweise: nWoche,
    schnittXp: schnittXp === null ? null : rund(schnittXp),
    schnittNachweise: schnittN === null ? null : rund(schnittN),
    vergleichswochen: vorher.length,
    levelVorher: levelVorher,
    levelJetzt: levelJetzt,
    fleissig: fleissig,
    auffaellig: hinweise.length > 0,
    hinweise: hinweise,
  }
}

/** Tag (Ortszeit) eines Zeitpunkts als JJJJ-MM-TT. */
function tagVon(wert) {
  const ms = typeof wert === "number" ? wert : Date.parse(String(wert))
  if (!isFinite(ms)) return null
  return require(`${__hooks}/vorgaenge.js`).heute(ms)
}

/** Nachweise je Tag für eine Person: Erledigtes, Garmin, Kraftbuch-Sätze und Bewegungen aus dem Spielstand. */
function nachweiseVon(app, besitzer, spielstand, ab) {
  const zahl = {}
  const zaehle = (t) => {
    if (t && t >= ab) zahl[t] = (zahl[t] || 0) + 1
  }
  const docs = app.findRecordsByFilter("dokumente", "besitzer = {:b} && geloescht = false && (typ = 'aufgabe' || typ = 'unteraufgabe' || typ = 'vorgang' || typ = 'aktivitaet' || typ = 'trainingslog')", "", 0, 0, { b: besitzer })
  for (const r of docs) {
    const d = JSON.parse(toString(r.get("daten")) || "{}")
    const typ = r.getString("typ")
    if (typ === "aktivitaet") zaehle(tagVon(d.start))
    else if (typ === "trainingslog") {
      for (const uebung of Object.values(d.sets || {})) for (const satz of Object.values(uebung || {})) if (satz && satz.updatedAt) zaehle(tagVon(satz.updatedAt))
    } else if (d.status === "Erledigt" && d.erledigt_am) zaehle(tagVon(d.erledigt_am))
  }
  for (const b of (spielstand && spielstand.bewegungen) || []) zaehle(b && b.datum)
  return zahl
}

/** Sonntagsprüfung für alle Personen. Gibt die Ergebnisse zurück. */
function pruefeAlle(app, jetzt) {
  const sonntag = require(`${__hooks}/vorgaenge.js`).heute(jetzt === undefined ? Date.now() : jetzt)
  const ab = plusTage(sonntag, -6 - 7 * VERGLEICHSWOCHEN)
  const ergebnisse = []
  const hauptpersonen = []
  for (const r of app.findRecordsByFilter("spielstaende", "benutzer != ''", "", 0, 0)) {
    let daten = {}
    try {
      const roh = JSON.parse(toString(r.get("daten")) || "{}") || {}
      // zustand speichert {state, version}; der Stand selbst liegt unter state
      daten = roh.state && typeof roh.state === "object" ? roh.state : roh
    } catch (_) {
      continue
    }
    const besitzer = r.getString("benutzer")
    const profil = r.getString("profil") || "voll"
    if (profil !== "fitness") hauptpersonen.push(besitzer)
    const gesamtXp = Object.values(daten.skillXp || {}).reduce((a, b) => a + (Number(b) || 0), 0)
    ergebnisse.push(bewerte({ name: r.getString("name"), profil: profil, xpTage: daten.xpTage, nachweise: nachweiseVon(app, besitzer, daten, ab), gesamtXp: gesamtXp }, sonntag))
  }
  const sammlung = app.findCollectionByNameOrId("dokumente")
  const auffaellig = ergebnisse.filter((e) => e.auffaellig)
  for (const b of hauptpersonen) {
    let doc
    try {
      doc = app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = 'xp_pruefung' && schluessel = {:s}", { b: b, s: sonntag })
    } catch (_) {
      doc = new Record(sammlung)
      doc.set("besitzer", b)
      doc.set("typ", "xp_pruefung")
      doc.set("schluessel", sonntag)
    }
    doc.set("daten", { sonntag: sonntag, personen: ergebnisse, auffaellig: auffaellig.length > 0, besprochen: false })
    doc.set("geloescht", false)
    app.save(doc)
    if (!auffaellig.length) continue
    const wer = auffaellig.map((e) => (e.profil === "fitness" ? e.name || "Fitness-Welt" : "dich")).join(" und ")
    require(`${__hooks}/push.js`).sende(app, b, {
      titel: "Sonntagsprüfung XP",
      text: `Bei ${wer} passen XP und Erledigtes diese Woche nicht ganz zusammen. ${auffaellig[0].hinweise[0]}`,
      kanal: "allgemein",
      id: "xp-pruefung-" + sonntag,
      ha: true,
    })
  }
  return ergebnisse
}

module.exports = { bewerte, levelAusXp, pruefeAlle, _intern: { plusTage, median } }
