// Kalender (Arbeit, frei, Feiertage), Garmin-Tageswerte und Paperless-Eingang: node --test test/*.test.js
const test = require("node:test")
const assert = require("node:assert/strict")
const K = require("../lebenswelt/pb_hooks/kalender.js")
const G = require("../lebenswelt/pb_hooks/garmin.js")
const P = require("../lebenswelt/pb_hooks/paperless.js")

test("Feiertage in Niedersachsen: Ostern beweglich, Reformationstag fest", () => {
  assert.equal(K.ostersonntag(2026), "2026-04-05")
  assert.equal(K.ostersonntag(2027), "2027-03-28")
  const f = K.feiertage(2026)
  assert.equal(f["2026-04-03"], "Karfreitag")
  assert.equal(f["2026-05-14"], "Christi Himmelfahrt")
  assert.equal(f["2026-05-25"], "Pfingstmontag")
  assert.equal(f["2026-10-31"], "Reformationstag")
  assert.equal(Object.keys(f).length, 10)
})

test("Tage einordnen: Homeoffice, Dienst mit Zeiten, Urlaub, Wochenende, vermutete Arbeit, Abfuhr ohne Termin", () => {
  const ereignisse = [
    { summary: "Homeoffice", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } },
    { summary: "Lauf: Basis, 60 min", start: { dateTime: "2026-10-14T12:00:00+02:00" }, end: { dateTime: "2026-10-14T13:00:00+02:00" } },
    { summary: "Spätdienst", start: { dateTime: "2026-10-15T13:00:00+02:00" }, end: { dateTime: "2026-10-15T21:30:00+02:00" } },
    { summary: "Biotonne", start: { dateTime: "2026-10-15T06:00:00+02:00" }, end: { dateTime: "2026-10-15T06:00:00+02:00" } },
    { summary: "Urlaub", start: { date: "2026-10-16" }, end: { date: "2026-10-17" } },
    { summary: "Dienstag Elternabend", start: { dateTime: "2026-10-13T19:00:00+02:00" }, end: { dateTime: "2026-10-13T20:30:00+02:00" } },
  ]
  const t = K.tage(ereignisse, "2026-10-13", 6, "07:00-15:30")
  const art = (tag) => t.find((x) => x.tag === tag)
  // Dienstag ohne Eintrag: Arbeit vermutet, „Dienstag“ im Titel ist kein Dienst
  assert.equal(art("2026-10-13").art, "arbeit")
  assert.equal(art("2026-10-13").sicher, false)
  assert.equal(art("2026-10-13").bis, "15:30")
  assert.equal(art("2026-10-13").termine[0].von, "19:00")
  assert.equal(art("2026-10-14").art, "homeoffice")
  assert.equal(art("2026-10-14").termine.length, 2)
  assert.equal(art("2026-10-15").art, "dienst")
  assert.equal(art("2026-10-15").von, "13:00")
  assert.equal(art("2026-10-15").bis, "21:30")
  assert.ok(!art("2026-10-15").termine.some((x) => x.titel === "Biotonne"))
  assert.equal(art("2026-10-16").art, "urlaub")
  assert.equal(art("2026-10-17").art, "wochenende")
  assert.equal(art("2026-10-18").art, "wochenende")
})

test("Feiertag ohne Dienst ist frei, mit Dienst Dienst; Zeiten in Winterzeit", () => {
  const t = K.tage([{ summary: "Frühdienst", start: { dateTime: "2026-12-25T06:00:00+01:00" }, end: { dateTime: "2026-12-25T14:00:00+01:00" } }], "2026-10-31", 1)
  assert.equal(t[0].art, "feiertag")
  assert.equal(t[0].feiertag, "Reformationstag")
  const w = K.tage([{ summary: "Frühdienst", start: { dateTime: "2026-12-25T06:00:00+01:00" }, end: { dateTime: "2026-12-25T14:00:00+01:00" } }], "2026-12-25", 1)
  assert.equal(w[0].art, "dienst")
  assert.equal(w[0].von, "06:00")
  assert.equal(w[0].feiertag, "1. Weihnachtstag")
})

test("Garmin: Tageswerte aus den Sensoren, unbekannte fehlen, Text bleibt Text", () => {
  const z = (id, state) => ({ entity_id: "sensor.garmin_connect_" + id, state })
  const w = G.tageswerte([z("steps", "104"), z("daily_step_goal", "7770"), z("hrv_status", "Balanced"), z("body_battery", "96"), z("average_spo2", "unknown"), z("bedtime", "2026-10-18T19:15:25+00:00"), { entity_id: "sensor.anderes", state: "1" }], "sensor.garmin_connect_last_activities")
  assert.equal(w.schritte, 104)
  assert.equal(w.schrittziel, 7770)
  assert.equal(w.hrv_status, "Balanced")
  assert.equal(w.body_battery, 96)
  assert.equal(w.zu_bett, "2026-10-18T19:15:25+00:00")
  assert.equal(Object.keys(w).length, 5)
})

