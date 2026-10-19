// Müllabfuhr nach dem echten Abfallkalender: Tonnen am Vorabend, Müllautos am Abholtag, Deponie, XP und Serie.
// Reine Funktionen ohne PocketBase, in Node getestet (test/muell.test.js). Konzept: docs/integrationen/KONZEPT.md, 4.
// Hinweis für PocketBase (goja): bewusst ohne ?. und ??.

const S = require(`${typeof __hooks === "undefined" ? __dirname + "/.." : __hooks}/einsatz/simulation.js`)

const MIN = 60 * 1000
const STD = 60 * MIN
const TAG = 24 * STD
const ZUHAUSE = "zuhause"
const I = S._intern

function kopie(o) {
  return JSON.parse(JSON.stringify(o))
}

/** Zeitpunkt (ms) zu einem Kalendertag (JJJJ-MM-TT) und einer Uhrzeit in Ortszeit. */
function ortsZeit(tag, stunde, minute) {
  const roh = Date.parse(tag + "T00:00:00Z") + ((stunde || 0) * 60 + (minute || 0)) * MIN
  return roh - I.ortsversatz(roh - I.ortsversatz(roh))
}

function vortag(tag) {
  return new Date(Date.parse(tag + "T12:00:00Z") - TAG).toISOString().slice(0, 10)
}

/** Abfallart zu einem Terminnamen ("Hausmüll 14-täglich" → restmuell), sonst null. */
function artVon(R, name) {
  const n = String(name || "").toUpperCase()
  for (const [id, a] of Object.entries(R.ABFALL.arten)) if (a.muster.some((m) => n.indexOf(m) >= 0)) return id
  return null
}

/**
 * Termine aus den Ereignissen eines Home-Assistant-Kalenders ({summary, start: {date | dateTime}}). Gleiche Art am
 * gleichen Tag ist eine Abfuhr (Hausmüll 14-täglich und 4-wöchentlich). Unbekannte Namen werden übergangen.
 */
function termineAus(R, ereignisse) {
  const aus = []
  for (const e of ereignisse || []) {
    const start = e && e.start
    const tag = start && (start.date || (start.dateTime ? I.tagVon(Date.parse(start.dateTime)) : null))
    const art = artVon(R, e && e.summary)
    if (!tag || !/^\d{4}-\d{2}-\d{2}$/.test(tag) || !art) continue
    if (!aus.some((x) => x.tag === tag && x.art === art)) aus.push({ tag, art, name: String(e.summary).slice(0, 60) })
  }
  return aus.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : a.art < b.art ? -1 : 1))
}

/** Häuser mit Tonnen: dein Zuhause und alle fertigen Wohnhäuser. */
function haeuser(R, s) {
  const aus = []
  const z = R.ORTE.elternhaus
  if (z) aus.push({ id: ZUHAUSE, x: z.x, z: z.z })
  for (const h of s.haeuser || []) {
    if (h.im_bau) continue
    const p = I.bauplatz(R, h.bauplatz)
    if (p) aus.push({ id: h.id, x: p.x, z: p.z })
  }
  return aus
}

function neuerTermin(R, t) {
  const a = R.ABFALL
  const ab = ortsZeit(t.tag, a.abfuhr_ab, a.arten[t.art].versatz_min || 0)
  return {
    id: t.tag + ":" + t.art,
    tag: t.tag,
    art: t.art,
    name: t.name,
    vorabend: ortsZeit(vortag(t.tag), a.vorabend_ab),
    abfuhr_ab: ab,
    reinholen: ortsZeit(t.tag, a.reinholen_bis),
    raus: {},
    rein: {},
    abfuhr: null,
    ergebnis: null,
    xp: 0,
    abgeholt: false,
  }
}

function leerM() {
  return { termine: {}, serie: 0, serie_best: 0, deponie: {}, deponie_abgefahren: 0, abgelagert: 0 }
}

/** Nimmt die Deponie in ihrer jetzigen Stufe diese Abfallart an? */
function deponieNimmt(R, s, art) {
  const st = R.GEBAEUDE.deponie && R.GEBAEUDE.deponie[(s.gebaeude && s.gebaeude.deponie) || 0]
  return Boolean(st && st.nimmt && st.nimmt.indexOf(art) >= 0 && R.ORTE.deponie)
}

