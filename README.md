# Lebenswelt für Home Assistant

App-Repository für Home Assistant mit der **Lebenswelt Datenbank**: PocketBase mit eigenen Routen, erreichbar nur über den Ingress von Home Assistant.

Hinzufügen in Home Assistant: Einstellungen, Apps, App Store, Menü oben rechts, Repositories, diese Adresse eintragen:

```
https://github.com/schale91/lebenswelt-ha
```

Das Repository enthält nur den Bauplan der App, keine persönlichen Daten.

## Fitness-Welt

Personen in der Option `fitness_personen` bekommen dieselbe App als Fitness-Welt (gleiche Karte, gleiches Einsatzspiel, gleiche Preise, aber nur Bewegung statt Aufgaben und Smarthome). Einrichtung in [`lebenswelt/DOCS.md`](lebenswelt/DOCS.md), Logik in [`lebenswelt/pb_hooks/familie.js`](lebenswelt/pb_hooks/familie.js).

## Einsatzspiel

Feuerwehr und Polizei als Teil der Hauptkarte, im Hintergrund simuliert. Konzept, Umsetzungsplan und Bestandsaufnahme stehen in [`docs/einsatzspiel/`](docs/einsatzspiel/), die Spielwerte in [`lebenswelt/pb_hooks/einsatz/regelwerk.js`](lebenswelt/pb_hooks/einsatz/regelwerk.js), die Simulation in [`lebenswelt/pb_hooks/einsatz/simulation.js`](lebenswelt/pb_hooks/einsatz/simulation.js). Die geplante Erweiterung um weitere Dienste und den Sportplatz: [`docs/einsatzspiel/DORFDIENSTE.md`](docs/einsatzspiel/DORFDIENSTE.md).

Prüfen:

```
node werkzeuge/pruefe-regelwerk.js --baum
node --test test/*.test.js
python3 test/ais_test.py
POCKETBASE=/pfad/zu/pocketbase node werkzeuge/pruefe-start.js
```

Die Startprobe startet PocketBase mit allen Hooks und Migrationen und fragt die wichtigsten Routen ab. Alles zusammen läuft bei jedem Pull Request als Action „Tests“. Die Ende-zu-Ende-Tests mit der App stehen in [`docs/ARBEITSABLAUF.md`](docs/ARBEITSABLAUF.md#änderungen-am-add-on).

## Daten aus Home Assistant

Elbpegel, Unwetterwarnungen, Müllabfuhr, Garmin, Kalender und Paperless-ngx in der Lebenswelt: Konzept in [`docs/integrationen/KONZEPT.md`](docs/integrationen/KONZEPT.md), Pegel in [`lebenswelt/pb_hooks/einsatz/pegel.js`](lebenswelt/pb_hooks/einsatz/pegel.js), Müllabfuhr in [`lebenswelt/pb_hooks/einsatz/muell.js`](lebenswelt/pb_hooks/einsatz/muell.js).
