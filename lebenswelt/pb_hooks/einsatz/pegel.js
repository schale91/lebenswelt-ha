// Elbpegel aus Home Assistant (PEGELONLINE): Verlauf, Scheitel, mittleres Tidehoch- und -niedrigwasser, Lage und die
// Einsätze, die eine echte Sturmflut ansetzt. Reine Funktionen ohne PocketBase, in Node getestet (test/pegel.test.js).
// Konzept: docs/integrationen/KONZEPT.md, Abschnitt 2. Hinweis für PocketBase (goja): bewusst ohne ?. und ??.

const MIN = 60 * 1000
const STD = 60 * MIN
const ROH_STUNDEN = 6

function kopie(o) {
  return JSON.parse(JSON.stringify(o))
}

/**
 * Neue Messung in den Verlauf übernehmen. Der Verlauf hält die Rohwerte der letzten Stunden und die Scheitel
 * (Hoch- und Niedrigwasser) der letzten PEGEL.tage. Ein Scheitel ist der höchste bzw. tiefste Wert in einem Fenster von
 * ±scheitel_fenster_min und wird erst erkannt, wenn das Fenster nach ihm voll ist.
 */
function verlaufNeu(R, alt, t, cm) {
  const P = R.PEGEL
  const v = { roh: ((alt && alt.roh) || []).slice(), scheitel: ((alt && alt.scheitel) || []).slice() }
  if (!Number.isFinite(cm) || !Number.isFinite(t)) return v
  const letzte = v.roh[v.roh.length - 1]
  if (!letzte || t > letzte[0]) v.roh.push([t, Math.round(cm)])
  v.roh = v.roh.filter((x) => x[0] > t - ROH_STUNDEN * STD)
  const f = P.scheitel_fenster_min * MIN
  const erster = v.roh.length ? v.roh[0][0] : t
  for (const [ts, wert] of v.roh) {
    if (ts - f < erster || ts + f > t) continue
    const fenster = v.roh.filter((x) => Math.abs(x[0] - ts) <= f)
    const max = Math.max.apply(null, fenster.map((x) => x[1]))
    const min = Math.min.apply(null, fenster.map((x) => x[1]))
    for (const hw of [true, false]) {
      if (wert !== (hw ? max : min) || max - min < 20) continue
      // bei gleichen Werten zählt der erste; ein Scheitel je Fenster
      if (fenster.find((x) => x[1] === wert)[0] !== ts) continue
      if (v.scheitel.some((s) => s.hw === hw && Math.abs(s.t - ts) <= f)) continue
      v.scheitel.push({ t: ts, cm: wert, hw })
    }
  }
  v.scheitel = v.scheitel.filter((s) => s.t > t - P.tage * 24 * STD).sort((a, b) => a.t - b.t)
  return v
}

/** Rang einer Stufe (Index in PEGEL.stufen), -1 wenn unbekannt. */
function rang(R, id) {
  return R.PEGEL.stufen.findIndex((s) => s.id === id)
}

/** Stufe zu einem Wasserstand. */
function stufeVon(R, cm, mthw, mtnw) {
  let id = "normal"
  for (const s of R.PEGEL.stufen) {
    if (s.unter_mtnw !== undefined && cm <= mtnw - s.unter_mtnw) id = s.id
    if (s.ueber_mthw !== undefined && cm >= mthw + s.ueber_mthw) id = s.id
  }
  return id
}

/**
 * Mittlere Scheitel der letzten Tage, sonst die Startwerte. Gemittelt wird mit dem Median, damit eine einzelne
 * Sturmflut ihr eigenes Bezugsmaß nicht anhebt.
 */
function mittelwerte(R, v) {
  const P = R.PEGEL
  const hw = (v.scheitel || []).filter((s) => s.hw)
  const nw = (v.scheitel || []).filter((s) => !s.hw)
  const mittel = (l) => {
    const w = l.map((s) => s.cm).sort((a, b) => a - b)
    const i = Math.floor(w.length / 2)
    return w.length % 2 ? w[i] : Math.round((w[i - 1] + w[i]) / 2)
  }
  return { mthw: hw.length >= P.min_scheitel ? mittel(hw) : P.mthw_start, mtnw: nw.length >= P.min_scheitel ? mittel(nw) : P.mtnw_start, eigen: hw.length >= P.min_scheitel }
}

