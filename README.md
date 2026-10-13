# Lebenswelt für Home Assistant

App-Repository für Home Assistant mit der **Lebenswelt Datenbank**: PocketBase mit eigenen Routen, erreichbar nur über den Ingress von Home Assistant.

Hinzufügen in Home Assistant: Einstellungen, Apps, App Store, Menü oben rechts, Repositories, diese Adresse eintragen:

```
https://github.com/schale91/lebenswelt-ha
```

Das Repository enthält nur den Bauplan der App, keine persönlichen Daten.

## In Vorbereitung: Einsatzspiel

Feuerwehr und Polizei als Spiel im Spiel auf der Hauptkarte. Konzept, Umsetzungsplan und Übergabe stehen in [`docs/einsatzspiel/`](docs/einsatzspiel/), die Spielwerte in [`lebenswelt/pb_hooks/einsatz/regelwerk.js`](lebenswelt/pb_hooks/einsatz/regelwerk.js). Prüfen mit `node werkzeuge/pruefe-regelwerk.js --baum`.
