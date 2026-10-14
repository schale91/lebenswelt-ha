# Einsatzspiel: Umsetzungsplan

Technischer Plan für die Umsetzung. Was das Spiel inhaltlich können soll, steht in [KONZEPT.md](KONZEPT.md), alle Werte im [Regelwerk](../../lebenswelt/pb_hooks/einsatz/regelwerk.js).

## 1. Ausgangslage

**Dieses Repository** (`schale91/lebenswelt-ha`) enthält die Datenbank-App für Home Assistant: PocketBase mit eigenen Routen, Zugriff nur über den Ingress. Spielstand und Dokumente liegen je Person in der Datenbank.

**Das Frontend** (React, `@react-three/fiber`, zustand) liegt im privaten Repository `schale91/Claude` und war in der Sitzung, in der dieser Plan entstand, nicht erreichbar. Was über das Frontend bekannt ist, stammt aus dem gebauten Bundle des Artifacts „Lebenswelt“. Das Bundle ist **älter** als die Version auf den Screenshots (dort gibt es schon den Handzugwagen mit „FM“-Schild). Alles Folgende zum Frontend muss also am echten Code geprüft werden:

- Orte der Karte stehen in einem Objekt mit `pos: [x, y, z]`, unter anderem `feuerwehr: [-46, 0, -16]`, `dienststelle: [-19, 0, 52]`, `markt: [19, 0, 62]`, `deich: [6, 3.2, -38]`.
- Der Store (zustand mit `persist`) kennt `muenzen`, `euro`, `grundstuecke`, `einsatz` und `setzeEinsatz`. Eine Komponente lässt ein Einsatzfahrzeug vom Feuerwehrhaus aus über eine Straßenpolylinie fahren.
- Der Spielstand wird über `PUT /api/lebenswelt/spielstand` mit `zeit` gespeichert. Ist der gespeicherte Stand neuer, antwortet der Server mit 409 und schickt den gespeicherten Stand mit.

**Was auf den Screenshots fehlt oder falsch ist** (Abnahmekriterien in Abschnitt 7):

1. Am Handzugwagen gibt es kein Strahlrohr, niemand hält den Schlauch, es fließt kein Wasser, und es ist kein Einsatz zu sehen. Der Schlauch ist eine gerade graue Linie auf der Fahrbahn.
2. Bei einigen Fahrzeugen stehen die Reifen verdreht (Screenshot 1, weißes Auto).
3. Fahrzeuge halten nicht an und fahren durch andere hindurch.

## 2. Architektur

```
┌──────────── Home Assistant ────────────┐
│ Datenbank-App (PocketBase)             │
│  pb_hooks/einsatz/regelwerk.js  Daten  │
│  pb_hooks/einsatz/simulation.js rein   │◄── Cron jede Minute: fortschreiben(stand, jetzt)
│  pb_hooks/einsatz.pb.js        Routen  │◄── Wetter-Entität alle 10 min
│  Dokumente: einsatzwelt / einsatz      │──► optional: Benachrichtigung bei Alarm
└──────────────┬─────────────────────────┘
               │ /api/lebenswelt/einsatz/*
┌──────────────▼─────────────────────────┐
│ Frontend (schale91/Claude)             │
│  holt Stand + Zeitleisten, zeigt live  │
│  Fahrphysik, Figuren, Wasser, Wetter   │
│  Kaufen/Einrichten → POST an Server    │
└────────────────────────────────────────┘
```

**Warum die Simulation auf dem Server läuft:** Einsätze sollen auch auftreten und verfallen, wenn die App zu ist („läuft nach 5 Minuten ab“). Eine Uhr auf dem Server ist die einzige verlässliche Quelle dafür. Das Frontend zeigt die Zeitleiste, die der Server geplant hat, und spielt sie nach.

**Arbeitsteilung bei der Physik:** Der Server rechnet Fahrzeiten mit einem einfachen Modell (Weglänge über das Straßennetz, Tempo, Wetterfaktor). Das Frontend fährt dieselbe Strecke mit echter Fahrphysik und Kollisionsvermeidung und gleicht nur die Zeit an: Ist es zu früh am Ziel, rollt es langsamer, ist es zu spät, wird es nicht hart korrigiert, sondern holt die Zeit beim nächsten Abschnitt auf. Maßgeblich für Sterne ist immer die Zeit des Servers.

**Das Straßennetz** muss es dafür nur einmal geben: als Knoten und Kanten im Regelwerk (`STRASSEN`), aus dem Frontend exportiert. Bis das passiert ist, rechnet der Server mit Luftlinie mal 1,3.

## 3. Datenmodell

Alles nutzt den vorhandenen Dokumentenspeicher (`dokumente`, je Person), so dass keine neue Migration nötig ist.

**Dokument `typ: "einsatzwelt"`, `schluessel: "stand"`** (eines je Person):

