# Arbeitsablauf: von der Änderung bis in die App

So kommt eine Änderung an der Lebenswelt bis auf Handy und PC. Die Anleitung liegt gleich in beiden Repos:
`schale91/Claude` (App) und `schale91/lebenswelt-ha` (Datenbank als Home-Assistant-App).

## Überblick

| Schritt | Wer | App (`schale91/Claude`) | Datenbank (`schale91/lebenswelt-ha`) |
|---|---|---|---|
| 1. Ändern und prüfen | Claude | in `app/`: `npx tsc -b` und `npm test` | `node --test test/*.test.js`, `node --check` für geänderte Hooks und Migrationen, Startprobe `werkzeuge/pruefe-start.js`; bei Änderungen an Hooks oder Migrationen zusätzlich die Ende-zu-Ende-Tests mit diesem Zweig (siehe unten) |
| 2. Pull Request anlegen und zusammenführen | Claude | Ziel `claude/code-readiness-check-40jtgv` | Ziel `main` |
| 3. Bauen bzw. bereitstellen | automatisch | GitHub Action „App-Paket“ baut und legt das Paket auf den Zweig `app-paket` | Home Assistant sieht die neue Version im App-Store |
| 4. Einspielen | Claude oder du | Datenbank-App lädt das Paket alle 10 Minuten herunter; Claude installiert es, sonst in der App „Update verfügbar · Installieren“ tippen | Update der „Lebenswelt Datenbank“ in Home Assistant, vorher mit Sicherung |

Die Regel, dass Claude Pull Requests ohne Rückfrage zusammenführt, steht in der `CLAUDE.md` im Hauptzweig beider Repos.

## 1. Ändern und prüfen

- Claude arbeitet auf einem eigenen Zweig (`claude/…`). Ist dieser Zweig schon zusammengeführt, wird er vom aktuellen Hauptzweig neu aufgesetzt.
- Zusammengeführt wird nur, wenn alle Prüfungen bestehen und es keine Konflikte gibt. Schlägt etwas fehl, meldet sich Claude mit dem Fehler.
- Datenbank: Bei jeder Änderung die Version in `lebenswelt/config.yaml` erhöhen und `lebenswelt/CHANGELOG.md` ergänzen. Ohne neue Version bietet Home Assistant kein Update an.

## 2. Pull Request

- Titel und Beschreibung auf Deutsch: was sich ändert, wie geprüft wurde, was nicht geprüft wurde.
- Zusammenführen als Merge-Commit.
- Gehört eine Änderung zu beiden Repos (z. B. neue Regel in App und Datenbank), bekommt jedes Repo einen eigenen Pull Request, und beide verweisen aufeinander.

## 3. App-Paket bauen

- Jeder Push auf `claude/code-readiness-check-40jtgv`, der `app/`, `android/` oder den Workflow ändert, startet die Action „App-Paket“ (`.github/workflows/app-paket.yml`). Sie dauert etwa drei Minuten.
- Der Bau läuft nur weiter, wenn Typprüfung und Tests bestehen. Den Stand zeigt GitHub unter Actions.

## 4. Einspielen in Home Assistant

### Datenbank

1. Store neu einlesen, damit Home Assistant die neue Version sieht (Einstellungen → Apps → App-Store → ⋮ → „Nach Updates suchen“).
2. Update der „Lebenswelt Datenbank“ installieren, mit Sicherung vorher. Migrationen in `pb_migrations` laufen beim Start einmal.
3. Automatische Updates sind für diese App eingeschaltet. Ohne Schritt 1 und 2 kommt das Update also auch, nur später.

Claude erledigt das über den Connector „Homeassistent MCP“ (`ha_manage_app` mit `check_updates`, dann `ha_manage_updates` mit `install` und `backup: true`) und prüft danach, ob die neue Version läuft.

### App

- Die Datenbank-App sieht alle 10 Minuten nach einem neuen App-Paket (Option `app_token` muss gesetzt sein).
- In der App erscheint „Update verfügbar · Installieren“. Erst dieser Tipp spielt die neue Version ein.
- Claude kann das ebenfalls: Über den Connector „Homeassistent MCP“ fragt `ha_manage_app` (Proxy, `GET /api/lebenswelt/app-paket`) den Stand ab. Ist `verfuegbar` neuer als `installiert`, spielt `POST /api/lebenswelt/app-paket/installieren` die Version ein. Danach die App einmal neu laden.

