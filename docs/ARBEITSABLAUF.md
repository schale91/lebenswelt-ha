# Arbeitsablauf: von der Änderung bis in die App

So kommt eine Änderung an der Lebenswelt bis auf Handy und PC. Die Anleitung liegt gleich in beiden Repos:
`schale91/Claude` (App) und `schale91/lebenswelt-ha` (Datenbank als Home-Assistant-App).

## Überblick

| Schritt | Wer | App (`schale91/Claude`) | Datenbank (`schale91/lebenswelt-ha`) |
|---|---|---|---|
| 1. Ändern und prüfen | Claude | in `app/`: `npx tsc -b` und `npm test` | `node --test test/*.test.js`, `node --check` für geänderte Hooks und Migrationen |
| 2. Pull Request anlegen und zusammenführen | Claude | Ziel `claude/code-readiness-check-40jtgv` | Ziel `main` |
| 3. Bauen bzw. bereitstellen | automatisch | GitHub Action „App-Paket“ baut und legt das Paket auf den Zweig `app-paket` | Home Assistant sieht die neue Version im App-Store |
| 4. Einspielen | Claude oder du | Datenbank-App lädt das Paket alle 10 Minuten herunter; in der App „Update verfügbar · Installieren“ tippen | Update der „Lebenswelt Datenbank“ in Home Assistant, vorher mit Sicherung |

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

## Wenn etwas schiefgeht

- **Datenbank startet nicht oder Daten sehen falsch aus:** In Home Assistant unter Einstellungen → System → Sicherungen die Teilsicherung „Lebenswelt Datenbank“ von vor dem Update wiederherstellen.
- **App zeigt Fehler:** Den Pull Request auf GitHub mit „Revert“ rückgängig machen und zusammenführen. Das neue Paket kommt wie jedes andere über „Update verfügbar“.
- **Kein „Update verfügbar“:** Unter Actions prüfen, ob „App-Paket“ grün ist. In der Datenbank-App unter Konfiguration nachsehen, ob `app_token` gesetzt ist.
