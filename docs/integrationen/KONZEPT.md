# Home Assistant in der Lebenswelt: Pegel, Unwetter, Müllabfuhr, Garmin, Paperless, Kalender

Stand 19.10.2026. Dieses Konzept beschreibt, wie Daten aus Home Assistant in die Lebenswelt kommen und was sie dort verändern: in der Spielwelt (Elbe Springs), bei den Einsätzen, im Store und bei der Ausrüstung, im Alltag (Aufgaben, Posteingang) und für Claude.

Umgesetzt ist der Teil in der Datenbank-App (dieses Repository, Version 0.38.0). Was das Frontend (`schale91/Claude`) dafür zeigen muss, steht je Abschnitt unter **Frontend** und gesammelt in Abschnitt 9.

## 0. Kurzfassung

| Quelle in Home Assistant | Was sich ändert |
|---|---|
| **PEGELONLINE Zollenspieker** (Elbe) | Die Elbe in der Stadt steigt und fällt mit der echten Tide. Bei echter Sturmflut kommen Deichverteidigung, Evakuierung und ab Level 30 die Großlage Elbhochwasser, sonst nicht. Bei Niedrigwasser dauert das Ansaugen an der Elbe länger. Neuer Ausbau „Pegelmonitor“. |
| **DWD-Unwetterwarnungen** (gab es schon) | Neu: Hitze und Gewitter. Neuer Ausbau „Gerätehausbesetzung bei Unwetter“: Bei Unwetter (Stufe 3 und höher) warten die Kräfte schon am Gerätehaus. |
| **Abfallkalender Landkreis** | Am Vorabend stehen an den Häusern die Tonnen. Du stellst deine richtige Tonne an die Straße (Klick), die Einwohner ihre selbst. Am Abholtag fährt je Abfallart ein Müllauto durch die Stadt, leert nur die passenden Tonnen und fährt zur Deponie, sobald du sie gebaut hast. Neues Gebäude „Deponie“ in vier Stufen, drei neue Einsätze, Müllauto als Hindernis im Verkehr. |
| **Garmin Connect** | Tageswerte (Schritte, Intensitätsminuten, Schlaf, Body Battery, HRV, Ruhepuls, Trainingsbereitschaft) für die Anzeige in der App, dazu ein Tagesverlauf. Gute Werte bringen ein paar XP, schlechte kosten nichts. Keine Wirkung auf die Einsatzwelt. |
| **Paperless-ngx** | Neue Dokumente im Posteingang von Paperless landen im Eingang der Lebenswelt. Claude kann über die Lebenswelt in Paperless suchen, Dokumente lesen, umbenennen, verschlagworten und Aufgaben mit Fälligkeit daraus machen. |
| **Kalender** (deiner, dazu Familie zum Mitlesen) | Je Tag: Arbeit, Homeoffice, frei, Urlaub, Feiertag, mit Terminen. Claude weiß damit, wann du arbeitest. |

## 1. Grundsätze

1. **Die echte Welt treibt, das Spiel erfindet nicht dazu.** Wo es echte Daten gibt (Pegel, Warnungen, Abfuhrtermine), richten sich die passenden Ereignisse nach ihnen. Ohne die Daten (Sensor fehlt, Messung zu alt) läuft alles wie bisher.
2. **Nichts muss gesteuert werden** (Grundsatz aus DORFDIENSTE.md). Einzige Ausnahme ist deine eigene Tonne. Das ist Absicht: Der Klick ist die Erinnerung und die Bestätigung für die echte Tonne. Die Einwohner stellen ihre Tonnen selbst raus, und wer den Klick vergisst, verliert nichts außer der Serie.
3. **Jeder Kauf wirkt messbar.** Die Deponie verkürzt keine Wege nur zur Optik: Sie nimmt Abfall auf, bringt Arbeitsplätze und neue Einsätze.
4. **Kein Druck aus Gesundheitsdaten.** Gute Garmin-Werte bringen ein paar XP, schlechte kosten nie etwas (Entscheidung vom 19.10.2026). Eine schlechte Nacht ist so nur keine Belohnung, keine Strafe. Auf die Einsatzwelt wirkt Garmin nicht (DORFDIENSTE.md, 12.6).
5. **Öffentlich und privat getrennt.** Dieses Repository ist öffentlich. Kalendernamen, Tokens und Adressen stehen nur in der Konfiguration der App in Home Assistant, nie im Code.
6. **Kein KI-Guthaben im Spielbetrieb.** Pegel, Müllabfuhr und Unwetter rechnet die Datenbank-App ohne Claude. Claude kommt nur bei Paperless, Aufgaben und Kalender ins Spiel, und nur wenn du es aufrufst oder eine Routine einrichtest.

