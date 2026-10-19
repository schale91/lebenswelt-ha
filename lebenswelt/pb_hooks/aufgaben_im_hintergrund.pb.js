/// <reference path="../pb_data/types.d.ts" />
// Hintergrundaufgaben:
// - Garmin: alle 15 Minuten die letzten Aktivitäten aus Home Assistant übernehmen (ohne GPS-Koordinaten).
// - Sonntags: erledigte Vorgänge anonymisieren (Titel = Vorgangsnummer, Nächster Schritt und Warten auf leeren).
// - Sonntags: XP-Prüfung (levelt jemand zu schnell?), siehe xp_pruefung.js.
// - Morgens: an Vorgänge beim LKA erinnern, deren Wiedervorlage heute fällig ist (Push ohne dienstliche Inhalte).
// - Fitness-Welt: um 19 Uhr Ortszeit erinnern, wenn heute noch keine Bewegung eingetragen ist.

cronAdd("garmin", "*/15 * * * *", () => {
  try {
    require(`${__hooks}/hintergrund.js`).garminAbgleich()
  } catch (err) {
    console.log("Garmin-Abgleich fehlgeschlagen", err)
  }
})

// Sonntag 17:00 UTC, also nach dem Wochenbriefing um 18 Uhr Winterzeit bzw. 19 Uhr Sommerzeit
cronAdd("anonymisieren", "0 17 * * 0", () => {
  try {
    require(`${__hooks}/hintergrund.js`).anonymisiereVorgaenge()
  } catch (err) {
    console.log("Anonymisieren fehlgeschlagen", err)
  }
})

// 5:30 UTC, also 6:30 Uhr Winterzeit bzw. 7:30 Uhr Sommerzeit
cronAdd("lka_wiedervorlage", "30 5 * * *", () => {
  try {
    require(`${__hooks}/vorgaenge.js`).erinnere($app)
  } catch (err) {
    console.log("Erinnerung Wiedervorlage LKA fehlgeschlagen", err)
  }
})

// Nach dem Start einmal Garmin, App-Paket und Abfallkalender abgleichen, in der ersten Minute statt beim Start selbst:
// Solange onBootstrap läuft, nimmt der Server keine Anfragen an, und direkt nach einem Neustart antworten Home
// Assistant und GitHub manchmal erst nach ihrer Zeitüberschreitung (die App war dann bis zu zwei Minuten nicht erreichbar).
cronAdd("nach_dem_start", "* * * * *", () => {
  const speicher = $app.store()
  if (speicher.get("nach_dem_start")) return
  speicher.set("nach_dem_start", Date.now())
  const schritte = [
    () => require(`${__hooks}/hintergrund.js`).garminAbgleich(),
    () => require(`${__hooks}/einsatz/dienst.js`).abfallAbgleich($app),
    () => require(`${__hooks}/app_paket.js`).pruefe(),
  ]
  for (const f of schritte) {
    try {
      f()
    } catch (err) {
      console.log("Abgleich nach dem Start fehlgeschlagen", err)
    }
  }
})

// Update der App: alle 10 Minuten nach einer neuen Version sehen und sie bereitlegen (siehe app_paket.js)
cronAdd("app_paket", "*/10 * * * *", () => {
  try {
    require(`${__hooks}/app_paket.js`).pruefe()
  } catch (err) {
    console.log("App-Paket fehlgeschlagen", err)
  }
})


// Sonntagsprüfung XP: 16 Uhr UTC, also 17 Uhr Winterzeit bzw. 18 Uhr Sommerzeit (vor dem Anonymisieren)
cronAdd("xp_pruefung", "0 16 * * 0", () => {
  try {
    require(`${__hooks}/xp_pruefung.js`).pruefeAlle($app)
  } catch (err) {
    console.log("Sonntagsprüfung XP fehlgeschlagen", err)
  }
})

// Sonntagsprüfung von Hand auslösen (nur volle Lebenswelt), z. B. zum Ausprobieren
routerAdd("POST", "/api/lebenswelt/xp-pruefung", (e) => {
  const h = require(`${__hooks}/hilfen.js`)
  const ich = h.benutzer(e)
  if (!ich) return e.json(401, h.KEINE_PERSON)
  if (h.profilVon(ich) === "fitness") return e.json(403, { fehler: "Die Prüfung startet nur die volle Lebenswelt." })
  return e.json(200, { personen: require(`${__hooks}/xp_pruefung.js`).pruefeAlle(e.app) })
})

// Fitness-Welt: stündlich nachsehen, um 19 Uhr Ortszeit (MEZ/MESZ) einmal erinnern, wer heute noch nichts eingetragen hat
cronAdd("bewegung_erinnern", "5 * * * *", () => {
  try {
    const S = require(`${__hooks}/einsatz/simulation.js`)
    const jetzt = Date.now()
    if (S.ortszeit(jetzt).stunde !== 19) return
    const heute = S._intern.tagVon(jetzt)
    const f = require(`${__hooks}/familie.js`)
    const p = require(`${__hooks}/push.js`)
    for (const r of $app.findRecordsByFilter("spielstaende", "profil = 'fitness'", "", 0, 0)) {
      let daten = null
      try {
        daten = JSON.parse(toString(r.get("daten")) || "null")
      } catch (_) {
        continue
      }
      if (!f.braucheErinnerung(daten, heute)) continue
      p.sende($app, r.getString("benutzer"), { titel: "Heute schon bewegt?", text: "Noch nichts eingetragen. Schon ein kurzer Spaziergang am Deich zählt.", kanal: "allgemein", id: "erinnerung-" + heute })
    }
  } catch (err) {
    console.log("Erinnerung fehlgeschlagen", err)
  }
})
