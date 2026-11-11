// App-Paket: sofort nachsehen im Hintergrund und Auftrag „installieren, sobald neuer als X“: node --test test/*.test.js
// Die PocketBase-Umgebung ($os, $app) wird hier mit Node nachgebildet, GitHub und Push ersetzt _ersetzeAbruf().
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASIS = fs.mkdtempSync(path.join(os.tmpdir(), "app-paket-test-"))
const WWW = path.join(BASIS, "www")
const DATEN = path.join(BASIS, "daten")
const UMGEBUNG = { LEBENSWELT_WWW: WWW, LEBENSWELT_DATEN: DATEN }

const eintrag = (ordner, name) => {
  const st = fs.statSync(path.join(ordner, name))
  return { name: () => name, isDir: () => st.isDirectory() }
}
// Optionen des Add-ons (sonst /data/options.json) nur im Speicher
const OPTIONEN = { fitness_personen: ["papa"] }
global.$os = {
  getenv: (n) => UMGEBUNG[n] || "",
  readFile: (p) => (p === "/data/options.json" ? JSON.stringify(OPTIONEN) : fs.readFileSync(p, "utf8")),
  writeFile: (p, d) => fs.writeFileSync(p, d),
  readDir: (p) => fs.readdirSync(p).map((n) => eintrag(p, n)),
  stat: (p) => fs.statSync(p),
  mkdirAll: (p) => fs.mkdirSync(p, { recursive: true }),
  remove: (p) => fs.rmSync(p),
  removeAll: (p) => fs.rmSync(p, { recursive: true, force: true }),
  rename: (a, b) => fs.renameSync(a, b),
}
const speicher = new Map()
// Wie der Speicher von PocketBase: get liefert null, getOrSet setzt nur, wenn noch nichts da ist
global.$app = {
  store: () => ({
    get: (k) => (speicher.has(k) ? speicher.get(k) : null),
    set: (k, v) => speicher.set(k, v),
    remove: (k) => speicher.delete(k),
    getOrSet: (k, f) => (speicher.has(k) ? speicher.get(k) : (speicher.set(k, f()), speicher.get(k))),
  }),
}
global.__hooks = path.join(__dirname, "..", "lebenswelt", "pb_hooks")

const P = require("../lebenswelt/pb_hooks/app_paket.js")

// ---------- Ersatz für GitHub: ein Paket je Version, Abrufe werden gezählt ----------
let paket = null
let abrufe = []
let kaputt = null // Datei, deren Abruf scheitert
let meldungen = 0
P._ersetzeAbruf({
  quelle: () => ({ github: false, token: "" }),
  hole: (_q, datei) => {
    abrufe.push(datei)
    if (!paket) throw new Error("HTTP 404 für manifest.json")
    if (datei === kaputt) throw new Error(`HTTP 502 für ${datei}`)
    if (datei === "manifest.json") return JSON.stringify(paket.manifest)
    return paket.dateien[datei]
  },
  meldeNeueVersion: () => meldungen++,
})

function baue(erstellt, extra = {}) {
  const js = `app-${erstellt.replace(/\W/g, "")}.js`
  return {
    manifest: Object.assign({ erstellt, dateien: [js, "stand.json", "index.html"] }, extra),
    dateien: { [js]: `// ${erstellt}`, "stand.json": JSON.stringify({ erstellt, js }), "index.html": "<!doctype html>" },
  }
}

const APP = path.join(WWW, "lebenswelt-test")
function frisch(installiert = "2026-11-10T08:00:00.000Z") {
  fs.rmSync(BASIS, { recursive: true, force: true })
  fs.mkdirSync(APP, { recursive: true })
  fs.writeFileSync(path.join(APP, "server.json"), '{"url":"geheim-bleibt-hier"}')
  fs.writeFileSync(path.join(APP, "stand.json"), JSON.stringify({ erstellt: installiert }))
  fs.writeFileSync(path.join(APP, "app-alt.js"), "// alt")
  speicher.clear()
  paket = null
  abrufe = []
  kaputt = null
  meldungen = 0
}
const manifestAbrufe = () => abrufe.filter((d) => d === "manifest.json").length
const MIN = 60 * 1000