## 2. Elbpegel

### 2.1 Datenquelle

Sensor der Integration PEGELONLINE (Wasser- und Schifffahrtsverwaltung des Bundes), hier `ZOLLENSPIEKER ELBE Wasserstand` in cm über Pegelnull. Option `pegel_entitaet`, leer = automatisch der erste Sensor, dessen Name auf `_wasserstand` endet und der in cm misst. Gelesen wird alle 10 Minuten mit dem Wetter.

Zollenspieker ist ein **Tidepegel**: Das Wasser steigt und fällt zweimal am Tag um rund 3 m (gemessen in HA vom 13. bis 19.10.2026: Tagesminimum 388 bis 425 cm, Tagesmaximum 646 bis 815 cm). Feste Grenzen in cm wären deshalb falsch. Maßgeblich ist der Abstand zum **mittleren Tidehochwasser (MThw)** bzw. **Tideniedrigwasser (MTnw)**. Beide rechnet die App aus den eigenen Messungen: Sie erkennt jeden Scheitel (Hoch- und Niedrigwasser) und nimmt den Median der letzten 30 Tage. Der Median sorgt dafür, dass eine einzelne Sturmflut ihr eigenes Bezugsmaß nicht anhebt. Bis 10 Scheitel da sind, gelten Startwerte (MThw 740 cm, MTnw 400 cm, aus den Messungen oben geschätzt, Spielwert).

