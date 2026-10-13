# Einsatzspiel: Start der Umsetzung

## Vorher einrichten

1. Eine neue Sitzung in Claude Code starten und **beide** Repositories auswählen: `schale91/lebenswelt-ha` und `schale91/Claude`. In dieser Sitzung wurde das Hinzufügen von `schale91/Claude` von der automatischen Rechteprüfung abgelehnt, deshalb gleich beim Start auswählen.
2. Wenn GitHub den Zugriff verweigert: unter <https://claude.ai/connect-github> das GitHub-Konto neu verbinden und prüfen, ob die Claude-GitHub-App für `schale91/Claude` installiert ist.
3. Optional in Home Assistant herausfinden, wie die Wetter-Entität heißt (z. B. `weather.forecast_home`) und welcher Benachrichtigungsdienst das Handy erreicht.

## Text für den Start der Sitzung

Diesen Text in die neue Sitzung kopieren:

```
Setze das Einsatzspiel der Lebenswelt um. Lies zuerst in schale91/lebenswelt-ha
den Branch claude/feuerwehr-einsatz-game-w74etb:
- docs/einsatzspiel/KONZEPT.md (was es können soll)
- docs/einsatzspiel/UMSETZUNG.md (Architektur, Datenmodell, Schnittstelle, Etappen, Abnahme)
- lebenswelt/pb_hooks/einsatz/regelwerk.js (alle Werte), geprüft mit node werkzeuge/pruefe-regelwerk.js

Dann im Frontend (schale91/Claude) mit Etappe E0 beginnen: Code lesen, Reifen aller
Fahrzeuge per Test und Screenshot prüfen, Straßennetz exportieren. Danach die Simulation
in lebenswelt-ha (simulation.js mit Node-Tests, einsatz.pb.js mit den Routen) und dann
das Frontend Etappe für Etappe. Nach jeder Etappe committen und pushen, Screenshots zeigen.
Prüfe vor dem ersten Kauf über den Server, wie das Frontend auf 409 beim Spielstand reagiert.
Die offenen Fragen aus UMSETZUNG.md Abschnitt 8 stellst du mir am Anfang gesammelt.
Keine Inhalte aus VS-NfD-Vorschriften (PDV 100) ins Repository.
```

## Reihenfolge

| Schritt | Repository | Ergebnis |
|---|---|---|
| E0 Bestandsaufnahme | Claude | Notizen zum Code, Reifen-Test, Straßennetz im Regelwerk |
| Simulation | lebenswelt-ha | `simulation.js` mit Tests, Routen in `einsatz.pb.js`, Cron, Wetter, Version 0.3.0 |
| E1 Leitstelle | Claude | Einsätze, Protokoll, Kaufen mit Technikbaum und Slot-Raster |
| E2 Einsatzstellen | Claude | jede Einsatzart sichtbar am Ort |
| E3 Einsatzkräfte und Löschangriff | Claude | Figuren, Schlauch, Strahlrohr, Wasser, Leiter |
| E4 Fahrphysik und Verkehr | Claude | Abstand, Kreuzungen, Blaulicht, Aufstellen, lenkende Räder |
| E5 Wetter | Claude | Schnee, Spuren, Rutschen, Regen, Nacht |
| E6 Häuser | Claude | Bauplätze, Neubaugebiete, Häuser der Einsatzkräfte |
| E7 Leistung | Claude | Zielwerte erreicht |
