// Push-Nachrichten an die Android-App über Firebase Cloud Messaging (HTTP v1).
// Als Modul, weil PocketBase jeden Handler in einem eigenen Kontext ausführt.
//
// Geräte melden ihren Token über POST /api/lebenswelt/push/geraet an (Dokument typ "push_geraet").
// Zum Senden braucht das Add-on den Schlüssel eines Firebase-Dienstkontos (Option fcm_dienstkonto, JSON).
// Daraus wird ein JWT (RS256, signiert mit openssl) und dafür ein Zugriffstoken bei Google geholt (1 Stunde gültig).
// Gesendet werden reine Datennachrichten (titel, text, kanal, id); die App zeigt sie selbst an.

const DATEN = $os.getenv("LEBENSWELT_DATEN") || "/data"
const TYP = "push_geraet"

function text(b) {
  return typeof b === "string" ? b : toString(b)
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** base64url einer Zeichenkette (UTF-8). */
function b64url(s) {
  const bytes = []
  for (const ch of s) {
    const c = ch.codePointAt(0)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  let aus = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0)
    aus += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    aus += i + 1 < bytes.length ? B64[(n >> 6) & 63] : ""
    aus += i + 2 < bytes.length ? B64[n & 63] : ""
  }
  return aus.replace(/\+/g, "-").replace(/\//g, "_")
}

function dienstkonto() {
  const h = require(`${__hooks}/hilfen.js`)
  const roh = String(h.optionen().fcm_dienstkonto || "").trim()
  if (!roh) return null
  try {
    const k = JSON.parse(roh)
    if (!k.client_email || !k.private_key || !k.project_id) return null
    return k
  } catch (_) {
    return null
  }
}

function eingerichtet() {
  return dienstkonto() !== null
}

/** Zugriffstoken für FCM, eine Stunde zwischengespeichert. */
function zugriff(k) {
  const datei = `${DATEN}/push_zugriff.json`
  try {
    const z = JSON.parse(text($os.readFile(datei)))
    if (z.email === k.client_email && z.bis > Date.now() + 60000) return z.token
  } catch (_) {
    // neu holen
  }
  const jetzt = Math.floor(Date.now() / 1000)
  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const inhalt = b64url(JSON.stringify({ iss: k.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: jetzt, exp: jetzt + 3600 }))
  const eingabe = `${kopf}.${inhalt}`
  // Schlüssel nur kurz auf der Platte, nur für diesen Prozess lesbar
  const ordner = `${DATEN}/push_tmp`
  $os.mkdirAll(ordner, 0o700)
  const schluessel = `${ordner}/k.pem`
  const daten = `${ordner}/e.txt`
  let signatur
  try {
    $os.writeFile(schluessel, k.private_key, 0o600)
    $os.writeFile(daten, eingabe, 0o600)
    signatur = text($os.cmd("sh", "-c", `openssl dgst -sha256 -sign '${schluessel}' -binary '${daten}' | openssl base64 -A`).output()).trim()
  } finally {
    try { $os.remove(schluessel) } catch (_) {}
    try { $os.remove(daten) } catch (_) {}
  }
  if (!signatur) throw new Error("Signieren fehlgeschlagen (openssl)")
  const jwt = `${eingabe}.${signatur.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`
  const r = $http.send({
    url: "https://oauth2.googleapis.com/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + encodeURIComponent(jwt),
    timeout: 20,
  })
  if (r.statusCode !== 200 || !r.json || !r.json.access_token) throw new Error("Google-Anmeldung fehlgeschlagen: HTTP " + r.statusCode + " " + text(r.body).slice(0, 200))
  const token = r.json.access_token
  $os.writeFile(datei, JSON.stringify({ email: k.client_email, token, bis: Date.now() + (r.json.expires_in || 3600) * 1000 }), 0o600)
  return token
}

function geraete(app, besitzer) {
  try {
    return app.findRecordsByFilter("dokumente", "besitzer = {:b} && typ = {:t} && geloescht = false", "", 20, 0, { b: besitzer, t: TYP })
  } catch (_) {
    return []
  }
}

/** Meldet ein Gerät an (oder aktualisiert es). */
function melde(app, besitzer, token, name) {
  if (!/^[A-Za-z0-9:_\-.]{20,4096}$/.test(token)) throw new Error("Ungültiger Token")
  const schluessel = $security.sha256(token).slice(0, 32)
  let r
  try {
    r = app.findFirstRecordByFilter("dokumente", "besitzer = {:b} && typ = {:t} && schluessel = {:s}", { b: besitzer, t: TYP, s: schluessel })
  } catch (_) {
    r = new Record(app.findCollectionByNameOrId("dokumente"))
    r.set("besitzer", besitzer)
    r.set("typ", TYP)
    r.set("schluessel", schluessel)
  }
  r.set("geloescht", false)
  r.set("daten", { token, name: String(name || "Android-App").slice(0, 60), angemeldet: new Date().toISOString() })
  app.save(r)
  return { ok: true, eingerichtet: eingerichtet() }
}

/**
 * Schickt eine Nachricht an alle Geräte einer Person. Wirft nie; gibt zurück, wie viele Geräte erreicht wurden.
 * kanal: "einsatz", "timer" oder "allgemein".
 */
function sende(app, besitzer, nachricht) {
  const ergebnis = { gesendet: 0, fehler: "" }
  // Zusätzlich über die Home-Assistant-App, wenn eingerichtet (Option ha_benachrichtigung, Nachricht mit ha: true)
  ergebnis.ha = haMelden(app, besitzer, nachricht)
  try {
    const k = dienstkonto()
    if (!k) return Object.assign(ergebnis, { fehler: "Push nicht eingerichtet (fcm_dienstkonto fehlt)" })
    const liste = geraete(app, besitzer)
    if (!liste.length) return Object.assign(ergebnis, { fehler: "Kein Gerät angemeldet" })
    const token = zugriff(k)
    for (const g of liste) {
      const d = g.get("daten") || {}
      const r = $http.send({
        url: `https://fcm.googleapis.com/v1/projects/${k.project_id}/messages:send`,
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: d.token,
            data: { titel: String(nachricht.titel || "Lebenswelt"), text: String(nachricht.text || ""), kanal: String(nachricht.kanal || "allgemein"), id: String(nachricht.id || Date.now()) },
            android: { priority: "HIGH", ttl: String(nachricht.ttl_s || 3600) + "s" },
          },
        }),
        timeout: 20,
      })
      if (r.statusCode === 200) ergebnis.gesendet++
      else if (r.statusCode === 404 || (r.statusCode === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(text(r.body)))) {
        // App deinstalliert oder Token ungültig: Gerät abmelden
        g.set("geloescht", true)
        app.save(g)
      } else ergebnis.fehler = "FCM: HTTP " + r.statusCode
    }
  } catch (err) {
    ergebnis.fehler = String(err && err.message ? err.message : err)
    console.log("Push: " + ergebnis.fehler)
  }
  return ergebnis
}

