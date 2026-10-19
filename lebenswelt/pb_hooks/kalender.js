// Kalender der Person: je Tag Arbeit, Homeoffice, Dienst, frei, Urlaub, Feiertag oder Wochenende, mit Terminen.
// Damit weiß Claude, wann du arbeitest. Reine Funktionen ohne PocketBase, getestet in test/kalender.test.js.
// Konzept: docs/integrationen/KONZEPT.md, Abschnitt 7. Hinweis für PocketBase (goja): bewusst ohne ?. und ??.

const S = require(`${typeof __hooks === "undefined" ? __dirname : __hooks}/einsatz/simulation.js`)
const R = require(`${typeof __hooks === "undefined" ? __dirname : __hooks}/einsatz/regelwerk.js`)

const TAG = 24 * 3600 * 1000

const MUSTER = {
  urlaub: /urlaub|\bfrei\b|freizeitausgleich|\bfza\b|gleittag|\bkrank|elternzeit/i,
  homeoffice: /home ?office|mobiles? arbeit/i,
  dienst: /(?:^|[^a-zäöüß])(?:früh|spät|nacht|wochenend|bereitschafts|ruf)?dienst(?![a-zäöüß])|schicht|bereitschaft|lehrgang|fortbildung/i,
}

/** Ostersonntag (gregorianisch, anonymer Algorithmus) als JJJJ-MM-TT. */
function ostersonntag(jahr) {
  const a = jahr % 19
  const b = Math.floor(jahr / 100)
  const c = jahr % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tag = ((h + l - 7 * m + 114) % 31) + 1
  return jahr + "-" + String(monat).padStart(2, "0") + "-" + String(tag).padStart(2, "0")
}

function plusTage(tag, n) {
  return new Date(Date.parse(tag + "T12:00:00Z") + n * TAG).toISOString().slice(0, 10)
}

/** Gesetzliche Feiertage in Niedersachsen ({JJJJ-MM-TT: Name}), mit dem Reformationstag (seit 2018). */
function feiertage(jahr) {
  const o = ostersonntag(jahr)
  const aus = {}
  aus[jahr + "-01-01"] = "Neujahr"
  aus[plusTage(o, -2)] = "Karfreitag"
  aus[plusTage(o, 1)] = "Ostermontag"
  aus[jahr + "-05-01"] = "Tag der Arbeit"
  aus[plusTage(o, 39)] = "Christi Himmelfahrt"
  aus[plusTage(o, 50)] = "Pfingstmontag"
  aus[jahr + "-10-03"] = "Tag der Deutschen Einheit"
  aus[jahr + "-10-31"] = "Reformationstag"
  aus[jahr + "-12-25"] = "1. Weihnachtstag"
  aus[jahr + "-12-26"] = "2. Weihnachtstag"
  return aus
}

/** "HH:MM" in Ortszeit. */
function uhrzeit(ms) {
  const z = S.ortszeit(ms)
  return String(z.stunde).padStart(2, "0") + ":" + String(z.minute).padStart(2, "0")
}

/** Ein Ereignis des Home-Assistant-Kalenders als {titel, tage[], von, bis, ganztag}. */
function ereignis(e) {
  const titel = String((e && e.summary) || "").slice(0, 120)
  const st = (e && e.start) || {}
  const en = (e && e.end) || {}
  if (st.date) {
    const ende = en.date || plusTage(st.date, 1)
    const tage = []
    for (let t = st.date; t < ende && tage.length < 60; t = plusTage(t, 1)) tage.push(t)
    return { titel, tage, von: null, bis: null, ganztag: true }
  }
  const a = Date.parse(st.dateTime)
  const b = Date.parse(en.dateTime || st.dateTime)
  if (!isFinite(a)) return null
  const tage = []
  const letzter = S._intern.tagVon(Math.max(a, b - 1))
  for (let t = S._intern.tagVon(a); t <= letzter && tage.length < 7; t = plusTage(t, 1)) tage.push(t)
  return { titel, tage, von: uhrzeit(a), bis: uhrzeit(b), ganztag: false, ab: a, ende: b }
}

/** Abfuhrtermine im eigenen Kalender (Biotonne um 6 Uhr) gehören nicht zu den Terminen. */
function istAbfall(titel) {
  return require(`${typeof __hooks === "undefined" ? __dirname : __hooks}/einsatz/muell.js`).artVon(R, titel) !== null && !/rausstellen/i.test(titel)
}

/**
 * Tage ab `vonTag` (JJJJ-MM-TT, Ortszeit) einordnen. regel: "HH:MM-HH:MM" (Regelarbeitszeit für Werktage ohne Eintrag).
 * Je Tag: {tag, wochentag, art, sicher, von, bis, feiertag, termine:[{titel, von, bis, ganztag}]}.
 * art: urlaub, dienst, homeoffice, feiertag, wochenende oder arbeit (sicher: false, vermutet).
 */
function tage(ereignisse, vonTag, anzahl, regel) {
  const [rvon, rbis] = String(regel || "07:00-16:00").split("-")
  const liste = (ereignisse || []).map(ereignis).filter((x) => x && x.titel && !istAbfall(x.titel))
  const aus = []
  for (let i = 0; i < anzahl; i++) {
    const tag = plusTage(vonTag, i)
    const wt = new Date(tag + "T12:00:00Z").getUTCDay()
    const ft = feiertage(Number(tag.slice(0, 4)))[tag] || null
    const heute = liste.filter((x) => x.tage.indexOf(tag) >= 0)
    const termine = heute.map((x) => ({ titel: x.titel, von: x.von, bis: x.bis, ganztag: x.ganztag })).sort((a, b) => (a.von || "") < (b.von || "") ? -1 : 1)
    const urlaub = heute.find((x) => MUSTER.urlaub.test(x.titel))
    const dienst = heute.filter((x) => MUSTER.dienst.test(x.titel) && !/gottesdienst/i.test(x.titel))
    const ho = heute.find((x) => MUSTER.homeoffice.test(x.titel))
    let d = { tag, wochentag: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][wt], art: "arbeit", sicher: false, von: rvon, bis: rbis, feiertag: ft, termine }
    if (urlaub) d = Object.assign(d, { art: "urlaub", sicher: true, von: null, bis: null, grund: urlaub.titel })
    else if (dienst.length) {
      const zeiten = dienst.filter((x) => !x.ganztag)
      d = Object.assign(d, { art: "dienst", sicher: true, von: zeiten.length ? zeiten.map((x) => x.von).sort()[0] : rvon, bis: zeiten.length ? zeiten.map((x) => x.bis).sort().pop() : rbis, grund: dienst[0].titel })
    } else if (ho) d = Object.assign(d, { art: "homeoffice", sicher: true })
    else if (ft) d = Object.assign(d, { art: "feiertag", sicher: true, von: null, bis: null })
    else if (wt === 0 || wt === 6) d = Object.assign(d, { art: "wochenende", sicher: true, von: null, bis: null })
    aus.push(d)
  }
  return aus
}

module.exports = { tage, feiertage, ostersonntag, ereignis, MUSTER }