## Ende-zu-Ende-Tests

Die Ende-zu-Ende-Tests in `app/e2e/` bedienen die fertig gebaute App in Chromium, gegen eine echte PocketBase mit den Hooks und Migrationen des Add-ons. Sie sollen Fehler finden, bevor sie in Home Assistant ankommen, etwa einen verlorenen Spielstand nach einem Update, Münzblasen, die sich nicht antippen lassen, oder Aufgaben und Routinen, die nicht ankommen.

So läuft es:

- `e2e/bau.mjs` baut die App zweimal wie für Home Assistant: Version a wird installiert, Version b ist das Update. TrainMe wird dabei nicht mitgebaut.
- `e2e/umgebung.mjs` startet PocketBase 0.40.4 mit `pb_hooks` und `pb_migrations` des Add-ons in einem leeren Ordner. Davor steht ein kleiner Ersatz für Home Assistant. Er liefert den App-Ordner unter `/local/lebenswelt-e2e/` aus, beantwortet den Websocket (Anmeldung, Benutzer, Ingress-Sitzung, Wetter) und reicht `/api/hassio_ingress/e2e/` mit `X-Remote-User-Id` an PocketBase weiter, wie der Ingress. Die App selbst bleibt dafür unverändert.
- Jeder Test hat eine eigene Testperson. Geprüft wird auf Handy-Größe (390 × 844) und im Browser (1280 × 860):
  1. Die App lädt ohne Fehler im Browser und legt den Spielstand in der Datenbank an.
  2. Eine Aufgabe wird im Arbeitsbereich angelegt und abgehakt. Nach dem Neuladen ist sie weiter erledigt, und die XP sind gebucht.
  3. Münzen, XP, Einsatz-Statistik und Chronik bleiben nach dem Neuladen und nach einem echten Update über „Update verfügbar · Installieren“ erhalten.
  4. Eine Routine wird angelegt, `POST /api/lebenswelt/routinen/lauf` legt die Aufgabe an, und sie steht mit der Marke „Routine“ in der Liste. Vor 4 Uhr Ortszeit wird dieser Test übersprungen, weil das Add-on dann noch nichts anlegt.
  5. Eine Münzblase der Stadtkasse liegt in Elbe Springs sichtbar im Bild, lässt sich antippen, und die Münzen steigen.
  6. Zwei Aufgaben werden markiert und bekommen über die Mehrfachauswahl das Datum „Morgen“. Nach dem Neuladen haben beide dieses Datum.
  7. Der Wochenrückblick bei den Briefings zählt erledigte und überfällige Aufgaben aus der Datenbank, und „Als Aufgabe für Montag übernehmen“ legt den Vorschlag mit dem Datum des nächsten Montags an.
  8. Eine Rückfrage zu einem Paperless-Dokument steht im Eingang, wird beantwortet und gibt XP. `GET /api/lebenswelt/fragen?status=beantwortet` liefert die Antwort wie für den täglichen Claude-Lauf. Nach „verarbeitet“ ist sie aus dem Eingang verschwunden.
  9. Mit einem Rathaus auf Stufe 2 öffnet der Rathaus-Knopf die Verwaltung: „Alles einsammeln“ leert die vollen Kassen (Münzen steigen in App und Datenbank), das Bürgerbüro zeigt die Einwohner, der Ratssaal ist bis Stufe 3 gesperrt.
- Tagesstart und Tagesabschluss gelten für jede Testperson als heute schon gesehen (`e2e/hilfen.ts`). Sonst legt sich je nach Uhrzeit des Laufs (4 bis 14 Uhr, ab 18 Uhr) ein Fenster über die App.

Start in `app/`:

```sh
npm ci
E2E_POCKETBASE=/pfad/zu/pocketbase E2E_ADDON=/pfad/zu/lebenswelt-ha/lebenswelt npm run e2e
```