test("Paperless: Kurzform ohne vollen Text, Eingang mit Verweis", () => {
  const n = { korrespondenten: { 3: "Stadtwerke" }, typen: { 2: "Rechnung" }, tags: { 1: "Posteingang", 5: "Haus" }, posteingang: [1] }
  const d = { id: 42, title: "Abschlag 2027", correspondent: 3, document_type: 2, tags: [1, 5], created: "2026-10-17", added: "2026-10-19T08:15:00.123456+02:00", content: "Sehr geehrter Herr  X,\n\nIhr Abschlag ... " + "x".repeat(1000) }
  const k = P.kurz(d, n, "http://paperless")
  assert.equal(k.korrespondent, "Stadtwerke")
  assert.equal(k.typ, "Rechnung")
  assert.deepEqual(k.tags, ["Posteingang", "Haus"])
  assert.equal(k.posteingang, true)
  assert.equal(k.auszug.length, 300)
  assert.equal(k.text, undefined)
  const e = P.eingangAus(k)
  assert.equal(e.quelle, "paperless")
  assert.equal(e.paperless_id, 42)
  assert.equal(e.erfasst, "2026-10-19 06:15:00Z")
  assert.equal(e.link, "http://paperless/documents/42/details")
  assert.match(e.details, /^Stadtwerke, Rechnung\. Sehr geehrter Herr X,/)
})

test("Regelarbeitszeit je Wochentag: Mo bis 15, Di bis Do bis 15:30, Fr bis 12", () => {
  const regel = "Mo 06:00-15:00; Di-Do 06:00-15:30; Fr 06:00-12:00"
  const z = K.regelzeiten(regel)
  assert.deepEqual(z[1], ["06:00", "15:00"])
  assert.deepEqual(z[3], ["06:00", "15:30"])
  assert.deepEqual(z[5], ["06:00", "12:00"])
  assert.equal(z[6], undefined)
  const t = K.tage([], "2026-10-19", 5, regel)
  assert.deepEqual(t.map((d) => d.wochentag + " " + d.von + "-" + d.bis), ["Mo 06:00-15:00", "Di 06:00-15:30", "Mi 06:00-15:30", "Do 06:00-15:30", "Fr 06:00-12:00"])
  // Einfache Form gilt für Montag bis Freitag
  assert.deepEqual(K.regelzeiten("07:00-16:00")[5], ["07:00", "16:00"])
  // Ein Werktag ohne Regelzeit ist frei (vermutet)
  assert.equal(K.tage([], "2026-10-23", 1, "Mo-Do 06:00-15:30")[0].art, "frei")
})

test("Weitere Kalender (Julia): stehen unter andere, bestimmen die Art des Tages nie", () => {
  const julia = [
    { summary: "Urlaub", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } },
    { summary: "Zahnarzt", start: { dateTime: "2026-10-20T10:00:00+02:00" }, end: { dateTime: "2026-10-20T11:00:00+02:00" } },
  ]
  const t = K.tage([], "2026-10-20", 1, "Di 06:00-15:30", [{ wer: "Julia", ereignisse: julia }])
  assert.equal(t[0].art, "arbeit")
  assert.deepEqual(t[0].andere.map((x) => x.wer + ": " + x.titel), ["Julia: Urlaub", "Julia: Zahnarzt"])
  assert.equal(t[0].termine.length, 0)
})

test("Garmin-XP: nur für gute Werte, höchste Stufe je Regel, gedeckelt, schlechte Werte kosten nichts", () => {
  const gut = G.xpAus({ schlafwert: 92, schlaf_min: 450, schlafbedarf_min: 430, schritte: 8000, schrittziel: 7770, hrv_status: "Balanced", body_battery_hoch: 100 })
  assert.equal(gut.summe, 20)
  assert.deepEqual(gut.gruende.map((g) => g.id + ":" + g.xp), ["schlafwert:8", "schlafdauer:3", "schritte:5", "hrv:2", "body_battery:2"])
  const mittel = G.xpAus({ schlafwert: 84, schlaf_min: 346, schlafbedarf_min: 430, schritte: 104, schrittziel: 7770, hrv_status: "Unbalanced" })
  assert.equal(mittel.summe, 5)
  assert.equal(G.xpAus({ schlafwert: 40, schritte: 0 }).summe, 0)
  assert.equal(G.xpAus({}).summe, 0)
})