test.after(() => fs.rmSync(BASIS, { recursive: true, force: true }))

test("Versionen vergleichen: nur echt neuer zählt, leer heißt jede Version", () => {
  assert.equal(P.neuerAls("2026-11-11T10:00:00Z", "2026-11-11T09:59:59Z"), true)
  assert.equal(P.neuerAls("2026-11-11T10:00:00.000Z", "2026-11-11T10:00:00Z"), false)
  assert.equal(P.neuerAls("2026-11-11T10:00:00Z", ""), true)
  assert.equal(P.neuerAls("", "2026-11-11T10:00:00Z"), false)
  assert.equal(P.neuerAls("kaputt", ""), false)
})

test("Ohne Anforderung und Auftrag fragt der Minutentakt nichts ab", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  assert.deepEqual(P.arbeite(), { getan: "nichts" })
  assert.equal(abrufe.length, 0)
  assert.equal(P.zustand().auftrag, null)
  assert.equal(P.zustand().nachsehen_angefordert, "")
})

test("Nachsehen im Hintergrund: antwortet sofort, lädt in der nächsten Minute, installiert nicht", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  const t = Date.now()
  const z = P.fordereAn(t)
  assert.equal(abrufe.length, 0, "die Anfrage selbst lädt nichts")
  assert.equal(z.nachsehen_angefordert, new Date(t).toISOString())
  // Mehrfach anfordern bleibt eine Anforderung
  assert.equal(P.fordereAn(t + 5000).nachsehen_angefordert, new Date(t).toISOString())
  assert.equal(P.arbeite(t + 30000).getan, "nachgesehen")
  const danach = P.zustand()
  assert.equal(danach.verfuegbar, "2026-11-11T09:00:00.000Z")
  assert.equal(danach.installiert, "2026-11-10T08:00:00.000Z", "nur bereitgelegt")
  assert.equal(danach.nachsehen_angefordert, "")
  assert.equal(danach.fehler, "")
  // Erledigt: der nächste Takt fragt nicht wieder
  abrufe = []
  assert.equal(P.arbeite(t + 90000).getan, "nichts")
  assert.equal(abrufe.length, 0)
})

test("Auftrag: wartet auf eine neuere Version, sieht höchstens alle 2 Minuten nach und installiert dann", () => {
  frisch()
  paket = baue("2026-11-11T08:00:00.000Z") // älter als der Auftrag verlangt
  const t = Date.now()
  const z = P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  assert.equal(z.auftrag.stand, "wartet")
  assert.equal(z.auftrag.neuer_als, "2026-11-11T08:30:00.000Z")
  assert.equal(z.auftrag.bis, new Date(t + 30 * MIN).toISOString())
  assert.equal(abrufe.length, 0, "die Anfrage selbst lädt nichts")

  assert.equal(P.arbeite(t).getan, "nachgesehen") // sofort in der nächsten Minute
  assert.equal(P.zustand().auftrag.stand, "wartet")
  assert.equal(manifestAbrufe(), 1)
  assert.equal(P.arbeite(t + 1 * MIN).getan, "gewartet") // Takt noch nicht um
  assert.equal(manifestAbrufe(), 1)

  paket = baue("2026-11-11T09:00:00.000Z")
  const r = P.arbeite(t + 2.5 * MIN)
  assert.equal(r.getan, "nachgesehen,installiert")
  const fertig = P.zustand()
  assert.equal(fertig.auftrag.stand, "erledigt")
  assert.equal(fertig.auftrag.installiert, "2026-11-11T09:00:00.000Z")
  assert.equal(fertig.installiert, "2026-11-11T09:00:00.000Z")
  assert.equal(fertig.auftrag.fehler, "")
  // Derselbe Installationscode wie der Knopf: server.json bleibt, alte Dateien weg, manifest.json im Ordner
  assert.equal(fs.readFileSync(path.join(APP, "server.json"), "utf8"), '{"url":"geheim-bleibt-hier"}')
  assert.equal(fs.existsSync(path.join(APP, "app-alt.js")), false)
  assert.ok(fs.existsSync(path.join(APP, "manifest.json")))
  // Danach ist Ruhe
  abrufe = []
  assert.equal(P.arbeite(t + 10 * MIN).getan, "nichts")
  assert.equal(abrufe.length, 0)
})

