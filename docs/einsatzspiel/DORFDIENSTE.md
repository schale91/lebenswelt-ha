# Dorfdienste: Rettungsdienst, Hilfsorganisationen, Abschleppdienst, Bauhof und Sportplatz

Erweiterung des Einsatzspiels. Grundlage sind [KONZEPT.md](KONZEPT.md) (Feuerwehr und Polizei), [UMSETZUNG.md](UMSETZUNG.md) (Architektur, Simulation, Bauen) und das [Regelwerk](../../lebenswelt/pb_hooks/einsatz/regelwerk.js). Was dort beschlossen ist, gilt weiter: alles auf der Hauptkarte, Simulation auf dem Server, keine Benachrichtigung, kein Ton, kein KI-Guthaben im Betrieb, Kauf im Store, Sterne nur als Anerkennung.

Stand 14.10.2026, zweite Fassung mit deinen Entscheidungen (Abschnitt 23). Werte, die nicht aus einer Vorschrift stammen, sind wie im Regelwerk als **Spielwert** gemeint.

---

## 0. Kurzfassung

1. **Sieben neue Dienste** kommen ins Dorf: Rettungsdienst, DRK mit Sanitäts- und Betreuungsdienst, DLRG mit Wasserrettung, Technisches Hilfswerk, Werkstatt mit Abschleppdienst, Bauhof mit Winterdienst und ein Sportverein mit Sportplatz in der südöstlichen Ecke.
2. **Freischaltung nach dem Level der Lebenswelt:** Sportplatz ab Level 10, Zusammenarbeit von Feuerwehr und Polizei ab 15, Werkstatt und Bauhof ab 20, **Rettungswache ab 30**, DRK ab 40, DLRG ab 50, THW ab 60, **alle zusammen ab 70**. Vorher gibt es den Dienst nicht, und **gemeinsame Einsätze mit ihm erscheinen erst ab diesem Level** (Abschnitt 14.3).
3. **Grundversorgung von außen ab der Freischaltung:** Ab seinem Level ist ein Dienst sofort da, aber von außerhalb und langsam (RTW der Nachbarwache, Abschleppdienst aus der Stadt). Jeder Kauf macht ihn schneller oder besser.
4. **Dorfbewohner statt Einsatzkräfte:** Wer in ein Haus zieht, ist Bewohnerin oder Bewohner mit Beruf, Fitness und **bis zu zwei ehrenamtlichen Mitgliedschaften** plus Sportverein. **Rettungsdienstler und Polizisten, die im Dorf wohnen, können in der Feuerwehr sein** und rücken außerhalb ihres Dienstes mit aus. Eine Person ist nie in zwei Einsätzen zugleich.
5. **Arbeitsplätze im Dorf** (Rettungswache, Werkstatt, Bauhof, Tierarztpraxis, Platzwart) machen Bewohner tagsüber verfügbar. Das ist die Antwort auf das reale Problem der Tagesalarmsicherheit freiwilliger Feuerwehren (beschlossen).
6. **Sportplatz** in acht Bauabschnitten, von der Bolzwiese bis zum Sportzentrum mit Lehrschwimmbecken. Er hebt die Fitness der Bewohner. Fitness wirkt auf Tempo, Arbeit, Ausdauer und die Einsatzzeit unter Atemschutz, und sie ist Voraussetzung für Atemschutz, Rettungsschwimmen und die Fitnessabzeichen.
7. **Gemeinsame Einsätze** in drei Größen: Feuerwehr und Polizei (ab Level 15), Feuerwehr, Polizei und ein weiterer Dienst (mit dessen Level), alle zusammen (ab Level 70). Jede Organisation bekommt Sterne für ihren Teil, dazu gibt es eine Bewertung der Zusammenarbeit.
8. **Drei Ebenen zum Leveln:** Person (Qualifikation, Erfahrung, Abzeichen), Organisation (Gebäudestufe) und das Level der Lebenswelt, das die Dienste freischaltet.
9. **Jeder Kauf wirkt, und das wird vorher gezeigt:** Die Simulation ist deterministisch. Vor dem Kauf rechnet der Server die letzten Einsätze mit dem neuen Teil nach und zeigt, was es gebracht hätte („Katze im Mittel 4:50 statt 5:30 Minuten, +0,5 Sterne“).
10. **Über 40 Baustellen** mit eigenen Bauphasen, darunter jahreszeitabhängige wie das Anwachsen des Rasens.
11. **Preisfaktor bleibt 0,05.** Weil die Dienste nacheinander über Jahre freigeschaltet werden, verteilen sich die Kosten von selbst (Abschnitt 19).
12. **Im Spiel stirbt niemand** (beschlossen).

---

## 1. Ehrliche Einschätzung

Einige Punkte halte ich für riskant oder habe ich mit dir entschieden. Ich schreibe sie an den Anfang, damit sie nicht untergehen.

