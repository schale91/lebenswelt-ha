// Gemeinsame Helfer für die Routen. Wird in jedem Handler per require geladen,
// weil PocketBase jeden Handler in einem eigenen Kontext ausführt.

/** Ingress-Proxy des Supervisors. Nur von dort (und aus dem Container selbst) sind Anfragen erlaubt. */
const ERLAUBT = ["172.30.32.2", "127.0.0.1", "::1"]

function absenderIp(e) {
  const adresse = String(e.request.remoteAddr || "")
  const ohnePort = adresse.lastIndexOf(":") > adresse.lastIndexOf("]") ? adresse.slice(0, adresse.lastIndexOf(":")) : adresse
  return ohnePort.replace(/^\[|\]$/g, "")
}

function erlaubt(e) {
  return ERLAUBT.indexOf(absenderIp(e)) !== -1
}

/** Die Home-Assistant-Person, die der Ingress mitschickt, oder null. */
function benutzer(e) {
  const id = String(e.request.header.get("X-Remote-User-Id") || "").trim()
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null
  return {
    id: id,
    name: String(e.request.header.get("X-Remote-User-Name") || ""),
    anzeige: String(e.request.header.get("X-Remote-User-Display-Name") || ""),
  }
}

function spielstandVon(app, id) {
  try {
    return app.findFirstRecordByFilter("spielstaende", "benutzer = {:id}", { id: id })
  } catch (_) {
    return null
  }
}

module.exports = { erlaubt, benutzer, spielstandVon }
