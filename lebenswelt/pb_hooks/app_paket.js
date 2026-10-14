// Selbst-Update der Lebenswelt-App (als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt).
//
// Eine GitHub Action baut die App bei jedem Push und legt das fertige Paket auf einen eigenen Zweig.
// Alle 10 Minuten fragt das Add-on dort nach. Gibt es eine neue Version, schreibt es sie in jeden Ordner
// www/lebenswelt-*/ von Home Assistant, in dem eine server.json liegt, genau wie der Installer:
// erst die Programmdateien, dann stand.json und index.html (Reihenfolge aus manifest.json), danach werden
// alte Dateien früherer Versionen gelöscht. server.json wird nie angefasst.

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

function merke(zustand) {
  try {
    $os.writeFile(`${DATEN}/app_paket.json`, JSON.stringify(zustand), 0o644)
  } catch (_) {
    // nur zur Anzeige
  }
}

function zustand() {
  try {
    return JSON.parse(text($os.readFile(`${DATEN}/app_paket.json`)))
  } catch (_) {
    return {}
  }
}

/** Prüft auf eine neue Version und spielt sie ein. `erzwingen` schreibt auch eine schon vorhandene neu. */
function aktualisiere(erzwingen) {
  const z = { geprueft: new Date().toISOString(), ordner: [], erstellt: "", geschrieben: 0, geloescht: 0, fehler: "" }
  try {
    const q = quelle()
    if (q.github && !q.token) throw new Error("Kein app_token in der Konfiguration des Add-ons.")
    const manifest = JSON.parse(text(hole(q, "manifest.json")))
    const dateien = (manifest.dateien || []).map(String)
    if (!manifest.erstellt || !dateien.length || !dateien.includes("stand.json") || !dateien.includes("index.html")) throw new Error("manifest.json ist unvollständig.")
    for (const d of dateien) if (!NAME_OK.test(d) || BEHALTEN.includes(d)) throw new Error("Unzulässiger Dateiname im Paket: " + d)
    z.erstellt = manifest.erstellt
    const ordner = zielordner()
    z.ordner = ordner.map((o) => o.slice(WWW.length + 1))
    if (!ordner.length) throw new Error("Kein Ordner www/lebenswelt-* mit server.json gefunden. Bitte einmal den Installer ausführen.")
    const offen = ordner.filter((o) => erzwingen || installiertErstellt(o) !== manifest.erstellt)
    if (!offen.length) {
      merke(z)
      return z
    }
    // Erst alles herunterladen, dann schreiben: bricht der Download ab, bleibt die alte Version unverändert
    const inhalt = {}
    for (const d of dateien) inhalt[d] = hole(q, d)
    for (const o of offen) {
      for (const d of dateien) {
        // über eine Zwischendatei, damit nie eine halbe Datei ausgeliefert wird
        $os.writeFile(`${o}/.${d}.neu`, inhalt[d], 0o644)
        $os.rename(`${o}/.${d}.neu`, `${o}/${d}`)
        z.geschrieben++
      }
      for (const e of $os.readDir(o)) {
        const name = e.name()
        if (e.isDir() || dateien.includes(name) || BEHALTEN.includes(name)) continue
        $os.remove(`${o}/${name}`)
        z.geloescht++
      }
    }
    console.log(`App-Paket ${manifest.erstellt} eingespielt: ${z.geschrieben} Dateien geschrieben, ${z.geloescht} alte gelöscht`)
  } catch (err) {
    z.fehler = String(err && err.message ? err.message : err)
    console.log("App-Paket: " + z.fehler)
  }
  merke(z)
  return z
}

module.exports = { aktualisiere, zustand }
