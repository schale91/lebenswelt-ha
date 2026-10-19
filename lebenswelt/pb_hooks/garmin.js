// Garmin-Tageswerte aus Home Assistant (Integration Garmin Connect) für die Anzeige in der App und als Tagesverlauf.
// Bewusst ohne Wirkung auf Spiel und XP (docs/integrationen/KONZEPT.md, Abschnitt 5; DORFDIENSTE.md 12.6).
// tageswerte() ist rein und in Node getestet (test/kalender.test.js).

/** Feld in der Antwort → Endung der Entität nach dem Präfix (z. B. sensor.garmin_connect_). */
const FELDER = {
  schritte: "steps",
  schrittziel: "daily_step_goal",
  schritte_gestern: "yesterday_steps",
  schritte_wochenschnitt: "weekly_step_average",
  distanz_m: "distance",
  etagen: "floors_ascended",
  etagen_ziel: "floors_ascended_goal",
  intensiv_min: "intensity_minutes",
  intensiv_ziel_woche: "intensity_minutes_goal",
  aktive_kalorien: "active_calories",
  kalorien: "calories",
  ruhepuls: "resting_heart_rate",
  ruhepuls_7_tage: "7_day_average_resting_heart_rate",
  body_battery: "body_battery",
  body_battery_hoch: "body_battery_highest",
  body_battery_tief: "body_battery_lowest",
  body_battery_geladen: "body_battery_charged",
  body_battery_verbraucht: "body_battery_drained",
  stress: "average_stress_level",
  schlaf_min: "sleep_duration",
  schlafbedarf_min: "sleep_need",
  schlafwert: "sleep_score",
  tiefschlaf_min: "deep_sleep",
  leichtschlaf_min: "light_sleep",
  rem_min: "rem_sleep",
  wach_min: "awake_duration",
  zu_bett: "bedtime",
  aufgewacht: "wake_time",
  hrv_status: "hrv_status",
  hrv_nacht: "hrv_last_night_average",
  hrv_woche: "hrv_weekly_average",
  hrv_basis: "hrv_baseline",
  trainingsbereitschaft: "training_readiness",
  vo2max: "vo2_max",
  fitnessalter: "fitness_age",
  naechstes_training: "next_scheduled_workout",
  letzte_aktivitaet: "last_activity",
  synchronisiert: "last_synced",
}

/** Präfix der Garmin-Sensoren aus der Option garmin_sensor (sensor.garmin_connect_last_activities). */
function praefix(sensor) {
  const s = String(sensor || "sensor.garmin_connect_last_activities")
  return s.replace(/last_activities$/, "")
}

/** Tageswerte aus den Zuständen von Home Assistant (Liste aus /api/states). Zahlen als Zahl, unbekannt fehlt. */
function tageswerte(zustaende, sensor) {
  const p = praefix(sensor)
  const nach = {}
  for (const z of zustaende || []) if (z && typeof z.entity_id === "string" && z.entity_id.indexOf(p) === 0) nach[z.entity_id.slice(p.length)] = z
  const aus = {}
  for (const [feld, endung] of Object.entries(FELDER)) {
    const z = nach[endung]
    if (!z || z.state === "unknown" || z.state === "unavailable" || z.state === "" || z.state === null) continue
    const n = Number(z.state)
    aus[feld] = isFinite(n) && /^-?[\d.]+$/.test(String(z.state)) ? Math.round(n * 100) / 100 : String(z.state)
  }
  return aus
}

module.exports = { tageswerte, praefix, FELDER }