const runde = (p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]

/**
 * Fahrt eines Müllautos: vom Start (Deponie oder Ortseingang) über das Straßennetz immer zum nächsten Haus mit der
 * richtigen Tonne an der Straße, je Tonne halt_s, danach zur Deponie oder aus der Stadt. Ohne Tonnen fährt es nicht.
 */
function planeAbfuhr(R, s, T) {
  const A = R.ABFALL
  const m = R.METER_JE_EINHEIT
  const zurDeponie = deponieNimmt(R, s, T.art)
  const basis = zurDeponie ? R.ORTE.deponie : R.ORTE.ortseingang || R.ORTE.feuerwehrhaus
  const offen = haeuser(R, s).filter((h) => {
    const r = T.raus[h.id]
    const rein = T.rein[h.id]
    return r && r.art === T.art && r.t <= T.abfuhr_ab && !(rein && rein <= T.abfuhr_ab)
  })
  const plan = { art: T.art, start: T.abfuhr_ab, ende: T.abfuhr_ab, von: zurDeponie ? "deponie" : "ortseingang", ziel: zurDeponie ? "deponie" : "ortseingang", wege: [], halte: [], geleert: 0 }
  if (!offen.length) return plan
  let t = T.abfuhr_ab
  let pos = { x: basis.x, z: basis.z }
  const fahre = (ziel, tempo) => {
    const punkte = I.strassenroute(R, pos, ziel)
    const dauer = Math.round(((I.linienLaenge(punkte) * m) / tempo) * 1000)
    plan.wege.push({ ab: t, an: t + dauer, punkte: punkte.map(runde) })
    t += dauer
    pos = { x: ziel.x, z: ziel.z }
  }
  while (offen.length) {
    let i = 0
    let best = Infinity
    offen.forEach((h, k) => {
      const d = S.strassenweg(R, pos, h)
      if (d < best || (d === best && h.id < offen[i].id)) {
        best = d
        i = k
      }
    })
    const h = offen.splice(i, 1)[0]
    fahre(h, A.tempo_ms)
    plan.halte.push({ haus: h.id, x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10, an: t, ab: t + A.halt_s * 1000 })
    t += A.halt_s * 1000
  }
  fahre(basis, A.transfer_ms)
  plan.ende = t
  plan.geleert = plan.halte.length
  return plan
}

/** Serienbonus für die n-te richtige Abfuhr in Folge. */
function serienBonus(R, n) {
  let xp = 0
  for (const st of R.ABFALL.xp.serie) if (n >= st.ab) xp = st.xp
  return xp
}

/**
 * Müllabfuhr bis jetzt fortschreiben: neue Termine übernehmen, am Vorabend die Tonnen der Einwohner rausstellen (und
 * vielleicht einen Mülltonnenbrand ansetzen), ab Abfuhrbeginn die Müllautos planen, deine Tonne werten, die Deponie
 * füllen und einen Brand im Müllfahrzeug anmelden. Vor dem Fortschreiben der Einsatzwelt aufrufen.
 * termine: aus termineAus, null = Kalender gerade nicht lesbar (dann nur Bekanntes weiterrechnen).
 */