```js
{
  version: 1,
  bis: 1791900000000,            // bis hierhin ist fortgeschrieben (ms)
  zufall: 12345,                 // Startwert für den deterministischen Zufall
  einsatzarten: { tier_katze: { gekauft: ms, naechster: ms, anzahl: 12, erfolgreich: 9, beste_sterne: 4.5 } },
  freigeschaltet: ["tier_katze", "b_muelltonne"],
  haeuser: [{ id: "bp03", gekauft: ms, ausbau: ["fahrrad"], alarmierung: "fme" }],
  personal: [{
    id: "p1", org: "feuerwehr", name: "…", anrede: "Feuerwehrfrau", haus: "bp03",
    lehrgaenge: { tm1: ms, sprechfunk: ms }, lehrgang_laeuft: { id: "agt", bis: ms } | null,
    psa: { helm: 1, stiefel: 0, jacke: 1, handschuhe: 1, haube: 0, th_kleidung: 0 },
    einsaetze: 14, belegt_bis: ms
  }],
  fahrzeuge: [{ id: "f1", typ: "tsf", stellplatz: 0, beladung: { c_schlauch_15: 6, … }, belegt_bis: ms }],
  lager: { feuerwehr: { c_schlauch_15: 2 }, polizei: {} },
  pflege: [{ geraet: "c_schlauch_15", anzahl: 3, bis: ms }],
  gebaeude: { geraetehaus: 1, dienststelle: 0 },
  ausbau: ["spinde"],
  neubaugebiete: [],
  laufend: [ /* Einsätze mit Zeitleiste, siehe unten */ ]
}
```

**Dokument `typ: "einsatz"`**, je abgeschlossenem Einsatz eines, als Protokoll. Abgeschlossene Einsätze werden aus `laufend` hierher verschoben, damit der Stand klein bleibt.

**Ein laufender Einsatz mit Zeitleiste:**

```js
{
  id: "e_1791900000000_tier_katze", art: "tier_katze", ort: "baum_feuerwehr",
  meldung: ms, verfall: ms, status: "gemeldet" | "alarmiert" | "anfahrt" | "vor_ort" | "abgeschlossen" | "verfallen",
  wetter: "schnee",
  plan: {
    alarm: ms,
    personen: [{ id: "p1", los: ms, am_geraetehaus: ms, umgezogen: ms, funktion: "angriffstrupp" }],
    fahrzeuge: [{ id: "f1", ab: ms, an: ms, zurueck: ms, besatzung: ["p1"], route: [knoten…] }],
    zu_fuss: [{ id: "p2", an: ms, traegt: ["klappleiter"] }],
    eintreffen: ms, arbeit_ende: ms, einsatzbereit: ms
  },
  bewertung: { sterne: 3.5, abzuege: [{ grund: "leiter_sicherung", sterne: 2, text: "…" }] } | null,
  folge_von: null
}
```

## 4. Simulation (`pb_hooks/einsatz/simulation.js`)

Eine reine Funktion `fortschreiben(stand, bis, umwelt, regelwerk)` ohne PocketBase-Aufrufe, damit sie in Node getestet werden kann. `umwelt` liefert das Wetter zu einem Zeitpunkt (aus dem gespeicherten Wetterverlauf).

Ablauf, ereignisgesteuert in Zeitreihenfolge bis `bis`:

1. **Lehrgänge und Pflege** beenden, deren Zeit vorbei ist.
2. **Neue Einsätze erzeugen.** Je gekaufter Einsatzart steht `naechster` fest. Ist er erreicht: Bedingung prüfen (Wetter, Monat, Stunde, Wochentag; `sonst_faktor` 0 heißt, der Einsatz fällt aus, und der nächste Termin wird neu gezogen). Dann den Ort ziehen, `verfall = meldung + max(ablauf_min, VERFALL.frist_min)` setzen (ein Tag; Folgeeinsätze, die so lange laufen wie der Auslöser, höchstens bis zu dessen Ende) und den nächsten Termin mit ±30 % Streuung ziehen. Der Zufall ist deterministisch (Startwert + Art + laufende Nummer), damit dieselbe Rechnung immer dasselbe ergibt, egal ob der Cron oder eine Anfrage sie auslöst.
3. **Disponieren** (Alarm- und Ausrückeordnung), für jeden gemeldeten Einsatz nach Dringlichkeit (Menschenleben vor Brand vor Tier vor Sachschaden):
   - Alarmiert werden alle freien Kräfte der Organisation, die nicht im Lehrgang sind. Mit Rückmeldung (Meldeempfänger mit Rückmeldung, App) nur so viele, wie für `optimal` nötig.
   - Für jede Person: `los = alarm + reaktion_s(Alarmierung, Ausbau Sirene)`, `am_geraetehaus = los + weg / tempo(Haus-Ausbau) + extra_s`, `umgezogen = am_geraetehaus + umziehen_s(Gebäudestufe, Spinde)`.
   - Fahrzeuge wählen: die kleinste Kombination aus freien Fahrzeugen, die `mindestens` erfüllt (Sitzplätze, Geräte inklusive Merkmalen wie `fahrzeug_wasser`, Fahrer mit Lehrgang), danach auffüllen Richtung `optimal`, solange Stellplätze, Sitze und Personen reichen.
   - Abfahrt, sobald die Besatzung für `mindestens` umgezogen ist, spätestens nach `warten_auf_staerke_max_s`. Wer danach kommt, fährt mit dem nächsten Fahrzeug nach oder bleibt in Bereitschaft.
   - Ohne Fahrzeug: zu Fuß mit `zu_fuss_mit_leiter_ms` oder mit dem Handzugwagen (`handzugwagen_ms`).
   - Fahrzeit: Weglänge über das Straßennetz · `METER_JE_EINHEIT` / (`tempo_kmh` · `WETTER.tempo` · `sonderrechte_tempo`). Ein offener Einsatz „Falschparker in der Feuerwehrzufahrt“ wirkt mit `fahrzeit_faktor` auf Ziele hinter der Zufahrt.
   - Ist `mindestens` mit allem, was die Organisation hat, nicht erreichbar, wird nicht ausgerückt. Der Einsatz wartet mit dem Grund, der fehlt („Leiter fehlt“, „nur 1 von 2 Personen“), und wird neu alarmiert, sobald es geht: bis `ablauf_min` jede Minute, danach alle `VERFALL.raster_min` Minuten, nach jedem Kauf sofort. Solange ein Einsatz einer Art wartet, kommt keiner derselben Art dazu.
