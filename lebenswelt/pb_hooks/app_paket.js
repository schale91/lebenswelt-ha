// Update der Lebenswelt-App per Knopf (als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt).
//
// Eine GitHub Action baut die App bei jedem Push und legt das fertige Paket auf einen eigenen Zweig.
// Alle 10 Minuten fragt das Add-on dort nach und lädt eine neue Version nur herunter (/data/app_paket/bereit).
// Live geht sie erst, wenn jemand in der App auf „Installieren“ tippt: Dann schreibt das Add-on sie in jeden
// Ordner www/lebenswelt-*/ mit einer server.json, genau wie der Installer: erst die Programmdateien, dann
// stand.json und index.html (Reihenfolge aus manifest.json), danach werden alte Dateien gelöscht.
// server.json wird nie angefasst.

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
  const q = String(o.app_quelle || "schale91/Claude@app-paket").trim()
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
 * Nur ein Abruf zur Zeit: Der Knopf in der App und die Prüfung alle 10 Minuten liefen sonst gleichzeitig und löschten
 * sich gegenseitig den Zwischenordner (Fehler "no such file or directory"). Eine Sperre älter als 5 Minuten gilt als
 * liegen geblieben.
 */
function sperren() {
  try {
    const seit = Number(text($os.readFile(SPERRE)))
    if (Date.now() - seit < SPERRE_MS) return false
  } catch (_) {
    // keine Sperre
  }
  $os.mkdirAll(`${DATEN}/app_paket`, 0o755)
  $os.writeFile(SPERRE, String(Date.now()), 0o644)
  return true
}

function entsperren() {
  try {
    $os.remove(SPERRE)
  } catch (_) {
    // schon weg
  }
}

/** Sieht nach einer neuen Version und lädt sie herunter, spielt sie aber nicht ein. */
function pruefe() {
  if (!sperren()) return zustand()
  try {
    const q = quelle()
    if (q.github && !q.token) throw new Error("Kein app_token in der Konfiguration des Add-ons.")
    const manifest = JSON.parse(text(hole(q, "manifest.json")))
    const dateien = pruefeManifest(manifest)
    const vorhanden = bereitesManifest()
    // Auch eine unvollständige bereitliegende Version (frühere Läufe) wird neu geladen
    if (!vorhanden || vorhanden.erstellt !== manifest.erstellt || !vollstaendig(vorhanden)) {
      // Erst vollständig in einen eigenen Zwischenordner, dann umbenennen: "bereit" ist nie halb
      const neu = `${DATEN}/app_paket/neu-${Date.now()}`
      $os.removeAll(neu)
      $os.mkdirAll(neu, 0o755)
      for (const d of dateien) $os.writeFile(`${neu}/${d}`, hole(q, d), 0o644)
      $os.writeFile(`${neu}/manifest.json`, JSON.stringify(manifest), 0o644)
      $os.removeAll(BEREIT)
      $os.rename(neu, BEREIT)
      console.log(`App-Paket ${manifest.erstellt} heruntergeladen, wartet auf Installieren`)
      if (vorhanden) require(`${__hooks}/push.js`).sendeAllen($app, { titel: "Update verfügbar", text: "In der Lebenswelt auf „Installieren“ tippen.", kanal: "allgemein", id: "update" })
    }
    merke({ geprueft: new Date().toISOString(), fehler: "" })
  } catch (err) {
    const fehler = String(err && err.message ? err.message : err)
    console.log("App-Paket: " + fehler)
    merke({ geprueft: new Date().toISOString(), fehler })
  } finally {
    entsperren()
  }
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
        if (e.isDir() || dateien.includes(name) || BEHALTEN.includes(name)) continue
        $os.remove(`${o}/${name}`)
        geloescht++
      }
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

module.exports = { pruefe, installiere, zustand }
