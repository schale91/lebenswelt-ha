/// <reference path="../pb_data/types.d.ts" />
// Einmaliger Nachtrag: Offene Aufgaben, Teilaufgaben und Unteraufgaben von Vorgängen, die schon erledigt sind,
// werden ebenfalls erledigt. xp_offen sorgt dafür, dass die App die XP noch bucht. Neue Fälle regelt vorgaenge.js.
migrate(
  (app) => {
    const alle = app.findRecordsByFilter("dokumente", "geloescht = false && (typ = 'vorgang' || typ = 'aufgabe' || typ = 'unteraufgabe')", "", 0, 0)
    const eintraege = alle.map((r) => ({ r: r, typ: r.getString("typ"), besitzer: r.getString("besitzer"), schluessel: r.getString("schluessel"), daten: JSON.parse(toString(r.get("daten")) || "{}") }))
    const jetzt = new Date().toISOString()
    let n = 0
    for (const v of eintraege) {
      if (v.typ !== "vorgang" || v.daten.status !== "Erledigt" || !v.schluessel) continue
      const eigene = eintraege.filter((x) => x.typ !== "vorgang" && x.besitzer === v.besitzer)
      const imVorgang = new Set(eigene.filter((x) => x.typ === "aufgabe" && x.daten.vorgang === v.schluessel).map((x) => x.schluessel).filter(Boolean))
      for (const x of eigene) {
        const d = x.daten
        if (d.status === "Erledigt") continue
        if (d.vorgang !== v.schluessel && !(d.eltern && imVorgang.has(d.eltern))) continue
        d.status = "Erledigt"
        d.erledigt_am = jetzt
        d.xp_offen = true
        d.erledigt_durch = "vorgang"
        x.r.set("daten", d)
        app.save(x.r)
        n++
      }
    }
    if (n) console.log("Mit erledigten Vorgängen abgeschlossen: " + n + " Aufgaben und Unteraufgaben")
  },
  () => {
    // Erledigte Aufgaben bleiben erledigt
  },
)
