/// <reference path="../pb_data/types.d.ts" />
// Hintergrundaufgaben:
// - Garmin: alle 15 Minuten die letzten Aktivitäten aus Home Assistant übernehmen (ohne GPS-Koordinaten).
// - Sonntags: erledigte Vorgänge anonymisieren (Titel = Vorgangsnummer, Nächster Schritt und Warten auf leeren).
// - Morgens: an Vorgänge beim LKA erinnern, deren Wiedervorlage heute fällig ist (Push ohne dienstliche Inhalte).

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

// Garmin auch gleich nach dem Start einmal abgleichen
onBootstrap((e) => {
  e.next()
  try {
    require(`${__hooks}/hintergrund.js`).garminAbgleich()
  } catch (_) {
    // beim Start nicht kritisch
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

onBootstrap((e) => {
  e.next()
  try {
    require(`${__hooks}/app_paket.js`).pruefe()
  } catch (_) {
    // beim Start nicht kritisch
  }
})