test("Auftrag: liegt die Version schon bereit, wird ohne Herunterladen sofort installiert", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  P.pruefe() // die Prüfung alle 10 Minuten hat sie schon geholt
  assert.equal(meldungen, 0, "erste Version ohne Push")
  abrufe = []
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  const r = P.arbeite(t)
  // Die Anforderung aus dem Auftrag sieht einmal nach (nur manifest.json), dann wird installiert
  assert.equal(r.getan, "nachgesehen,installiert")
  assert.deepEqual(abrufe, ["manifest.json"])
  assert.equal(P.zustand().auftrag.stand, "erledigt")
})

test("Auftrag: ohne neuer_als gilt die installierte Version, \"jetzt\" die Uhrzeit des Add-ons", () => {
  frisch("2026-11-10T08:00:00.000Z")
  const t = Date.parse("2026-11-11T10:00:00Z")
  assert.equal(P.beauftrage({}, t).auftrag.neuer_als, "2026-11-10T08:00:00.000Z")
  assert.equal(P.beauftrage({ neuer_als: "jetzt", minuten: 45 }, t).auftrag.neuer_als, "2026-11-11T10:00:00.000Z")
  assert.equal(P.zustand().auftrag.bis, "2026-11-11T10:45:00.000Z")
  assert.throws(() => P.beauftrage({ neuer_als: "gestern" }, t), /kein Zeitpunkt/)
  assert.throws(() => P.beauftrage({ minuten: 2 }, t), /minuten/)
  assert.throws(() => P.beauftrage({ minuten: 600 }, t), /minuten/)
  assert.throws(() => P.beauftrage({ minuten: "viel" }, t), /minuten/)
})

test("Auftrag: ist die verlangte Version schon installiert, ist er ohne Abruf erledigt", () => {
  frisch("2026-11-11T09:00:00.000Z")
  paket = baue("2026-11-11T09:00:00.000Z")
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:00:00Z" }, t)
  const r = P.arbeite(t)
  assert.match(r.getan, /^schon_installiert/)
  assert.equal(P.zustand().auftrag.stand, "erledigt")
  assert.match(P.zustand().auftrag.hinweis, /schon installiert/)
})

test("Auftrag läuft ab: danach keine Abfragen mehr", () => {
  frisch()
  paket = baue("2026-11-11T08:00:00.000Z")
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z", minuten: 5 }, t)
  P.arbeite(t)
  abrufe = []
  assert.equal(P.arbeite(t + 6 * MIN).getan, "abgelaufen")
  assert.equal(abrufe.length, 0)
  const z = P.zustand()
  assert.equal(z.auftrag.stand, "abgelaufen")
  assert.equal(z.installiert, "2026-11-10T08:00:00.000Z")
  assert.equal(P.arbeite(t + 7 * MIN).getan, "nichts")
})

