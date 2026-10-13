// Gemeinsame Helfer für die Routen. Wird in jedem Handler per require geladen,
// weil PocketBase jeden Handler in einem eigenen Kontext ausführt.

/** Ingress-Proxy des Supervisors und der Container selbst. */
const IMMER_ERLAUBT = ["172.30.32.2", "127.0.0.1", "::1"]
const INGRESS = "172.30.32.2"

/** Einstellungen der App aus Home Assistant (Reiter Konfiguration). */
function optionen() {
  try {
    const roh = $os.readFile("/data/options.json")
    return JSON.parse(typeof roh === "string" ? roh : toString(roh))
  } catch (_) {
    return {}
  }
}

function absenderIp(e) {
  const adresse = String(e.request.remoteAddr || "")
  const ohnePort = adresse.lastIndexOf(":") > adresse.lastIndexOf("]") ? adresse.slice(0, adresse.lastIndexOf(":")) : adresse
  return ohnePort.replace(/^\[|\]$/g, "")
}

/** Löst einen Hostnamen im Netz von Home Assistant auf (z. B. eine andere App). */
function loese(name) {
  const versuche = [
    () => toString($os.cmd("getent", "hosts", name).output()),
    () => toString($os.cmd("nslookup", name).output()),
  ]
  for (const v of versuche) {
    try {
      const text = v()
      const treffer = text.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g) || []
      // nslookup nennt zuerst den DNS-Server; die letzte Adresse ist die gesuchte
      if (treffer.length) return treffer[treffer.length - 1]
    } catch (_) {
      // nächster Versuch
    }
  }
  return null
}

/**
 * Adressen vertrauter Apps (Standard: der MCP-Server von Home Assistant, über den Claude arbeitet).
 * Wer diese App bedienen kann, hat ohnehin vollen Zugriff auf Home Assistant.
 */
function vertrauteIps() {
  const speicher = $app.store()
  const zwischen = speicher.get("vertraute_ips")
  if (zwischen && Date.now() - zwischen.zeit < 60000) return zwischen.ips
  const namen = optionen().vertraute_apps || ["81f33d0f-ha-mcp"]
  const ips = []
  for (const n of namen) {
    const ip = loese(n)
    if (ip) ips.push(ip)
  }
  speicher.set("vertraute_ips", { zeit: Date.now(), ips: ips })
  return ips
}

function quelle(e) {
  const ip = absenderIp(e)
  if (ip === INGRESS) return "ingress"
  if (IMMER_ERLAUBT.indexOf(ip) !== -1) return "lokal"
  if (vertrauteIps().indexOf(ip) !== -1) return "vertraut"
  return null
}

function erlaubt(e) {
  return quelle(e) !== null
}

/** Die einzige bekannte Person, falls es genau eine gibt (Einzelbetrieb). */
function einzigePerson(app) {
  try {
    const liste = app.findRecordsByFilter("spielstaende", "benutzer != ''", "", 2, 0)
    if (liste.length === 1) return { id: liste[0].getString("benutzer"), name: liste[0].getString("name") }
  } catch (_) {
    // noch keine Personen
  }
  return null
}

/**
 * Wer fragt? Über den Ingress kommt die angemeldete Home-Assistant-Person mit.
 * Vertraute Apps (Claude) dürfen eine Person nennen, sonst gilt die eingestellte oder die einzige Person.
 */
function benutzer(e) {
  const art = quelle(e)
  const kopf = (n) => String(e.request.header.get(n) || "").trim()
  if (art === "ingress" || art === "lokal") {
    const id = kopf("X-Remote-User-Id")
    if (/^[A-Za-z0-9_-]{1,100}$/.test(id)) return { id: id, name: kopf("X-Remote-User-Name"), anzeige: kopf("X-Remote-User-Display-Name"), art: art }
    if (art === "ingress") return null
  }
  if (art === "vertraut" || art === "lokal") {
    const genannt = kopf("X-Lebenswelt-Person")
    if (/^[A-Za-z0-9_-]{1,100}$/.test(genannt)) return { id: genannt, name: "", anzeige: "", art: art }
    const opt = String(optionen().person || "").trim()
    if (opt) return { id: opt, name: "", anzeige: "", art: art }
    const einzig = einzigePerson(e.app)
    if (einzig) return { id: einzig.id, name: "", anzeige: einzig.name, art: art }
  }
  return null
}

function spielstandVon(app, id) {
  try {
    return app.findFirstRecordByFilter("spielstaende", "benutzer = {:id}", { id: id })
  } catch (_) {
    return null
  }
}

/** Dokument für die Antwort. */
function alsDokument(r) {
  return {
    id: r.id,
    typ: r.getString("typ"),
    schluessel: r.getString("schluessel"),
    daten: JSON.parse(toString(r.get("daten")) || "{}"),
    geloescht: r.getBool("geloescht"),
    geaendert: r.getString("updated"),
  }
}

/**
 * Führt Änderungen in vorhandene Daten zusammen. Schlüssel mit Punkt ändern verschachtelte Werte
 * ("saetze.kniebeuge.2"), null löscht einen Schlüssel.
 */
function verschmelze(alt, neu) {
  const ziel = JSON.parse(JSON.stringify(alt || {}))
  for (const k of Object.keys(neu || {})) {
    const teile = k.split(".")
    let knoten = ziel
    for (let i = 0; i < teile.length - 1; i++) {
      if (knoten[teile[i]] === null || typeof knoten[teile[i]] !== "object") knoten[teile[i]] = {}
      knoten = knoten[teile[i]]
    }
    const letzter = teile[teile.length - 1]
    if (neu[k] === null) delete knoten[letzter]
    else knoten[letzter] = neu[k]
  }
  return ziel
}

const TYP_MUSTER = /^[a-z_]{1,40}$/
const KEINE_PERSON = { fehler: "Keine Person bekannt. Über Home Assistant öffnen oder in der App-Konfiguration 'person' setzen." }

module.exports = { optionen, erlaubt, benutzer, spielstandVon, alsDokument, verschmelze, TYP_MUSTER, KEINE_PERSON, einzigePerson }