function fortschreiben(R, stand, termine, jetzt) {
  if (!R.ABFALL) return stand
  const s = kopie(stand)
  const A = R.ABFALL
  const m = s.muell || leerM()
  s.muell = m
  if (termine) {
    for (const t of termine) {
      const id = t.tag + ":" + t.art
      if (!m.termine[id] && ortsZeit(t.tag, 23, 59) > jetzt) m.termine[id] = neuerTermin(R, t)
    }
    // Abgesagt oder verschoben (Feiertag): Termine, deren Vorabend noch nicht begonnen hat, verschwinden
    for (const [id, T] of Object.entries(m.termine)) if (T.vorabend > jetzt && !termine.some((t) => t.tag + ":" + t.art === id)) delete m.termine[id]
  }
  const liste = Object.values(m.termine).sort((a, b) => a.abfuhr_ab - b.abfuhr_ab || (a.id < b.id ? -1 : 1))
  for (const T of liste) {
    if (jetzt >= T.vorabend && !T.einwohner) {
      T.einwohner = true
      const von = ortsZeit(vortag(T.tag), A.rausstellen[0])
      const bis = ortsZeit(vortag(T.tag), A.rausstellen[1])
      for (const h of haeuser(R, s)) {
        if (h.id === ZUHAUSE || T.raus[h.id]) continue
        const r = I.zufall(s.zufall + ":muell:" + T.id + ":" + h.id)
        if (r() < A.vergessen) continue
        T.raus[h.id] = { t: von + Math.round(r() * (bis - von)), art: T.art, von: "einwohner" }
      }
      // Draußen stehende Tonnen werden nachts öfter angezündet (nur wenn der Mülltonnenbrand gekauft ist)
      const st = s.einsatzarten && s.einsatzarten.b_muelltonne
      const rb = I.zufall(s.zufall + ":tonnenbrand:" + T.id)
      if (st && rb() < A.tonnenbrand_anteil) {
        const nacht = Math.max(ortsZeit(vortag(T.tag), 22) + Math.round(rb() * 5 * STD), s.bis)
        if (nacht < T.abfuhr_ab) st.naechster = Math.min(st.naechster, nacht)
      }
    }
    if (jetzt >= T.abfuhr_ab && !T.abfuhr) {
      T.abfuhr = planeAbfuhr(R, s, T)
      werte(R, s, T)
    }
  }
  // Haufen auf der Deponie: Papier, Gelb und Kompost werden regelmäßig abgefahren; auf der Deponie der höchsten Stufe
  // bleibt ein Teil liegen (abgelagert)
  if (jetzt - (m.deponie_abgefahren || 0) >= A.abfahren_tage * TAG) {
    m.deponie = {}
    m.deponie_abgefahren = jetzt
  }
  // Erledigte Termine eine Woche behalten (XP abholen), dann vergessen
  for (const [id, T] of Object.entries(m.termine)) if (T.reinholen < jetzt - 7 * TAG) delete m.termine[id]
  return s
}

/** Abfuhr werten: deine Tonne, Nachbarschaftshilfe, Serie, Deponie, Brand im Müllfahrzeug. */
function werte(R, s, T) {
  const A = R.ABFALL
  const m = s.muell
  const plan = T.abfuhr
  const geleert = new Set(plan.halte.map((h) => h.haus))
  const meine = T.raus[ZUHAUSE]
  T.ergebnis = geleert.has(ZUHAUSE) ? "richtig" : meine && meine.art !== T.art ? "falsch" : "fehlt"
  if (T.ergebnis === "richtig") {
    m.serie += 1
    m.serie_best = Math.max(m.serie_best || 0, m.serie)
    T.xp += A.xp.richtig + serienBonus(R, m.serie)
  } else m.serie = 0
  const nachbarn = Object.entries(T.raus).filter(([h, r]) => h !== ZUHAUSE && r.von === "du" && geleert.has(h)).length
  T.xp += Math.min(A.xp.nachbar_max, nachbarn) * A.xp.nachbar
  T.serie = m.serie
  if (plan.ziel === "deponie" && plan.geleert) {
    m.deponie[T.art] = (m.deponie[T.art] || 0) + plan.geleert
    if ((s.gebaeude.deponie || 0) >= 4) m.abgelagert = (m.abgelagert || 0) + plan.geleert
  }
  // Brand im Müllfahrzeug: fest je Termin, dort, wo das Auto gerade hält
  const r = I.zufall(s.zufall + ":muellbrand:" + T.id)
  if (plan.halte.length && s.einsatzarten && s.einsatzarten.b_muellfahrzeug && r() < A.brand_anteil) {
    const h = plan.halte[Math.floor(r() * plan.halte.length)]
    s.angemeldet = (s.angemeldet || []).concat([{ id: "muell:" + T.id, art: "b_muellfahrzeug", t: Math.max(h.an, s.bis), x: h.x, z: h.z }])
  }
}

/** Termine, deren Vorabend läuft (Tonnen dürfen raus). */
function aktive(m, jetzt) {
  return Object.values((m && m.termine) || {}).filter((T) => T.vorabend <= jetzt && jetzt < T.abfuhr_ab)
}

/**
 * Eine Tonne an die Straße stellen oder reinholen ({haus, art, rein}). haus: "zuhause" oder ein Wohnhaus, bei dem die
 * Tonne vergessen wurde (Nachbarschaftshilfe, erst nach dem Rausstellen der Einwohner). Gibt {stand, richtig, text}
 * oder {fehler} zurück.
 */
