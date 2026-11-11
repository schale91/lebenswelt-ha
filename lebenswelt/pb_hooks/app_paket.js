// Update der Lebenswelt-App per Knopf (als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt).
//
// Eine GitHub Action baut die App bei jedem Push und legt das fertige Paket auf einen eigenen Zweig.
// Alle 10 Minuten fragt das Add-on dort nach und lädt eine neue Version nur herunter (/data/app_paket/bereit).
// Live geht sie erst, wenn jemand in der App auf „Installieren“ tippt: Dann schreibt das Add-on sie in jeden
// Ordner www/lebenswelt-*/ mit einer server.json, genau wie der Installer: erst die Programmdateien, dann
// stand.json und index.html (Reihenfolge aus manifest.json), danach werden alte Dateien gelöscht.
// server.json wird nie angefasst.
//
// Für Aufrufer mit kurzer Zeitgrenze (Claude über den Proxy von Home Assistant, 30 s) gibt es zwei Aufträge, die
// sofort antworten und im Minutentakt (cron "app_paket_auftrag", arbeite()) abgearbeitet werden:
// - „nachsehen“: einmal so bald wie möglich nach einer neuen Version sehen (Feld nachsehen_angefordert);
// - „installieren, sobald neuer als X“ (Feld auftrag): bis zur Frist höchstens alle 2 Minuten nachsehen, dann mit
//   installiere() einspielen, also mit genau demselben Code wie der Knopf in der App.
// Beides steht in zustand.json und übersteht so einen Neustart des Add-ons.

const WWW = $os.getenv("LEBENSWELT_WWW") || "/homeassistant/www"
const DATEN = $os.getenv("LEBENSWELT_DATEN") || "/data"
const BEHALTEN = ["server.json"]
const NAME_OK = /^[A-Za-z0-9._-]+$/

function text(b) {
  return typeof b === "string" ? b : toString(b)
}

