/// <reference path="../pb_data/types.d.ts" />
// Hintergrundaufgaben:
// - Garmin: alle 15 Minuten die letzten Aktivitäten aus Home Assistant übernehmen (ohne GPS-Koordinaten).
// - Sonntags: erledigte Vorgänge anonymisieren (Titel = Vorgangsnummer, Nächster Schritt und Warten auf leeren).

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

// Garmin auch gleich nach dem Start einmal abgleichen
onBootstrap((e) => {
  e.next()
  try {
    require(`${__hooks}/hintergrund.js`).garminAbgleich()
  } catch (_) {
    // beim Start nicht kritisch
  }
})

// Selbst-Update der App: alle 10 Minuten nach einer neuen Version sehen (siehe app_paket.js)
cronAdd("app_paket", "*/10 * * * *", () => {
  try {
    require(`${__hooks}/app_paket.js`).aktualisiere(false)
  } catch (err) {
    console.log("App-Paket fehlgeschlagen", err)
  }
})

onBootstrap((e) => {
  e.next()
  try {
    require(`${__hooks}/app_paket.js`).aktualisiere(false)
  } catch (_) {
    // beim Start nicht kritisch
  }
})