test("Download scheitert: Zwischenordner weg, bereit unverändert, nach 3 Versuchen gibt der Auftrag auf", () => {
  frisch()
  paket = baue("2026-11-11T08:00:00.000Z")
  P.pruefe()
  paket = baue("2026-11-11T09:00:00.000Z")
  kaputt = paket.manifest.dateien[0]
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  P.arbeite(t)
  let z = P.zustand()
  assert.equal(z.auftrag.stand, "wartet")
  assert.equal(z.auftrag.versuche, 1)
  assert.match(z.auftrag.fehler, /HTTP 502/)
  assert.equal(z.verfuegbar, "2026-11-11T08:00:00.000Z", "bereit bleibt die alte, vollständige Version")
  assert.deepEqual(fs.readdirSync(path.join(DATEN, "app_paket")).filter((n) => n.startsWith("neu-")), [])
  // Nach einem Fehler wartet der Auftrag den Takt ab (keine Dauerabfragen)
  abrufe = []
  P.arbeite(t + 1 * MIN)
  assert.equal(abrufe.length, 0)
  P.arbeite(t + 2.1 * MIN)
  P.arbeite(t + 4.2 * MIN)
  z = P.zustand()
  assert.equal(z.auftrag.stand, "fehler")
  assert.equal(z.auftrag.versuche, P.AUFTRAG_FEHLVERSUCHE)
  assert.equal(z.installiert, "2026-11-10T08:00:00.000Z")
  abrufe = []
  assert.equal(P.arbeite(t + 10 * MIN).getan, "nichts")
  assert.equal(abrufe.length, 0)
})

test("Unvollständiges Paket (ohne index.html) wird nicht installiert", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  paket.manifest.dateien = paket.manifest.dateien.filter((d) => d !== "index.html")
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  P.arbeite(t)
  const z = P.zustand()
  assert.equal(z.auftrag.stand, "wartet")
  assert.match(z.auftrag.fehler, /unvollständig/)
  assert.equal(z.installiert, "2026-11-10T08:00:00.000Z")
  assert.equal(z.verfuegbar, "")
})

test("Bereitliegende Version mit fehlender Datei wird neu geladen, bevor der Auftrag installiert", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  P.pruefe()
  fs.rmSync(path.join(DATEN, "app_paket", "bereit", "index.html"))
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  assert.equal(P.arbeite(t).getan, "nachgesehen,installiert")
  assert.ok(fs.existsSync(path.join(APP, "index.html")))
})

test("Zwei Aufträge: der neue ersetzt den alten, der alte schreibt nichts mehr", () => {
  frisch()
  const t = Date.now()
  const erster = P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t).auftrag
  const zweiter = P.beauftrage({ neuer_als: "2026-11-11T09:30:00Z" }, t + 1000).auftrag
  assert.notEqual(erster.id, zweiter.id)
  assert.equal(zweiter.ersetzt, erster.seit)
  paket = baue("2026-11-11T09:00:00.000Z") // reicht für den ersten, nicht für den zweiten
  P.arbeite(t + 2000)
  const z = P.zustand()
  assert.equal(z.auftrag.id, zweiter.id)
  assert.equal(z.auftrag.stand, "wartet")
  assert.equal(z.installiert, "2026-11-10T08:00:00.000Z")
})

test("Nur ein Lauf zur Zeit; nach einem Neustart (Speicher leer) geht der Auftrag aus zustand.json weiter", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  // Ein anderer Lauf ist gerade dabei
  speicher.set("app_paket_arbeit", `${Date.now()}-x`)
  assert.equal(P.arbeite(t + 1000).getan, "laeuft_schon")
  // Ein anderer Abruf (Prüfung alle 10 Minuten) lädt gerade: der Auftrag wartet, ohne selbst zu laden
  speicher.set("app_paket_arbeit", `${Date.now() - 16 * MIN}-x`) // liegen gebliebene Belegung gilt nicht mehr
  speicher.set("app_paket_abruf", `${Date.now()}-y`)
  assert.equal(P.arbeite(t + 2000).getan, "abruf_laeuft_schon")
  assert.equal(abrufe.length, 0)
  speicher.delete("app_paket_abruf")
  assert.equal(P.arbeite(t + 3000).getan, "nachgesehen,installiert")
  // Neustart mitten im Auftrag: Speicher leer, Abrufsperre als Datei liegt noch, alter Zwischenordner auch
  paket = baue("2026-11-11T10:00:00.000Z")
  P.beauftrage({ neuer_als: "2026-11-11T09:30:00Z" }, t)
  speicher.clear()
  fs.writeFileSync(path.join(DATEN, "app_paket", "sperre"), String(Date.now()))
  const alt = path.join(DATEN, "app_paket", `neu-${Date.now() - 60 * MIN}`)
  fs.mkdirSync(alt)
  assert.equal(P.arbeite(t + 1000).getan, "abruf_laeuft_schon")
  assert.equal(P.zustand().auftrag.stand, "wartet")
  fs.rmSync(path.join(DATEN, "app_paket", "sperre")) // Sperre abgelaufen bzw. der alte Lauf ist fertig
  assert.equal(P.arbeite(t + 2000).getan, "nachgesehen,installiert")
  assert.equal(P.zustand().auftrag.stand, "erledigt")
  assert.equal(fs.existsSync(alt), false, "Zwischenordner des abgebrochenen Laufs aufgeräumt")
})