Die amtlichen Hauptwerte des Pegels stehen im Deutschen Gewässerkundlichen Jahrbuch der BfG (Pegel 5930090, [Datenblatt](https://dgj-daten.bafg.de/Elbe/Zollenspieker/5930090_W.pdf)). Aus dieser Sitzung heraus war die Seite nicht erreichbar. Wer die Startwerte durch amtliche ersetzen will, trägt sie in `PEGEL.mthw_start` und `PEGEL.mtnw_start` ein.

### 2.2 Stufen

| Stufe | Bedingung | Grundlage |
|---|---|---|
| Niedrigwasser | Wasserstand ≤ MTnw − 60 cm | Spielwert |
| Normal | dazwischen | |
| Erhöhtes Hochwasser | Scheitel ≥ MThw + 75 cm | Spielwert |
| Sturmflut | Scheitel ≥ MThw + 150 cm | Einteilung des BSH: Sturmflut ab 1,5 m über dem mittleren Hochwasser |
| Schwere Sturmflut | ≥ MThw + 250 cm | BSH: ab 2,5 m |
| Sehr schwere Sturmflut | ≥ MThw + 350 cm | BSH: ab 3,5 m |

Die BSH-Einteilung ist für die Nordseeküste festgelegt. Am Oberlauf der Tideelbe ist sie ein Spielwert, der sich gut anfühlt, aber keine amtliche Warnstufe.

Eine **Lage** hält 12 Stunden nach dem letzten Scheitel über der Grenze an. So bleibt der Deich zwischen zwei Hochwassern verteidigt, wie in echt.

### 2.3 Wirkung auf Einsätze

- **Deichverteidigung** (`th_deich`, ab Lage Sturmflut), **Evakuierung bei Hochwasser** der DLRG (`dlrg_hochwasser`, ab Sturmflut) und **Großlage Elbhochwasser** (`gl_hochwasser`, ab schwerer Sturmflut, Level 30) kommen mit echten Pegeldaten **nur** noch bei passender Lage. Bisher kamen sie zufällig nach Monaten. Ohne Pegeldaten bleibt es bei den Monaten.
- Beginnt eine Lage, werden die gekauften Arten angesetzt (wie bei DWD-Warnungen): Deich 30 bis 120 Minuten nach dem Scheitel, Wasser im Keller in tiefen Lagen 60 bis 240 Minuten, bei schwerer Sturmflut die Großlage und die Evakuierung. Jede Lage wirkt einmal.
- **Niedrigwasser:** Ansaugen an der Elbe dauert 90 s länger (längere Saugleitung, Saugkorb muss tiefer). Das Protokoll nennt es.

### 2.4 Store und Ausrüstung

- **Pegelmonitor im Gerätehaus** (Ausbau, ab Gerätehaus Stufe 1, 800 Münzen roh): Ab Lage „erhöht“ füllt die Wehr vorsorglich Sandsäcke. Deichverteidigung und Wasser im Keller gehen dann 20 % schneller. Wirkt nur mit echten Pegeldaten.
- Sandsäcke, Tauchpumpen und Stromerzeuger gibt es schon. Wer sie im Lager hat, merkt es jetzt öfter.

### 2.5 Frontend

- Wasserfläche der Elbe auf Höhe des echten Pegels: `stand.pegel.cm` linear auf die Höhe der Uferböschung abbilden, MTnw = unterer Rand, MThw + 350 = Deichkrone.
- Ab Sturmflut: Vorland überflutet, Deichfuß mit Qualmwasser-Pfützen, Sandsackreihe am Deich, sobald der Deicheinsatz arbeitet.
- Kleine Pegellatte am Ufer mit aktuellem Wert, Tendenz (steigt, fällt) und Stufe.

## 3. Unwetterwarnungen des DWD

Die Anbindung gibt es seit 0.22.0. Neu:

- **Hitze** (`STARKE HITZE`, `EXTREME HITZE`): Spielwetter Hitze, setzt Flächenbrand am Deich und den Rettungsdienst-Einsatz bei Hitze an.
- **Gewitter** ab Stufe 2 (starkes Gewitter): Spielwetter Sturm, Baum auf der Straße; ab Stufe 3 auch Stromausfall und Wasser im Keller. Gewitter mit Orkanböen fällt wie bisher unter Sturm.
- **Gerätehausbesetzung bei Unwetter** (Ausbau, Gerätehaus ab Stufe 2): Gilt eine Warnung der Stufe 3 oder 4, sind alle Feuerwehrleute, die nicht gerade arbeiten, schon am Gerätehaus. Reaktion 10 s, kein Weg. Das ist echte Praxis bei vielen Wehren. Ohne den Ausbau kommen alle wie sonst von zu Hause.

**Frontend:** Warnsymbol mit Stufe am Gerätehaus; bei Bereitschaft brennt Licht im Gerätehaus und die Kräfte stehen davor.

## 4. Müllabfuhr

### 4.1 Datenquelle

Der Kalender der Integration Waste Collection Schedule (Option `abfall_kalender`, leer = automatisch der erste `calendar.waste_collection_schedule_*`). Gelesen werden alle Termine der nächsten 14 Tage, stündlich. Die Namen der Termine werden einer Abfallart zugeordnet:

| Abfallart | erkannt an | Farbe im Spiel |
|---|---|---|
| Restmüll | „Hausmüll“, „Restmüll“, „Restabfall“ | grau mit schwarzem Deckel |
| Bio | „Bio“ | braun |
| Gelbe Tonne | „Gelb“, „Wertstoff“, „Leichtverpackung“ | gelb |
| Altpapier | „Papier“, „Pappe“ | blau |
| Grünabfall | „Grün“, „Garten“ | grünes Bündel statt Tonne |

„Hausmüll 14-täglich“ und „Hausmüll 4-wöchentlich“ am selben Tag sind eine Abfuhr. Die Farben sind die üblichen in Deutschland. Für den Landkreis habe ich keine verlässliche Quelle zu den Deckelfarben gefunden; die Farben stehen in `ABFALL.arten` und lassen sich anpassen.

### 4.2 Ablauf eines Abfuhrtags

1. **Vorabend ab 16 Uhr:** An jedem Wohnhaus stehen die Tonnen am Haus. Die Einwohner stellen ihre passende Tonne zwischen 17 und 22 Uhr an die Straße. Etwa jede zwölfte Tonne wird vergessen (Spielwert, fest je Haus und Termin).
2. **Deine Tonne:** An deinem Zuhause tippst du die Tonne an, die du an die Straße stellen willst. Die richtige Farbe gibt beim Leeren 10 XP. Die falsche Tonne steht dann draußen, wird aber nicht geleert; du kannst bis zur Abfuhr umstellen. Eine vergessene Tonne beim Nachbarn darfst du auch rausstellen (3 XP, höchstens drei Häuser je Termin).
3. **Abholtag ab 7 Uhr** (je Abfallart 20 Minuten versetzt): Je Abfallart fährt ein Müllauto in der Farbe der Abfallart. Es startet an der Deponie (falls gebaut und dort zuständig) oder am Ortseingang, fährt über das Straßennetz von Haus zu nächstem Haus, hält 35 s je Tonne (Schüttung), leert nur die richtigen Tonnen und fährt danach zur Deponie oder aus der Stadt.
4. **Nach der Abfuhr** holen die Einwohner ihre Tonnen bis 20 Uhr wieder rein (`reinholen`). Deine Tonne holst du mit einem Tipp rein (`rein: true`); sonst zeigt die App sie ab 20 Uhr wieder am Haus.
5. **Serie:** Jede Abfuhr mit deiner richtigen Tonne zählt. Ab 5 in Folge gibt es 15 XP extra je Abfuhr, ab 10 in Folge 30. Eine verpasste Abfuhr setzt die Serie auf 0. Die XP holst du in der App ab (wie die Tagesbilanz am Feuerwehrhaus).
6. **Erinnerung:** Um 18 Uhr am Vorabend eine Push-Nachricht („Morgen: Biotonne“), wenn deine Tonne noch nicht draußen steht.

### 4.3 Deponie (Store)

Neues Gebäude `deponie`. Ohne Deponie fährt jedes Müllauto zur Anlage des Landkreises aus der Stadt hinaus.

| Stufe | Name | nimmt an | Level | Preis roh |
|---|---|---|---|---|
| 1 | Wertstoffhof mit Containerplatz | Altpapier, Gelbe Tonne | 3 | 4 000 |
| 2 | Kompostplatz | dazu Bio und Grünabfall | 6 | 8 000 |
| 3 | Umladestation für Restmüll | alles | 10 | 15 000 |
| 4 | Deponie mit Sickerwasserfassung und Gasfassung | alles | 16 | 40 000 |

Hintergrund zu Stufe 3: Unbehandelter Restmüll darf in Deutschland seit Juni 2005 nicht mehr auf Deponien abgelagert werden; er geht in die Verbrennung oder mechanisch-biologische Behandlung. Die Umladestation sammelt ihn deshalb nur und gibt ihn weiter. Auf der Deponie der Stufe 4 landen behandelte und mineralische Reste.

Wirkung:
- Die Müllautos der angenommenen Arten fahren zur Deponie und laden dort ab. Die Haufen wachsen sichtbar (`stand.muell.deponie`, Tonnen je Art) und werden wöchentlich abgefahren. Auf der Deponie der Stufe 4 bleibt ein Teil liegen (`stand.muell.abgelagert`), der Deponiekörper wächst also langsam.
- Zwei Arbeitsplätze „Entsorgungszentrum“ (Arbeitgeber `deponie`, ab Stufe 1).
- Neue Einsätze (Abschnitt 4.4).

### 4.4 Einsätze

| Einsatz | Org | Wann | Hinweis |
|---|---|---|---|
| **Brand im Müllfahrzeug** (`b_muellfahrzeug`) | Feuerwehr | während einer Abfuhr, 4 % je Müllauto | Ein Akku im Restmüll entzündet sich in der Presse. Der Fahrer kippt die Ladung auf die Straße. Ort ist die Stelle, an der das Auto gerade hält. Freigeschaltet nach Mülltonnenbrand. |
| **Brand auf dem Wertstoffhof** (`b_wertstoffhof`) | Feuerwehr | etwa wöchentlich, braucht Deponie ab Stufe 1 | Akkus und Spraydosen im Container. Wärmebildkamera hilft. |
| **Deponiebrand** (`b_deponie`) | Feuerwehr | etwa monatlich, öfter bei Hitze, braucht Stufe 4 | Glimmbrand im Abfallkörper, lange Arbeit, Radlader vom Bauhof hilft. |
| **Mülltonnenbrand** (gab es schon) | Feuerwehr | in Nächten, in denen Tonnen draußen stehen, zu 25 % zusätzlich | Draußen stehende Tonnen werden öfter angezündet. |

Dazu wirkt das **Müllauto als Hindernis**: Hält es gerade in der Nähe von Start oder Ziel eines Einsatzes, kostet das Einsatzfahrzeug Zeit wie eine Baustellenampel. Das Protokoll nennt „Müllauto“.

### 4.5 Frontend

- Tonnen je Wohnhaus und an deinem Zuhause: am Haus (Standplatz) oder an der Straße (`stand.muell.termine[*].raus[haus]`, ab `t` sichtbar). Am Vorabend leuchten deine Tonnen leicht. Tipp auf eine Tonne: `POST /api/lebenswelt/muell/tonne`.
- Müllauto je Abfuhr: `abfuhr.wege` (Punkte mit `ab` und `an`) und `abfuhr.halte` (Haus, Lage, `an`, `ab`). Beim Halt kippt der Lifter die Tonne; danach steht sie leer an der Straße (Deckel offen).
- Deponie am Ort `deponie` (die Stadtkarte muss den Ort mitschicken, sonst gilt der Platzhalter im Regelwerk), Haufen je Art aus `stand.muell.deponie`. Ortseingang am Ort `ortseingang`.
- XP abholen: an deinem Zuhause, `POST /api/lebenswelt/muell/abholen`.

## 5. Garmin

- Neue Route `GET /api/lebenswelt/garmin/heute`: Schritte und Ziel, Etagen, Intensitätsminuten und Wochenziel, Ruhepuls, Body Battery (aktuell, höchster, niedrigster Wert), Stress, Schlaf (Dauer, Tief-, REM-, Leichtschlaf, Schlafwert), HRV (Status, letzte Nacht, Wochenschnitt, Basis), Trainingsbereitschaft, VO2max, nächstes geplantes Training, letzte Synchronisierung. Gelesen wird direkt aus Home Assistant.
- Um 23:55 Uhr wird der Tag als Dokument `garmin_tag` (Schlüssel = Datum) gespeichert, für Verläufe in der App und für Claude.
- **XP nur für gute Werte** (Entscheidung vom 19.10.2026), ausgewertet um 23:55 Uhr, höchstens 20 XP am Tag:

| Wert | XP |
|---|---|
| Schlafwert ab 70 / 80 / 90 | 2 / 5 / 8 |
| Schlafbedarf gedeckt | 3 |
| Schrittziel erreicht | 5 |
| HRV ausgeglichen | 2 |
| Body Battery erreicht 90 | 2 |

  Schlechte Werte kosten nichts. Abholen mit `POST /api/lebenswelt/garmin/abholen`, die App bucht die XP. Keine Wirkung auf die Einsatzwelt oder die Fitness im Dorf. Die XP für Aktivitäten (Läufe usw.) bleiben wie bisher.

**Frontend:** Karte „Heute“ im Bereich Gesundheit mit Ringen für Schritte und Intensitätsminuten, Schlafbalken, Body-Battery-Kurve aus `garmin_tag`, HRV-Status als Text.

## 6. Paperless-ngx

### 6.1 Verbindung

Die Datenbank-App spricht Paperless über das interne Netz der Apps an (Option `paperless_url`, Standard `http://ca5234a0-paperless-ngx:80`) mit einem API-Token (Option `paperless_token`, in Paperless unter Profil → API-Token). Über den Ingress geht es nicht: Paperless lehnt Aufrufe von außerhalb des Ingress-Proxys ab (in dieser Sitzung geprüft: HTTP 403).

### 6.2 Posteingang

Alle 15 Minuten: Dokumente mit einem Posteingang-Tag (`is_inbox_tag` in Paperless) werden zu Einträgen im **Eingang** der Lebenswelt (`typ: eingang`, `quelle: paperless`, Schlüssel `paperless:<id>`): Titel, Korrespondent, Dokumenttyp, Datum, ein Auszug von 300 Zeichen und der Link. Verschwindet das Tag in Paperless (bearbeitet), wird der Eingang als verarbeitet markiert. Der volle Text wird **nicht** in die Lebenswelt kopiert, er bleibt in Paperless.

### 6.3 Claude: dauerhafter Zugang

Claude erreicht die Lebenswelt in jeder Unterhaltung über den Connector „Homeassistent MCP“ (Proxy auf die App). Darüber gibt es:

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/lebenswelt/paperless` | eingerichtet, erreichbar, Zahl im Posteingang, letzter Abgleich |
| GET | `/api/lebenswelt/paperless/suche?q=…&posteingang=1&seite=1` | Volltextsuche über alle Dokumente (Titel, Korrespondent, Typ, Tags, Datum, Auszug) |
| GET | `/api/lebenswelt/paperless/dokument/{id}` | ein Dokument mit vollem Text und Notizen |
| PATCH | `/api/lebenswelt/paperless/dokument/{id}` | `{titel, korrespondent, dokumenttyp, tags_dazu, tags_weg, datum, aus_posteingang, neu_anlegen}` |
| POST | `/api/lebenswelt/paperless/dokument/{id}/notiz` | `{text}` Notiz in Paperless |
| POST | `/api/lebenswelt/paperless/dokument/{id}/aufgabe` | `{titel, faellig, sphaere, kontext}` Aufgabe in der Lebenswelt mit Verweis auf das Dokument |
| POST | `/api/lebenswelt/paperless/dokument/{id}/frage` | `{text}` Rückfrage an Alex (typ `frage`: `text, paperless_id, titel, link, status, antwort, erstellt, beantwortet_am, verarbeitet_am`) |
| GET | `/api/lebenswelt/fragen?status=beantwortet` | beantwortete Rückfragen abholen |
| PATCH | `/api/lebenswelt/fragen/{id}` | `{status: "verarbeitet"}` nach Übernahme der Antwort |
| POST | `/api/lebenswelt/routinen/lauf` | fällige Aufgaben aus Routinen sofort anlegen |

Damit kann Claude in jeder Unterhaltung alle Dokumente durchsuchen und lesen, ohne dass sie irgendwo anders liegen. „Automatisch“ heißt: Auf Wunsch richtet Claude eine Routine ein (zum Beispiel täglich 18 Uhr), die den Posteingang durchgeht, Dokumente sinnvoll benennt (`JJJJ-MM-TT Korrespondent - Inhalt` oder nach deinem Schema), Tags und Typ setzt, Fristen erkennt und Aufgaben mit Fälligkeit anlegt. Das kostet Guthaben bei jedem Lauf.

**Fällige Aufgaben erledigen:** Claude markiert nur Aufgaben als erledigt, die es selbst vollständig erledigen kann (Dokument ablegen, umbenennen, eine Notiz oder einen Entwurf anlegen). Alles, was du in der echten Welt tun musst (überweisen, unterschreiben, anrufen), bereitet Claude vor, hakt es aber nicht ab.

### 6.4 Datenschutz

- Die Routen gelten nur für die Person mit voller Lebenswelt (nicht für die Fitness-Welt) und nur über Ingress oder vertraute Apps, wie alle Routen.
- Was Claude liest, geht an Anthropic zur Verarbeitung. Dienstliche Unterlagen, insbesondere eingestufte (VS-NfD und höher), gehören weder in Paperless zu Hause noch zu Claude.

## 7. Kalender

- Option `kalender_entitaet`: dein Kalender (zum Beispiel `calendar.<dein_name>`). Option `kalender_weitere`: Kalender der Familie zum Mitlesen. Deren Termine stehen je Tag unter `andere` mit Namen und bestimmen nie, ob du arbeitest; es sind meist die Termine der anderen.
- Stündlich werden die nächsten 14 Tage gelesen und je Tag eingeordnet:

| Art | Woran erkannt |
|---|---|
| Urlaub / frei | Termin mit „Urlaub“, „frei“, „Freizeitausgleich“, „FZA“, „Gleittag“, „krank“, „Elternzeit“ |
| Homeoffice | „Homeoffice“, „Home Office“, „mobiles Arbeiten“ |
| Dienst | „Dienst“, „Schicht“, „Bereitschaft“, „Früh-“, „Spät-“, „Nachtdienst“, „Lehrgang“, „Fortbildung“ |
| Feiertag | gesetzliche Feiertage in Niedersachsen (berechnet, auch Reformationstag) |
| Wochenende | Samstag, Sonntag ohne Dienst |
| Arbeit (vermutet) | Werktag ohne Eintrag, Zeiten aus Option `regelarbeitszeit`, auch je Wochentag (`Mo 06:00-15:00; Di-Do 06:00-15:30; Fr 06:00-12:00`) |

- Ergebnis als Dokument `kalender`/`tage` und über `GET /api/lebenswelt/kalender`: je Tag Art, sicher oder vermutet, Arbeitszeit, Termine (Titel, von, bis). Termine der Müllabfuhr im eigenen Kalender werden übersprungen.
- **Wofür:** Claude plant Fälligkeiten auf freie Abende und Tage und fasst morgens zusammen („heute Homeoffice, 12 Uhr Lauf“). Später denkbar: die Erinnerung an die Tonne früher schicken, wenn du am Vorabend Spät- oder Nachtdienst hast.

## 8. YouTube und Gmail

**Gmail: ja, aber über Claude, nicht über die Datenbank-App.** Claude hat schon einen Gmail-Connector (Lesen, Labels, Entwürfe), und den Ablauf „Mails sichten, Aufgaben daraus“ gibt es schon als Skill. Sinnvoll ist, dass Claude daraus Einträge im Eingang der Lebenswelt anlegt (`quelle: gmail`, Link zur Mail) statt in einer eigenen Liste. Dafür braucht es keine neue Route; `POST /api/lebenswelt/dokumente` reicht. Die Datenbank-App selbst soll Gmail nicht lesen: Das hieße, ein Google-Passwort oder App-Passwort in Home Assistant abzulegen, und der Nutzen wäre derselbe. Die Gmail-Integration von Home Assistant kann ohnehin nur senden und die Abwesenheitsnotiz setzen, nicht lesen.

**YouTube: nein.** Die YouTube-Integration von Home Assistant zeigt nur Daten zu Kanälen (neuestes Video, Abonnenten), nicht was du schaust; den Wiedergabeverlauf gibt die YouTube-Schnittstelle nicht heraus. Für die Lebenswelt bleibt höchstens „neues Video von Kanal X“, das hat keinen Bezug zu Alltag oder Spiel. Wenn du Bildschirmzeit im Blick haben willst, ist das ein eigenes Thema (Android-Bildschirmzeit), nicht YouTube.

## 9. Frontend: was zu tun ist (Repository `schale91/Claude`)

| Was | Daten | Darstellung |
|---|---|---|
| Elbe | `stand.pegel` | Wasserhöhe, Vorland, Qualmwasser, Pegellatte |
| Unwetter | `warnungen`, `stand.bereitschaft` | Warnsymbol, Licht im Gerätehaus |
| Tonnen | `stand.muell.termine[*].raus`, `tonnen` | Tonnen je Haus, Tipp zum Rausstellen und Reinholen |
| Müllautos | `abfuhr.wege`, `abfuhr.halte` | Fahrt, Halt, Lifter, Farbe je Art |
| Deponie | `stand.gebaeude.deponie`, `stand.muell.deponie` | Gebäude je Stufe, Haufen, Abladen |
| Store | Regelwerk `GEBAEUDE.deponie`, `AUSBAU.pegelmonitor`, `AUSBAU.unwetterbereitschaft`, neue Einsatzarten | wie andere Gebäude und Ausbauten |
| Karte | `orte.deponie`, `orte.ortseingang` im Dokument `karte/elbe` | Lage auf dem Stadtplan mitschicken |
| Garmin | `/api/lebenswelt/garmin/heute`, Dokumente `garmin_tag` | Karte „Heute“ |
| Eingang | Dokumente `eingang` mit `quelle: paperless` | Symbol Paperless, Link zum Dokument |
| Kalender | `/api/lebenswelt/kalender` | Zeile „Heute“ im Briefing |

Dieses Repository war in der Sitzung, in der das Konzept entstand, nicht klonbar (automatische Rechteprüfung). Für das Frontend eine Sitzung mit beiden Repositories starten (siehe `docs/einsatzspiel/START.md`).

## 10. Offene Entscheidungen

1. **Tonnenfarben:** Stimmen grau, braun, gelb, blau für deine Tonnen? Sonst `ABFALL.arten` anpassen.
2. **Automatische Paperless-Routine:** ja oder nein, und wann? Sie kostet bei jedem Lauf Guthaben.
3. **Benennungsschema in Paperless:** Vorschlag `JJJJ-MM-TT Korrespondent - Gegenstand`.
4. **Regelarbeitszeit** für Werktage ohne Eintrag.
