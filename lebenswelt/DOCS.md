# Lebenswelt Datenbank

Speichert die Daten der Lebenswelt-App in Home Assistant. Technisch ist das [PocketBase](https://pocketbase.io) mit eigenen Routen.

- Erreichbar nur über den Ingress von Home Assistant. Anfragen von anderswo lehnt die App ab.
- Wer eine Anfrage stellt, weiß die App aus dem Ingress (die angemeldete Home-Assistant-Person). Eine eigene Anmeldung gibt es nicht.
- Die Daten liegen in `/data/pb_data` und sind Teil jedes Home-Assistant-Backups. Gesichert wird im gestoppten Zustand.

## Konfiguration

| Option | Bedeutung |
|---|---|
| `person` | HA-Benutzer-ID, für die Claude und Hintergrundaufgaben arbeiten. Leer = die einzige bekannte Person. |
| `vertraute_apps` | Hostnamen anderer Apps, die ohne Ingress zugreifen dürfen (Standard: der MCP-Server, über den Claude arbeitet). |
| `fitness_personen` | HA-Benutzer-IDs oder Anmeldenamen, die nur die Fitness-Welt bekommen (siehe unten). Leer = niemand. |
| `ais_schluessel` | API-Schlüssel von aisstream.io für den Schiffsverkehr auf der Elbe. Leer = kein Schiffsverkehr. |
| `ais_radius_km` | Umkreis um das Zuhause (`zone.home`) für den Schiffsverkehr in km, Standard 5. |
| `garmin_sensor` | Sensor mit den letzten Garmin-Aktivitäten. |
| `wetter_entitaet` | Wetter-Entität für das Einsatzspiel (Standard `weather.forecast_home`). |
| `app_quelle` | Woher neue Versionen der App kommen: `besitzer/repository@zweig` (Standard `schale91/Claude@app-paket`). |
| `app_token` | GitHub-Token nur zum Lesen dieses einen Repositorys. Ohne Token gibt es keine Updates per Knopf. |
| `fcm_dienstkonto` | Schlüssel eines Firebase-Dienstkontos (der ganze JSON-Inhalt) für Push-Nachrichten an die Android-App. Leer = keine Push-Nachrichten. |

## Vorgänge beim LKA

Steht ein Vorgang neu auf „Warten auf LKA (KTA PMK)“, setzt die Datenbank die `frist` auf heute plus zwei Monate (Wiedervorlage). Das gilt für Änderungen aus der App wie über Claude. Ist die Wiedervorlage fällig, kommt morgens eine Push-Nachricht ohne dienstliche Inhalte.

Neue Unteraufgaben (in einem Vorgang oder Projekt, unter einer Aufgabe) bekommen beim Anlegen zwei Wochen als Fälligkeit, sofern keine mitkommt.

## Fitness-Welt (zum Beispiel für Papa)

Eine zweite Person bekommt dieselbe Lebenswelt als Fitness-Welt: gleiche Karte, gleiches Einsatzspiel, gleicher Shop mit gleichen Preisen, und jede Änderung an der App kommt mit demselben Update auch bei ihr an. Statt Aufgaben, Smarthome und Kraftbuch zählt dort nur Bewegung (Schritte am Deich, Heim-Physio im Elternhaus, Physio in der Praxis, Nilo schieben am Haus). Die Daten liegen getrennt je Person in dieser Datenbank.

Einrichtung:

1. In Home Assistant unter Einstellungen → Personen einen eigenen Benutzer anlegen, **ohne** Administratorrechte.
2. Hier unter Konfiguration den Anmeldenamen (oder die Benutzer-ID) bei `fitness_personen` eintragen, speichern, App neu starten.
3. Er öffnet dieselbe Adresse wie du (`/local/lebenswelt-…/index.html`) oder installiert die eigene Android-App „Lebenswelt Fit“ und meldet sich mit seinem Konto an.

Die App schaltet in der Fitness-Welt nichts in Home Assistant und liest nur die Wetter-Entität. Wichtig: Home Assistant selbst kennt keine Rechte je Gerät. Wer ein HA-Konto hat, kann die normale HA-Oberfläche öffnen und dort Geräte bedienen. Deshalb das Konto ohne Adminrechte anlegen und ihm keine Dashboards mit Geräten zeigen.

Wünsche aus der Fitness-Welt gehen in die Vorschlagsliste. Samstagabend bereitet eine Claude-Routine sie auf und legt je Wunsch ein Dokument `freigabe` bei der Person mit voller Lebenswelt an; das Add-on schickt dann eine Push-Nachricht. Freigegebenes setzt die Sonntags-Routine für beide gleich um.

Push-Nachrichten (mit eingerichtetem `fcm_dienstkonto`): an die Familie, wenn „Nilo schieben“ eingetragen wird, und um 19 Uhr an die Fitness-Welt, wenn heute noch nichts eingetragen ist.

Routen: `GET /api/lebenswelt/familie` (Bewegung der Familie für den Buggy und die Wochenübersicht, dazu der Stand der Wünsche).

## Schiffsverkehr auf der Elbe

Die App zeigt die echten Schiffe vor dem Deich (Binnenschiffe, Tanker, Fahrgastschiffe, Sportboote) nach ihren AIS-Daten. Freigeschaltet wird das im Shop der App.

Einrichtung:

1. Auf [aisstream.io](https://aisstream.io) kostenlos anmelden und einen API-Schlüssel anlegen.
2. Hier unter Konfiguration als `ais_schluessel` eintragen, speichern, App neu starten.

Das Programm `ais/ais.py` liest die Lage von `zone.home` aus Home Assistant, abonniert bei aisstream.io ein Rechteck von `ais_radius_km` um diesen Punkt und legt die Schiffe mit Lage relativ zum Zuhause (Meter nach Osten und Norden) in `/data/ais.json` ab. Dabei erfährt aisstream.io das Rechteck, also ungefähr, wo das Zuhause liegt. Die App bekommt keine Koordinaten.

Route: `GET /api/lebenswelt/schiffe` (`eingerichtet`, `fehler`, `schiffe` mit Name, AIS-Typ, Länge, Lage, Fahrt, Kurs und Ziel).

## Updates der App per Knopf

Bei jedem Push baut eine GitHub Action die App (nur wenn Typprüfung und Tests bestehen) und legt das fertige Paket auf den Zweig `app-paket`. Das Add-on sieht beim Start und danach alle 10 Minuten nach und lädt eine neue Version herunter, spielt sie aber nicht ein. In der App erscheint dann „Update verfügbar · Installieren“. Erst dieser Tipp schreibt die Version in jeden Ordner `www/lebenswelt-*/`, in dem eine `server.json` liegt: erst die Programmdateien, zuletzt `stand.json` und `index.html`, danach werden alte Dateien früherer Versionen gelöscht. `server.json` und andere Ordner bleiben unberührt.

Einrichtung:

1. Auf GitHub unter Settings → Developer settings → Personal access tokens → Fine-grained tokens einen Token anlegen: Repository access „Only select repositories“ mit dem App-Repository, Repository permissions → Contents „Read-only“, sonst nichts.
2. Den Token hier unter Konfiguration als `app_token` eintragen, speichern und das Add-on neu starten.

Enthält das Paket die Android-App (`lebenswelt.apk`, `android.json`), legt das Add-on sie mit in den Ordner; die App bietet sie dann zum Herunterladen an.

Routen: `GET /api/lebenswelt/app-paket` (bereitliegende und installierte Version, letzter Fehler), `POST /api/lebenswelt/app-paket` (sofort nachsehen), `POST /api/lebenswelt/app-paket/installieren` (bereitliegende Version einspielen).

## Push-Nachrichten an die Android-App

Die Android-App meldet ihren Firebase-Token beim Add-on an (`POST /api/lebenswelt/push/geraet`). Das Add-on schickt dann Nachrichten bei neuen Einsätzen, neuen Garmin-Aktivitäten (XP zum Abholen) und wenn ein Update bereitliegt. Gesendet wird über Firebase Cloud Messaging (HTTP v1); die Anmeldung bei Google signiert das Add-on mit `openssl`, der Schlüssel liegt dafür nur kurz in `/data` und wird sofort gelöscht.

Einrichtung:

1. In der Firebase-Konsole ein Projekt anlegen und darin eine Android-App mit dem Paketnamen `de.lebenswelt.app` hinzufügen. Die `google-services.json` gehört als Secret `GOOGLE_SERVICES_JSON` ins App-Repository (für den Bau der APK).
2. Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“. Den Inhalt der JSON-Datei hier als `fcm_dienstkonto` eintragen, speichern, Add-on neu starten.
3. In der App unter Persönlich → Android-App „Test-Benachrichtigung“ tippen.

Routen: `GET /api/lebenswelt/push` (eingerichtet, Zahl der Geräte), `POST /api/lebenswelt/push/test`.

## Schnittstelle

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/lebenswelt/ich` | angemeldete Person mit `profil` (`voll` oder `fitness`) |
| GET | `/api/lebenswelt/familie` | Bewegung der letzten 14 Tage aus der Fitness-Welt (alle Personen) und Stand der Wünsche |
| GET | `/api/lebenswelt/schiffe` | Schiffe auf der Elbe (AIS), Lage relativ zum Zuhause |
| GET | `/api/lebenswelt/spielstand` | Spielstand der Person |
| PUT | `/api/lebenswelt/spielstand` | Spielstand speichern (`{zeit, daten}`), 409 wenn der gespeicherte neuer ist |
| GET | `/api/lebenswelt/dokumente?typ=a,b&seit=…` | Dokumente der Person, optional nur Änderungen seit `jetzt` der letzten Antwort |
| POST | `/api/lebenswelt/dokumente` | `{dokumente:[{id?, typ, schluessel?, daten, ersetzen?}]}` anlegen oder zusammenführen |
| PATCH | `/api/lebenswelt/dokumente/{id}` | `{daten:{…}}` zusammenführen; Punkt im Schlüssel ändert verschachtelte Werte, `null` löscht |
| DELETE | `/api/lebenswelt/dokumente/{id}` | als gelöscht markieren |
| GET | `/api/lebenswelt/suche?q=…&typ=…&offen=1` | Suche im Titel und in der Nummer |
| GET | `/api/lebenswelt/personen` | bekannte Personen |
| GET | `/api/lebenswelt/einsatz/regelwerk` | Regelwerk des Einsatzspiels |
| GET | `/api/lebenswelt/einsatz/stand` | bis jetzt fortgeschriebener Stand mit laufenden Einsätzen und Wetter |
| GET | `/api/lebenswelt/einsatz/protokoll?seit=…` | abgeschlossene Einsätze mit Sternen und Abzügen |
| POST | `/api/lebenswelt/einsatz/kaufen` | `{art, id, ziel?, anzahl?, stufe?, org?, bewohner?}`; bucht Münzen im Spielstand ab. `art` auch `mitgliedschaft` (Feuerwehr für Polizei im Dorf, Sportverein); `bewohner: {org, beruf, arbeitgeber}` beim Bauplatz |
| POST | `/api/lebenswelt/einsatz/einraeumen` | `{fahrzeug, geraet, anzahl, richtung: "ein"\|"aus"}` |
| POST | `/api/lebenswelt/einsatz/personal` | `{ziel, name?, anrede?}` |

Das Einsatzspiel rechnet jede Minute im Hintergrund weiter. Es nutzt keine KI und verbraucht kein Guthaben. Die Dokumente `einsatzwelt` und `einsatz` sind über die allgemeinen Dokument-Routen nur lesbar.