function tonne(R, stand, auftrag, jetzt) {
  const s = kopie(stand)
  const A = R.ABFALL
  const m = s.muell || leerM()
  s.muell = m
  const haus = String(auftrag.haus || ZUHAUSE)
  const art = String(auftrag.art || "")
  if (!A.arten[art]) return { fehler: "Diese Tonne gibt es nicht." }
  if (!haeuser(R, s).some((h) => h.id === haus)) return { fehler: "Unbekanntes Haus." }
  const name = A.arten[art].name
  if (auftrag.rein) {
    let n = 0
    for (const T of Object.values(m.termine)) {
      const r = T.raus[haus]
      if (r && r.art === art && !(T.rein[haus] <= jetzt) && r.t <= jetzt) {
        T.rein[haus] = jetzt
        n++
      }
    }
    if (!n) return { fehler: "Die " + name + " steht nicht an der Straße." }
    return { stand: s, richtig: true, text: name + " ist wieder am Haus." }
  }
  const offen = aktive(m, jetzt)
  if (!offen.length) {
    const naechster = Object.values(m.termine).filter((T) => T.vorabend > jetzt).sort((a, b) => a.vorabend - b.vorabend)[0]
    return { fehler: "Heute Abend kommt keine Müllabfuhr." + (naechster ? " Nächste: " + A.arten[naechster.art].name + " am " + naechster.tag.split("-").reverse().join(".") + "." : "") }
  }
  if (haus !== ZUHAUSE) {
    const r0 = ortsZeit(vortag(offen[0].tag), A.rausstellen[1])
    if (jetzt < r0) return { fehler: "Die Nachbarn stellen ihre Tonnen bis " + A.rausstellen[1] + " Uhr selbst raus." }
    const schon = offen.some((T) => T.raus[haus])
    if (schon) return { fehler: "Bei diesem Haus steht schon eine Tonne draußen." }
    const geholfen = offen[0] ? Object.values(offen[0].raus).filter((r) => r.von === "du").length : 0
    if (geholfen >= A.xp.nachbar_max) return { fehler: "Heute hast du schon genug Nachbarn geholfen." }
  }
  const passend = offen.filter((T) => T.art === art)
  if (passend.length) {
    for (const T of passend) {
      T.raus[haus] = { t: jetzt, art, von: "du" }
      delete T.rein[haus]
    }
    // Eine falsche Tonne, die vorher rausgestellt wurde, kommt zurück
    for (const T of offen) if (T.art !== art && T.raus[haus] && T.raus[haus].art !== T.art) delete T.raus[haus]
    return { stand: s, richtig: true, text: name + " steht an der Straße. Morgen wird sie geleert." }
  }
  for (const T of offen) if (!T.raus[haus] || T.raus[haus].art !== T.art) T.raus[haus] = { t: jetzt, art, von: "du", falsch: true }
  const sollen = offen.map((T) => A.arten[T.art].name).join(" und ")
  return { stand: s, richtig: false, text: "Morgen kommt " + sollen + ", nicht " + name + ". Die Tonne bleibt stehen, bis du die richtige rausstellst." }
}

/** XP einer erledigten Abfuhr abholen (ohne id: alle offenen). Gibt {stand, xp} zurück. */
function abholen(stand, id) {
  const s = kopie(stand)
  let xp = 0
  for (const T of Object.values((s.muell && s.muell.termine) || {})) {
    if ((id && T.id !== id) || T.abgeholt || !T.xp) continue
    T.abgeholt = true
    xp += T.xp
  }
  return { stand: s, xp }
}

/** Termin, an den heute Abend erinnert werden sollte (Vorabend nach erinnerung Uhr, deine Tonne noch nicht draußen). */
function erinnerungFaellig(R, stand, jetzt) {
  const m = stand.muell
  if (!m) return null
  for (const T of aktive(m, jetzt)) {
    if (T.erinnert || jetzt < ortsZeit(vortag(T.tag), R.ABFALL.erinnerung)) continue
    const r = T.raus[ZUHAUSE]
    if (!r || r.art !== T.art) return T
  }
  return null
}

module.exports = { termineAus, artVon, fortschreiben, tonne, abholen, erinnerungFaellig, planeAbfuhr, ortsZeit, ZUHAUSE }
