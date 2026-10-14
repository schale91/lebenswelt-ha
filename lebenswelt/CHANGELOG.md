# Änderungen

## 0.7.0

- Fitness-Welt: Neue Option `fitness_personen` (HA-Benutzer-ID oder Anmeldename). Diese Personen bekommen in der App nur die Fitness-Welt: dieselbe Karte, dasselbe Einsatzspiel und derselbe Shop mit denselben Preisen, aber kein Smarthome, keine Aufgaben und kein Kraftbuch. `GET /api/lebenswelt/ich` liefert dazu `profil` (`voll` oder `fitness`).
- Neue Route `GET /api/lebenswelt/familie`: Bewegung der letzten 14 Tage aller Personen, die in der Fitness-Welt etwas eingetragen haben (Schritte, Heim-Physio, Physio in der Praxis, Nilo schieben), dazu ihr Schrittziel. Gelesen wird aus dem Spielstand (`state.bewegungen`), es gibt keine neue Sammlung.
- Updates per Knopf (`POST /api/lebenswelt/app-paket` und `/installieren`) sind für Personen der Fitness-Welt gesperrt (403).
- Spielstände merken sich ihr Profil (Feld `profil`, Migration). Ohne Option `person` arbeitet Claude weiter für die eine Person mit voller Lebenswelt, auch wenn eine Fitness-Welt dazukommt.
- Push-Nachrichten: an die Familie, wenn in der Fitness-Welt „Nilo schieben“ eingetragen wird; um 19 Uhr Ortszeit an Personen der Fitness-Welt, die heute noch nichts eingetragen haben; an die Person, die freigeben soll, sobald Wünsche zur Freigabe (Dokumente `freigabe`) angelegt werden.
- `GET /api/lebenswelt/familie` liefert zusätzlich den Stand der Wünsche (`wuensche`: Vorschlag, Titel, Status, Anmerkung).
- Schiffsverkehr auf der Elbe: neues Programm `ais/ais.py` empfängt AIS-Daten von aisstream.io für einen Umkreis um `zone.home` (Optionen `ais_schluessel`, `ais_radius_km`) und legt die Schiffe mit Lage relativ zum Zuhause in `/data/ais.json` ab. Neue Route `GET /api/lebenswelt/schiffe`. Im Container dafür `python3` und `py3-websockets`, Start über `start.sh`.

## 0.6.2

- Neue Unteraufgaben bekommen beim Anlegen zwei Wochen als `faellig`, wenn keine mitkommt: Aufgaben mit `vorgang` oder `eltern` sowie Dokumente vom Typ `unteraufgabe`. Gilt für App und Claude, nur beim Anlegen; danach lässt sich die Fälligkeit frei ändern.

## 0.6.1

- Vorgänge „Warten auf LKA (KTA PMK)“: Wer einen Vorgang neu auf diesen Status setzt (App, Claude, jede Route), bekommt automatisch eine Wiedervorlage in zwei Monaten als `frist` (am Monatsende gekappt, Ortszeit). Kommt in derselben Änderung eine `frist` mit, bleibt sie stehen. Regeln in `pb_hooks/vorgaenge.js`.
- Einmaliger Nachtrag (Migration): Vorgänge, die schon beim LKA liegen und keine Frist haben, bekommen den 31.10.2026.
- Morgens um 6:30 Uhr (Winterzeit) bzw. 7:30 Uhr (Sommerzeit) eine Push-Nachricht, wenn eine Wiedervorlage heute fällig ist. Die Nachricht nennt nur die Zahl der Vorgänge, keinen Titel und keine Nummer.

## 0.6.0

