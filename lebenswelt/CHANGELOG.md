# Änderungen

## 0.5.0

- Updates der App per Knopf: Das Add-on lädt neue Versionen alle 10 Minuten vom Zweig `app-paket` herunter. Eingespielt wird erst, wenn in der App „Installieren“ getippt wird, und zwar nach `www/lebenswelt-*/` (nur Ordner mit `server.json`, diese Datei bleibt unberührt).
- Neue Optionen `app_quelle` und `app_token`, Zugriff auf den Konfigurationsordner von Home Assistant (nur für diese Ordner genutzt).
- Routen `/api/lebenswelt/app-paket` (Stand, Nachsehen) und `/api/lebenswelt/app-paket/installieren`.

## 0.4.0

- Bauen mit Bauzeit: Gebäudestufen, Ausbauten, Häuser und Neubaugebiete werden in Phasen gebaut. Zwei Baukolonnen, Wetterverzug, Behelfsbetrieb während des Umbaus, Baustellen als Hindernis an der Strecke, Einsätze auf der Baustelle, Bauchronik.

## 0.3.0

- Einsatzspiel: Simulation läuft im Hintergrund (Minutentakt), auch wenn die App zu ist. Einsätze entstehen, werden disponiert, bewertet (Sterne) und schalten weitere Einsatzarten frei. Ohne KI, ohne Guthaben.
- Neue Routen unter `/api/lebenswelt/einsatz/` (Regelwerk, Stand, Protokoll, Kaufen, Einräumen, Personal).
- Wetter für die Simulation aus der Wetter-Entität von Home Assistant (Option `wetter_entitaet`), alle 10 Minuten.
- Kaufbuch: Käufe im Einsatzspiel bucht der Server von den Münzen ab; ein Gerät mit älterem Spielstand bekommt die Ausgaben beim Hochladen nachgezogen (Antwort 409 mit berichtigtem Stand).
- `GET /api/lebenswelt/dokumente` ohne `typ` liefert die Dokumente des Einsatzspiels nicht mehr mit.
- Sterne nach Einsatzende statt Eintreffen. Ausrüstung wirkt je Stufe (Tempo, Stolpern, Umziehen, Sicht im Dunkeln, Arbeit), Dunkelheit nach Sonnenzeiten, ohne Verteiler nur ein Strahlrohr. Das Protokoll nennt, was Zeit gekostet hat.
- Dokumente des Einsatzspiels sind über die allgemeinen Dokument-Routen nur lesbar. Ein ungültiger Stand wird nie gespeichert; ein unlesbarer wird gesichert und neu begonnen.

## 0.2.1

- Garmin-Abgleich auf Abruf (`POST /api/lebenswelt/garmin`) mit Rückmeldung.

## 0.2.0

- Dokumentenspeicher für Aufgaben, Vorgänge, Training und mehr (`/api/lebenswelt/dokumente`, `/api/lebenswelt/suche`).
- Zugang für vertraute Apps (Standard: der Home-Assistant-MCP-Server, über den Claude arbeitet).
- Garmin: übernimmt alle 15 Minuten die letzten Aktivitäten aus Home Assistant, ohne GPS-Koordinaten.
- Sonntags werden erledigte Vorgänge anonymisiert.

## 0.1.0

- Erste Version: Spielstand je Home-Assistant-Person, Zugriff nur über Ingress.
