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
| `garmin_sensor` | Sensor mit den letzten Garmin-Aktivitäten. |
| `wetter_entitaet` | Wetter-Entität für das Einsatzspiel (Standard `weather.forecast_home`). |
| `app_quelle` | Woher neue Versionen der App kommen: `besitzer/repository@zweig` (Standard `schale91/Claude@app-paket`). |
| `app_token` | GitHub-Token nur zum Lesen dieses einen Repositorys. Ohne Token gibt es keine Updates per Knopf. |
| `fcm_dienstkonto` | Schlüssel eines Firebase-Dienstkontos (der ganze JSON-Inhalt) für Push-Nachrichten an die Android-App. Leer = keine Push-Nachrichten. |

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
| GET | `/api/lebenswelt/ich` | angemeldete Person |
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