- `E2E_POCKETBASE`: PocketBase 0.40.4 (von den GitHub-Releases). Ohne diese Angabe wird `app/e2e/.werkzeug/pocketbase` genommen, sonst `pocketbase` aus dem `PATH`.
- `E2E_ADDON`: der Ordner `lebenswelt` aus `schale91/lebenswelt-ha`. Ohne diese Angabe wird `lebenswelt-ha/lebenswelt` neben diesem Repository gesucht.
- `PLAYWRIGHT_CHROMIUM`: ein vorhandenes Chromium, z. B. `/opt/pw-browsers/chromium`. Ohne diese Angabe einmal `npx playwright install chromium` ausführen.
- `E2E_OHNE_BAU=1`: vorhandene Builds aus `app/e2e/.bau/` wiederverwenden, das spart beim Schreiben von Tests etwa eine halbe Minute.
- Weitere Argumente gehen an Playwright, z. B. `npm run e2e -- --project=handy` oder `npm run e2e -- -g Routine`.
- Ergebnisse liegen in `app/e2e/.ergebnisse/`: Bildschirmfotos und Spuren fehlgeschlagener Tests (`npx playwright show-trace …`) und die Protokolle von PocketBase und dem Ersatz für Home Assistant. Mit `E2E_BEHALTEN=1` bleibt auch der Datenordner der Testdatenbank stehen.

Die Tests laufen nacheinander, weil der Update-Test eine neue Version in den gemeinsamen App-Ordner einspielt. Die Stadt wird im Test ohne Grafikchip gezeichnet. Ein Durchlauf dauert deshalb mehrere Minuten.

Bei jedem Pull Request auf `claude/code-readiness-check-40jtgv`, der `app/` ändert, laufen die Tests auch als GitHub Action „Ende-zu-Ende-Tests“ (`.github/workflows/e2e.yml`). Die Action lädt dafür PocketBase 0.40.4 und checkt `schale91/lebenswelt-ha` aus. Schlägt ein Test fehl, hängen die Ergebnisse als Artefakt `e2e-ergebnisse` am Lauf.

### Änderungen am Add-on

Das App-Repository ist privat, das Add-on-Repository öffentlich. Eine Action im Add-on-Repository kann die App deshalb nicht holen. So werden Add-on-Änderungen trotzdem mit der App geprüft:

1. **Bei jedem Pull Request im Add-on** läuft dort die Action „Tests“ (`.github/workflows/tests.yml`): Node-Tests, Regelwerk, Schiffsempfang und die Startprobe `werkzeuge/pruefe-start.js`. Die Startprobe startet PocketBase in der Version aus dem Dockerfile mit allen Hooks und Migrationen, fragt die wichtigsten Routen ab und schlägt fehl, wenn ein Hook nicht lädt, eine Route fehlt oder im Protokoll ein Fehler der JS-Laufzeit steht.
2. **Vor dem Zusammenführen** eines Add-on-Pull-Requests, der `pb_hooks` oder `pb_migrations` ändert, startet Claude im App-Repository die Action „Ende-zu-Ende-Tests“ von Hand (workflow_dispatch) mit `addon_ref` = Zweig des Add-on-Pull-Requests. Zusammengeführt wird erst, wenn beide Actions grün sind.
3. **Jede Nacht um 3:17 Uhr UTC** laufen die Ende-zu-Ende-Tests gegen `main` des Add-ons, wenn es dort in den letzten 24 Stunden einen neuen Stand gab. Ohne Änderung am Add-on endet der Lauf nach wenigen Sekunden.

## Wenn etwas schiefgeht

- **Datenbank startet nicht oder Daten sehen falsch aus:** In Home Assistant unter Einstellungen → System → Sicherungen die Teilsicherung „Lebenswelt Datenbank“ von vor dem Update wiederherstellen.
- **App zeigt Fehler:** Den Pull Request auf GitHub mit „Revert“ rückgängig machen und zusammenführen. Das neue Paket kommt wie jedes andere über „Update verfügbar“.
- **Kein „Update verfügbar“:** Unter Actions prüfen, ob „App-Paket“ grün ist. In der Datenbank-App unter Konfiguration nachsehen, ob `app_token` gesetzt ist.