3a. **Weg vom Haus zum Gerätehaus** (`heimweg`): zu Fuß und mit dem Rad auf dem Gehweg (`fussroute`: entlang der Straßen, nur am Anfang und Ende über Hof oder Platz, höchstens `ZEITEN.abkuerzung_max`), mit dem Auto über die Straße. Baustellen in lauten Phasen und Pannen oder Unfälle direkt am Weg kosten Wartezeit (zu Fuß `BAU.verkehr.zu_fuss_s`, mit dem Auto `fahrzeug_s`). Der Plan speichert den Weg (`personen[].weg`), die App zeigt ihn: am Bordstein halten und schauen, bei freier Fahrbahn queren, mit dem Auto Abstand halten und an Hindernissen langsam am Rand vorbei.
4. **Verfall:** Liegt `eintreffen` nach `verfall`, verfällt der Einsatz zum Zeitpunkt `verfall`. Wer unterwegs ist, kehrt um. Weil die Frist lang ist, kommt das selten vor: Wer spät kommt, verliert Sterne über das Einsatzende (ab sechsfacher Zielzeit bleibt ein Stern), und ein Feuer breitet sich nach `ablauf_min` nicht weiter aus.
5. **Arbeit vor Ort:** `arbeit = arbeit_min · max(1, optimal.personen / vorhanden)^0,5 · Gerätefaktor · (1 + wachstum · verzug_min)`. Der Gerätefaktor ergibt sich aus Löschleistung (Strahlrohre, Pumpe, Wasserquelle) bzw. Werkzeug. Gesperrte Regeln (Sicherheitstrupp) erzwingen eine Taktik ohne Innenangriff: Die Arbeit dauert länger und der Schaden wächst.
6. **Bewertung** nach `STERNE` und `REGELN`, mit Text je Abzug. Freischaltungen prüfen.
7. **Rückkehr und Einsatzbereitschaft:** Rückfahrt mit `rueckfahrt_faktor`, dann `einsatzbereit_s`. Benutzte Schläuche und Atemschutzgeräte gehen für `schlauchpflege_h` bzw. `atemschutz_pflege_h` (verkürzt durch Waschanlage, Trockenturm, Werkstatt) in die Pflege und fehlen solange.
8. **Folgeeinsätze** (`folge`) beim Eintreffen anlegen, für die andere Organisation. `dauer_wie_ausloeser` hält sie offen, bis der Auslöser fertig ist.

Wichtige Eigenschaften, die Tests absichern müssen:

- Eine Person, ein Fahrzeug, ein Gerät ist nie in zwei Einsätzen zugleich.
- `fortschreiben(fortschreiben(s, t1), t2)` ergibt dasselbe wie `fortschreiben(s, t2)`.
- Nach 30 Tagen ohne Öffnen der App läuft das Fortschreiben in unter einer Sekunde (Ereignisse statt Minutenschritte).