/** Ruft notify.<ha_benachrichtigung> in Home Assistant auf. Wirft nie; true, wenn Home Assistant angenommen hat. */
function haMelden(app, besitzer, nachricht) {
  try {
    const h = require(`${__hooks}/hilfen.js`)
    const b = require(`${__hooks}/benachrichtigung.js`)
    const o = h.optionen()
    const voll = String(o.person || "").trim() || (h.einzigePerson(app) || {}).id
    const dienst = b.haDienst(o, besitzer, voll, nachricht)
    if (!dienst) return false
    const token = $os.getenv("SUPERVISOR_TOKEN")
    if (!token) return false
    const r = $http.send({
      url: "http://supervisor/core/api/services/notify/" + dienst,
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(b.haDaten(nachricht)),
      timeout: 15,
    })
    if (r.statusCode !== 200) console.log("Benachrichtigung über Home Assistant: HTTP " + r.statusCode)
    return r.statusCode === 200
  } catch (err) {
    console.log("Benachrichtigung über Home Assistant: " + String(err && err.message ? err.message : err))
    return false
  }
}

/** An alle Personen mit angemeldetem Gerät (z. B. „Update verfügbar“). */
function sendeAllen(app, nachricht) {
  let liste = []
  try {
    liste = app.findRecordsByFilter("dokumente", "typ = {:t} && geloescht = false", "", 100, 0, { t: TYP })
  } catch (_) {
    return
  }
  const personen = new Set(liste.map((r) => r.getString("besitzer")))
  for (const b of personen) sende(app, b, nachricht)
}

function anzahl(app, besitzer) {
  return geraete(app, besitzer).length
}

module.exports = { melde, sende, sendeAllen, eingerichtet, anzahl }