test("Während des Abrufs abgebrochen: es wird nicht mehr installiert", () => {
  frisch()
  paket = baue("2026-11-11T09:00:00.000Z")
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  const echt = paket
  paket = { manifest: echt.manifest, dateien: new Proxy(echt.dateien, { get: (o, k) => (k === "index.html" && P.brichAb(t + 500), o[k]) }) }
  assert.equal(P.arbeite(t + 1000).getan, "nachgesehen")
  const z = P.zustand()
  assert.equal(z.auftrag.stand, "abgebrochen")
  assert.equal(z.verfuegbar, "2026-11-11T09:00:00.000Z", "heruntergeladen wird trotzdem")
  assert.equal(z.installiert, "2026-11-10T08:00:00.000Z")
})

test("Abbrechen: ein wartender Auftrag wird beendet, ein erledigter bleibt erledigt", () => {
  frisch()
  const t = Date.now()
  P.beauftrage({ neuer_als: "2026-11-11T08:30:00Z" }, t)
  assert.equal(P.brichAb(t + 1000).auftrag.stand, "abgebrochen")
  assert.equal(P.brichAb(t + 2000).auftrag.ende, new Date(t + 1000).toISOString())
})

test("Bisheriger Weg bleibt: pruefe() lädt sofort, zweite Version meldet per Push, installiere() spielt ein", () => {
  frisch()
  paket = baue("2026-11-11T08:00:00.000Z")
  assert.equal(P.pruefe().verfuegbar, "2026-11-11T08:00:00.000Z")
  paket = baue("2026-11-11T09:00:00.000Z")
  assert.equal(P.pruefe().verfuegbar, "2026-11-11T09:00:00.000Z")
  assert.equal(meldungen, 1)
  const z = P.installiere()
  assert.equal(z.fehler, "")
  assert.equal(z.installiert, "2026-11-11T09:00:00.000Z")
  assert.equal(z.geschrieben, 3)
  assert.ok(fs.existsSync(path.join(APP, "server.json")))
  assert.deepEqual(Object.keys(z).sort(), ["auftrag", "fehler", "geloescht", "geprueft", "geschrieben", "installiert", "installiert_am", "nachsehen_angefordert", "ordner", "verfuegbar"])
})

test("Rechte: ohne Person 401, Fitness-Welt 403, volle Lebenswelt darf", () => {
  // Anfrage wie über den Ingress von Home Assistant
  const anfrage = (person) => ({
    request: { remoteAddr: "172.30.32.2:4711", header: { get: (n) => (n === "X-Remote-User-Id" ? person : "") } },
  })
  assert.equal(P.verweigert(anfrage("")).status, 401)
  assert.equal(P.verweigert(anfrage("papa")).status, 403)
  assert.match(P.verweigert(anfrage("papa")).body.fehler, /volle Lebenswelt/)
  assert.equal(P.verweigert(anfrage("alex")), null)
})