- Löschwasser im Einsatzspiel: Bei Bränden mit Strahlrohren muss eine Wasserversorgung aufgebaut werden. Gewählt wird die schnellste Quelle: ein Unterflurhydrant (mit Standrohr) oder ein offenes Gewässer wie die Elbe (Pumpe, mindestens zwei A-Saugschläuche, Saugkorb), sofern die B- und C-Schläuche bis dorthin reichen. Leitung verlegen kostet Zeit (`ZEITEN.leitung_m_s`, `wasser_hydrant_s`, `wasser_ansaugen_s`), in der sich das Feuer weiter ausbreitet. Wasser im Tank überbrückt den Aufbau. Ohne erreichbare Quelle gilt der Faktor `nur_tankwasser` bzw. `ohne_wasser`. Der Plan enthält `wasser` (Quelle, Lage, Meter, Verzug).
- Neue Listen `HYDRANTEN`, `HYDRANT_PLAETZE` und `GEWAESSER` im Regelwerk; die private Karte ersetzt sie (Felder `hydranten`, `hydrant_plaetze`, `gewaesser`). Überflurhydranten gibt es nicht.
- Ausbau `hydrant_a` und `hydrant_b`: zwei zusätzliche Unterflurhydranten mit Hinweisschild an den Hydrantenplätzen der Karte.

## 0.5.2

- Einsätze ohne freie Kräfte verfallen nicht mehr sofort: Sie bleiben offen (`wartet: true`, mit Grund), werden zu jeder vollen Minute und direkt nach jedem Kauf neu alarmiert und verfallen erst, wenn ihre Frist abläuft. Wer spät alarmiert wird, kommt entsprechend später an (das kostet wie bisher Sterne).

## 0.5.1

- Schutzzonen im Einsatzspiel: Einsatzarten mit `harmlos: true` (Katze auf Baum, Ruhestörung, Falschparker, Baulärm) dürfen überall stattfinden, alle anderen (Brände, Verletzte, Wasser) nie in einer Schutzzone. Auch Folgeeinsätze und Baustellen-Einsätze halten sich daran. Die Zonen kommen nur aus der privaten Karte (Feld `schutz`), im Regelwerk ist die Liste leer.

## 0.5.0

- Updates der App per Knopf: Das Add-on lädt neue Versionen alle 10 Minuten vom Zweig `app-paket` herunter. Eingespielt wird erst, wenn in der App „Installieren“ getippt wird, und zwar nach `www/lebenswelt-*/` (nur Ordner mit `server.json`, diese Datei bleibt unberührt).
- Neue Optionen `app_quelle` und `app_token`, Zugriff auf den Konfigurationsordner von Home Assistant (nur für diese Ordner genutzt).
- Routen `/api/lebenswelt/app-paket` (Stand, Nachsehen) und `/api/lebenswelt/app-paket/installieren`.
- Android-App: Liegt sie im Paket (`lebenswelt.apk`), kommt sie mit in den App-Ordner.
- Einsatzspiel: Tagesbilanz. Jeder Einsatz bekommt weiter seine Sterne; um Mitternacht (Ortszeit) wird der Durchschnitt aller Einsätze des Tages abgerechnet (verfallene zählen mit 0). Daraus gibt es XP (in der App zum Abholen am Feuerwehrhaus), und neue Einsatzarten werden nur noch freigeschaltet, wenn der Tagesdurchschnitt reicht und die vorausgesetzte Art an dem Tag erfolgreich war. Neue Route `POST /api/lebenswelt/einsatz/sofort` löst zum Ausprobieren sofort einen Einsatz aus.
- Karte: Seitenstraße südlich des Elternhauses (im Straßennetz für die Wege der Einsatzkräfte). Bauplätze bp04, bp06 und bp07 liegen jetzt an ihr, dazu die neuen Bauplätze bp17 bis bp20.
- Eigene Karte: Legt die App ein Dokument `karte` mit Schlüssel `dorf` ab (Wegenetz, Lage der Orte, Bauplätze, Neubaugebiete), rechnet das Einsatzspiel für diese Person damit statt mit der erfundenen Karte des Regelwerks. So bleibt eine Karte nach dem echten Wohnort nur in der eigenen Datenbank. Die Route `/api/lebenswelt/einsatz/regelwerk` liefert dann `KARTE: "privat"`.
- Push-Nachrichten an die Android-App über Firebase (Option `fcm_dienstkonto`): neue Einsätze, neue Garmin-Aktivitäten, Update verfügbar. Routen `/api/lebenswelt/push/geraet`, `/api/lebenswelt/push`, `/api/lebenswelt/push/test`. `openssl` im Container.

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
