// Startprobe des Add-ons: PocketBase mit den Hooks und Migrationen aus lebenswelt/ in einem leeren Datenordner starten,
// die wichtigsten Routen als lokale Person abfragen und das Protokoll auf Fehler prüfen. Fängt ab, was die Node-Tests
// nicht sehen: Hooks, die in der PocketBase-Laufzeit nicht laden, und Migrationen, die nicht durchlaufen.
// Aufruf: POCKETBASE=/pfad/zu/pocketbase node werkzeuge/pruefe-start.js
const { spawn } = require("node:child_process")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const net = require("node:net")

const ADDON = join(__dirname, "..", "lebenswelt")
const PERSON = "startprobe"
// Routen, die beim Öffnen der App und im Alltag laufen (GET), dazu der Lauf der Routinen (POST)
const ROUTEN = [
  ["GET", "/api/lebenswelt/ich"],
  ["GET", "/api/lebenswelt/dokumente"],
  ["GET", "/api/lebenswelt/spielstand"],
  ["GET", "/api/lebenswelt/familie"],
  ["GET", "/api/lebenswelt/fragen"],
  ["GET", "/api/lebenswelt/app-paket"],
  ["GET", "/api/lebenswelt/einsatz/regelwerk"],
  ["GET", "/api/lebenswelt/einsatz/stand"],
  ["GET", "/api/lebenswelt/einsatz/protokoll"],
  ["GET", "/api/lebenswelt/trainme"],
  // Gmail im Posteingang (ab 0.46.0): Liste, Anlegen ohne Mails (400) und XP abholen
  ["GET", "/api/lebenswelt/gmail"],
  ["POST", "/api/lebenswelt/gmail/eingang"],
  ["POST", "/api/lebenswelt/gmail/abholen"],
  ["POST", "/api/lebenswelt/routinen/lauf"],
  // App-Paket ohne Warten (ab 0.46.2): ohne Person abgewiesen (genau 401, nichts angelegt), nachsehen im Hintergrund,
  // Auftrag anlegen, Stand, Auftrag abbrechen
  ["POST", "/api/lebenswelt/app-paket/auftrag", { status: 401, ohnePerson: true }],
  ["GET", "/api/lebenswelt/app-paket", { pruefe: (j) => j.auftrag === null || "Auftrag trotz 401 angelegt" }],
  ["POST", "/api/lebenswelt/app-paket?hintergrund=1"],
  ["POST", "/api/lebenswelt/app-paket/auftrag"],
  ["GET", "/api/lebenswelt/app-paket"],
  ["DELETE", "/api/lebenswelt/app-paket/auftrag"],
]
// Fehler der JS-Laufzeit im Protokoll (ein Hook, der beim Laden oder in einer Route scheitert)
const FEHLER = /(SyntaxError|ReferenceError|TypeError|RangeError|GoError|failed to (load|execute|apply)|panic:)/i

const freierPort = () =>
  new Promise((ok) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

async function main() {
  const pocketbase = process.env.POCKETBASE
  if (!pocketbase) throw new Error("POCKETBASE fehlt (Pfad zur PocketBase-Datei, Version wie im Dockerfile)")
  const daten = mkdtempSync(join(tmpdir(), "lebenswelt-startprobe-"))
  const port = await freierPort()
  const basis = `http://127.0.0.1:${port}`
  let protokoll = ""
  // App-Ordner und Zwischenstände des Add-ons im leeren Probeordner, nicht unter /homeassistant/www und /data
  const env = { ...process.env, LEBENSWELT_WWW: join(daten, "www"), LEBENSWELT_DATEN: join(daten, "addon") }
  const pb = spawn(pocketbase, ["serve", "--http", `127.0.0.1:${port}`, "--dir", daten, "--hooksDir", join(ADDON, "pb_hooks"), "--migrationsDir", join(ADDON, "pb_migrations")], { env })
  pb.stdout.on("data", (d) => (protokoll += d))
  pb.stderr.on("data", (d) => (protokoll += d))
  const beendet = new Promise((ok) => pb.on("exit", (code) => ok(code)))
  const fehler = []
  try {
    // Warten, bis PocketBase antwortet (Migrationen laufen vorher durch)
    const bis = Date.now() + 60_000
    for (;;) {
      if (pb.exitCode !== null) throw new Error(`PocketBase hat sich beim Start beendet (Code ${pb.exitCode})`)
      const r = await fetch(`${basis}/api/health`).catch(() => null)
      if (r?.ok) break
      if (Date.now() > bis) throw new Error("PocketBase antwortet nach 60 s nicht")
      await new Promise((f) => setTimeout(f, 250))
    }
    for (const [methode, pfad, erwartet = {}] of ROUTEN) {
      const kopf = { "Content-Type": "application/json", ...(erwartet.ohnePerson ? {} : { "X-Remote-User-Id": PERSON }) }
      const r = await fetch(basis + pfad, { method: methode, headers: kopf, body: methode === "GET" ? undefined : "{}" })
      const text = await r.text()
      let json = true
      let inhalt = null
      try {
        inhalt = JSON.parse(text)
      } catch {
        json = false
      }
      // 404 heißt: Die Route fehlt, meist weil ihre Datei nicht geladen hat
      const zusatz = json && erwartet.pruefe ? erwartet.pruefe(inhalt) : true
      const ok = (erwartet.status ? r.status === erwartet.status : r.status < 500 && r.status !== 404) && json && zusatz === true
      if (zusatz !== true) console.log(`       ${zusatz}`)
      console.log(`${ok ? "ok    " : "FEHLER"} ${r.status} ${methode} ${pfad}`)
      if (!ok) fehler.push(`${methode} ${pfad}: ${r.status} ${text.slice(0, 300)}`)
    }
  } catch (e) {
    fehler.push(String(e instanceof Error ? e.message : e))
  } finally {
    pb.kill("SIGTERM")
    await Promise.race([beendet, new Promise((f) => setTimeout(f, 5000))])
    rmSync(daten, { recursive: true, force: true })
  }
  const zeilen = protokoll.split("\n").filter((z) => FEHLER.test(z))
  for (const z of zeilen) fehler.push(`Protokoll: ${z.trim()}`)
  if (fehler.length) {
    console.error(`\n${fehler.length} Fehler:\n${fehler.join("\n")}`)
    if (!zeilen.length && protokoll) console.error(`\nProtokoll von PocketBase:\n${protokoll.slice(-4000)}`)
    process.exit(1)
  }
  console.log(`\nStartprobe bestanden: Migrationen durchgelaufen, ${ROUTEN.length} Routen antworten, keine Fehler im Protokoll.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
