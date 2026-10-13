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
| POST | `/api/lebenswelt/einsatz/kaufen` | `{art, id, ziel?, anzahl?, stufe?}`; bucht Münzen im Spielstand ab |
| POST | `/api/lebenswelt/einsatz/einraeumen` | `{fahrzeug, geraet, anzahl, richtung: "ein"\|"aus"}` |
| POST | `/api/lebenswelt/einsatz/personal` | `{ziel, name?, anrede?}` |

Das Einsatzspiel rechnet jede Minute im Hintergrund weiter. Es nutzt keine KI und verbraucht kein Guthaben.