/** Woher das Paket kommt: "besitzer/repo@zweig" über die GitHub-API oder eine http(s)-Adresse (zum Testen). */
function quelle() {
  const h = require(`${__hooks}/hilfen.js`)
  const o = h.optionen()
  // LEBENSWELT_APP_QUELLE nur für Tests (eine http-Adresse statt GitHub), wie LEBENSWELT_WWW und LEBENSWELT_DATEN
  const q = String($os.getenv("LEBENSWELT_APP_QUELLE") || o.app_quelle || "schale91/Claude@app-paket").trim()
  const token = String(o.app_token || "").trim()
  if (/^https?:\/\//.test(q)) return { github: false, url: (p) => q.replace(/\/$/, "") + "/" + p, kopf: {}, token }
  const [repo, zweig] = q.split("@")
  return {
    github: true,
    token,
    url: (p) => `https://api.github.com/repos/${repo}/contents/${p}?ref=${encodeURIComponent(zweig || "app-paket")}`,
    kopf: {
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lebenswelt-ha",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  }
}

function hole(q, pfad) {
  const r = $http.send({ url: q.url(pfad), headers: q.kopf, timeout: 60 })
  if (r.statusCode === 401 || r.statusCode === 404) throw new Error(`HTTP ${r.statusCode} für ${pfad} (Token fehlt, ist abgelaufen oder hat keinen Lesezugriff)`)
  if (r.statusCode !== 200) throw new Error(`HTTP ${r.statusCode} für ${pfad}`)
  return r.body
}

/** Alles, was nach außen geht (GitHub, Push). Die Node-Tests ersetzen es mit _ersetzeAbruf(). */
const abruf = {
  quelle,
  hole,
  meldeNeueVersion() {
    require(`${__hooks}/push.js`).sendeAllen($app, { titel: "Update verfügbar", text: "In der Lebenswelt auf „Installieren“ tippen.", kanal: "allgemein", id: "update" })
  },
}

/** Ordner der App in www: lebenswelt-* mit einer server.json (die legt die Einrichtung an). */
function zielordner() {
  const aus = []
  let eintraege = []
  try {
    eintraege = $os.readDir(WWW)
  } catch (_) {
    return aus
  }
  for (const e of eintraege) {
    const name = e.name()
    if (!e.isDir() || !/^lebenswelt-[A-Za-z0-9_-]+$/.test(name)) continue
    try {
      $os.stat(`${WWW}/${name}/server.json`)
      aus.push(`${WWW}/${name}`)
    } catch (_) {
      // ohne server.json ist es nicht unsere App
    }
  }
  return aus
}

function installiertErstellt(ordner) {
  try {
    return JSON.parse(text($os.readFile(`${ordner}/stand.json`))).erstellt || ""
  } catch (_) {
    return ""
  }
}

const BEREIT = `${DATEN}/app_paket/bereit`

function merke(felder) {
  try {
    $os.mkdirAll(`${DATEN}/app_paket`, 0o755)
    $os.writeFile(`${DATEN}/app_paket/zustand.json`, JSON.stringify(Object.assign(zustandRoh(), felder)), 0o644)
  } catch (_) {
    // nur zur Anzeige
  }
}

function zustandRoh() {
  try {
    return JSON.parse(text($os.readFile(`${DATEN}/app_paket/zustand.json`)))
  } catch (_) {
    return {}
  }
}

function bereitesManifest() {
  try {
    return JSON.parse(text($os.readFile(`${BEREIT}/manifest.json`)))
  } catch (_) {
    return null
  }
}

/** Alle Dateien des Pakets: die App selbst und Zusatzdateien wie die Android-App (lebenswelt.apk). */
function pruefeManifest(manifest) {
  const dateien = (manifest.dateien || []).map(String).concat((manifest.zusatz || []).map(String))
  if (!manifest.erstellt || !dateien.length || !dateien.includes("stand.json") || !dateien.includes("index.html")) throw new Error("manifest.json ist unvollständig.")
  for (const d of dateien) if (!NAME_OK.test(d) || BEHALTEN.includes(d)) throw new Error("Unzulässiger Dateiname im Paket: " + d)
  return dateien
}

/** Stand für die App: bereitliegende und installierte Version, letzter Blick, letzter Fehler. */
function zustand() {
  const z = zustandRoh()
  const m = bereitesManifest()
  const ordner = zielordner()
  return {
    verfuegbar: (m && m.erstellt) || "",
    installiert: ordner.length ? installiertErstellt(ordner[0]) : "",
    ordner: ordner.map((o) => o.slice(WWW.length + 1)),
    geprueft: z.geprueft || "",
    installiert_am: z.installiert_am || "",
    fehler: z.fehler || "",
    // Aufträge für Aufrufer mit kurzer Zeitgrenze (siehe arbeite())
    nachsehen_angefordert: z.nachsehen_angefordert || "",
    auftrag: z.auftrag || null,
  }
}

/** Liegen alle Dateien des Manifests im Ordner "bereit"? */
function vollstaendig(manifest) {
  try {
    for (const d of pruefeManifest(manifest)) $os.stat(`${BEREIT}/${d}`)
    return true
  } catch (_) {
    return false
  }
}

const SPERRE = `${DATEN}/app_paket/sperre`
const SPERRE_MS = 5 * 60 * 1000

/**
 * Atomar im Speicher des Servers belegen: getOrSet hält dabei die Sperre des Speichers, zwei Läufe in derselben
 * Sekunde (z. B. die Prüfung alle 10 Minuten und der Minutentakt der Aufträge um :00) bekommen also nie beide true.
 * Nach einem Neustart ist der Speicher leer, dort läuft dann auch nichts mehr.
 */
function belegeSpeicher(schluessel, liegenGebliebenMs) {
  const s = $app.store()
  const jetzt = Date.now()
  const marke = `${jetzt}-${Math.random().toString(36).slice(2)}`
  const wert = String(s.getOrSet(schluessel, () => marke))
  if (wert === marke) return true
  if (jetzt - Number(wert.split("-")[0]) < liegenGebliebenMs) return false
  s.remove(schluessel) // liegen geblieben
  return String(s.getOrSet(schluessel, () => marke)) === marke
}

function gibSpeicherFrei(schluessel) {
  try {
    $app.store().remove(schluessel)
  } catch (_) {
    // schon weg
  }
}

/**
 * Nur ein Abruf zur Zeit: Der Knopf in der App und die Prüfung alle 10 Minuten liefen sonst gleichzeitig und löschten
 * sich gegenseitig den Zwischenordner (Fehler "no such file or directory"). Eine Sperre älter als 5 Minuten gilt als
 * liegen geblieben. Die Datei bleibt wie bisher, davor steht seit 0.46.2 die atomare Belegung im Speicher.
 */
function sperren() {
  if (!belegeSpeicher("app_paket_abruf", SPERRE_MS)) return false
  try {
    const seit = Number(text($os.readFile(SPERRE)))
    if (Date.now() - seit < SPERRE_MS) {
      gibSpeicherFrei("app_paket_abruf")
      return false
    }
  } catch (_) {
    // keine Sperre
  }
  try {
    $os.mkdirAll(`${DATEN}/app_paket`, 0o755)
    $os.writeFile(SPERRE, String(Date.now()), 0o644)
  } catch (err) {
    gibSpeicherFrei("app_paket_abruf")
    throw err
  }
  return true
}

function entsperren() {
  try {
    $os.remove(SPERRE)
  } catch (_) {
    // schon weg
  }
  gibSpeicherFrei("app_paket_abruf")
}

/** Zwischenordner abgebrochener Läufe (z. B. Neustart mitten im Herunterladen), älter als eine halbe Stunde. */
function raeumeAuf(jetzt) {
  try {
    for (const e of $os.readDir(`${DATEN}/app_paket`)) {
      const m = /^neu-(\d+)$/.exec(e.name())
      if (e.isDir() && m && jetzt - Number(m[1]) > 30 * 60 * 1000) $os.removeAll(`${DATEN}/app_paket/${e.name()}`)
    }
  } catch (_) {
    // nichts aufzuräumen
  }
}

/**
 * Sieht nach einer neuen Version und lädt sie herunter, spielt sie aber nicht ein.
 * false, wenn gerade ein anderer Abruf läuft (dann passiert nichts), sonst true (auch bei einem Fehler, der dann in
 * zustand.json steht).
 */
function lade() {
  if (!sperren()) return false
  let neu = ""
  try {
    raeumeAuf(Date.now())
    const q = abruf.quelle()
    if (q.github && !q.token) throw new Error("Kein app_token in der Konfiguration des Add-ons.")
    const manifest = JSON.parse(text(abruf.hole(q, "manifest.json")))
    const dateien = pruefeManifest(manifest)
    const vorhanden = bereitesManifest()
    // Auch eine unvollständige bereitliegende Version (frühere Läufe) wird neu geladen
    if (!vorhanden || vorhanden.erstellt !== manifest.erstellt || !vollstaendig(vorhanden)) {
      // Erst vollständig in einen eigenen Zwischenordner, dann umbenennen: "bereit" ist nie halb
      neu = `${DATEN}/app_paket/neu-${Date.now()}`
      $os.removeAll(neu)
      $os.mkdirAll(neu, 0o755)
      for (const d of dateien) $os.writeFile(`${neu}/${d}`, abruf.hole(q, d), 0o644)
      $os.writeFile(`${neu}/manifest.json`, JSON.stringify(manifest), 0o644)
      $os.removeAll(BEREIT)
      $os.rename(neu, BEREIT)
      neu = ""
      console.log(`App-Paket ${manifest.erstellt} heruntergeladen, wartet auf Installieren`)
      if (vorhanden) abruf.meldeNeueVersion()
    }
    merke({ geprueft: new Date().toISOString(), fehler: "" })
  } catch (err) {
    const fehler = String(err && err.message ? err.message : err)
    console.log("App-Paket: " + fehler)
    // Halb heruntergeladenen Zwischenordner nicht liegen lassen; "bereit" bleibt, wie es war
    if (neu) {
      try {
        $os.removeAll(neu)
      } catch (_) {
        // dann räumt ein späterer Lauf auf
      }
    }
    merke({ geprueft: new Date().toISOString(), fehler })
  } finally {
    entsperren()
  }
  return true
}

/** Sieht nach einer neuen Version und lädt sie herunter, spielt sie aber nicht ein (wartet, bis das fertig ist). */
function pruefe() {
  lade()
  return zustand()
}

/** Spielt die bereitliegende Version in alle App-Ordner ein. */
function installiere() {
  let m = bereitesManifest()
  if (!m) return Object.assign(zustand(), { fehler: "Es liegt keine neue Version bereit." })
  // Fehlt eine Datei, erst neu laden; nie eine halbe Version einspielen
  if (!vollstaendig(m)) {
    pruefe()
    m = bereitesManifest()
    if (!m || !vollstaendig(m)) return Object.assign(zustand(), { fehler: "Die bereitliegende Version ist unvollständig und wird neu geladen. Bitte gleich noch einmal versuchen." })
  }
  try {
    const dateien = pruefeManifest(m)
    const ordner = zielordner()
    if (!ordner.length) throw new Error("Kein Ordner www/lebenswelt-* mit server.json gefunden. Bitte einmal den Installer ausführen.")
    let geschrieben = 0
    let geloescht = 0
    for (const o of ordner) {
      for (const d of dateien) {
        // über eine Zwischendatei, damit nie eine halbe Datei ausgeliefert wird
        $os.writeFile(`${o}/.${d}.neu`, $os.readFile(`${BEREIT}/${d}`), 0o644)
        $os.rename(`${o}/.${d}.neu`, `${o}/${d}`)
        geschrieben++
      }
      for (const e of $os.readDir(o)) {
        const name = e.name()
        if (e.isDir() || dateien.includes(name) || BEHALTEN.includes(name) || name === "manifest.json") continue
        $os.remove(`${o}/${name}`)
        geloescht++
      }
      // Zuletzt die Liste der Dateien: Lebenswelt Fit lädt danach Updates seiner eingebauten Web-App (Fit.kt)
      $os.writeFile(`${o}/.manifest.json.neu`, JSON.stringify(m), 0o644)
      $os.rename(`${o}/.manifest.json.neu`, `${o}/manifest.json`)
    }
    console.log(`App-Paket ${m.erstellt} installiert: ${geschrieben} Dateien geschrieben, ${geloescht} alte gelöscht`)
    merke({ installiert_am: new Date().toISOString(), fehler: "" })
    return Object.assign(zustand(), { geschrieben, geloescht })
  } catch (err) {
    const fehler = String(err && err.message ? err.message : err)
    merke({ fehler })
    return Object.assign(zustand(), { fehler })
  }
}

// ---------- Aufträge für Aufrufer mit kurzer Zeitgrenze ----------
//
// Warum nicht einfach öfter nachsehen: Jeder Blick kostet eine Anfrage an die GitHub-API (manifest.json), eine neue
// Version mehrere hundert (eine je Datei). Deshalb bleibt es beim Takt von 10 Minuten; ein Auftrag sieht nur bis zu
// seiner Frist nach, höchstens alle AUFTRAG_TAKT_MS, und gibt nach AUFTRAG_FEHLVERSUCHE gescheiterten Versuchen auf.
// Die Sperre aus sperren() (ein Abruf zur Zeit) gilt auch hier, weil alles über lade() läuft.

const AUFTRAG_MINUTEN = 30
const AUFTRAG_MINUTEN_MIN = 5
const AUFTRAG_MINUTEN_MAX = 120
const AUFTRAG_TAKT_MS = 2 * 60 * 1000
// Der Minutentakt läuft zur vollen Minute, geprueft steht ein paar Millisekunden später: ohne Spielraum würde aus
// 2 Minuten jedes Mal 3
const AUFTRAG_SPIELRAUM_MS = 15 * 1000
const AUFTRAG_FEHLVERSUCHE = 3
const ARBEIT_SCHLUESSEL = "app_paket_arbeit"
const ARBEIT_LIEGEN_GEBLIEBEN_MS = 15 * 60 * 1000

const iso = (ms) => new Date(ms).toISOString()

/** Ist Version a (erstellt) neuer als der Zeitpunkt b? Ein leeres b heißt: jede Version. */
function neuerAls(a, b) {
  const ta = Date.parse(a || "")
  if (isNaN(ta)) return false
  if (!b) return true
  const tb = Date.parse(b)
  return isNaN(tb) ? false : ta > tb
}

function aktiv(a) {
  return !!(a && a.stand === "wartet")
}

/** Ändert den Auftrag nur, wenn er noch derselbe ist (in der Zwischenzeit kann ein neuer gekommen sein). */
function aendereAuftrag(id, felder) {
  const a = zustandRoh().auftrag
  if (!a || a.id !== id) return false
  merke({ auftrag: Object.assign({}, a, felder) })
  return true
}

/** Einmal so bald wie möglich nachsehen (nächste volle Minute). Mehrfaches Anfordern bleibt eine Anforderung. */
function fordereAn(jetzt) {
  jetzt = jetzt || Date.now()
  if (!zustandRoh().nachsehen_angefordert) merke({ nachsehen_angefordert: iso(jetzt) })
  return zustand()
}

/**
 * Auftrag „installieren, sobald eine Version neuer als neuer_als bereitliegt“, bis zur Frist (minuten).
 * neuer_als: Zeitpunkt (ISO 8601), "jetzt" oder leer (= neuer als die installierte Version).
 * Es gibt höchstens einen Auftrag; ein neuer ersetzt einen laufenden (Feld ersetzt).
 */
function beauftrage(eingabe, jetzt) {
  jetzt = jetzt || Date.now()
  eingabe = eingabe || {}
  let grenze = String(eingabe.neuer_als == null ? "" : eingabe.neuer_als).trim()
  if (grenze === "jetzt") grenze = iso(jetzt)
  else if (!grenze) grenze = zustand().installiert
  else {
    const t = Date.parse(grenze)
    if (isNaN(t)) throw new Error("neuer_als ist kein Zeitpunkt (ISO 8601, z. B. 2026-11-11T09:30:00Z), \"jetzt\" oder leer.")
    grenze = iso(t)
  }
  const minuten = eingabe.minuten == null || eingabe.minuten === "" ? AUFTRAG_MINUTEN : Number(eingabe.minuten)
  if (!isFinite(minuten) || minuten < AUFTRAG_MINUTEN_MIN || minuten > AUFTRAG_MINUTEN_MAX) throw new Error(`minuten: ${AUFTRAG_MINUTEN_MIN} bis ${AUFTRAG_MINUTEN_MAX}.`)
  const z = zustandRoh()
  const auftrag = {
    id: `${jetzt}-${Math.random().toString(36).slice(2, 8)}`,
    seit: iso(jetzt),
    neuer_als: grenze,
    bis: iso(jetzt + Math.round(minuten * 60 * 1000)),
    stand: "wartet",
    versuche: 0,
    fehler: "",
  }
  if (aktiv(z.auftrag)) auftrag.ersetzt = z.auftrag.seit
  // Gleich in der nächsten Minute nachsehen, nicht erst nach AUFTRAG_TAKT_MS
  merke({ auftrag, nachsehen_angefordert: z.nachsehen_angefordert || iso(jetzt) })
  return zustand()
}

/** Bricht einen laufenden Auftrag ab. */
function brichAb(jetzt) {
  const a = zustandRoh().auftrag
  if (aktiv(a)) aendereAuftrag(a.id, { stand: "abgebrochen", ende: iso(jetzt || Date.now()) })
  return zustand()
}

/** Nur ein arbeite() zur Zeit (Herunterladen und Installieren dauern länger als eine Minute). */
const belege = () => belegeSpeicher(ARBEIT_SCHLUESSEL, ARBEIT_LIEGEN_GEBLIEBEN_MS)
const gibFrei = () => gibSpeicherFrei(ARBEIT_SCHLUESSEL)

/** Ein gescheiterter Versuch; nach AUFTRAG_FEHLVERSUCHE ist der Auftrag gescheitert (Stand "fehler"). */
function fehlversuch(a, fehler, jetzt) {
  const versuche = (Number(a.versuche) || 0) + 1
  const felder = { versuche, fehler }
  if (versuche >= AUFTRAG_FEHLVERSUCHE) Object.assign(felder, { stand: "fehler", ende: iso(jetzt) })
  aendereAuftrag(a.id, felder)
  return versuche >= AUFTRAG_FEHLVERSUCHE
}

/**
 * Arbeitet Anforderung und Auftrag ab (jede Minute, cron "app_paket_auftrag"). Ohne beides passiert nichts weiter
 * als das Lesen von zustand.json. Antwort zum Testen: was getan wurde.
 */
function arbeite(jetzt) {
  jetzt = jetzt || Date.now()
  let z = zustandRoh()
  if (!z.nachsehen_angefordert && !aktiv(z.auftrag)) return { getan: "nichts" }
  if (!belege()) return { getan: "laeuft_schon" }
  const getan = []
  try {
    let a = aktiv(z.auftrag) ? z.auftrag : null
    if (a && !(jetzt <= Date.parse(a.bis))) {
      aendereAuftrag(a.id, { stand: "abgelaufen", ende: iso(jetzt) })
      getan.push("abgelaufen")
      a = null
    }
    if (a) {
      const installiert = zustand().installiert
      if (installiert && neuerAls(installiert, a.neuer_als)) {
        aendereAuftrag(a.id, { stand: "erledigt", ende: iso(jetzt), installiert, fehler: "", hinweis: "Diese oder eine neuere Version war schon installiert." })
        getan.push("schon_installiert")
        a = null
      }
    }
    const passt = (m) => !!(a && m && neuerAls(m.erstellt, a.neuer_als) && vollstaendig(m))
    const angefordert = z.nachsehen_angefordert ? Date.parse(z.nachsehen_angefordert) : 0
    const geprueft = Date.parse(z.geprueft || "") || 0
    const auftragSiehtNach = !!a && !passt(bereitesManifest()) && jetzt - geprueft >= AUFTRAG_TAKT_MS - AUFTRAG_SPIELRAUM_MS
    if (angefordert || auftragSiehtNach) {
      const start = Date.now()
      if (lade()) {
        getan.push("nachgesehen")
        z = zustandRoh()
        // Anforderungen, die während des Abrufs kamen, bleiben stehen
        if (z.nachsehen_angefordert && !(Date.parse(z.nachsehen_angefordert) > start)) merke({ nachsehen_angefordert: "" })
        if (a && z.fehler && fehlversuch(a, z.fehler, jetzt)) a = null
      } else getan.push("abruf_laeuft_schon")
    }
    // Während des Abrufs ersetzt oder abgebrochen? Dann nicht mehr für diesen Auftrag installieren
    if (a) {
      const jetztDa = zustandRoh().auftrag
      if (!aktiv(jetztDa) || jetztDa.id !== a.id) a = null
    }
    const bereit = bereitesManifest()
    if (a && passt(bereit)) {
      // Derselbe Weg wie der Knopf in der App
      const r = installiere()
      if (r.fehler) {
        fehlversuch(a, r.fehler, jetzt)
        getan.push("installieren_gescheitert")
      } else {
        aendereAuftrag(a.id, { stand: "erledigt", ende: iso(Date.now()), installiert: bereit.erstellt, geschrieben: r.geschrieben, geloescht: r.geloescht, fehler: "" })
        getan.push("installiert")
      }
    }
  } catch (err) {
    console.log("App-Paket, Auftrag: " + String(err && err.message ? err.message : err))
    getan.push("fehler")
  } finally {
    gibFrei()
  }
  return { getan: getan.join(",") || "gewartet" }
}

/**
 * Gemeinsame Rechte der schreibenden Routen: ohne Person 401, Fitness-Welt 403, sonst null. Gibt {status, body} zurück,
 * die Route antwortet selbst mit return e.json(...): e.json() liefert in PocketBase nichts, woran man das Antworten
 * erkennen könnte.
 */
function verweigert(e) {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return { status: 401, body: { fehler: "Keine Home-Assistant-Person übermittelt." } }
  // Fitness-Welt (Papa) spielt keine Updates ein, das bleibt bei der vollen Lebenswelt
  if (h.profilVon(ich) === "fitness") return { status: 403, body: { fehler: "Updates spielt nur die volle Lebenswelt ein." } }
  return null
}

/** Nur für die Node-Tests: GitHub und Push ersetzen. */
function _ersetzeAbruf(teile) {
  Object.assign(abruf, teile)
}

module.exports = {
  pruefe,
  installiere,
  zustand,
  zielordner,
  fordereAn,
  beauftrage,
  brichAb,
  arbeite,
  verweigert,
  neuerAls,
  _ersetzeAbruf,
  AUFTRAG_TAKT_MS,
  AUFTRAG_FEHLVERSUCHE,
}