/**
 * Lage zum Zeitpunkt jetzt: aktueller Wert, Stufe, Lage (höchste Stufe der letzten lage_h), seit wann jede Stufe der
 * Lage ununterbrochen erreicht ist (erreicht), Tendenz. null, wenn keine frische Messung da ist.
 */
function lage(R, v, jetzt) {
  const P = R.PEGEL
  const roh = (v && v.roh) || []
  const letzte = roh[roh.length - 1]
  if (!letzte || jetzt - letzte[0] > P.max_alter_min * MIN) return null
  const m = mittelwerte(R, v)
  const cm = letzte[1]
  const stufe = stufeVon(R, cm, m.mthw, m.mtnw)
  // Höchststände: Scheitel und die Rohwerte seit dem letzten erkannten Scheitel (der nächste ist noch nicht sicher)
  const hoch = (v.scheitel || []).filter((s) => s.hw).map((s) => ({ t: s.t, cm: s.cm }))
  const nachLetztem = hoch.length ? hoch[hoch.length - 1].t : -Infinity
  for (const [t, wert] of roh) if (t > nachLetztem + P.scheitel_fenster_min * MIN) hoch.push({ t, cm: wert })
  const erreicht = {}
  let lageId = stufe === "niedrig" ? "niedrig" : "normal"
  for (const s of P.stufen) {
    if (s.ueber_mthw === undefined) continue
    const grenze = m.mthw + s.ueber_mthw
    const ueber = hoch.filter((x) => x.cm >= grenze).sort((a, b) => a.t - b.t)
    if (!ueber.length || jetzt - ueber[ueber.length - 1].t > P.lage_h * STD) continue
    // Anfang der ununterbrochenen Folge (Lücken höchstens lage_h)
    let ab = ueber[ueber.length - 1].t
    for (let i = ueber.length - 2; i >= 0 && ab - ueber[i].t <= P.lage_h * STD; i--) ab = ueber[i].t
    erreicht[s.id] = ab
    lageId = s.id
  }
  if (rang(R, stufe) > rang(R, lageId)) lageId = stufe
  const vorher = roh.filter((x) => x[0] <= letzte[0] - 25 * MIN).pop()
  const trend = !vorher ? "gleich" : cm - vorher[1] > 3 ? "steigt" : vorher[1] - cm > 3 ? "faellt" : "gleich"
  const hw = (v.scheitel || []).filter((s) => s.hw).pop() || null
  const nw = (v.scheitel || []).filter((s) => !s.hw).pop() || null
  return {
    cm,
    t: letzte[0],
    mthw: m.mthw,
    mtnw: m.mtnw,
    eigene_mittel: m.eigen,
    stufe,
    lage: lageId,
    name: R.PEGEL.stufen[rang(R, lageId)].name,
    erreicht,
    trend,
    letztes_hw: hw ? { t: hw.t, cm: hw.cm } : null,
    letztes_nw: nw ? { t: nw.t, cm: nw.cm } : null,
  }
}

/**
 * Pegel in den Stand übernehmen (stand.pegel, ohne frische Messung entfernt) und bei einer neuen Lage die passenden
 * Einsätze ansetzen: Die nächste Meldung der Einsatzart kommt dann spätestens einige Minuten nach Beginn der Lage. Jede
 * Lage wirkt je Stufe einmal (pegel_gesehen). Vor dem Fortschreiben aufrufen, wie warnungenAusloesen.
 */
function pegelAusloesen(R, stand, l, jetzt, zufall) {
  const s = kopie(stand)
  if (!l) {
    delete s.pegel
    return s
  }
  s.pegel = l
  const gesehen = (s.pegel_gesehen || []).slice()
  const P = R.PEGEL
  for (const [stufe, liste] of Object.entries(P.ausloesen || {})) {
    const ab = l.erreicht[stufe]
    if (ab === undefined) continue
    if (gesehen.some((g) => g.stufe === stufe && Math.abs(g.t - ab) <= P.lage_h * STD)) continue
    gesehen.push({ stufe, t: ab })
    const beginn = Math.max(ab, s.bis)
    for (const a of liste) {
      const st = s.einsatzarten[a.art]
      if (!st) continue
      const r = zufall(s.zufall + ":pegel:" + stufe + ":" + ab + ":" + a.art)
      st.naechster = Math.min(st.naechster, beginn + Math.round((a.min[0] + (a.min[1] - a.min[0]) * r()) * MIN))
    }
  }
  s.pegel_gesehen = gesehen.slice(-20)
  return s
}

module.exports = { verlaufNeu, lage, pegelAusloesen, stufeVon, mittelwerte, rang }