| Punkt | Problem | Lösung |
|---|---|---|
| **Wie weit Level 70 weg ist** | Nach der Levelkurve der App (`100 · n^1,4` XP je Level) und rund 300 XP am Tag erreicht man Level 30 nach etwa 1,3 Jahren, Level 50 nach 4,4 Jahren und **Level 70 erst nach etwa 10 Jahren** (bei 250 XP am Tag nach 12 Jahren). THW ab 60 heißt rund 7 Jahre. | So umgesetzt, wie du es willst. Meine Empfehlung dazu: Inhalte erst bauen, wenn das Level näher rückt (Abschnitt 20). Was in sieben Jahren freigeschaltet wird, muss heute noch nicht programmiert sein. Die Stufen stehen im Regelwerk und lassen sich jederzeit verschieben. |
| **Wirtschaft** | Die neuen Dienste kosten bei `PREISFAKTOR = 0,05` rund 55 000 Münzen. | Bleibt bei 0,05. Durch die Freischaltung nach Level kommen sie nacheinander dazu, über rund zehn Jahre. Das passt zu den Einnahmen (Abschnitt 19). Zusätzlich gilt die **Preisleiter** aus Abschnitt 16. |
| **Komplexität** | Sieben Dienste auf einmal würden die App überladen. | Gelöst durch die Freischaltung nach Level. Alles wird automatisch disponiert, es gibt nichts zu steuern. |
| **Rettungsdienst ist hauptamtlich** | Im echten Leben fährt den RTW kein Ehrenamtlicher von zu Hause aus los. Träger sind Landkreise und kreisfreie Städte, die Wache ist im Schichtdienst besetzt. | Rettungswache mit **Stellen und Schichten** (wie die Polizei-Dienststelle). Bewohner können dort **beruflich** arbeiten und zusätzlich in der Feuerwehr sein. |
| **Tagesalarmsicherheit** | Wenn Bewohner tagsüber auswärts arbeiten, ist die Feuerwehr werktags schwächer. | Beschlossen: kommt. Bestehende Einsatzkräfte behalten „arbeitet im Dorf“, nur Neuzugänge wählen einen Beruf (Abschnitt 3.4). |
| **Verletzte und Tod** | Die Lebenswelt ist eine Familien-App mit Kindern. | Beschlossen: Im Spiel stirbt niemand. Das schlechteste Ergebnis ist „Zustand verschlechtert, lange Behandlung im Krankenhaus“. Patienten liegen zugedeckt auf der Trage. |
| **Bolzplatz g5** | Im Shop gibt es schon das Grundstück g5 „Bolzplatz“. | g5 bleibt als Kinder-Bolzplatz bestehen. Der Sportplatz ist die Vereinsanlage in der Südostecke. |
| **Echte Namen** | Beschlossen: DRK und DLRG mit echtem Namen. Zeichen und Bezeichnung des Roten Kreuzes sind gesetzlich geschützt, die unbefugte Benutzung ist eine Ordnungswidrigkeit ([§ 125 OWiG](https://lxgesetze.de/owig/125)). | Namen nur als Text, **kein rotes Kreuz und keine Logos** auf Fahrzeugen, Kleidung oder Gebäuden. Im öffentlichen Regelwerk stehen neutrale Kennungen (`sanitaet`, `wasserrettung`), die Anzeigenamen setzt die App. |

---

## 2. Grundsätze für die Erweiterung

1. **Grundversorgung von außen, aber erst ab dem Level.** Vor seinem Level gibt es einen Dienst nicht, auch nicht unsichtbar, und die bestehenden Einsätze laufen wie heute. Ab dem Level existiert er als externe Einheit mit langer Anfahrt und begrenzter Bewertung (höchstens 3 Sterne, Text „Nachbarwache hat übernommen“). Das gibt es bei der Feuerwehr schon als Verfallstext („Die Nachbarwehr mit Rettungssatz hat übernommen“). Eigene Gebäude, Fahrzeuge und Leute machen den Dienst schneller und besser. So bringt schon der erste Kauf etwas.
2. **Jeder Kauf wirkt sofort oder nach der Bauzeit messbar.** Keine Käufe nur für die Optik in der Einsatzwelt. Grafik kommt mit dem Kauf automatisch. Keine Verbrauchsgüter, die ungenutzt verfallen. Keine zeitlich begrenzten Angebote, keine Zufallsbelohnungen, keine Lootboxen.
3. **Nichts muss gesteuert werden.** Disposition, Schichten, Training, Prüfungen und Übungen laufen automatisch. Entscheidungen trifft man nur beim Kaufen und beim Einzug eines Bewohners.
4. **Normgerecht, aber spielbar.** Wer etwas nach Vorschrift falsch macht, bekommt weniger Sterne und eine Begründung im Protokoll. Gesperrt wird nur, was in der Realität gefährlich und ausgeschlossen ist (wie heute der Innenangriff ohne Sicherheitstrupp).
5. **Ein Store, ein Bilanzfenster je Gebäude.** Gekauft wird im Store unter „Einsatzwelt“ (bisher „Feuerwehr & Polizei“). Ein Klick auf Rettungswache, Bauhof oder Sportplatz zeigt dort die Bilanz, wie heute am Feuerwehrhaus.
6. **Öffentlich und privat getrennt.** Dieses Dokument und das Regelwerk enthalten nur erfundene Orte. Die Lage auf der echten Karte steht im privaten Repository. Keine Inhalte aus VS-NfD-Vorschriften.

---

## 3. Dorfbewohner und Mehrfachmitgliedschaft

### 3.1 Vom Einsatzkraft-Haus zum Bewohner

Heute zieht in jedes Haus genau eine Einsatzkraft der Feuerwehr. Künftig zieht eine **Bewohnerin oder ein Bewohner** ein. Beim Einzug wählt man:

| Merkmal | Auswahl | Wirkung |
|---|---|---|
| Name, Anrede | frei, mit Vorschlag aus erfundenen Namen (wie heute) | Anzeige |
| Beruf | zwei bis drei Vorschläge, darunter immer einer im Dorf, wenn dort eine Stelle frei ist | Verfügbarkeit werktags 7 bis 17 Uhr |
| Erste Mitgliedschaft | Feuerwehr, DRK, DLRG, THW (je nach Level) | Grundausbildung der Organisation ist abgeschlossen |
| Sportverein | ja oder nein | Training und Fitness (Abschnitt 12) |

Mit der **Einliegerwohnung** (gibt es schon) zieht eine zweite Person ein. Neu ist der Ausbau **Familienhaus** (dritte Person, ab Level 40).

### 3.2 Was jede Person hat

| Feld | Inhalt |
|---|---|
| `mitgliedschaften` | Liste aus Organisation, Eintritt, Qualifikationen, Einsätzen, Dienstgrad oder Stufe; eine davon ist die **Hauptorganisation** |
| `beruf` | Art (im Dorf, auswärts, Schicht, Ruhestand, in Ausbildung) und Arbeitgeber im Dorf |
| `fitness` | Wert 0 bis 100, letzter Trainingstermin, Abzeichen |
| `psa` | je Organisation eigene Schutzkleidung (wie heute je Stufe mit Wirkung) |
| `belegt_bis` | wie heute: solange sie im Einsatz, im Lehrgang, auf Wache oder im Dienst ist |

### 3.3 Regeln für mehrere Mitgliedschaften

1. **Höchstens zwei ehrenamtliche Einsatzorganisationen** und zusätzlich der Sportverein. Mehr ist im echten Ehrenamt kaum durchzuhalten, und im Spiel würden sonst wenige Personen alles abdecken. Eine Organisation steht erst ab ihrem Level zur Wahl.
2. **Hauptamt plus Ehrenamt:** Wer beruflich auf der Rettungswache oder an der Polizei-Dienststelle arbeitet und im Dorf wohnt, kann zusätzlich in der Feuerwehr sein (und in einer zweiten ehrenamtlichen Organisation). Der Beruf zählt nicht als Mitgliedschaft. Polizistinnen und Polizisten, die nur an die Dienststelle versetzt sind und kein Haus im Dorf haben, wohnen auswärts und können das nicht.
3. **Im Dienst gilt der Dienst:** Wer gerade Schicht auf der Rettungswache oder an der Dienststelle hat, wird von der Feuerwehr nicht alarmiert. Außerhalb der Schicht ist die Person ganz normal Feuerwehrfrau oder Feuerwehrmann. Rückt sie bei einem gemeinsamen Einsatz mit der Feuerwehr aus, ist sie dort Feuerwehrkraft, nicht Polizei oder Rettungsdienst.
4. **Erfahrung zählt doppelt:** Eine Notfallsanitäterin in der Feuerwehr gilt dort als Kraft mit Erste-Hilfe- und Sanitätsausbildung (Voraussetzung für First Responder). Ein Polizist in der Feuerwehr bringt bei der Verkehrsabsicherung Erfahrung mit (Spielwert: Absicherung 20 % schneller).
5. **Eine zweite Mitgliedschaft kostet** einen Eintritt (Spielwert, 150) und die Grundausbildung der neuen Organisation als Lehrgang mit Dauer. Die Person fehlt während des Lehrgangs, wie heute.
6. **Nie in zwei Einsätzen zugleich.** Das ist die wichtigste Regel und wird getestet wie heute „keine Doppelbelegung“.
7. **Alarmkollision:** Wer zuerst alarmiert wird, geht. Kommen zwei Alarme in derselben Minute, entscheidet die Hauptorganisation. Mit Rückmeldesystem (Meldeempfänger mit Rückmeldung oder App) weiß die zweite Organisation sofort, dass die Person fehlt, und plant ohne sie. Ohne Rückmeldung wartet sie vergeblich (wie heute 10 Minuten gebunden).
8. **Großlagen** (ab Level 70): Jede Person wird **einmal** eingeplant, für ihre Hauptorganisation; Hauptamtliche im Dienst für ihren Dienst. Das ist eine Spielregel. Eine Vorschrift dazu habe ich nicht gefunden. Laut Bundesregierung erfassen weder THW noch Bundeswehr Doppelmitgliedschaften, und daraus lasse sich nicht ableiten, wie sehr sie die Verfügbarkeit im Katastrophenfall einschränken ([Antwort der Bundesregierung](https://www.andre-hahn.eu/app/uploads/2024/11/sf558.pdf)).
9. **Wachdienst der DLRG** an Sommerwochenenden bindet die Person an der Badestelle. Sie ist dort schnell bei Badeunfällen, fehlt aber der Feuerwehr.

**Darstellung:** Die Figur trägt die Kleidung der Organisation, für die sie gerade unterwegs ist. In der Personenliste stehen kleine Farbpunkte je Mitgliedschaft, der Beruf steht darunter.

### 3.4 Tagesalarmsicherheit und Arbeitsplätze im Dorf

Freiwillige Feuerwehren haben werktags tagsüber oft zu wenig Leute, weil die Mitglieder auswärts arbeiten. In Niedersachsen haben Mitglieder der Einsatzabteilung Anspruch auf Freistellung von der Arbeit (§ 12 NBrandSchG), und der Arbeitgeber zahlt das Entgelt weiter (§ 32 NBrandSchG) ([Informationsschreiben MI](https://www.mi.niedersachsen.de/download/213228/Informationsschreiben.pdf), [§ 32 NBrandSchG](https://www.anwalt24.de/gesetze/nbrandschg-1/32)). Das hilft aber nur, wenn der Arbeitsplatz nah genug ist.

| Beruf | Verfügbar werktags 7 bis 17 Uhr | Bemerkung |
|---|---|---|
| im Dorf | ja, mit `extra_s` 60 (Arbeit unterbrechen, Weg vom Arbeitsplatz) | braucht eine freie Stelle bei einem Arbeitgeber im Dorf |
| auswärts | nein | Standard für Pendler |
| Schicht | wechselnd nach Schichtplan | Rettungswache, Polizei |
| Ruhestand | ja | ab Altersgrenze nur noch Unterstützung (Spielwert, keine Einsatzabteilung) |
| in Ausbildung | wie „auswärts“, in den Ferien ja | |

**Arbeitgeber im Dorf** entstehen durch Käufe: Rettungswache (Stellen nach Stufe), Werkstatt und Abschleppdienst, Bauhof, Tierarztpraxis, Platzwart am Sportplatz, Kiosk am Sportplatz. Jeder dieser Käufe hat damit zwei Wirkungen: den Dienst selbst und mehr Leute am Tag.

Die Bilanz am Feuerwehrhaus zeigt dazu eine Zeile „tagsüber verfügbar: 4 von 9“ und den Hinweis, welcher Kauf das verbessert.

### 3.5 Übergang vom heutigen Stand

- Alle heutigen Einsatzkräfte werden Bewohner mit der Mitgliedschaft Feuerwehr bzw. Polizei als Hauptorganisation und dem Beruf „im Dorf“. An ihrer Einsatzbereitschaft ändert sich nichts.
- Der Stand bekommt `version: 2`. Ein Test stellt sicher, dass ein alter Stand nach der Umstellung bei reinen Feuerwehr-Einsätzen dieselben Zeiten und Sterne ergibt.

---

## 4. Die Dienste im Überblick

| Dienst | Ab Level | Träger und Grundlage | Gebäude im Dorf | Grundversorgung von außen | Farben auf der Karte |
|---|---|---|---|---|---|
| **Sportverein** | 10 | Verein | Sportplatz in acht Stufen | Joggen auf der Straße | Vereinsfarben frei wählbar |
| **Werkstatt und Abschleppdienst** | 20 | privater Betrieb, Auftrag durch Polizei oder Halter | Werkstatt in fünf Stufen | Abschleppdienst aus der Stadt | Gelb mit gelbem Rundumlicht |
| **Bauhof** | 20 | Gemeinde | Bauhof in fünf Stufen | Straßenmeisterei des Kreises | Kommunalorange |
| **Rettungsdienst** | 30 | Landkreis als Träger, NRettDG, BedarfVO-RettD | Rettungswache in vier Stufen, Landestelle am Sportplatz | RTW der Nachbarwache, Anfahrt lang | Weiß mit leuchtroter und leuchtgelber Konturmarkierung |
| **DRK (Sanitäts- und Betreuungsdienst)** | 40 | Hilfsorganisation, Mitwirkung im Katastrophenschutz nach § 14 NKatSG | Unterkunft in vier Stufen | Schnelleinsatzgruppe aus dem Nachbarort | Weiß und Rot, ohne Kreuz und Logo |
| **DLRG (Wasserrettung)** | 50 | Wasserrettungsorganisation, Fachdienst Wasserrettung im Katastrophenschutz | Wachstation an der Elbe in vier Stufen | Wasserrettungszug des Landkreises | Rot und Gelb, ohne Logo |
| **THW** | 60 | Bundesanstalt, Hilfe auf Ersuchen der Gefahrenabwehr (§ 1 THWG) | Unterkunft des Ortsverbands in vier Stufen | Ortsverband der Kreisstadt | THW-Blau mit weißer Schrift, ohne Logo |

Dazu kommen kleine **externe Partner** (Abschnitt 11, ab Level 20) und die **Leitstelle** als unsichtbarer Dienst mit kaufbaren Verbesserungen (Abschnitt 13.1, ab Level 30).

---

## 5. Rettungsdienst (ab Level 30)

### 5.1 Worauf er sich stützt

| Thema | Grundlage |
|---|---|
| Hilfsfrist: 15 Minuten von der Dispositionsentscheidung der Leitstelle bis zum Eintreffen des ersten geeigneten Rettungsmittels, in 95 % der Notfälle eines Jahres | BedarfVO-RettD Niedersachsen ([Nds. GVBl. 18/2023](https://www.niedersachsen.de/download/199212/Nds._GVBl._Nr._18_2023_vom_19.09.2023_S._201-215.pdf), [Landtag Drs. 17/8319](https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen_17_10000/8001-8500/17-8319.pdf)) |
| Besetzung: RTW in der Notfallrettung mit mindestens einer Notfallsanitäterin oder einem Notfallsanitäter, NEF neben dem Notarzt mit einer weiteren Fachkraft, Krankenkraftwagen mit mindestens zwei Personen; Notfallkrankenwagen mit Rettungssanitäter mit mindestens 100 Notfalleinsätzen | § 10 NRettDG, nach [Landtag Drs. 18/10734](https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen_18_12500/10501-11000/18-10734.pdf); aktuelle Fassung vor der Umsetzung in VORIS prüfen |
| Notfallsanitäter: drei Jahre Ausbildung an Schule, Lehrrettungswache und Krankenhaus | [§ 5 NotSanG](https://www.gesetze-im-internet.de/notsang/__5.html) |
| Rettungssanitäter: mindestens 520 Ausbildungseinheiten (Theorie, Klinik, Rettungswache, Abschlusslehrgang) | [APVO-RettSan 2013](https://www.mi.niedersachsen.de/download/83627/Verordnung_ueber_Ausbildung_und_Pruefung_fuer_Rettungssanitaeterinnen_und_Rettungssanitaeter_APVO-RettSan_vom_17.12.2013.pdf); 2021 neu gefasst, aktuelle Fassung prüfen |
| Fahrzeuge: Krankentransportwagen Typ A, Notfallkrankenwagen Typ B, Rettungswagen Typ C | [DIN EN 1789](https://www.dinmedia.de/de/norm/din-en-1789/94004682) |
| Notarzteinsatzfahrzeug | [DIN 75079, Ausgabe 2025-04](https://www.dinmedia.de/de/norm/din-75079/388433461) |
| Landung des Rettungshubschraubers außerhalb von Flugplätzen zur Hilfe bei Gefahr für Leib oder Leben ohne vorherige Erlaubnis | [§ 25 LuftVG](https://lxgesetze.de/luftvg/25), Zusammenarbeit am Boden: [vfdb-Merkblatt Feuerwehr und Luftrettung](https://www.vfdb.de/media/doc/merkblaetter/MB_06_02_Feuerrwehr_Luftrettung.pdf) |
| Ohne Wiederbelebung sinkt die Überlebenschance je Minute um etwa 10 %; Laienreanimation verdreifacht die Chancen | [Uniklinik Freiburg](https://www.uniklinik-freiburg.de/fileadmin/mediapool/06_presse/migration/100ProAnimation_Zahlen_Fakten.pdf), [German Resuscitation Council](https://www.grc-org.de/files/Newsreleases/document/PM_Laienreanimationsquote_21.06.2021.pdf) |

Die 15 Minuten gelten für einen ganzen Rettungsdienstbereich. Die Karte ist viel kleiner, deshalb wird die Frist wie bei der Feuerwehr heruntergerechnet (Spielwert 8 Minuten). Übernommen wird das **Prinzip**: Die Bilanz der Rettungswache zeigt den **Erreichungsgrad**, also den Anteil der Notfälle innerhalb der Frist, mit der Marke 95 %.

### 5.2 Personal

Die Rettungswache hat **Stellen** wie die Dienststelle der Polizei. Eine Stelle wird besetzt durch Einstellung (Kauf) oder durch einen Bewohner mit passendem Beruf.

| Qualifikation | Wie man sie bekommt | Darf |
|---|---|---|
| Rettungssanitäter/in | Einstellung (Spielwert 500) oder Lehrgang für Bewohner (Dauer gekürzt, Spielwert 48 h) | KTW, Fahrer RTW, Notfallkrankenwagen ab 100 Notfalleinsätzen |
| Notfallsanitäter/in | Einstellung (1500) oder Ausbildung nur an der **Lehrrettungswache** (Stufe 4), Spielwert 240 h | Transportführung RTW |
| Praxisanleiter/in | Lehrgang (Spielwert 40 h) | Ausbildung an der eigenen Wache wird schneller |
| Desinfektor/in | Lehrgang (24 h) | Wiederherstellung nach Infektionstransport halbiert |
| Notärztin/Notarzt | kein Bewohner, kommt über den **Notarztvertrag** mit der Klinik | NEF, Notarzt-Einsätze |

**Schichten:** Stufe 1 der Wache hat nur Tagdienst (7 bis 19 Uhr), ab Stufe 2 rund um die Uhr. Eine Stelle braucht für 24 Stunden an 7 Tagen rechnerisch mehrere Personen. Im Spiel wird das vereinfacht: Eine besetzte Stelle deckt ihre Schicht ab, eine Person kann nicht zwei Schichten gleichzeitig.

### 5.3 Fahrzeuge

| Fahrzeug | Norm | Besatzung | Preis (Regelwerk) | Stellplatz | Rolle |
|---|---|---|---|---|---|
| Krankentransportwagen (KTW) | DIN EN 1789 Typ A2 | 2 | 7 000 | 1 | Krankentransport, entlastet den RTW |
| Rettungswagen (RTW) | DIN EN 1789 Typ C | 2 | 14 000 | 1 | Notfallrettung, Transport |
| Notarzteinsatzfahrzeug (NEF) | DIN 75079 | 2 | 6 500 | 1 | bringt den Notarzt, Rendezvous mit dem RTW |
| Zweiter RTW | wie oben | 2 | 14 000 | 1 | Parallelität bei Transporten |
| Rettungshubschrauber | extern | | Landestelle (Abschnitt 12) | | kommt bei Reanimation und schweren Unfällen, landet am Sportplatz |

### 5.4 Ausrüstung (je Teil kaufbar, belegt Slots)

Tragestuhl, Schaufeltrage, Vakuummatratze, Vakuumschienen-Set, Notfallrucksack (gibt es schon), Defibrillator mit EKG-Monitor, Beatmungsgerät, Kinder-Notfallset, Wärmeerhaltungsset, Spineboard, mechanische Thoraxkompressionshilfe, Sauerstoffeinheit, Infektionsschutzset. Medikamente werden nicht einzeln geführt, sie sind Teil der Grundbeladung.

### 5.5 Rettungswache: Ausbaustufen

| Stufe | Name | Bauzeit (Spielwert) | Stellplätze | Wirkung |
|---|---|---|---|---|
| 0 | Nachbarwache (extern) | | | ein RTW von außerhalb, Anfahrt Spielwert 14 min, höchstens 3 Sterne |
| 1 | RTW-Stellplatz am Feuerwehrhaus, Tagdienst | 6 h | 1 | RTW im Dorf von 7 bis 19 Uhr. In der Wirklichkeit stehen RTW häufig an Feuerwachen. |
| 2 | Rettungswache in Containerbauweise | 24 h | 1 | rund um die Uhr |
| 3 | Rettungswache | 72 h | 3 | Desinfektionsraum, Ruheraum, NEF möglich |
| 4 | Rettungswache mit Lehrrettungswache (ab Level 60) | 96 h | 4 | Ausbildung zur Notfallsanitäterin im Dorf |

**Ausbauten:** beheizte Fahrzeughalle (schneller ausrücken im Winter), Desinfektionsraum (Wiederherstellung nach Transport kürzer), Ruheraum (Nachtschicht ohne Abzug), Waschhalle, Lager für Medizinprodukte (mehr Slots), Notstrom.

**Lage:** am südöstlichen Ortseingang an der Hauptstraße, neben dem Sportplatz. Von dort geht es schnell aus dem Dorf zum Krankenhaus, und die Landestelle liegt nebenan. Der Stellplatz am Feuerwehrhaus (Stufe 1) bleibt als zweiter Standort nutzbar, wenn die Wache gebaut ist.

### 5.6 Patienten und Transport

Einsätze mit Verletzten oder Erkrankten bekommen **Patienten**. Jeder Patient hat eine **Dringlichkeit** in drei Stufen, angelehnt an die Sichtungskategorien: rot (sofort), gelb (dringend), grün (leicht).

| Phase | Was passiert | Zeit (Spielwert) |
|---|---|---|
| Erste Hilfe | Ersthelfer, Feuerwehr (Erste-Hilfe-Lehrgang), Helfer vor Ort | ab Eintreffen |
| Qualifizierte Versorgung | RTW-Besatzung, Notarzt bei Indikation | `versorgung_min` je Einsatzart |
| Transport | RTW fährt über die Hauptstraße nach Süden aus der Karte | 25 min hin |
| Übergabe im Krankenhaus | Fahrzeug ist weg | 10 min |
| Rückfahrt | ohne Sonderrechte | 25 min |
| Wiederherstellung | Desinfizieren, Auffüllen | 10 min, mit Desinfektionsraum 5 min |

Ein RTW ist pro Transport also rund 70 Minuten weg. Wer nur einen RTW hat, merkt das schnell: Der zweite Notfall bekommt den RTW der Nachbarwache. Daraus ergibt sich der Wunsch nach KTW (übernimmt Krankentransporte) und zweitem RTW, ohne dass das Spiel es erklären muss.

**Ergebnis eines Patienten** (kein Tod, siehe Abschnitt 1): „stabil übergeben“, „mit Verzögerung übergeben“, „Zustand verschlechtert“. Es hängt ab von der Zeit bis zur ersten Hilfe, der Zeit bis zur qualifizierten Versorgung, ob bei Indikation ein Notarzt kam und vom Transport.

### 5.7 Einsatzarten und Freischaltbaum

- **Krankentransport** (Start, zweimal am Tag, planbar, nicht zeitkritisch, KTW oder RTW)
  - **Sturz im Haushalt, ältere Person** (3★, Tragestuhl)
    - **Atemnot** (3★, Sauerstoff)
      - **Brustschmerz** (4★, Notarzt nachfordern, EKG)
        - **Reanimation** (4★, mit First Responder der Feuerwehr, AED, Helfer vor Ort, Rettungshubschrauber)
    - **Fieberkrampf beim Kind** (4★, Kinder-Notfallset, Notarzt)
    - **Tragehilfe** (3★, die Feuerwehr hilft tragen, bei Bedarf mit Drehleiter)
  - **Allergische Reaktion nach Wespenstich** (3★, nur Sommer)
  - **Kreislaufprobleme bei Hitze** (3★, Sommer, Festplatz und Sportplatz)
  - **Sportverletzung** (3★, erst ab Sportplatz Stufe 3, Vakuumschiene)
  - **Infektionstransport** (4★, Infektionsschutzset, Desinfektor)

**Bestehende Einsätze bekommen ab Level 30 einen Rettungsdienst-Teil:** Verkehrsunfall mit eingeklemmter Person, Zimmerbrand, Person im Eis, Person in der Elbe, Arbeitsunfall auf der Baustelle, Schlägerei, hilflose Person, Türöffnung, First Responder. **Vor Level 30 gibt es diesen Teil nicht.** Die Einsätze laufen dann genau wie heute, ohne Patienten und ohne Abzug.

### 5.8 Bewertung

Fünf Sterne, abgezogen wird für:

- Eintreffen nach der heruntergerechneten Hilfsfrist,
- keine Notfallsanitäterin im RTW bei Notfallrettung (Regel nach § 10 NRettDG),
- kein Notarzt bei Notarzt-Indikation,
- Zeit ohne Versorgung bei roten Patienten,
- Fahrzeug nicht wiederhergestellt vor dem nächsten Einsatz (Hygiene).

---

## 6. DRK: Sanitäts- und Betreuungsdienst (ab Level 40)

Hilfsorganisationen wirken in Niedersachsen im Katastrophenschutz mit (§ 14 NKatSG). Grundeinheit ist der Sanitäts- und Betreuungszug, Gliederung und Sollstärke legt das Innenministerium per Erlass fest ([MI Niedersachsen](https://www.mi.niedersachsen.de/startseite/themen/innere_sicherheit/brand_katastrophenschutz/katastrophenschutz/gliederung-und-sollstarke-der-einheiten-des-katastrophenschutzes-im-sanitats-und-betreuungsdienst-221740.html)). Bei Hochwasser haben Helfer von ASB, DRK, JUH und MHD Deichverteidigung und Versorgung unterstützt ([MI, Neuausrichtung Katastrophenschutz](https://www.mi.niedersachsen.de/download/120460/Neuausrichtung_Niedersachsen_stellt_Katastrophenschutz_neu_auf_Artikel_.pdf)).

**Im Dorf heißt das:** ein DRK-Ortsverein mit ehrenamtlichen Mitgliedern, die wie die Feuerwehr von zu Hause alarmiert werden.

| Aufgabe | Wirkung im Spiel |
|---|---|
| **Helfer vor Ort** | wird bei Notfällen parallel zum RTW alarmiert, ist oft schneller da, überbrückt die Zeit bis zum RTW |
| **Sanitätswachdienst** | planbarer Einsatz bei Schützenfest, Dorffest und Sportfest. Solange er läuft, werden Notfälle auf dem Festplatz sofort versorgt. |
| **Betreuung** | nach Zimmerbrand oder Evakuierung kümmert sie sich um die Betroffenen; ohne Betreuung Abzug bei der Feuerwehr („Bewohner standen stundenlang auf der Straße“) |
| **Verpflegung** | bei Einsätzen über drei Stunden werden alle Einsatzkräfte versorgt. Ohne Verpflegung arbeiten sie ab der vierten Stunde langsamer. |
| **Schnelleinsatzgruppe** | bei vielen Verletzten (Abschnitt 13) |
| **Psychosoziale Notfallversorgung** | nach belastenden Einsätzen. Spätere Idee, siehe Abschnitt 22. |

**Qualifikationen:** Sanitätshelfer/in, Rettungssanitäter/in (ehrenamtlich, gleicher Lehrgang wie in 5.2), Betreuungshelfer/in, Verpflegungshelfer/in (Feldkoch), Gruppenführer/in, Zugführer/in.

**Fahrzeuge:** PKW für Helfer vor Ort, MTW, Krankentransportwagen für den Katastrophenschutz, Gerätewagen Sanitätsdienst, Feldküche (Anhänger, braucht Zugfahrzeug), Betreuungs-LKW.

**Unterkunft:** Gruppenraum im Gemeindehaus (Stufe 0, ab Freischaltung) → Unterkunft mit Garage → Unterkunft mit Fahrzeughalle und Lager → Katastrophenschutzzentrum (gemeinsam mit der Wasserrettung möglich, Stellplätze und Lager für beide).

**Einsatzarten:** Helfer vor Ort (Start), Sanitätswachdienst Dorffest (3★), Betreuung nach Brand (3★), Verpflegung bei Großeinsatz (3★), Sanitätswachdienst Sportfest (ab Sportplatz Stufe 6), Behandlungsplatz bei vielen Verletzten (4★, Großlage).

---

## 7. DLRG: Wasserrettung (ab Level 50)

Die Elbe ist das prägende Gewässer des Dorfes, ihr Pegel kommt schon heute live aus Home Assistant. Der Fachdienst Wasserrettung ist in Niedersachsen Teil des Katastrophenschutzes, bei Hochwasser waren über 500 Mitglieder der DLRG eingesetzt ([MI, Neuausrichtung Katastrophenschutz](https://www.mi.niedersachsen.de/download/120460/Neuausrichtung_Niedersachsen_stellt_Katastrophenschutz_neu_auf_Artikel_.pdf)).

**Qualifikationen:**

| Stufe | Grundlage | Voraussetzung im Spiel |
|---|---|---|
| Deutsches Rettungsschwimmabzeichen Bronze | Deutsche Prüfungsordnung Schwimmen, Retten, Rettungsschwimmen ([Prüfungsordnung, Abdruck DLRG](https://koenigswinter.dlrg.de/fileadmin/groups/9220020/DLRG_Koenigswinter/Pruefungsordnung/po1.pdf)) | Fitness 40 |
| Deutsches Rettungsschwimmabzeichen Silber | dieselbe Prüfungsordnung | Fitness 55, Training im Wasser (Elbe im Sommer oder Lehrschwimmbecken) |
| Wasserretter/in | Fachausbildung der Organisation | Silber |
| Strömungsretter/in | Fachausbildung | Wasserretter, Fitness 65 |
| Bootsführer/in | Fachausbildung | Wasserretter |
| Wachführer/in | Führungsausbildung | Wasserretter |

Das Rettungsschwimmabzeichen muss in der Wirklichkeit regelmäßig erneuert werden. Im Spiel geschieht das automatisch über das Training, ohne Zutun.

**Wachstation an der Elbe** (hinter dem Deich an der Badestelle): Rettungsschwimmer mit Sonnenschirm (Stufe 0) → Wachturm → Wasserrettungsstation mit Bootshaus und Slipanlage → mit Steg, Strömungsrettungslager und Funkraum.

**Fahrzeuge und Boote:** Rettungsbrett, Schlauchboot, Motorrettungsboot, Gerätewagen Wasserrettung mit Bootstrailer, Strömungsretter-Ausrüstung (Trockenanzug, Wurfsack, Helm).

**Wachdienst:** An Sommerwochenenden (Juni bis August, Sa und So 11 bis 18 Uhr, Spielwert) sitzen zwei Mitglieder auf dem Wachturm. Sie fehlen dann der Feuerwehr (Abschnitt 3.3).

**Einsatzarten:** Badeunfall (Start, nur Sommer), Person in der Elbe (gemeinsam mit der Feuerwehr, gibt es schon), Boot treibt manövrierunfähig (3★), Person im Eis (Unterstützung, gibt es schon), Evakuierung bei Hochwasser (4★, nur bei hohem Elbpegel), Suche am Ufer (3★, mit der Polizei bei „Vermisstes Kind“).

**Pegel:** Ab dem mittleren Hochwasser treten Hochwasser-Einsätze häufiger auf, die Strömung macht Wasserrettung langsamer, und Boote brauchen einen Bootsführer mit Strömungsausbildung.

---

## 8. Technisches Hilfswerk (ab Level 60)

Das THW ist eine Bundesanstalt aus ehrenamtlichen und hauptamtlichen Kräften. Es hilft **auf Ersuchen** der für die Gefahrenabwehr zuständigen Stellen ([§ 1 THWG](https://www.gesetze-im-internet.de/thw-helfrg/__1.html)). Ein Technischer Zug besteht aus Zugtrupp, Bergungsgruppe und Fachgruppen, die je Ortsverband verschieden sind, zum Beispiel Notversorgung und Notinstandsetzung, Räumen oder Wassergefahren ([OV Heilbronn](https://ov-heilbronn.thw.de/unser-thw-ortsverband/einheiten/technischer-zug), [Übersicht der Einheiten](https://ov-woerth.thw.de/fileadmin/user_upload/LVBY/GSTR/OWOE/Mediathek/THW_Einheiten.pdf)).

**Im Spiel heißt das:** Das THW hat **keine eigenen Einsatzarten, die von selbst auftreten**. Es kommt nur, wenn eine Einsatzleitung es **nachfordert** (Abschnitt 13.2). Damit hängt sein Nutzen an der Führungsausbildung der Feuerwehr (Gruppenführer, Zugführer, ELW), und beide Bäume greifen ineinander.

| Einheit | Kauf | Kann |
|---|---|---|
| Zugtrupp | Gründung des Ortsverbands | Führung, Funk, Verbindung zur Einsatzleitung |
| Bergungsgruppe | Gerätekraftwagen, Abstützsystem Holz, Grundausbildung | Abstützen einsturzgefährdeter Gebäude, Bergung, Ausleuchten |
| Fachgruppe Notversorgung und Notinstandsetzung | Netzersatzanlage, Elektro-Lehrgang | Stromausfall überbrücken, Pumpen betreiben |
| Fachgruppe Räumen | Radlader, Kipper, Bagger | Sturmschäden räumen, Trümmer |
| Fachgruppe Wassergefahren | Mehrzweckboot, Großpumpen | Hochwasser, Deich, Keller in Serie |
| Fachgruppe Ortung (spät) | Ortungstechnik, Rettungshundeteam | Suche nach Verschütteten |

**Qualifikationen:** Grundausbildung THW, Sprechfunker, Motorsägenführer, Kraftfahrer C/CE, Fachausbildungen je Fachgruppe, Truppführer, Gruppenführer, Zugführer.

**Unterkunft:** Lagerraum in einer Scheune (Stufe 0) → Unterkunft des Ortsverbands → mit Fahrzeughalle und Werkstatt → mit Übungsgelände (Trümmerkegel, Übungsbecken). Lage am Ortsrand, im privaten Kartenvorschlag am Ostweg Richtung Scheune.

**Einsätze (nur durch Nachforderung):** Stromausfall im Ortsteil, Scheune einsturzgefährdet nach Brand, Sturm-Flächenlage, Hochwasser (Pumpen, Sandsack-Füllanlage, Ausleuchten), lange Nachteinsätze (Ausleuchten), Verschüttete Person nach Gebäudeeinsturz (Endstufe).

---

## 9. Werkstatt und Abschleppdienst (ab Level 20)

Ein privater Betrieb, der für das Dorf zwei Dinge tut: Er räumt nach Unfällen und Falschparkern die Straße, und er ist ein Arbeitgeber im Dorf.

**Rechtliches:** Die Polizei kann ein verbotswidrig abgestelltes Fahrzeug abschleppen lassen, etwa ein Fahrzeug in der Feuerwehrzufahrt (§ 12 StVO; Grundlage für die Maßnahme ist das NPOG, Paragraf vor der Umsetzung in VORIS prüfen). Fahrzeuge, die zur Pannenhilfe geeignet und als Pannenhilfsfahrzeug anerkannt sind, dürfen gelbes Rundumlicht führen ([§ 52 Abs. 4 StVZO](https://www.anwalt24.de/gesetze/stvzo-1/52)). Sonderrechte nach § 35 StVO haben sie nicht, sie fahren im normalen Verkehr.

| Stufe | Name | Bauzeit | Wirkung |
|---|---|---|---|
| 0 | Abschleppdienst aus der Stadt (extern) | | kommt nach Spielwert 35 min |
| 1 | Pannenhilfe-Transporter im Unterstand | 4 h | Pannen im Dorf in 10 min |
| 2 | Kfz-Werkstatt mit Abschleppwagen | 24 h | Abschleppen im Dorf, 3 Arbeitsplätze |
| 3 | Abschlepphof mit Verwahrplatz | 36 h | abgeschleppte Fahrzeuge bleiben im Dorf, Polizei schneller fertig |
| 4 | Bergungszentrum mit Kran | 72 h | Bergung schwerer Fahrzeuge, LKW |

**Fahrzeuge:** Pannenhilfsfahrzeug, Abschleppwagen mit Hubbrille, Abschleppwagen mit Schiebeplateau, schwerer Bergewagen mit Drehkran.

**Qualifikationen:** Kfz-Mechatroniker/in (Beruf), Führerschein C/CE, Bergung schwerer Fahrzeuge, Ladungssicherung.

**Einsatzarten:**

- **Panne auf der Dorfstraße** (Start, täglich, behindert den Verkehr, bis der Abschleppdienst da ist)
  - **Falschparker umsetzen** (3★): Folge von „Falschparker in der Feuerwehrzufahrt“. Heute bremst der Falschparker die Feuerwehr, solange der Polizei-Einsatz läuft. Mit Abschleppdienst ist die Zufahrt früher frei.
  - **Fahrzeugbergung nach Unfall** (3★): Folge von Verkehrsunfällen. Die Straße bleibt gesperrt, bis das Fahrzeug weg ist, und Einsätze in der Nähe dauern länger (gleicher Mechanismus wie Baustellen).
    - **PKW im Graben** (3★, Seilwinde)
    - **LKW festgefahren bei Glätte** (4★, schwerer Bergewagen, Bauhof streut)
      - **LKW hat Ladung verloren** (4★, gemeinsam mit Feuerwehr und Bauhof)

---

## 10. Bauhof und Winterdienst (ab Level 20)

Der Bauhof der Gemeinde wirkt **vorbeugend** und **nachsorgend**. Das ist ein eigener Spieltyp: Er verhindert keine Einsätze, macht sie aber leichter.

| Leistung | Wirkung im Spiel |
|---|---|
| **Winterdienst** | Nach einer Streufahrt gilt auf gestreuten Straßen bei Glätte der Reibwert für „nass“ statt „Glätte“. Die Hauptstraße wird zuerst gestreut, Nebenstraßen ab Stufe 3. Weniger Rutschen, kürzere Bremswege, Unfälle durch Glätte treten seltener auf. |
| **Fahrbahnreinigung** | Nach einer Ölspur bleibt die Straße ohne Nachreinigung länger glatt. Mit Bauhof ist sie schneller wieder frei. |
| **Absperrmaterial** | Baken, Absperrschranken und Verkehrszeichen für lange Einsätze. Ersetzt bei der Polizei die Absicherung nach der ersten Stunde, die Streife ist wieder frei. |
| **Sandsäcke** | Füllen vor Hochwasser, Lager am Bauhof. Ohne Bauhof muss die Feuerwehr selbst füllen. |
| **Baumkontrolle** | Bei Sturm fallen weniger Bäume auf Straßen (Intervall bei Sturm länger). Das ist die einzige Stelle, an der ein Kauf Einsätze seltener macht. Sie ist bewusst klein gehalten. |

| Stufe | Name | Bauzeit |
|---|---|---|
| 0 | Straßenmeisterei des Kreises (extern) | |
| 1 | Gemeindearbeiter mit Pritschenwagen in einer Garage | 4 h |
| 2 | Bauhof mit Halle | 24 h |
| 3 | Bauhof mit Salzlager und Winterdienstfahrzeug | 36 h |
| 4 | Bauhof mit Werkstatt und Sandsacklager | 48 h |

**Fahrzeuge:** Pritschenwagen, Kommunalfahrzeug mit Schneeschild und Streuer, Kehrmaschine, Radlader, Hubsteiger (Baumpflege).

**Qualifikationen:** Führerschein C, Motorsägenführer, Baumkontrolleur/in, Winterdienst-Fahrer/in. Gemeindearbeiter sind im echten Leben oft in der Feuerwehr. Im Spiel ist der Bauhof deshalb ein besonders wirksamer Arbeitgeber für die Tagesalarmsicherheit.

**Einsatzarten:** Glätte streuen (Start, nur bei Glätte und Schnee), Ölspur nachreinigen (Folge), Ast auf dem Gehweg (3★, niedrige Dringlichkeit), Absperrung bei Sturm (3★), Sandsäcke füllen (4★, Hochwasser).

---

## 11. Kleine externe Partner (ab Level 20, AED ab Level 30)

Ohne eigenen Aufbau, aber mit einem Kauf, der wirkt:

| Partner | Wo er gebraucht wird | Kauf |
|---|---|---|
| **Jägerschaft** | Wildunfall: verletztes Wild braucht die Jagdausübungsberechtigte bzw. den Jagdausübungsberechtigten. Volle Sterne beim Wildunfall nur, wenn die Polizei sie benachrichtigt. | Mitgliedschaft „Jägerschaft“ für einen Bewohner (zählt nicht als Einsatzorganisation) |
| **Tierarztpraxis** | Pferd im Graben: Volle Sterne nur mit Tierarzt. Ohne Praxis im Dorf kommt er von außerhalb. | Gebäude (Arbeitgeber im Dorf, 2 Stellen) |
| **Entstörungsdienst des Netzbetreibers** | Gasgeruch und Stromausfall: Das Absperren übernimmt der Netzbetreiber. | Kein Kauf. Fester externer Partner mit Spielwert 25 min Anfahrt. |
| **Öffentlich zugängliche Defibrillatoren (AED)** | Reanimation: Ersthelfer holen den nächsten AED. | einzeln: am Dorfplatz, am Markt, am Sportplatz, am Feuerwehrhaus |

---

## 12. Sportplatz in der Südostecke (ab Level 10)

### 12.1 Lage

Die südöstliche Ecke der Karte ist frei: östlich der Hauptstraße, die dort von Südosten ins Dorf kommt, südlich des Neubaugebiets Elbblick. Die genauen Koordinaten stehen nur im privaten Repository (`schale91/Claude`, `docs/KONZEPT.md`). Die Zufahrt zweigt von der Hauptstraße ab. Am Westrand liegen Parkplatz, Vereinsheim und die Rettungswache, das Spielfeld liegt östlich davon.

Ein Großspielfeld misst in der Praxis 105 × 68 m netto, mit 400-m-Rundlaufbahn ([DIN 18035-1](https://www.dinmedia.de/de/norm/din-18035-1/291764379), Beispiel [Stadt Reinbek](https://reinbek.de/fileadmin/Gemeinde/Dateien/Reinbek_unsere_Stadt/Bauen/Aktuelle_Planungen/43_Aenderung_Flaechennutzungsplan/Stadt_Reinbek_43te_A_FNP_Konzept_SpFreizeitp_20230328.pdf)). Auf der stilisierten Karte wäre das zu groß. Der Platz wird in denselben Proportionen verkleinert, so wie die Fahrzeuge bewusst groß wirken.

### 12.2 Ausbaustufen

Jede Stufe ist eine Baustelle mit eigenen Phasen und Baufahrzeugen (Abschnitt 17).

| Stufe | Ab Level | Name | Bauzeit | Preis (Regelwerk) | Wirkung |
|---|---|---|---|---|---|
| 0 | 10 | Brachfläche (Grundstück kaufen) | | 2 000 | Fläche gehört dem Dorf |
| 1 | 10 | Bolzwiese mit zwei Toren | 4 h | 1 500 | Training möglich, Fitness wächst langsam |
| 2 | 10 | Trimm-dich-Pfad am Rand | 8 h | 3 000 | Kraft und Koordination, für alle Bewohner, auch ohne Verein |
| 3 | 10 | Rasenplatz mit Drainage | 48 h + Anwachsen | 12 000 | Fußball, regelmäßiges Vereinstraining |
| 4 | 20 | Vereinsheim mit Umkleiden und Duschen | 48 h | 15 000 | Training bei jedem Wetter, Arbeitsplatz Platzwart; AED am Platz ab Level 30 |
| 5 | 20 | Flutlicht | 12 h | 8 000 | Training im Winter abends, ab Level 30 Landestelle auch bei Nacht |
| 6 | 40 | 400-m-Laufbahn, Weitsprung, Kugelstoßen, Tribüne, Kiosk | 72 h | 30 000 | Ausdauer, Sportabzeichen, Sportfest mit Sanitätswachdienst, Kiosk als Arbeitsplatz |
| 7 | 50 | Übungsbahn der Feuerwehr und Kraftraum | 36 h | 20 000 | Feuerwehr-Fitnessabzeichen, Löschangriff üben (Ausbildung schneller) |
| 8 | 60 | Sporthalle mit Lehrschwimmbecken | 120 h | 60 000 | Training ganzjährig, Rettungsschwimmen im Winter |

Ausbauten ohne eigene Stufe: **Kunstrasen** (Training auch nach Regen, ab Stufe 5), **Hubschrauber-Landestelle** mit Windsack, Markierung und Befeuerung (ab Level 30 und Stufe 3, Befeuerung ab Stufe 5), **Geräteschuppen**, **Beregnungsanlage** (Rasen im Sommer).

Einsätze am Sportplatz gibt es erst mit dem passenden Dienst: Sportverletzung ab Level 30, Sanitätswachdienst beim Sportfest ab Level 40.

### 12.3 Fitness

Jede Person hat Fitness von 0 bis 100. Beim Einzug liegt sie je nach Alter zwischen 35 und 70 (Spielwert).

| Wirkung | Formel (Spielwert) |
|---|---|
| Tempo zu Fuß und mit dem Rad | × (0,85 + 0,3 · f/100) |
| Körperliche Arbeit vor Ort | × (0,9 + 0,2 · f/100) |
| Ausdauer bei langen Einsätzen | Ab 90 min wird die Arbeit langsamer, mit hoher Fitness weniger (bis 20 %) |
| Atemschutz | Luftverbrauch sinkt mit Fitness, die Zeit unter Atemschutz je Flasche steigt (× 0,8 bis 1,2) |
| Tragen (Tragestuhl, Trage, Sandsäcke) | schneller |
| Voraussetzung | Atemschutz ab 50, Rettungsschwimmer Bronze ab 40, Silber ab 55, Strömungsretter ab 65 |

**Training:** Mitglieder des Sportvereins trainieren automatisch zweimal pro Woche abends, Feuerwehr und Hilfsorganisationen haben zusätzlich einen Dienstsport-Termin. Wer im Einsatz ist, verpasst das Training, sonst nichts. Ohne Sportplatz joggen sie über die Straßen, das bringt weniger. Ohne Training sinkt die Fitness sehr langsam bis zum Ausgangswert, nie darunter.

| Ausbaustufe | Fitnessgewinn je Training (Spielwert) |
|---|---|
| keine (Joggen) | +0,3 |
| Stufe 1 bis 2 | +0,5 |
| Stufe 3 bis 5 | +0,8 |
| Stufe 6 bis 8 | +1,0, im Winter nur mit Flutlicht oder Halle |

**Atemschutz und Belastungsübung:** Atemschutzgeräteträger müssen jährlich eine Belastungsübung in einer Atemschutzübungsanlage und eine Einsatzübung absolvieren ([FwDV 7](https://www.nlbk.niedersachsen.de/download/192509), [Erläuterung KFV Aschaffenburg](https://kfv-ab.de/images/KFV/2024/241022_ATG_Ausbildung_2025/Belastungs%C3%BCbungen_2025.pdf)). Im Spiel plant das die App automatisch: Die Person fährt einmal im Jahr für drei Stunden zur Übungsanlage des Landkreises und fehlt dann. Mit dem Ausbau **Atemschutzübungsstrecke** am Feuerwehrhaus (Stufe 4) findet die Übung im Dorf statt und dauert nur eine Stunde. Die Pflicht kann nie verpasst werden, weil sie automatisch läuft.

### 12.4 Abzeichen

| Abzeichen | Grundlage | Braucht | Wirkung |
|---|---|---|---|
| Deutsches Feuerwehr-Fitnessabzeichen Bronze, Silber, Gold | je eine Disziplin aus Ausdauer, Kraft und Koordination, nach Alter gestaffelt ([Deutsche Feuerwehr-Sportföderation](https://dfs-ev.de/wp-content/uploads/2024/05/BROSCHRE2019_AK_1.pdf)) | Laufbahn (Stufe 6), Kraftraum und Übungsbahn (Stufe 7) | Fitness-Obergrenze +5 / +10 / +15, Abzeichen an der Figur |
| Deutsches Sportabzeichen | Spielwert, für Bewohner ohne Feuerwehr | Stufe 6 | wie oben |
| Rettungsschwimmabzeichen | Abschnitt 7 | Elbe im Sommer oder Lehrschwimmbecken | Qualifikation Wasserrettung |

### 12.5 Dorfleben und Einsätze am Sportplatz

- Abends laufen Figuren auf der Bahn, am Wochenende wird Fußball gespielt, im Winter brennt Flutlicht.
- **Sportfest** einmal im Sommer (wie das Schützenfest): Sanitätswachdienst, Kreislaufprobleme bei Hitze, Falschparker an der Zufahrt, Polizei für den Verkehr.
- **Sportverletzung** (Rettungsdienst) ab Stufe 3.
- **Landestelle:** Bei Reanimation und schweren Unfällen fliegt der Rettungshubschrauber. Er landet am Sportplatz, wenn die Landestelle gebaut ist, die Feuerwehr sichert die Landung, und der Notarzt wird mit dem RTW zur Einsatzstelle gebracht. Ohne Landestelle landet er auf einer Wiese, was länger dauert.

### 12.6 Keine Verbindung zum eigenen Training

Entschieden: Das Training im Kraftbuch wirkt nicht auf die Fitness im Dorf. Die Einsatzwelt bleibt vom echten Training getrennt, damit dort kein Druck entsteht.

---

## 13. Gemeinsame Einsätze

### 13.1 Leitstelle

Die Leitstelle ist kein Gebäude auf der Karte. Sie disponiert automatisch nach einer **Alarm- und Ausrückeordnung**: Jede Einsatzart nennt die Organisationen, die sofort alarmiert werden, und die, die nachgefordert werden können. Eine Organisation steht darin erst ab ihrem Level. Kaufbare Verbesserungen ab Level 30:

| Kauf | Wirkung |
|---|---|
| Strukturierte Notrufabfrage | Rettungsdienst und Notarzt werden bei passenden Einsätzen sofort richtig alarmiert statt nachgefordert |
| Telefonreanimation | Anrufende werden zur Herzdruckmassage angeleitet, die Zeit ohne Hilfe bei Reanimation sinkt |
| Smartphone-Ersthelferalarmierung | registrierte Ersthelfer in der Nähe werden alarmiert (Bewohner mit Erste-Hilfe-Ausbildung) |
| AED-Verzeichnis | Ersthelfer werden zum nächsten AED geschickt |
| Paralleler Alarm Helfer vor Ort | ab Level 40: Helfer vor Ort des DRK wird gleichzeitig mit dem RTW alarmiert |

### 13.2 Nachforderung

Manche Hilfe kommt nur auf Anforderung: Abschleppdienst, Bauhof (ab 20), Rettungshubschrauber (ab 30, wenn die Leitstelle ihn nicht schon sendet), Betreuung und Verpflegung (ab 40), THW (ab 60). Nachfordern kann eine **Einsatzleitung** mit passender Führungsausbildung:

| Einsatzgröße | Einsatzleitung |
|---|---|
| Trupp, Staffel | Truppführer/in |
| Gruppe | Gruppenführer/in |
| Zug, Großlage | Zugführer/in mit ELW |

Ohne passende Führung wird später nachgefordert (Spielwert +10 min), und das Protokoll sagt warum. So zahlt die Führungsausbildung der Feuerwehr auch auf die anderen Dienste ein.

### 13.3 Wann gemeinsame Einsätze erscheinen

Ein gemeinsamer Einsatz erscheint **erst, wenn alle beteiligten Dienste freigeschaltet sind**. Vorher ist er im Store nicht sichtbar, tritt nicht auf und wird auch nicht unsichtbar von außen erledigt. Ab dem Level steht er im Einsatzbaum und folgt den üblichen Regeln: freischalten über Sterne beim Vorgänger, dann kaufen. Teile, die an bestehende Einsätze angehängt werden (etwa der Rettungsdienst-Teil beim Verkehrsunfall), kommen mit dem Level automatisch dazu und kosten nichts.

| Ab Level | Wer zusammenarbeitet | Was neu erscheint |
|---|---|---|
| 1 (wie heute) | Feuerwehr und Polizei über Folgeeinsätze | Verkehrsregelung, Absperrung, Unfallaufnahme, Begleitung Türöffnung, Personensuche |
| 15 | Feuerwehr und Polizei als gemeinsamer Einsatz | 8 Einsatzarten aus 13.5, Bewertung der Zusammenarbeit |
| 20 | dazu Abschleppdienst und Bauhof | Teile in Verkehrsunfall, Ölspur, Falschparker, Glätte, Sturm |
| 30 | dazu Rettungsdienst | Rettungsdienst-Teil in 9 bestehenden Einsätzen, 6 neue Einsatzarten mit Feuerwehr und Polizei aus 13.6 |
| 40 | dazu DRK | Betreuung nach Brand, Verpflegung bei langen Einsätzen, Sanitätswachdienst bei Festen |
| 50 | dazu DLRG | Person in der Elbe mit Strömungsrettern, Auto in der Elbe, Badeunfall |
| 60 | dazu THW | Nachforderung bei Stromausfall, Einsturzgefahr, Ausleuchten |
| 70 | **alle zusammen** | Großlagen aus 13.7 |

### 13.4 Bewertung gemeinsamer Einsätze

- Jede beteiligte Organisation bekommt **eigene Sterne für ihren Teil** und schaltet damit ihren eigenen Baum frei.
- Dazu gibt es ab Level 15 die **Zusammenarbeit** von 1 bis 5 Sternen, die Übergaben bewertet: Wie lange stand die Straße nach dem Löschen noch gesperrt? Wie lange wartete der befreite Patient auf den RTW? Kam die Verpflegung rechtzeitig?
- Die Zusammenarbeit der letzten 20 gemeinsamen Einsätze bestimmt, wie oft die großen gemeinsamen Einsätze kommen. Wer gut zusammenarbeitet, bekommt mehr davon.

### 13.5 Feuerwehr und Polizei (ab Level 15)

| Einsatz | Freischaltung | Feuerwehr | Polizei | Für 5 Sterne |
|---|---|---|---|---|
| **Kind im Auto eingeschlossen** (Sommer, Hitze) | nach Türöffnung (3★) | Fahrzeug öffnen | Halter ermitteln, Eltern finden, Lage beruhigen | Fahrzeug offen in 10 min, Polizei vor Ort |
| **Rinder auf der Straße** | nach Pferd im Graben (3★) | Tiere mit Absperrband und Leitkegeln zurücktreiben | Straße sperren, Landwirt verständigen | Straße gesperrt, bevor ein Auto kommt |
| **Serie von Mülltonnenbränden** | nach Mülltonnenbrand (4★) und Wohnungseinbruch (3★) | jeden Brand löschen | ab dem dritten Brand in einer Woche ermittelt sie mit Spurensicherung; findet sie den Täter, endet die Serie | Serie nach höchstens vier Bränden beendet |
| **Unfallflucht mit Betriebsstoffen** | nach Ölspur (3★) | Fahrbahn abstreuen, absichern | Fahndung, Unfallaufnahme | Fahrbahn frei in 30 min, Verursacher gefunden |
| **Gasgeruch, Häuser räumen** | nach Gasgeruch (4★) | messen, Gefahrenbereich festlegen | Häuser im Gefahrenbereich räumen, absperren | niemand im Gefahrenbereich, Netzbetreiber da |
| **LKW verliert Flüssigkeit** (Gefahrgut-Kennzeichnung) | nach Gasgeruch (4★) | ABC-Erkundung, Auffangen, Abdichten | großräumige Sperrung, Umleitung | Ausbreitung gestoppt, Sperrung steht in 10 min |
| **Brand in leerstehendem Haus** | nach Zimmerbrand (3★) | Löschen, Kontrolle auf Personen | Ermittlung Brandursache, Absperrung | Haus durchsucht, Brandstelle beschlagnahmt |
| **Silvesternacht** (nur 31.12. bis 1.1.) | nach Heckenbrand und Ruhestörung (je 3★) | mehrere Kleinbrände | Ruhestörungen, Sachbeschädigung | alle Einsätze der Nacht unter Zielzeit |

### 13.6 Feuerwehr, Polizei und Rettungsdienst (ab Level 30)

Zusätzlich zum Rettungsdienst-Teil in den bestehenden Einsätzen:

| Einsatz | Feuerwehr | Polizei | Rettungsdienst |
|---|---|---|---|
| **Verkehrsunfall mit mehreren Verletzten** | technische Rettung, Absicherung | Sperrung, Unfallaufnahme | mehrere RTW, Notarzt, Sichtung |
| **Motorradunfall nach Wildwechsel** | Absicherung, Betriebsstoffe | Unfallaufnahme, Jäger verständigen | Versorgung, Rettungshubschrauber |
| **Trunkenheitsfahrt endet im Graben** | Fahrzeug sichern | Blutprobe, Führerschein | Fahrer untersuchen |
| **Schlägerei beim Schützenfest mit Verletzten** | Ausleuchtung bei Nacht | Trennen, Festnahme | Versorgung |
| **Person auf dem Dach eines Stalls verletzt** | Drehleiter oder Schiebleiter, Rettung | Absperrung | Versorgung oben und unten |
| **Reanimation am Sportplatz** | First Responder | Anfahrtsweg frei halten | RTW, Notarzt oder Hubschrauber auf der Landestelle |

### 13.7 Alle zusammen (ab Level 70)

Großlagen werden nicht gekauft. Sie erscheinen ab Level 70, kommen selten und hängen am echten Wetter und Pegel. Wie oft, bestimmt die Zusammenarbeit (13.4). Jede Person wird einmal eingeplant (3.3).

| Großlage | Auslöser | Feuerwehr | Polizei | Rettungsdienst | DRK | DLRG | THW | Bauhof, Abschleppdienst |
|---|---|---|---|---|---|---|---|---|
| **Elbhochwasser** | Pegel aus Home Assistant über dem mittleren Hochwasser | Deichverteidigung in Abschnitten | Sperrung, Evakuierung | Bereitschaft | Verpflegung, Betreuung | Evakuierung per Boot | Großpumpen, Sandsack-Füllanlage, Licht | Sand, Radlader |
| **Sturm-Flächenlage** | Sturm aus der Wetter-Entität | viele Bäume auf Straßen | Sperrungen | Verletzte | Verpflegung bei Dauer | | Räumen mit Radlader | Absperrung, beschädigte Autos |
| **Busunfall mit vielen Verletzten** | Bus nach Fahrplan, Glätte erhöht | technische Rettung | Sperrung, Ermittlung | mehrere RTW, Sichtung nach rot, gelb, grün | Behandlungsplatz, Betreuung Unverletzter | | Licht, bei Bedarf Bergung | schwerer Bergewagen |
| **Bombenfund mit Evakuierung** | Baustelle (Erdarbeiten) | Bereitstellung, Brandschutz | Evakuierung und Sperrung des Gefahrenbereichs | Bereitstellung, Transport nicht gehfähiger Bewohner | Betreuungsstelle in der Sporthalle | | Licht | Absperrung |
| **Großbrand Scheune mit Stromausfall** | Hitze, Trockenheit | Zug, lange Schlauchleitung | Verkehr, Ermittlung | Bereitstellung | Verpflegung | | Netzersatzanlage, Abstützen | Wasser vom Bauhof |
| **Dorffest-Wochenende** | Kalender (Sommer) | Brandsicherheitswache | Verkehr, Ordnung | Bereitschaft | Sanitätswachdienst | Wache an der Badestelle | | Parkplatzlenkung, Abschleppen |

Beim Bombenfund folgt das Spiel dem bekannten Ablauf: Entschärft wird erst, wenn der Gefahrenbereich geräumt ist. Entschärfen kann nur der Kampfmittelbeseitigungsdienst Niedersachsen (externer Partner ohne Kauf). Feuerwehr, Polizei und DRK arbeiten dabei zusammen ([Feuerwehr Hannover 2015](https://www.hannover.de/Leben-in-der-Region-Hannover/Sicherheit-Ordnung/Feuerwehr-Hannover/Presse-und-Öffentlichkeitsarbeit/Pressemitteilungen/Mai-2015/Kampfmittelbeseitigung-erfolgreich-abgeschlossen), [Feuerwehr Hannover 2016](https://www.hannover.de/Leben-in-der-Region-Hannover/Sicherheit-Ordnung/Feuerwehr-Hannover/Presse-und-Öffentlichkeitsarbeit/Pressemitteilungen/November-2016/Bombenentschärfung-erfolgreich-abgeschlossen)).

### 13.8 Ausführliches Beispiel: Verkehrsunfall mit eingeklemmter Person

Wie derselbe Einsatz mit jedem Level reicher wird:

| Level | Feuerwehr | Polizei | Rettungsdienst | Abschleppdienst und Bauhof |
|---|---|---|---|---|
| bis 14 | wie heute | Unfallaufnahme als Folgeeinsatz | gibt es nicht | gibt es nicht |
| 15 bis 19 | wie heute | wie heute, dazu Bewertung der Zusammenarbeit (Absicherung, Übergabe der Einsatzstelle) | gibt es nicht | gibt es nicht |
| 20 bis 29 | wie heute | Straße erst frei, wenn das Fahrzeug weg ist | gibt es nicht | Abschleppdienst nachfordern, Bauhof reinigt die Fahrbahn |
| ab 30 | patientengerechte Rettung in Absprache mit dem Notarzt | wie oben | RTW und NEF, Patient mit Dringlichkeit, Transport | wie oben |

Abzug Zusammenarbeit ab Level 30 zum Beispiel: „Patient wartete nach der Befreiung 6 Minuten auf den RTW.“

---

## 14. Leveln auf drei Ebenen

### 14.1 Person

- **Qualifikationen** je Organisation (Lehrgänge mit Dauer, wie heute).
- **Erfahrung** aus Einsätzen je Organisation. Dienstgrade der Feuerwehr wie heute, beim Rettungsdienst Erfahrungsstufen (Berufsanfänger/in, ab 100 Notfalleinsätzen erfahren, Praxisanleiter/in), beim THW und in der Wasserrettung Helfer/in, Truppführer/in, Gruppenführer/in.
- **Fitness und Abzeichen** (Abschnitt 12).
- **Jubiläen** nach Jahren der Mitgliedschaft (Spielwert, nur Anerkennung).

### 14.2 Organisation

Die Gebäudestufe ist das Level der Organisation. Sie bestimmt Stellplätze, Lager, Personalgrenze und welche Einsatzarten möglich sind. Jede Organisation hat 4 bis 8 Stufen.

### 14.3 Freischaltung nach Level

Die Dienste hängen am **Level der Lebenswelt** (XP aus dem Alltag, Kurve `100 · n^1,4`, siehe Konzept der App). XP gehen nie verloren, ein freigeschalteter Dienst bleibt also für immer. Zeiten bei rund 300 XP am Tag (bei 250 XP etwa ein Fünftel länger):

| Level | ungefähr nach | Freigeschaltet | Gemeinsame Einsätze |
|---|---|---|---|
| 1 | sofort | Feuerwehr und Polizei wie heute, Bewohner mit Beruf, Feuerwehr und Polizei als Mitgliedschaften | Folgeeinsätze wie heute |
| 10 | 1 Monat | Sportverein, Sportplatz Stufen 0 bis 3 | keine |
| 15 | 3 Monate | Zusammenarbeit von Feuerwehr und Polizei | 13.5 |
| 20 | 6 Monate | Werkstatt und Abschleppdienst, Bauhof, Tierarztpraxis, Jägerschaft, Sportplatz Stufen 4 und 5 | mit Abschleppdienst und Bauhof |
| **30** | **1,3 Jahre** | **Rettungswache**, AED, Leitstellen-Verbesserungen, Landestelle, dritte Baukolonne | 13.6 |
| 40 | 2,6 Jahre | DRK, Familienhaus, Sportplatz Stufe 6 | mit DRK |
| 50 | 4,4 Jahre | DLRG, Sportplatz Stufe 7 | mit DLRG |
| 60 | 6,9 Jahre | THW, Lehrrettungswache, Sportplatz Stufe 8 | mit THW |
| **70** | **10 Jahre** | **alle zusammen** | Großlagen 13.7 |

Bisher war dafür eine Dorfstufe nach Einwohnerzahl vorgesehen. Sie entfällt: Ein Level ist einfacher zu verstehen und belohnt den Alltag, um den es in der App eigentlich geht.

---

## 15. Technikbaum über alle Dienste

Die Bäume der einzelnen Dienste stehen in den Abschnitten 5 bis 10. Hier die **Querverbindungen**, also die Stellen, an denen ein Kauf in einem Baum einen anderen weiterbringt:

```
Feuerwehr Erste Hilfe ──► First Responder ──► Rettungsdienst Reanimation (5★ nur mit FR)
Feuerwehr Gruppenführer/ELW ──► Nachforderung ohne Verzug ──► THW, Betreuung, Abschleppdienst
Polizei Falschparker ──► Abschleppdienst „Falschparker umsetzen“ ──► Feuerwehrzufahrt früher frei
Polizei Verkehrsunfall ──► Abschleppdienst Bergung ──► Straße früher frei für alle
Bauhof Winterdienst ──► weniger Glätteunfälle ──► Feuerwehr, Polizei, Rettungsdienst entlastet
Sportplatz Stufe 3 ──► Landestelle ──► Rettungshubschrauber schneller
Sportplatz Stufe 4 ──► AED am Platz ──► Reanimation am Sportplatz und Festplatz
Sportplatz Stufe 6/7 ──► Fitnessabzeichen ──► Atemschutz länger, Ablösung seltener
Sportplatz Stufe 8 ──► Lehrschwimmbecken ──► Rettungsschwimmer im Winter
Rettungswache, Bauhof, Werkstatt, Tierarzt ──► Arbeitsplätze ──► Feuerwehr tagsüber stärker
DRK Verpflegung ──► lange Einsätze ohne Leistungsabfall ──► Deich, Scheunenbrand
Wasserrettung Strömungsretter ──► Person in der Elbe (5★) ──► Hochwasser-Evakuierung
Atemschutzübungsstrecke (Feuerwehr) ──► Belastungsübung im Dorf ──► AGT seltener abwesend
```

Im Store wird der Baum je Dienst gezeigt wie heute, mit einem zusätzlichen Hinweis an Knoten mit Querverbindung („wirkt auch auf: Feuerwehr“).

---

## 16. Store und die Regel „jeder Kauf bringt voran“

### 16.1 Aufbau

Store-Bereich **Einsatzwelt** mit Reitern:

1. **Empfohlen:** die drei Käufe mit der größten Wirkung, berechnet aus dem Protokoll (siehe 16.3), dazu je Dienst der nächste sinnvolle Schritt.
2. **Feuerwehr, Polizei, Rettungsdienst, DRK, DLRG, THW, Werkstatt, Bauhof, Sportverein:** je Dienst die bekannten Bereiche Einsätze (Baum), Personal, Ausrüstung, Fahrzeuge, Gebäude, Ausbau. Gesperrte Dienste erscheinen grau mit dem nötigen Level und den fehlenden XP, damit man weiß, worauf es hinausläuft. Kaufen kann man dort nichts.
3. **Dorf:** Bauplätze, Häuser, Bewohner, Einliegerwohnung und Familienhaus, Neubaugebiete, AED, Leitstelle, Tierarztpraxis.

### 16.2 Wirkungsvorschau

Die Simulation ist eine reine, deterministische Funktion. Deshalb kann der Server vor jedem Kauf die letzten Einsätze nachrechnen, **als ob** das Teil schon da gewesen wäre:

- Route `GET /api/lebenswelt/einsatz/vorschau?art=…&id=…`
- Nimmt bis zu 20 abgeschlossene Einsätze der betroffenen Einsatzarten aus den letzten 30 Tagen, rechnet Disposition, Arbeit und Bewertung mit dem hypothetischen Stand neu und vergleicht.
- Anzeige im Store: „In den letzten 20 Einsätzen: im Mittel 1:40 min schneller, +0,4 Sterne, 2 Einsätze wären nicht verfallen.“
- Für Teile ohne messbare Wirkung in der Vergangenheit (z. B. eine neue Einsatzart): „wirkt ab dem ersten Einsatz“ mit der Beschreibung.
- Teile, die gerade **nichts** bewirken würden (fehlende Voraussetzung, kein Slot, kein Fahrer), sind sichtbar, aber mit Hinweis „wirkt erst mit …“ und einem Knopf zum fehlenden Teil.

### 16.3 Empfehlung aus dem Protokoll

Die Abzüge der letzten 14 Tage werden gesammelt („Leiter nicht gesichert: 9-mal“, „RTW der Nachbarwache: 6-mal“). Daraus und aus der Wirkungsvorschau ergibt sich die Reihenfolge der Empfehlungen.

### 16.4 Bedarfsnachweis

Ein Teil, das in den letzten 7 Tagen in einem Abzug genannt wurde, ist 15 % günstiger (Spielwert). In der Wirklichkeit begründet ein nachgewiesener Bedarf eine Beschaffung, im Spiel lenkt der Nachlass den Blick auf das, was fehlt. Es ist kein zeitlich begrenztes Angebot im Sinne von Druck: Der Nachlass kommt wieder, sobald das Teil wieder fehlt.

### 16.5 Preisleiter

Prüfung in `werkzeuge/pruefe-regelwerk.js` (neu): Für jeden Abschnitt zwischen zwei Freischalt-Levels muss es mindestens **fünf Artikel mit Wirkung** geben, die höchstens drei Tageseinnahmen kosten (heute 90 Münzen), und mindestens **einen größeren Meilenstein** pro Monat Einnahmen. So ist immer etwas erreichbar, und es gibt trotzdem etwas, worauf man spart.

### 16.6 Was es nicht gibt

Keine Käufe gegen Euro, keine Lootboxen, keine Zufallsbelohnungen, keine zeitlich verschwindenden Angebote, keine Verbrauchsgüter, die ohne Nutzung ablaufen, keine Strafen für Pausen.

---

## 17. Bauzyklen

### 17.1 Was alles gebaut wird

| Bereich | Baustellen |
|---|---|
| Rettungsdienst | Stellplatz, Container-Wache, Rettungswache, Lehrrettungswache, 6 Ausbauten |
| DRK | 3 Stufen der Unterkunft, Feldküchen-Unterstand |
| DLRG | Wachturm, Wasserrettungsstation, Steg und Slipanlage |
| THW | 3 Stufen der Unterkunft, Übungsgelände |
| Werkstatt | 4 Stufen |
| Bauhof | 4 Stufen, Salzsilo |
| Sportplatz | 8 Stufen, Kunstrasen, Landestelle, Befeuerung, Beregnung, Geräteschuppen |
| Dorf | Familienhaus, Tierarztpraxis, AED-Säulen, Atemschutzübungsstrecke |

Zusammen über 40 Baustellen, dazu die Häuser der neuen Bewohner.

### 17.2 Neue Bauphasen

Zusätzlich zu den Phasen aus [UMSETZUNG.md Abschnitt 13](UMSETZUNG.md):

| Phase | Wo | Fahrzeuge und Bild | Besonderheit |
|---|---|---|---|
| Bodenaustausch und Drainage | Sportplatz | Bagger, Kipper, Rohrverlegung | laut |
| Einsaat | Rasenplatz | Traktor mit Sämaschine | |
| **Anwachsen** | Rasenplatz | Fläche färbt sich von Braun nach Grün, Absperrband | nur von April bis September; im Winter ruht die Phase. Das macht Jahreszeiten im Bauen sichtbar. |
| Linierung | Spielfeld | Linierwagen fährt die Linien ab | |
| Masten stellen | Flutlicht | Autokran | windabhängig: bei Sturm keine Arbeit |
| Kunststoffbelag | Laufbahn | Fertiger, Walze | nur trocken und über 10 °C (Spielwert) |
| Module setzen | Container-Wache | LKW mit Ladekran | schnell, eine Phase |
| Stahlbau | THW-Halle, Bauhof-Halle | Kran, Hubsteiger | |
| Rammen | Steg der Wasserrettung | Ramme auf Ponton | nur bei normalem Pegel |
| Befeuerung prüfen | Landestelle | Abnahme bei Nacht | |
| Beckenbau und Wassertechnik | Lehrschwimmbecken | Betonmischer, Transporter | längste Baustelle im Spiel |

### 17.3 Ebenen, die die Ideen aus UMSETZUNG.md aufgreifen

- **Eigenleistung:** Mitglieder des Vereins oder der Organisation helfen abends auf der eigenen Baustelle. Die Bauzeit sinkt um bis zu 20 %, die Helfer sind in der Zeit nicht im Einsatz verfügbar. Kann je Baustelle an- und abgeschaltet werden (Standard: aus).
- **Richtfest** bei Gebäuden mit Rohbau: Die Bewohner stehen eine Stunde auf der Baustelle, rein sichtbar.
- **Lieferzeit für Fahrzeuge:** Große Fahrzeuge (RTW, HLF, Bergewagen, Radlader) werden bestellt und kommen nach einer Lieferzeit (Spielwert 12 bis 48 h) mit einem Tieflader ins Dorf. Bis dahin steht im Store „bestellt“.
- **Behelfsbetrieb** gilt auch für Rettungswache, Bauhof und Werkstatt: Solange dort gebaut wird, dauern Ausrücken und Wiederherstellen länger.
- **Baufirma:** Bleibt bei zwei Kolonnen. Mit den neuen Diensten wird das spürbar. Ein Ausbau **dritte Kolonne** (Spielwert 5 000, ab Level 30) wird ein sinnvoller Kauf.

---

## 18. Grafiken

### 18.1 Neue Modelle

| Gruppe | Modelle |
|---|---|
| Gebäude | Rettungswache in 4 Stufen, DRK-Unterkunft in 4 Stufen, Wachturm und Wasserrettungsstation, THW-Unterkunft in 4 Stufen, Werkstatt in 5 Stufen, Bauhof in 5 Stufen, Vereinsheim, Sporthalle, Tierarztpraxis, Familienhaus |
| Sportplatz | Bolzwiese mit Toren, Trimm-dich-Stationen, Rasen mit Streifen, Laufbahn mit Bahnlinien, Weitsprunggrube, Tribüne, Kiosk, Flutlichtmasten, Hindernisbahn, Windsack und Landemarkierung |
| Rettungsdienst | KTW, RTW, NEF, Rettungshubschrauber mit drehendem Rotor und aufgewirbeltem Staub bei der Landung, Trage mit zugedeckter Person, Tragestuhl |
| DRK | PKW Helfer vor Ort, MTW, KTW, Gerätewagen, Feldküche mit Dampf, Zelt für Betreuung oder Behandlungsplatz |
| DLRG | Rettungsbrett, Schlauchboot, Motorrettungsboot mit Bugwelle, Bootstrailer, Gerätewagen |
| THW | MTW, Gerätekraftwagen, Radlader, Kipper, Netzersatzanlage, Großpumpe mit Schlauch, Abstützung aus Holz, Lichtmast |
| Werkstatt | Pannenhilfsfahrzeug, Abschleppwagen mit Hubbrille (hebt die Vorderachse an), Plateau (kippt ab, Auto rollt hinauf), Bergewagen mit Drehkran |
| Bauhof | Pritschenwagen, Winterdienstfahrzeug mit Schild und Streuteller (Streusalz als Teilchen), Kehrmaschine, Hubsteiger, Baken und Schranken |
| Bau | Linierwagen, Sämaschine, Fertiger und Walze, Autokran, Ramme auf Ponton, Tieflader |

### 18.2 Figuren und Kleidung

Jede Organisation hat eigene Kleidung, damit man auf der Karte sofort sieht, wer unterwegs ist. Warnkleidung ist im Rettungsdienst und bei Arbeiten im Straßenraum üblich, die genauen Farben je Organisation sind Spielentscheidung.

| Organisation | Kleidung |
|---|---|
| Rettungsdienst | leuchtrot und leuchtgelb mit Reflexstreifen |
| DRK | Rot und Weiß, ohne rotes Kreuz und ohne Logo |
| DLRG | Rot und Gelb ohne Logo, Rettungsweste, beim Strömungsretter Trockenanzug und Helm |
| THW | Blau mit Warnweste, Helm |
| Werkstatt | Arbeitshose, Warnweste |
| Bauhof | Orange |
| Sportverein | Trikots in Vereinsfarbe, beim Joggen Laufkleidung |

### 18.3 Animationen

Hubschrauberlandung, Abschleppen, Streufahrt mit Teilchen, Pumpen mit Wasserstrahl aus dem Deich, Radlader schiebt Äste, Boot fährt mit Kielwasser, Fußballspiel, Läufer auf der Bahn, Rasen wächst, Linien entstehen, Figuren tragen Sandsäcke.

### 18.4 Shop-Bilder und Leistung

- Shop-Bilder werden wie heute aus den Modellen gerendert (`ShopModelle.tsx`, `ShopBild.tsx`).
- Neue Gebäude werden mit dem vorhandenen Verschmelzen zu einem Mesh je Material zusammengefasst, Figuren und Baken instanziert.
- Ziel wie in E7: drei gleichzeitige Einsätze plus Training auf dem Sportplatz ohne spürbaren Einbruch. Training und Fußball laufen nur, wenn der Sportplatz im Bild ist.

---

## 19. Wirtschaft

`PREISFAKTOR` bleibt bei 0,05 für alles (Entscheidung). Grobe Summen der neuen Dienste mit allen Stufen, Fahrzeugen, Ausbauten und je Bewohner Ausbildung und Ausrüstung:

| Bereich | Ab Level | Regelwerk | Münzen |
|---|---|---|---|
| Dorf (Bewohner, Mitgliedschaften, Familienhaus, AED, Leitstelle, Tierarzt) | 1 bis 40 | 60 000 | 3 000 |
| Sportplatz | 10 bis 60 | 160 000 | 8 000 |
| Werkstatt und Abschleppdienst | 20 | 90 000 | 4 500 |
| Bauhof | 20 | 80 000 | 4 000 |
| Rettungsdienst | 30 | 260 000 | 13 000 |
| DRK | 40 | 120 000 | 6 000 |
| DLRG | 50 | 110 000 | 5 500 |
| THW | 60 | 220 000 | 11 000 |
| **Summe** | | **1 100 000** | **55 000** |

**Passt das zu den Einnahmen?** Bei 30 Münzen am Tag kommen bis Level 70 in rund zehn Jahren etwa 110 000 Münzen zusammen. Feuerwehr und Polizei (rund 60 000) und die neuen Dienste (55 000) kosten zusammen etwa 115 000. Das geht also ungefähr auf. Bis Level 30 gibt es mit Feuerwehr, Polizei, Sportplatz, Werkstatt und Bauhof weit mehr zu kaufen, als man verdient. Danach kommt alle ein bis drei Jahre ein neuer Dienst dazu, gerade wenn die vorigen weitgehend ausgebaut sind. Wichtig bleibt die Preisleiter (16.5): Alle ein bis drei Tage soll ein wirksamer Kauf möglich sein.

---

## 20. Umsetzung in Etappen

Gebaut wird in der Reihenfolge der Level. Was erst in vielen Jahren freigeschaltet wird, baue ich erst, wenn das Level näher rückt (etwa ein halbes Jahr vorher). So entsteht kein Code, der jahrelang ungenutzt liegt und bis dahin veraltet. Jede Etappe endet wie bisher mit Tests, Build, Screenshots und Installation.

| Etappe | Level | Inhalt | Abnahme |
|---|---|---|---|
| **D1 Bewohner und Level** | 1 | Datenmodell Version 2, Berufe, Mitgliedschaften, Hauptamt plus Feuerwehr, Alarmkollision, Freischaltung nach Level auf dem Server | alter Stand ergibt gleiche Bewertung; nie zwei Einsätze gleichzeitig; ohne Level kein Dienst und kein gemeinsamer Einsatz |
| **D2 Sportplatz** | 10 | Stufen 0 bis 3, Fitness, Training, Wirkung auf Tempo und Atemschutz, Belastungsübung automatisch | Fitness steigt mit Training, Wirkung im Protokoll sichtbar; Screenshot je Stufe |
| **D3 Zusammenarbeit Feuerwehr und Polizei** | 15 | 8 gemeinsame Einsatzarten, Bewertung der Zusammenarbeit | jede Organisation eigene Sterne, Zusammenarbeit im Protokoll |
| **D4 Werkstatt und Bauhof** | 20 | Abschleppen, Straßensperren, Winterdienst mit Reibwert, Arbeitsplätze im Dorf, Sportplatz 4 und 5, Wirkungsvorschau | gestreute Straße bremst wie nass; Vorschau stimmt mit Nachrechnung überein |
| **D5 Rettungsdienst** | 30 | Nachbarwache, Wache in Stufen, Fahrzeuge, Patienten, Transport, Baum, Erreichungsgrad, Landestelle, Leitstelle | Reanimation mit und ohne AED; zweiter Notfall bekommt Nachbarwache; vor Level 30 unverändert |
| **D6 DRK** | 40 | Helfer vor Ort, Sanitätswachdienst, Betreuung, Verpflegung, Sportplatz 6 | Verpflegung verhindert Leistungsabfall |
| **D7 DLRG** | 50 | Wachstation, Wachdienst, Pegel-Kopplung, Sportplatz 7 | Wachdienst bindet Personen |
| **D8 THW** | 60 | Nachforderung nach Führungsstufe, Fachgruppen, Sportplatz 8 | THW kommt nur auf Anforderung |
| **D9 Alle zusammen** | 70 | Großlagen | Großlage über mehrere Stunden in unter einer Sekunde fortgeschrieben |

---

## 21. Änderungen am Regelwerk und an der Simulation (Überblick)

- **Regelwerk:** neue Blöcke `ORGANISATIONEN`, `BERUFE`, `FREISCHALTUNG_LEVEL`, `FITNESS`, `SPORTPLATZ`, `PATIENTEN`, `TRANSPORT`, `LEITSTELLE`, `EXTERN` (Grundversorgung je Dienst), `GEMEINSAME_EINSAETZE`. Bestehende Blöcke werden um `org`-Werte erweitert. `LEHRGAENGE`, `FAHRZEUGE`, `GERAETE`, `GEBAEUDE`, `AUSBAU`, `EINSATZARTEN` bekommen Einträge für die neuen Dienste.
- **Einsatzarten:** neues Feld `beteiligte` mit `mindestens` und `optimal` je Organisation, `patienten`, `nachforderung` und `abhaengig_von` (z. B. Transport erst nach Befreiung).
- **Simulation:** Disposition je Organisation mit gemeinsamer Personenbelegung, externe Einheiten mit fester Anfahrt, Patienten und Transport aus der Karte, Schichten, Training als Ereignis, Fitness als Faktor, Wirkungsvorschau als zweiter Aufruf derselben Funktion mit verändertem Stand.
- **Eigenschaften, die Tests absichern müssen** (zusätzlich zu den bisherigen): eine Person nie in zwei Einsätzen, auch über Organisationen; Teile gleich Ganzes auch mit Training und Schichten; Vorschau gleich Nachrechnung; Großlage über 3 Tage unter einer Sekunde.
- **Level auf dem Server:** Der Server berechnet das Level aus dem Spielstand (Summe der Skill-XP, gleiche Formel wie `levelAusXp` in der App) und prüft es beim Kaufen und beim Erzeugen von Einsätzen. Unter dem Level gibt es weder Kauf noch Einsatz noch angehängten Teil. Die Grenzen stehen in `FREISCHALTUNG_LEVEL` und lassen sich ohne Codeänderung verschieben.
- **Home Assistant:** neue Option `pegel_entitaet` für den Elbpegel (heute nur im Frontend). Sonst keine neuen Optionen.
- **Prüfwerkzeug:** `pruefe-regelwerk.js` prüft zusätzlich die Preisleiter und dass jeder Artikel eine Wirkung hat.

---

## 22. Spätere Ideen (bewusst nicht im ersten Umfang)

- Psychosoziale Notfallversorgung nach belastenden Einsätzen (positiv gewendet: schnellere Rückkehr in den Dienst, keine Strafe ohne).
- Jugendfeuerwehr und Jugend der Hilfsorganisationen: Kinder der Bewohner werden mit 10 Jahren Mitglied und wechseln mit 16 bis 18 in die Einsatzabteilung.
- Kreisausbildung: Lehrgänge an der Kreisausbildungsstätte mit begrenzten Plätzen im Monat.
- Partnerschaft mit dem Nachbardorf (überörtliche Hilfe in beide Richtungen).

---

## 23. Entscheidungen und offene Fragen

**Entschieden am 14.10.2026:**

1. Freischaltung nach Level der Lebenswelt: Rettungswache ab 30, alle zusammen ab 70, dazwischen wie in 14.3. Gemeinsame Einsätze erst, wenn alle Beteiligten freigeschaltet sind.
2. `PREISFAKTOR` bleibt 0,05.
3. Rettungsdienstler und Polizisten, die im Dorf wohnen, können in der Feuerwehr sein.
4. Gemeinsame Einsätze mit der Polizei und mit allen zusammen.
5. Berufe und Tagesalarmsicherheit kommen, bestehende Einsatzkräfte ausgenommen.
6. Keine Verbindung zum Training im Kraftbuch.
7. Echte Namen (DRK, DLRG), ohne rotes Kreuz und ohne Logos.
8. Im Spiel stirbt niemand.

**Noch offen:**

1. Stimmt die Verteilung zwischen 30 und 70 (Werkstatt und Bauhof 20, DRK 40, DLRG 50, THW 60)?
2. Bolzplatz g5 bleibt als Kinder-Bolzplatz bestehen. Einverstanden?

---

## 24. Quellen

Rettungsdienst
- [BedarfVO-RettD, Nds. GVBl. Nr. 18/2023](https://www.niedersachsen.de/download/199212/Nds._GVBl._Nr._18_2023_vom_19.09.2023_S._201-215.pdf)
- [Landtag Niedersachsen Drs. 17/8319 (Hilfsfrist 15 Minuten)](https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen_17_10000/8001-8500/17-8319.pdf)
- [Landtag Niedersachsen Drs. 19/11330 (Anfrage zum P-95-Wert, 2026)](https://www.landtag-niedersachsen.de/drucksachen/drucksachen_19_12500/11001-11500/19-11330.pdf)
- [Landtag Niedersachsen Drs. 18/10734 (Besetzung nach § 10 NRettDG)](https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen_18_12500/10501-11000/18-10734.pdf)
- [§ 5 Notfallsanitätergesetz](https://www.gesetze-im-internet.de/notsang/__5.html)
- [APVO-RettSan Niedersachsen 2013](https://www.mi.niedersachsen.de/download/83627/Verordnung_ueber_Ausbildung_und_Pruefung_fuer_Rettungssanitaeterinnen_und_Rettungssanitaeter_APVO-RettSan_vom_17.12.2013.pdf)
- [DIN EN 1789 Krankenkraftwagen](https://www.dinmedia.de/de/norm/din-en-1789/94004682), [DIN 75079 Notarzteinsatzfahrzeuge](https://www.dinmedia.de/de/norm/din-75079/388433461)
- [§ 25 LuftVG](https://lxgesetze.de/luftvg/25), [vfdb-Merkblatt Feuerwehr und Luftrettung](https://www.vfdb.de/media/doc/merkblaetter/MB_06_02_Feuerrwehr_Luftrettung.pdf)
- [Uniklinik Freiburg, Zahlen zur Reanimation](https://www.uniklinik-freiburg.de/fileadmin/mediapool/06_presse/migration/100ProAnimation_Zahlen_Fakten.pdf), [German Resuscitation Council, Laienreanimation](https://www.grc-org.de/files/Newsreleases/document/PM_Laienreanimationsquote_21.06.2021.pdf)

Katastrophenschutz, THW, Wasserrettung
- [MI Niedersachsen: Gliederung und Sollstärke im Sanitäts- und Betreuungsdienst](https://www.mi.niedersachsen.de/startseite/themen/innere_sicherheit/brand_katastrophenschutz/katastrophenschutz/gliederung-und-sollstarke-der-einheiten-des-katastrophenschutzes-im-sanitats-und-betreuungsdienst-221740.html)
- [MI Niedersachsen: Neuausrichtung des Katastrophenschutzes](https://www.mi.niedersachsen.de/download/120460/Neuausrichtung_Niedersachsen_stellt_Katastrophenschutz_neu_auf_Artikel_.pdf)
- [§ 1 THW-Gesetz](https://www.gesetze-im-internet.de/thw-helfrg/__1.html)
- [THW OV Heilbronn: Technischer Zug](https://ov-heilbronn.thw.de/unser-thw-ortsverband/einheiten/technischer-zug), [THW-Einheiten (OV Wörth)](https://ov-woerth.thw.de/fileadmin/user_upload/LVBY/GSTR/OWOE/Mediathek/THW_Einheiten.pdf)
- [Antwort der Bundesregierung zu Doppelmitgliedschaften](https://www.andre-hahn.eu/app/uploads/2024/11/sf558.pdf)
- [Prüfungsordnung Schwimmen und Rettungsschwimmen (Abdruck DLRG Königswinter)](https://koenigswinter.dlrg.de/fileadmin/groups/9220020/DLRG_Koenigswinter/Pruefungsordnung/po1.pdf)

Feuerwehr, Fitness, Sportplatz
- [FwDV 7 Atemschutz (NLBK)](https://www.nlbk.niedersachsen.de/download/192509), [Belastungsübungen nach FwDV 7 (KFV Aschaffenburg)](https://kfv-ab.de/images/KFV/2024/241022_ATG_Ausbildung_2025/Belastungs%C3%BCbungen_2025.pdf)
- [Deutsches Feuerwehr-Fitnessabzeichen (Deutsche Feuerwehr-Sportföderation)](https://dfs-ev.de/wp-content/uploads/2024/05/BROSCHRE2019_AK_1.pdf)
- [DIN 18035-1 Sportplätze](https://www.dinmedia.de/de/norm/din-18035-1/291764379), [Stadt Reinbek, Sportpark-Konzept 2023](https://reinbek.de/fileadmin/Gemeinde/Dateien/Reinbek_unsere_Stadt/Bauen/Aktuelle_Planungen/43_Aenderung_Flaechennutzungsplan/Stadt_Reinbek_43te_A_FNP_Konzept_SpFreizeitp_20230328.pdf)
- [MI Niedersachsen: Informationsschreiben zur Freistellung (§ 12 NBrandSchG)](https://www.mi.niedersachsen.de/download/213228/Informationsschreiben.pdf), [§ 32 NBrandSchG](https://www.anwalt24.de/gesetze/nbrandschg-1/32)

Verkehr und Ordnungsrecht
- [§ 52 StVZO](https://www.anwalt24.de/gesetze/stvzo-1/52)
- [§ 125 OWiG (Rotes Kreuz)](https://lxgesetze.de/owig/125)
- [Feuerwehr Hannover: Kampfmittelbeseitigung 2015](https://www.hannover.de/Leben-in-der-Region-Hannover/Sicherheit-Ordnung/Feuerwehr-Hannover/Presse-und-Öffentlichkeitsarbeit/Pressemitteilungen/Mai-2015/Kampfmittelbeseitigung-erfolgreich-abgeschlossen), [2016](https://www.hannover.de/Leben-in-der-Region-Hannover/Sicherheit-Ordnung/Feuerwehr-Hannover/Presse-und-Öffentlichkeitsarbeit/Pressemitteilungen/November-2016/Bombenentschärfung-erfolgreich-abgeschlossen)

Nicht im Wortlaut geprüft und deshalb vor der Umsetzung nachzuschlagen: die aktuelle Fassung von § 10 NRettDG und der APVO-RettSan (beide in VORIS), die Rechtsgrundlage für das Abschleppen im NPOG, die genauen Leistungstabellen des Feuerwehr-Fitnessabzeichens und die Maße aus DIN 18035-1 (kostenpflichtige Norm).
