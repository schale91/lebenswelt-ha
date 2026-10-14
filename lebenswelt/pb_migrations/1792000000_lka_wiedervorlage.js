/// <reference path="../pb_data/types.d.ts" />
// Einmaliger Nachtrag: Vorgänge, die schon auf „Warten auf LKA (KTA PMK)“ stehen und noch keine Frist haben,
// bekommen als erste Wiedervorlage den 31.10.2026. Neue Fälle setzt danach vorgaenge.js (zwei Monate).
migrate(
  (app) => {
    const liste = app.findRecordsByFilter("dokumente", "typ = 'vorgang' && geloescht = false", "", 0, 0)
    let n = 0
    for (const r of liste) {
      const d = JSON.parse(toString(r.get("daten")) || "{}")
      if (d.status !== "Warten auf LKA (KTA PMK)" || d.frist) continue
      d.frist = "2026-10-31"
      r.set("daten", d)
      app.save(r)
      n++
    }
    if (n) console.log("Wiedervorlage LKA nachgetragen: " + n + " Vorgänge")
  },
  () => {
    // Fristen bleiben stehen
  },
)