## 5. Schnittstelle

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/lebenswelt/einsatz/regelwerk` | Regelwerk für das Frontend (mit `VERSION`, zwischenspeicherbar) |
| GET | `/api/lebenswelt/einsatz/stand` | fortschreiben bis jetzt, dann Stand, laufende Einsätze, Wetter, `jetzt` |
| GET | `/api/lebenswelt/einsatz/protokoll?seit=…` | abgeschlossene Einsätze |
| POST | `/api/lebenswelt/einsatz/kaufen` | `{art: "einsatzart"\|"bauplatz"\|"haus_ausbau"\|"alarmierung"\|"lehrgang"\|"psa"\|"geraet"\|"fahrzeug"\|"gebaeude"\|"ausbau"\|"neubaugebiet", id, ziel?, anzahl?}` |
| POST | `/api/lebenswelt/einsatz/einraeumen` | Gerät zwischen Lager und Fahrzeug bewegen (Slots prüfen) |
| POST | `/api/lebenswelt/einsatz/personal` | Name und Anrede setzen, Funktion bevorzugen |

**Münzen beim Kauf:** Der Server liest `spielstand.daten.muenzen`, bucht ab, speichert den Spielstand mit `zeit = jetzt` und antwortet mit `{ok, muenzen, zeit}`. Das Frontend übernimmt beides sofort. Schickt es danach einen älteren Stand, greift der vorhandene 409-Mechanismus. **Vorher prüfen**, ob das Frontend bei 409 den Serverstand übernimmt. Tut es das nicht, muss das zuerst gebaut werden, sonst gehen Käufe verloren.

**Home Assistant:** neue Optionen in `config.yaml`:

| Option | Bedeutung |
|---|---|
| `wetter_entitaet` | z. B. `weather.forecast_home`. Wird alle 10 Minuten gelesen und als Verlauf gespeichert. |
| `einsatz_benachrichtigung` | Benachrichtigungsdienst, z. B. `notify.mobile_app_…`. Leer bedeutet keine Benachrichtigung. |
| `einsatz_ruhezeit` | z. B. `22:00-06:30`. In dieser Zeit wird nicht benachrichtigt; Einsätze laufen trotzdem. |

Dazu Version anheben, `CHANGELOG.md` und `DOCS.md` ergänzen.

## 6. Frontend in Etappen

Jede Etappe endet mit Tests, Build, einer Kontrolle per Screenshot und der Installation über den Installer.

**E0 Bestandsaufnahme.** Code lesen und Stellen notieren, an denen Fahrzeuge, Figuren, Orte, Straßen und der Spielstand liegen. Für jedes Fahrzeugmodell einen Playwright-Screenshot von oben und von der Seite machen (Abschnitt 7). Das Straßennetz als Knoten und Kanten exportieren und ins Regelwerk übernehmen.

**E1 Anbindung und Leitstelle.** Ein Hook `useEinsatzwelt` fragt alle 5 Sekunden ab, solange die App sichtbar ist, und bei `visibilitychange` sofort. Klick auf das Feuerwehrhaus oder die Dienststelle öffnet die **Leitstelle** mit den Reitern: Einsätze (laufende mit Countdown bis Verfall, Status, Kräfte), Protokoll (Sterne, Abzüge mit Begründung), Kaufen. Der Kaufen-Reiter ist ein Technikbaum: Einsatzarten als Baum mit gesperrten und freigeschalteten Knoten, Häuser, Personal mit Lehrgängen und PSA, Fahrzeuge mit Beladung als Slot-Raster, in das man Geräte aus dem Lager zieht, Gebäude und Ausbau. Neben dem Ort auf der Karte steht „Einsatz!“ (das gibt es schon) mit Stichwort und Countdown.

**E2 Einsatzstellen.** Jede Einsatzart bekommt eine Darstellung am Ort: Katze in der Krone, die nach der Rettung in der Box sitzt; brennende Hecke mit Flammen und Rauch, die mit dem Löschfortschritt kleiner werden und danach verkohlt stehen bleiben; brennende Mülltonne; Ölspur als dunkler Streifen, der nach dem Abstreuen hell wird; Baum quer über der Straße; Musiknoten über dem Nachbarhaus bei der Ruhestörung und so weiter. Der Fortschritt kommt aus der Zeitleiste.

**E3 Einsatzkräfte und Löschangriff.** Figuren mit Helm, dessen Farbe oder Kennzeichnung die Funktion zeigt. Sie laufen vom Haus zum Gerätehaus, steigen ein, steigen am Ziel aus und nehmen ihre Plätze nach FwDV 3 ein:
- Der Maschinist steht an der Pumpe.
- Der Angriffstrupp geht vor: Truppführer mit dem Strahlrohr vorn, Truppmann dahinter am Schlauch.
- Der Wassertrupp setzt Standrohr und Verteiler, der Schlauchtrupp legt Reserve.

Der **Schlauch** ist eine `TubeGeometry` entlang einer Kurve (Catmull-Rom) von der Pumpe über den Verteiler zum Strahlrohr, mit sichtbaren Kupplungen alle 15 bzw. 20 m. Er liegt auf dem Boden, folgt den Figuren und ist prall, sobald Wasser fließt. Der **Wasserstrahl** besteht aus Partikeln mit Wurfbahn: Die Geschwindigkeit ergibt sich aus der Löschleistung des Strahlrohrs, beim Aufprall spritzt es, und am Ziel steigt Dampf auf. Die **Leiter** lehnt im Winkel von 65 bis 75 Grad am Baum. Ist eine zweite Person da, steht sie am Fuß und sichert. Im Screenshot-Fall (Handzugwagen) heißt das: Person mit Strahlrohr am Ende des Schlauchs, Kübelspritze oder Pumpe am Wagen, Wasser im Bogen.

**E4 Fahrphysik und Verkehr.**
- Fahrzeuge fahren auf Fahrstreifen (rechts) des Straßennetzes.
- Abstandhalten nach dem Intelligent Driver Model (Treiber, Hennecke, Helbing 2000): Wunschgeschwindigkeit, Sicherheitsabstand, Bremsverzögerung begrenzt durch `µ · g`.
- In Kurven höchstens `√(µ · g · r)`.
- An Kreuzungen gilt rechts vor links bzw. die Vorfahrt nach Plan, umgesetzt über Reservierung der Kreuzungsfläche, damit sich nichts überschneidet.
- Einsatzfahrzeuge mit Blaulicht: andere Fahrzeuge in Sichtweite bremsen, fahren an den rechten Rand und halten (§ 38 StVO), danach geht es weiter.
- An der Einsatzstelle wird auf einer freien Aufstellfläche geparkt (Prüfung mit gedrehten Rechtecken), mit Abstand zum Brand.
- Räder drehen sich entsprechend der Geschwindigkeit, die Vorderräder lenken (vereinfachte Ackermann-Lenkung), die Karosserie neigt sich leicht beim Bremsen.

**E5 Wetter.**
- Schneedecke: Shader mischt Weiß auf Flächen, deren Normale nach oben zeigt.
- Schneefall als Partikel.
- Fahrspuren als Textur, in die die Räder schreiben und die langsam verblasst.
- Bei Glätte rutschen Fahrzeuge sichtbar, wenn sie die Kurvengrenze überschreiten (Gierwinkel).
- Regen mit Pfützen, die spiegeln. Nachts Blaulicht, das auf Fassaden scheint. Die Beleuchtungsgeräte der Feuerwehr leuchten die Einsatzstelle aus.

**E6 Häuser der Einsatzkräfte.** Bauplätze und Neubaugebiete auf der Karte, gekaufte Häuser mit Namensschild, Fahrrad oder Auto vor der Tür. Bei Alarm geht die Tür auf, und die Person läuft oder fährt los.

**E7 Leistung.** Instancing für Figuren, Partikel und Schlauchkupplungen; Partikel nur nah an der Kamera; auf dem Handy weniger Partikel und keine Schatten für Partikel. Ziel: 60 Bilder pro Sekunde am Desktop, 30 auf dem Handy, bei drei gleichzeitigen Einsätzen.

## 7. Tests und Abnahme

| Was | Wie | Abnahme |
|---|---|---|
| Regelwerk | `node werkzeuge/pruefe-regelwerk.js` | keine Fehler |
| Simulation | Node-Tests mit festen Startwerten (z. B. `node --test`) | Szenarien aus KONZEPT.md (Einstieg Schritt 1 bis 6) ergeben die beschriebenen Ergebnisse; keine Doppelbelegung; Fortschreiben in Teilen ergibt dasselbe wie am Stück |
| Reifen | Test über alle Fahrzeugmodelle: Radachse senkrecht zur Fahrtrichtung, Radebene parallel zur Fahrtrichtung; dazu Screenshots von oben und von der Seite | kein Rad steht quer; Screenshots im Pull Request |
| Fahrzeuge halten | Playwright-Szenario: zwei Fahrzeuge hintereinander, eins bremst, dazu eine Kreuzung mit Querverkehr und ein Einsatzfahrzeug mit Blaulicht | Mindestabstand nie unterschritten, keine Überschneidung der Umrisse, Querverkehr hält |
| Löschangriff | Screenshot des Heckenbrands nach 2 Minuten Arbeit | Person hält das Strahlrohr, der Schlauch läuft von der Pumpe bis zum Strahlrohr, Wasser fließt im Bogen, die Flammen sind kleiner |
| Schnee | Wetter auf Schnee setzen, Fahrzeug fahren lassen | Schneedecke, Spuren hinter den Rädern, längerer Bremsweg messbar |
| Leistung | Profil mit drei Einsätzen gleichzeitig | Zielwerte aus E7 |

## 8. Offene Fragen an dich

1. **Wirtschaft:** Wie viele Münzen bringt ein normaler Tag? Davon hängt `PREISFAKTOR` ab. Ziel aus dem Konzept: viele Jahre lang etwas zum Kaufen.
2. **Benachrichtigung:** Soll das Handy bei einem Einsatz Bescheid geben, und wenn ja, mit welcher Ruhezeit?
3. **Namen der Einsatzkräfte:** frei wählbar oder aus einer Liste? Echte Namen nur in der Datenbank, nie im Repository.
4. **Ton:** Martinshorn und Sirene ja oder nein, und standardmäßig an oder aus?
5. **Startguthaben für das Einsatzspiel:** bei null anfangen oder mit einem kleinen Bonus, damit die Katze gleich gerettet werden kann?

## 9. Entscheidungen (13.10.2026)

Antworten auf Abschnitt 8 und daraus folgende Änderungen am Plan:

1. **Wirtschaft:** `PREISFAKTOR = 0,05`, Mindestpreis 10 Münzen. Ein normaler Tag bringt nach den Regeln der App etwa 30 Münzen (rund 300 XP, 1 Münze je 10 XP). Alles zusammen kostet damit rund 60 000 Münzen, also etwa fünf Jahre.
2. **Benachrichtigung:** keine. Das Einsatzspiel läuft still im Hintergrund und verlangt keine Aufmerksamkeit. Die Optionen `einsatz_benachrichtigung` und `einsatz_ruhezeit` entfallen. Wetter-Entität: `weather.forecast_home`.
3. **Namen:** frei wählbar, beim Einzug mit einem Vorschlag aus einer Liste erfundener Namen. Echte Namen nur in der Datenbank.
4. **Ton:** kein Ton.
5. **Start:** Die Einsatzart „Katze auf Baum“ ist von Anfang an gekauft. Sonst beginnt alles bei null (die App selbst startet seit dem 13.10.2026 bei Level 0).
6. **Kein eigenes Spiel, keine Leitstelle:** Das Einsatzspiel ist Teil der Oberfläche. Kräfte und Fahrzeuge bewegen sich auf der Karte und arbeiten Einsätze ab, wenn sie anstehen. Gekauft wird alles im **Store** der Lebenswelt (dort ein Bereich für Feuerwehr und Polizei mit dem Technikbaum). Ein Klick auf das Feuerwehrhaus bzw. die Dienststelle zeigt die Bilanz: Sterne je Einsatz (frisch vergebene Sterne leuchten kurz auf), Protokoll mit Abzügen und Statistik. Etappe E1 wird entsprechend umgeplant: statt Leitstelle mit Reitern ein Store-Bereich plus Bilanzfenster.
7. **Reihenfolge:** Zuerst werden in der App die Schnelleingabe und der Umzug von Briefings, Gesundheit und Laufplanung fertiggestellt, danach folgen E0 und die Simulation.
8. **Kein KI-Guthaben im Betrieb:** Simulation, Disposition, Bewertung und Darstellung laufen ohne Claude, nur in der Datenbank-App (Cron) und im Browser. Es kommt keine Routine für das Einsatzspiel dazu.

## 10. Stand der Simulation (13.10.2026)

Umgesetzt in `lebenswelt/pb_hooks/einsatz/` (`simulation.js`, `kaufbuch.js`, `dienst.js`) und `einsatz.pb.js`, getestet mit `node --test test/` (Einstieg 1 bis 6, keine Doppelbelegung über 30 Tage, Teile gleich Ganzes, 30 Tage unter einer Sekunde, Folgeeinsatz, Kaufbuch, Rückmeldung) und in der PocketBase-Laufzeit.

Abweichungen und Ergänzungen gegenüber Abschnitt 3 bis 5:

- `METER_JE_EINHEIT` 3 statt 5 (siehe E0), damit der nächste Baum zu Fuß in 5 Minuten erreichbar ist.
- Wege: zu Fuß und mit dem Rad über die kürzere Strecke aus Straße und Luftlinie · 1,3; Fahrzeuge über das Straßennetz.
- Zu Fuß trägt jede Einsatzkraft bis zu 2 Slots aus dem Lager (`TRAGEN_SLOTS_JE_PERSON`).
- Ausgerückt wird höchstens mit der optimalen Stärke. Ohne Rückmeldung (Sirene, einfacher Meldeempfänger) sind Alarmierte, die nicht gebraucht werden, 10 Minuten gebunden.
- Polizei startet an der Dienststelle (Reaktion 30 s, kein Umziehen). Personal kommt über `PERSONAL.polizei` (Versetzung an die Dienststelle), begrenzt durch `personal_max`.
- Kaufbuch: `einsatzwelt.ausgaben`; der Spielstand merkt sich `einsatzAusgabenBekannt`. Das Frontend muss dieses Feld speichern und nach einem Kauf aus der Antwort übernehmen (E1).
- Dokumente `einsatzwelt` und `einsatz` kommen nicht mehr über die allgemeine Dokumentliste.
- Benachrichtigungsoptionen entfallen (Entscheidung 2).

## 11. Stand E1 (13.10.2026)

Frontend in `schale91/Claude`, Verzeichnis `app/src/einsatz/` (Anbindung und Ableitungen) sowie `app/src/ui/EinsatzStore.tsx` und `app/src/ui/Bilanz.tsx`.

- Statt einer Leitstelle (Entscheidung 6): Gekauft wird im Store unter „Feuerwehr & Polizei“ (Einsätze als Freischaltbaum, Häuser mit Wegzeit je Bauplatz, Einsatzkräfte mit Lehrgängen, Ausrüstung und frei wählbarem Namen samt Vorschlag aus erfundenen Namen, Geräte mit Lagerplätzen, Fahrzeuge mit Beladung, Gebäude, Ausbau, Neubaugebiete). Klick auf das Feuerwehrhaus zeigt die Bilanz: laufende Einsätze mit Phase und Countdown, Sterne je Einsatzart (neue leuchten kurz auf), Protokoll mit Abzügen, Statistik. Feuerwehr und Polizei stehen dort in zwei Reitern, weil die Dienststelle auf der Karte der Arbeitsbereich ist.
- Beladung: Geräte werden per Knopf zwischen Lager und Fahrzeug umgeräumt (kein Ziehen), mit Füllstandsbalken.
- Abruf alle 5 Sekunden, nur wenn die Seite sichtbar ist. Countdown in Serverzeit.
- Vor jedem Kauf lädt das Frontend den Spielstand sofort hoch, damit frisch verdiente Münzen zählen. Nach dem Kauf zieht es denselben Betrag lokal ab und übernimmt `einsatzAusgabenBekannt`. Geprüft mit zwei Geräten: das zweite Gerät mit veraltetem Stand bekommt beim Hochladen 409 und übernimmt die berichtigten Münzen.
- Die alten Shop-Artikel `fw_*` und `pol_*` sind entfernt. Fahrzeughalle und Polizei in der Szene zeigen den Bestand vom Server; Tore öffnen sich, solange ein Fahrzeug im Einsatz ist. Die zufälligen Schein-Einsätze der Szene laufen nicht mehr; die Darstellung am Einsatzort folgt in E2 und E3.
- Server: Dokumente `einsatzwelt` und `einsatz` sind über die allgemeinen Dokument-Routen nur noch lesbar (Schreiben gibt 400 bzw. 403). Ein Stand mit ungültigen Zahlen wird nie gespeichert; ein unlesbarer Stand wird als `defekt_<Zeit>` gesichert und neu begonnen, statt die Einsatzwelt anzuhalten. Anlass war ein Test, in dem ein allgemeiner PATCH den Stand zerstörte.

## 12. Bewertung nach Einsatzende, Ausrüstung mit Wirkung (13.10.2026)

Entscheidung: Volle Sterne gibt es nicht für schnelles Eintreffen, sondern wenn der Einsatz rechtzeitig **beendet** ist (Meldung bis Arbeit erledigt, Ziel `ziel_ende_min`, sonst `ziel_eintreffen_min + arbeit_min`). In diese Zeit fließt alles ein, was im Einsatz zählt; das Protokoll nennt die Gründe mit Prozent („Länger dauerte es durch: …“).

- Ohne Mindestausrüstung kein Einsatz (z. B. ohne Leiter keine Katzenrettung, wie bisher).
- Persönliche Ausrüstung hat je Stufe eine Wirkung (`effekt` in `PSA_FEUERWEHR`/`PSA_POLIZEI`): Stiefel bestimmen Tempo und Stolpern zu Fuß (Wetter verstärkt das Stolpern), Stiefel und Einsatzkleidung verkürzen das Umziehen, Helmlampe gibt Sicht im Dunkeln, Handschuhe und Helm beschleunigen die Arbeit, TH-Kleidung die technische Hilfe, das eigene Funkgerät den Aufbruch der Polizei. Der Langsamste im Trupp bestimmt den Weg, die Arbeit zählt im Mittel.
- Dunkelheit nach Sonnenzeiten je Monat (`SONNE`) bremst Weg und Arbeit, aufgehoben durch Helmlampen bei allen, Flutlicht oder eine Taschenlampe je Person.
- Ohne Verteiler wird mit nur einem Strahlrohr gelöscht, mit Verteiler mit bis zu drei (je Rohr ein Trupp).
- Fehlende Personen und fehlende optimale Geräte verlängern die Arbeit, statt pauschal Sterne zu kosten. Pauschale Abzüge bleiben nur für Vorschriften (`REGELN`), fehlende Mindest-Schutzausrüstung und große Schäden.
- Folge für den Einstieg: 5 Sterne bei der Katze brauchen drei Kräfte und bessere Stiefel als Gummistiefel.

## 13. Bauen mit Bauzeit und Baustellen (14.10.2026)

Alles, was gebaut wird, hat eine Bauzeit (`BAU` im Regelwerk, `bauzeit_h` an Gebäudestufen, Ausbauten, Einliegerwohnung, Neubaugebieten; Häuser `BAU.haus_h`). Ein Kauf legt eine Baustelle an (`stand.baustellen`), die Wirkung tritt erst mit der Fertigstellung ein (`stand.bauchronik`). Ebenen:

1. **Bauphasen** mit eigenen Baufahrzeugen: Erdarbeiten (Bagger, Kipper), Rohbau (Kran, Betonmischer), Dach und Fassade (Kran, Kipper), Innenausbau (Transporter), Abnahme. Kleine Ausbauten: Anlieferung, Einbau, Abnahme.
2. **Baufirma mit zwei Kolonnen:** ein dritter Auftrag wartet, bis eine Kolonne frei ist.
3. **Wetterverzug:** Sturm, Schnee, Glätte und Regen kosten Bautage; am Ende einmal nachgerechnet.
4. **Behelfsbetrieb:** Solange am Gerätehaus bzw. an der Dienststelle gebaut wird, dauern Umziehen, Ausrücken und Aufbruch länger (Container-Umkleide, enge Zufahrt).
5. **Baustellen stehen im Weg:** In lauten Phasen kosten Baustellen nahe Start oder Ziel eines Einsatzes Zeit (Baustellenampel, Baufahrzeuge auf der Straße).
6. **Einsätze auf der Baustelle**, nur solange gebaut wird und ohne Kauf: Arbeitsunfall (Feuerwehr, Rohbau und Dach), Diebstahl von der Baustelle (Polizei, nachts), Beschwerde über Baulärm (Polizei, früh und abends, laute Phasen).
7. **Bauchronik** in der Bilanz: fertige Bauten mit Datum und Wetterverzug.
8. **Ein Haus** wird erst gebaut; die Einsatzkraft zieht beim Fertigstellen ein.

Ideen für spätere Ebenen: Eigenleistung der Wehr (schneller bauen, Kräfte abends auf der Baustelle), Bauabnahme mit Mängeln durch die Bauaufsicht, Richtfest, Lieferzeit für Fahrzeuge (Beschaffung), Container als Zwischenlager während des Umbaus.

Frontend dazu (`app/src/scene/Bau.tsx`, `Geraetehaus.tsx`): eigenes Gerätehaus je Stufe (Unterstand mit Pultdach, kleines Gerätehaus mit einem Tor, Grundausstattung mit zwei Toren und Sozialtrakt, Stützpunkt mit vier Toren nach dem bisherigen Modell, Schwerpunkt mit sieben Toren, zweigeschossigem Trakt und Schlauchturm), Polizeistation und Kommissariat neben der Dienststelle, sichtbare Ausbauten (Schlauchturm, Übungshof, Fahrradständer, Parkplatz, Funkmast, elektronische Sirene, Werkstattanbau). Baustellen zeigen je Phase Baugrube, wachsenden Rohbau, Gerüst, Bagger, Kran, Betonmischer, Kipper und Transporter, dazu eine Blase mit Restzeit. In lauten Phasen steht ein Kipper mit Baustellenampel auf der nächsten Straße. Ab der Dachphase eines Umbaus steht das neue Gebäude eingerüstet. Fertige Häuser der Einsatzkräfte stehen auf ihren Bauplätzen, mit Fahrrad oder Auto vor der Tür.

## 14. Stand E2 bis E7 (14.10.2026)

E2 bis E7 sind im Frontend (Repository `Claude`, Ordner `app/`) umgesetzt. Am Server ändert sich dafür nichts, Version 0.4.0 bleibt.

- **E2 Einsatzstellen:** jede Einsatzart am Ort, Fortschritt aus der Zeitleiste, Nachwirkung 30 Minuten nach dem Ende.
- **E3 Einsatzkräfte:** Weg von zu Hause zum Gerätehaus, Plätze nach FwDV 3, Schlauchleitung mit Kupplungen, Verteiler, Wasserstrahl, Leiter, Flutlicht. Liegt die Einsatzstelle abseits der Straße, halten die Fahrzeuge am Rand und die Kräfte gehen zu Fuß.
- **E4 Fahrphysik und Verkehr:** Intelligent Driver Model, Kurvengrenze aus Reibung und Radius, Platz machen bei Blaulicht, Warten an der Kreuzung, lenkende Vorderräder.
- **E5 Wetter:** Schneedecke auf allen nach oben zeigenden Flächen, Fahrspuren im Schnee, Pfützen, Rutschen bei Glätte, Licht bei Nacht.
- **E6 Häuser:** Tür geht bei Alarm auf, Fahrrad oder Auto fehlt, solange die Person unterwegs ist.
- **E7 Leistung:**
  - Unbewegliches wird je Bereich zu einem Mesh je Material verschmolzen. Was sich bewegt, leuchtet, durchsichtig ist oder eine Textur hat, bleibt einzeln. Klicks bleiben erhalten, weil die Originale für den Raycaster sichtbar bleiben.
  - Bäume, Figuren der Einsatzkräfte und Schlauchkupplungen sind instanziert.
  - Teilchen außerhalb des Bildes werden nicht berechnet. Schatten werden nur jedes zweite Bild neu gezeichnet, auf dem Handy jedes dritte, dort mit 1024er Schattenkarte und höchstens 1,5-facher Pixeldichte.
  - Gemessen mit drei gleichzeitigen Einsätzen bei Nacht und Schnee:

    | Gerät | Zeichenaufrufe vorher | Zeichenaufrufe nachher |
    |---|---|---|
    | Desktop | 746 | 394 |
    | Handy | 393 | 241 |

  - Die Bildrate selbst lässt sich in der Testumgebung nicht messen, weil sie ohne Grafikkarte rechnet. Auf dem echten Gerät zeigt `?fps=1` die Bildrate an. Mit `?verschmelzen=0` lässt sich das Verschmelzen zum Vergleich abschalten.
