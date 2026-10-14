# Dorfdienste: Rettungsdienst, Hilfsorganisationen, Abschleppdienst, Bauhof und Sportplatz

Erweiterung des Einsatzspiels. Grundlage sind [KONZEPT.md](KONZEPT.md) (Feuerwehr und Polizei), [UMSETZUNG.md](UMSETZUNG.md) (Architektur, Simulation, Bauen) und das [Regelwerk](../../lebenswelt/pb_hooks/einsatz/regelwerk.js). Was dort beschlossen ist, gilt weiter: alles auf der Hauptkarte, Simulation auf dem Server, keine Benachrichtigung, kein Ton, kein KI-Guthaben im Betrieb, Kauf im Store, Sterne nur als Anerkennung.

Stand 14.10.2026, Entwurf zur Entscheidung. Werte, die nicht aus einer Vorschrift stammen, sind wie im Regelwerk als **Spielwert** gemeint.

---

## 0. Kurzfassung

1. **Sieben neue Dienste** kommen ins Dorf: Rettungsdienst, Sanitäts- und Betreuungsdienst einer Hilfsorganisation, Wasserrettung, Technisches Hilfswerk, Werkstatt mit Abschleppdienst, Bauhof mit Winterdienst und ein Sportverein mit Sportplatz in der südöstlichen Ecke.
2. **Grundversorgung von außen:** Jeder neue Dienst ist vom ersten Tag an da, aber von außerhalb und langsam (RTW der Nachbarwache, Abschleppdienst aus der Stadt). Jeder Kauf macht ihn schneller oder besser. Niemand startet bei null und wartet tagelang auf den ersten Nutzen.
3. **Dorfbewohner statt Einsatzkräfte:** Wer in ein Haus zieht, ist Bewohnerin oder Bewohner mit Beruf, Fitness und **bis zu zwei Einsatz-Mitgliedschaften** plus Sportverein. Eine Person ist nie in zwei Einsätzen zugleich. Wer zuerst alarmiert wird, geht.
4. **Arbeitsplätze im Dorf** (Rettungswache, Werkstatt, Bauhof, Tierarztpraxis, Platzwart) machen Bewohner tagsüber verfügbar. Das ist die Antwort auf das reale Problem der Tagesalarmsicherheit freiwilliger Feuerwehren.
5. **Sportplatz** in acht Bauabschnitten, von der Bolzwiese bis zum Sportzentrum mit Lehrschwimmbecken. Er hebt die Fitness der Bewohner. Fitness wirkt auf Tempo, Arbeit, Ausdauer und die Einsatzzeit unter Atemschutz, und sie ist Voraussetzung für Atemschutz, Rettungsschwimmen und die Fitnessabzeichen.
6. **Gemeinsame Einsätze:** Ein Verkehrsunfall mit eingeklemmter Person alarmiert Feuerwehr, Rettungsdienst und Polizei, später kommen Abschleppdienst und Bauhof dazu. Jede Organisation bekommt Sterne für ihren Teil, dazu gibt es eine Bewertung der Zusammenarbeit.
7. **Drei Ebenen zum Leveln:** Person (Qualifikation, Erfahrung, Abzeichen), Organisation (Gebäudestufe) und Dorf (Dorfstufe nach Einwohnern und Ausbau). Die Dorfstufe schaltet neue Dienste frei.
8. **Jeder Kauf wirkt, und das wird vorher gezeigt:** Die Simulation ist deterministisch. Vor dem Kauf rechnet der Server die letzten Einsätze mit dem neuen Teil nach und zeigt, was es gebracht hätte („Katze im Mittel 4:50 statt 5:30 Minuten, +0,5 Sterne“).
9. **Über 40 Baustellen** mit eigenen Bauphasen, darunter jahreszeitabhängige wie das Anwachsen des Rasens.
10. **Reihenfolge:** zuerst Bewohner und Sportplatz, dann Rettungsdienst, dann die kleinen Dienste, zuletzt THW und Großlagen.

---

## 1. Ehrliche Einschätzung vorab

Einige Punkte halte ich für riskant. Ich schreibe sie an den Anfang, damit sie nicht untergehen.

| Punkt | Problem | Empfehlung |
|---|---|---|
| **Wirtschaft** | Mit dem heutigen `PREISFAKTOR = 0,05` kosten die neuen Dienste zusammen rund 55 000 Münzen, also noch einmal fünf Jahre bei 30 Münzen am Tag. Mit dem Bestand wären es über zehn Jahre. Die neuen Dienste öffnen, während die Feuerwehr noch wächst, und beide teilen sich dieselben 30 Münzen. | Eigener Faktor `PREISFAKTOR_DIENSTE = 0,035` (rund 38 000 Münzen) und vor allem die **Preisleiter** aus Abschnitt 16: In jeder Phase gibt es mindestens fünf wirksame Artikel, die höchstens drei Tageseinnahmen kosten. Wichtiger als die Gesamtdauer ist, dass alle ein bis drei Tage ein Kauf möglich ist. |
| **Komplexität** | Sieben Dienste auf einmal würden die App überladen. „Simpel in der Anwendung“ und „umfangreich“ widersprechen sich, wenn alles gleichzeitig kommt. | Freischaltung über die **Dorfstufe** (Abschnitt 14). Am Anfang sieht man nur Feuerwehr, Polizei, Sportverein und die Grundversorgung von außen. Alles wird automatisch disponiert, es gibt nichts zu steuern. |
| **Rettungsdienst ist hauptamtlich** | Im echten Leben fährt den RTW kein Ehrenamtlicher von zu Hause aus los. Träger sind Landkreise und kreisfreie Städte, die Wache ist im Schichtdienst besetzt. Ein Modell „RTW wie Feuerwehr“ wäre nicht normgerecht. | Rettungswache mit **Stellen und Schichten** (wie die Polizei-Dienststelle). Bewohner können dort **beruflich** arbeiten. Ehrenamtlich wirken sie als Helfer vor Ort oder in der Schnelleinsatzgruppe der Hilfsorganisation. |
| **Tagesalarmsicherheit** | Wenn Bewohner tagsüber auswärts arbeiten, ist die Feuerwehr werktags schwächer. Das ist realistisch, aber es verschlechtert etwas, das heute funktioniert. | Bestehende Einsatzkräfte behalten „arbeitet im Dorf“. Nur Neuzugänge wählen beim Einzug einen Beruf, mit sichtbarer Wirkung. Siehe Abschnitt 3.4. Wenn dir das zu streng ist, lässt sich der Teil komplett abschalten. |
| **Verletzte und Tod** | Die Lebenswelt ist eine Familien-App mit Kindern. | Im Spiel stirbt niemand. Das schlechteste Ergebnis ist „Zustand verschlechtert, lange Behandlung im Krankenhaus“. Keine Darstellung von Verletzungen, Patienten liegen zugedeckt auf der Trage. |
| **Doppelte Bolzplatz-Idee** | Im Shop gibt es schon das Grundstück g5 „Bolzplatz“. Zwei Fußballfelder nah beieinander wirken seltsam. | g5 bleibt als Spielplatz-Bolzplatz für Kinder bestehen (er ist schon kaufbar und soll nicht entwertet werden). Der Sportplatz ist die Vereinsanlage und liegt weit davon in der Südostecke. |
| **Echte Organisationsnamen** | DRK, DLRG, ASB und andere sind eingetragene Namen mit geschützten Zeichen. | Im Spiel generisch („Hilfsorganisation“, „Wasserrettung“), Logos nie nachbauen. THW, Rettungsdienst und Bauhof sind Bezeichnungen öffentlicher Aufgaben und unproblematisch. Entscheidung bei dir (Frage 5). |

---

## 2. Grundsätze für die Erweiterung

1. **Grundversorgung von außen.** Jeder Dienst existiert ab der Freischaltung als externe Einheit mit langer Anfahrt und begrenzter Bewertung (höchstens 3 Sterne, Text „Nachbarwache hat übernommen“). Das gibt es bei der Feuerwehr schon als Verfallstext („Die Nachbarwehr mit Rettungssatz hat übernommen“). Eigene Gebäude, Fahrzeuge und Leute machen den Dienst schneller und besser. So bringt schon der erste Kauf etwas.
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
| Erste Mitgliedschaft | Feuerwehr, Hilfsorganisation, Wasserrettung, THW (je nach Dorfstufe) | Grundausbildung der Organisation ist abgeschlossen |
| Sportverein | ja oder nein | Training und Fitness (Abschnitt 12) |

Mit der **Einliegerwohnung** (gibt es schon) zieht eine zweite Person ein. Neu ist der Ausbau **Familienhaus** (dritte Person, ab Dorfstufe 3).

### 3.2 Was jede Person hat

| Feld | Inhalt |
|---|---|
| `mitgliedschaften` | Liste aus Organisation, Eintritt, Qualifikationen, Einsätzen, Dienstgrad oder Stufe; eine davon ist die **Hauptorganisation** |
| `beruf` | Art (im Dorf, auswärts, Schicht, Ruhestand, in Ausbildung) und Arbeitgeber im Dorf |
| `fitness` | Wert 0 bis 100, letzter Trainingstermin, Abzeichen |
| `psa` | je Organisation eigene Schutzkleidung (wie heute je Stufe mit Wirkung) |
| `belegt_bis` | wie heute: solange sie im Einsatz, im Lehrgang, auf Wache oder im Dienst ist |

### 3.3 Regeln für mehrere Mitgliedschaften

1. **Höchstens zwei Einsatzorganisationen** und zusätzlich der Sportverein. Mehr ist im echten Ehrenamt kaum durchzuhalten, und im Spiel würden sonst wenige Personen alles abdecken.
2. **Eine zweite Mitgliedschaft kostet** einen Eintritt (Spielwert, 150) und die Grundausbildung der neuen Organisation als Lehrgang mit Dauer. Die Person fehlt während des Lehrgangs, wie heute.
3. **Nie in zwei Einsätzen zugleich.** Das ist die wichtigste Regel und wird getestet wie heute „keine Doppelbelegung“.
4. **Alarmkollision:** Wer zuerst alarmiert wird, geht. Kommen zwei Alarme in derselben Minute, entscheidet die Hauptorganisation. Mit Rückmeldesystem (Meldeempfänger mit Rückmeldung oder App) weiß die zweite Organisation sofort, dass die Person fehlt, und plant ohne sie. Ohne Rückmeldung wartet sie vergeblich (wie heute 10 Minuten gebunden).
5. **Großlagen:** Bei Hochwasser oder Sturm (Abschnitt 13) wird jede Person **einmal** eingeplant, für ihre Hauptorganisation. Das ist eine Spielregel. Eine Vorschrift dazu habe ich nicht gefunden. Laut Bundesregierung erfassen weder THW noch Bundeswehr Doppelmitgliedschaften, und daraus lasse sich nicht ableiten, wie sehr sie die Verfügbarkeit im Katastrophenfall einschränken ([Antwort der Bundesregierung](https://www.andre-hahn.eu/app/uploads/2024/11/sf558.pdf)).
6. **Hauptamt schlägt Ehrenamt:** Wer im Schichtdienst auf der Rettungswache ist, wird von der Feuerwehr nicht alarmiert. Außerhalb der Schicht schon.
7. **Wachdienst der Wasserrettung** an Sommerwochenenden bindet die Person an der Badestelle. Sie ist dort schnell bei Badeunfällen, fehlt aber der Feuerwehr.

**Darstellung:** Die Figur trägt die Kleidung der Organisation, für die sie gerade unterwegs ist. In der Personenliste stehen kleine Farbpunkte je Mitgliedschaft.

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

| Dienst | Träger und Grundlage | Gebäude im Dorf | Grundversorgung von außen | Farben auf der Karte |
|---|---|---|---|---|
| **Rettungsdienst** | Landkreis als Träger, NRettDG, BedarfVO-RettD | Rettungswache in vier Stufen, Landestelle am Sportplatz | RTW der Nachbarwache, Anfahrt lang | Weiß mit leuchtroter und leuchtgelber Konturmarkierung |
| **Sanitäts- und Betreuungsdienst** | Hilfsorganisation, Mitwirkung im Katastrophenschutz nach § 14 NKatSG | Unterkunft in vier Stufen | Schnelleinsatzgruppe aus dem Nachbarort | Weiß und Rot, ohne Logo |
| **Wasserrettung** | Wasserrettungsorganisation, Fachdienst Wasserrettung im Katastrophenschutz | Wachstation an der Elbe in vier Stufen | Wasserrettungszug des Landkreises | Rot und Gelb |
| **THW** | Bundesanstalt, Hilfe auf Ersuchen der Gefahrenabwehr (§ 1 THWG) | Unterkunft des Ortsverbands in vier Stufen | Ortsverband der Kreisstadt | THW-Blau mit weißer Schrift |
| **Werkstatt und Abschleppdienst** | privater Betrieb, Auftrag durch Polizei oder Halter | Werkstatt in fünf Stufen | Abschleppdienst aus der Stadt | Gelb mit gelbem Rundumlicht |
| **Bauhof** | Gemeinde | Bauhof in fünf Stufen | Straßenmeisterei des Kreises | Kommunalorange |
| **Sportverein** | Verein | Sportplatz in acht Stufen | Joggen auf der Straße | Vereinsfarben frei wählbar |

Dazu kommen kleine **externe Partner** ohne eigenen Aufbau (Abschnitt 11) und die **Leitstelle** als unsichtbarer Dienst mit kaufbaren Verbesserungen (Abschnitt 13.1).

---

## 5. Rettungsdienst

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
| 4 | Rettungswache mit Lehrrettungswache | 96 h | 4 | Ausbildung zur Notfallsanitäterin im Dorf |

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

**Bestehende Einsätze bekommen einen Rettungsdienst-Teil**, sobald der Rettungsdienst freigeschaltet ist: Verkehrsunfall mit eingeklemmter Person, Zimmerbrand, Person im Eis, Person in der Elbe, Arbeitsunfall auf der Baustelle, Schlägerei, hilflose Person, Türöffnung, First Responder. Bis dahin übernimmt die Nachbarwache diesen Teil unsichtbar, und es gibt keinen Abzug.

### 5.8 Bewertung

Fünf Sterne, abgezogen wird für:

- Eintreffen nach der heruntergerechneten Hilfsfrist,
- keine Notfallsanitäterin im RTW bei Notfallrettung (Regel nach § 10 NRettDG),
- kein Notarzt bei Notarzt-Indikation,
- Zeit ohne Versorgung bei roten Patienten,
- Fahrzeug nicht wiederhergestellt vor dem nächsten Einsatz (Hygiene).

---

## 6. Sanitäts- und Betreuungsdienst (Hilfsorganisation)

Hilfsorganisationen wirken in Niedersachsen im Katastrophenschutz mit (§ 14 NKatSG). Grundeinheit ist der Sanitäts- und Betreuungszug, Gliederung und Sollstärke legt das Innenministerium per Erlass fest ([MI Niedersachsen](https://www.mi.niedersachsen.de/startseite/themen/innere_sicherheit/brand_katastrophenschutz/katastrophenschutz/gliederung-und-sollstarke-der-einheiten-des-katastrophenschutzes-im-sanitats-und-betreuungsdienst-221740.html)). Bei Hochwasser haben Helfer von ASB, DRK, JUH und MHD Deichverteidigung und Versorgung unterstützt ([MI, Neuausrichtung Katastrophenschutz](https://www.mi.niedersachsen.de/download/120460/Neuausrichtung_Niedersachsen_stellt_Katastrophenschutz_neu_auf_Artikel_.pdf)).

**Im Dorf heißt das:** ein Ortsverein mit ehrenamtlichen Mitgliedern, die wie die Feuerwehr von zu Hause alarmiert werden.

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

## 7. Wasserrettung

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

## 8. Technisches Hilfswerk

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

## 9. Werkstatt und Abschleppdienst

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

## 10. Bauhof und Winterdienst

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

## 11. Kleine externe Partner

Ohne eigenen Aufbau, aber mit einem Kauf, der wirkt:

| Partner | Wo er gebraucht wird | Kauf |
|---|---|---|
| **Jägerschaft** | Wildunfall: verletztes Wild braucht die Jagdausübungsberechtigte bzw. den Jagdausübungsberechtigten. Volle Sterne beim Wildunfall nur, wenn die Polizei sie benachrichtigt. | Mitgliedschaft „Jägerschaft“ für einen Bewohner (zählt nicht als Einsatzorganisation) |
| **Tierarztpraxis** | Pferd im Graben: Volle Sterne nur mit Tierarzt. Ohne Praxis im Dorf kommt er von außerhalb. | Gebäude (Arbeitgeber im Dorf, 2 Stellen) |
| **Entstörungsdienst des Netzbetreibers** | Gasgeruch und Stromausfall: Das Absperren übernimmt der Netzbetreiber. | Kein Kauf. Fester externer Partner mit Spielwert 25 min Anfahrt. |
| **Öffentlich zugängliche Defibrillatoren (AED)** | Reanimation: Ersthelfer holen den nächsten AED. | einzeln: am Dorfplatz, am Markt, am Sportplatz, am Feuerwehrhaus |

---

## 12. Sportplatz in der Südostecke

### 12.1 Lage

Die südöstliche Ecke der Karte ist frei: östlich der Hauptstraße, die dort von Südosten ins Dorf kommt, südlich des Neubaugebiets Elbblick. Die genauen Koordinaten stehen nur im privaten Repository (`schale91/Claude`, `docs/KONZEPT.md`). Die Zufahrt zweigt von der Hauptstraße ab. Am Westrand liegen Parkplatz, Vereinsheim und die Rettungswache, das Spielfeld liegt östlich davon.

Ein Großspielfeld misst in der Praxis 105 × 68 m netto, mit 400-m-Rundlaufbahn ([DIN 18035-1](https://www.dinmedia.de/de/norm/din-18035-1/291764379), Beispiel [Stadt Reinbek](https://reinbek.de/fileadmin/Gemeinde/Dateien/Reinbek_unsere_Stadt/Bauen/Aktuelle_Planungen/43_Aenderung_Flaechennutzungsplan/Stadt_Reinbek_43te_A_FNP_Konzept_SpFreizeitp_20230328.pdf)). Auf der stilisierten Karte wäre das zu groß. Der Platz wird in denselben Proportionen verkleinert, so wie die Fahrzeuge bewusst groß wirken.

### 12.2 Ausbaustufen

Jede Stufe ist eine Baustelle mit eigenen Phasen und Baufahrzeugen (Abschnitt 17).

| Stufe | Name | Bauzeit | Preis (Regelwerk) | Wirkung |
|---|---|---|---|---|
| 0 | Brachfläche (Grundstück kaufen) | | 2 000 | Fläche gehört dem Dorf |
| 1 | Bolzwiese mit zwei Toren | 4 h | 1 500 | Training möglich, Fitness wächst langsam |
| 2 | Trimm-dich-Pfad am Rand | 8 h | 3 000 | Kraft und Koordination, für alle Bewohner, auch ohne Verein |
| 3 | Rasenplatz mit Drainage | 48 h + Anwachsen | 12 000 | Fußball, regelmäßiges Vereinstraining, Sportverletzungen möglich |
| 4 | Vereinsheim mit Umkleiden, Duschen und AED | 48 h | 15 000 | Training bei jedem Wetter, AED am Platz, Arbeitsplatz Platzwart |
| 5 | Flutlicht | 12 h | 8 000 | Training im Winter abends, Landestelle bei Nacht nutzbar |
| 6 | 400-m-Laufbahn, Weitsprung, Kugelstoßen, Tribüne, Kiosk | 72 h | 30 000 | Ausdauer, Sportabzeichen, Sportfest, Kiosk als Arbeitsplatz |
| 7 | Übungsbahn der Feuerwehr und Kraftraum | 36 h | 20 000 | Feuerwehr-Fitnessabzeichen, Löschangriff üben (Ausbildung schneller) |
| 8 | Sporthalle mit Lehrschwimmbecken | 120 h | 60 000 | Training ganzjährig, Rettungsschwimmen im Winter |

Ausbauten ohne eigene Stufe: **Kunstrasen** (Training auch nach Regen, ab Stufe 5), **Hubschrauber-Landestelle** mit Windsack, Markierung und Befeuerung (ab Stufe 3, Befeuerung ab Stufe 5), **Geräteschuppen**, **Beregnungsanlage** (Rasen im Sommer).

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

### 12.6 Verbindung zum eigenen Training (Vorschlag)

Wenn du in einer Woche mindestens dreimal im Kraftbuch trainierst, gibt es für das ganze Dorf in der Folgewoche „Trainingslust“: +25 % Fitnessgewinn. Es gibt dafür keine Münzen und keinen Abzug, wenn du nicht trainierst. Die Verbindung ist bewusst klein, damit das echte Training nicht unter Druck gerät (Frage 3).

---

## 13. Zusammenspiel mit Feuerwehr und Polizei

### 13.1 Leitstelle

Die Leitstelle ist kein Gebäude auf der Karte. Sie disponiert automatisch nach einer **Alarm- und Ausrückeordnung**: Jede Einsatzart nennt die Organisationen, die sofort alarmiert werden, und die, die nachgefordert werden können. Kaufbare Verbesserungen:

| Kauf | Wirkung |
|---|---|
| Strukturierte Notrufabfrage | Rettungsdienst und Notarzt werden bei passenden Einsätzen sofort richtig alarmiert statt nachgefordert |
| Telefonreanimation | Anrufende werden zur Herzdruckmassage angeleitet, die Zeit ohne Hilfe bei Reanimation sinkt |
| Smartphone-Ersthelferalarmierung | registrierte Ersthelfer in der Nähe werden alarmiert (Bewohner mit Erste-Hilfe-Ausbildung) |
| AED-Verzeichnis | Ersthelfer werden zum nächsten AED geschickt |
| Paralleler Alarm Helfer vor Ort | Helfer vor Ort wird gleichzeitig mit dem RTW alarmiert |

### 13.2 Nachforderung

Manche Hilfe kommt nur auf Anforderung: THW, Abschleppdienst, Bauhof, Betreuung, Verpflegung, Rettungshubschrauber (wenn die Leitstelle ihn nicht schon sendet). Nachfordern kann eine **Einsatzleitung** mit passender Führungsausbildung:

| Einsatzgröße | Einsatzleitung |
|---|---|
| Trupp, Staffel | Truppführer/in |
| Gruppe | Gruppenführer/in |
| Zug, Großlage | Zugführer/in mit ELW |

Ohne passende Führung wird später nachgefordert (Spielwert +10 min), und das Protokoll sagt warum. So zahlt die Führungsausbildung der Feuerwehr auch auf THW, Betreuung und Abschleppdienst ein.

### 13.3 Bewertung gemeinsamer Einsätze

- Jede beteiligte Organisation bekommt **eigene Sterne für ihren Teil** und schaltet damit ihren eigenen Baum frei.
- Dazu gibt es eine **Zusammenarbeit** von 1 bis 5 Sternen, die Übergaben bewertet: Wie lange wartete der befreite Patient auf den RTW? Wie lange stand die Straße nach dem Löschen noch gesperrt? Kam die Verpflegung rechtzeitig?
- Die Zusammenarbeit schaltet die **Großlagen** frei (Abschnitt 13.5).

### 13.4 Zehn Einsatzbeispiele

**1. Verkehrsunfall, Person eingeklemmt** (gibt es schon, wird erweitert)

| Zeit | Feuerwehr | Rettungsdienst | Polizei | Abschleppdienst | Bauhof |
|---|---|---|---|---|---|
| 0 | Alarm HLF oder LF mit Rettungssatz | RTW und NEF (mit Notrufabfrage sofort) | Streife | | |
| Eintreffen | Absichern, Brandschutz, Erstversorgung | Patient im Fahrzeug versorgen, Rettungsart mit der Feuerwehr festlegen | Absperrung, Verkehr | | |
| Arbeit | patientengerechte Rettung, Tempo hängt an Rettungssatz, TH-Lehrgang und Fitness | Übernahme, Transport | Unfallaufnahme | Nachforderung durch die Einsatzleitung | bei ausgelaufenen Betriebsstoffen |
| Ende | einsatzbereit | 70 min weg | fertig, wenn die Straße frei ist | Fahrzeug weg, Straße frei | Fahrbahn gereinigt |

Abzug Zusammenarbeit: „Patient wartete nach der Befreiung 6 Minuten auf den RTW“.

**2. Zimmerbrand, Menschenleben in Gefahr:** RTW in Bereitstellung, gerettete Person wird an der Haustür übergeben. Die Betreuung kümmert sich um die Bewohner, die Polizei ermittelt zur Brandursache. Bei langer Nachlöschzeit Verpflegung.

**3. Reanimation:** Leitstelle mit Telefonreanimation → Ersthelfer per App holen den AED vom Sportplatz → First Responder der Feuerwehr → Helfer vor Ort → RTW → NEF oder Rettungshubschrauber mit Landung am Sportplatz. Bewertet wird vor allem die Zeit bis zur Herzdruckmassage und bis zum ersten Schock. Hier zeigt sich, warum viele kleine Käufe (AED, Ersthelfer-App, Telefonreanimation) mehr bringen als ein teures Fahrzeug.

**4. Person in der Elbe:** Wasserrettung mit Strömungsrettern und Boot, Feuerwehr mit Boot und Ausleuchtung, Rettungsdienst am Ufer, Polizei sucht mit. Der echte Pegel bestimmt die Strömung.

**5. Deichverteidigung bei Elbhochwasser** (gibt es schon, wird zur Großlage): ausgelöst nur bei hohem Pegel aus Home Assistant. Feuerwehr in mehreren Abschnitten, THW mit Großpumpen, Sandsack-Füllanlage und Licht, Bauhof mit Sand und Radlader, Wasserrettung für Evakuierung, Hilfsorganisation mit Verpflegung, Polizei sperrt ab. Dauert Stunden bis Tage. Jede Person wird einmal eingeplant, Ablösung nach Fitness.

**6. Sturm-Flächenlage:** viele kleine Einsätze gleichzeitig (Bäume auf Straßen, Äste, ein PKW unter einem Baum). Die Feuerwehr arbeitet ab, das THW räumt mit Radlader, der Bauhof sperrt ab, der Abschleppdienst holt beschädigte Autos.

**7. Schützenfest und Sportfest:** Sanitätswachdienst auf dem Platz, Kreislaufprobleme, Schlägerei (Polizei, danach Rettungsdienst), Falschparker an der Zufahrt (Polizei, dann Abschleppdienst).

**8. Glätte am Morgen:** Ohne Winterdienst mehr Unfälle und festgefahrene LKW. Mit Winterdienst fährt das Streufahrzeug um 5 Uhr los, und die Hauptstraße ist bis zum Berufsverkehr gestreut.

**9. Ölspur:** Feuerwehr streut ab, Bauhof reinigt nach, Polizei warnt. Ohne Bauhof bleibt die Straße länger rutschig.

**10. Busunfall mit vielen Verletzten** (Endstufe, der Bus fährt schon heute nach Fahrplan durch das Dorf): Sichtung nach rot, gelb und grün, Behandlungsplatz der Hilfsorganisation, mehrere RTW (eigene und Nachbarwachen), Feuerwehr zur technischen Rettung, Polizei für Absperrung und Ermittlung, Abschleppdienst mit schwerem Bergewagen, Betreuung der Unverletzten. Einmal im Quartal höchstens, und nur, wenn die Zusammenarbeit bei kleineren Einsätzen gut lief.

### 13.5 Großlagen

Großlagen werden nicht gekauft. Sie werden freigeschaltet, wenn die Dorfstufe 5 erreicht ist und die Zusammenarbeit im Mittel der letzten 20 gemeinsamen Einsätze bei 4 Sternen liegt. Sie kommen selten und hängen am echten Wetter und Pegel.

---

## 14. Leveln auf drei Ebenen

### 14.1 Person

- **Qualifikationen** je Organisation (Lehrgänge mit Dauer, wie heute).
- **Erfahrung** aus Einsätzen je Organisation. Dienstgrade der Feuerwehr wie heute, beim Rettungsdienst Erfahrungsstufen (Berufsanfänger/in, ab 100 Notfalleinsätzen erfahren, Praxisanleiter/in), beim THW und in der Wasserrettung Helfer/in, Truppführer/in, Gruppenführer/in.
- **Fitness und Abzeichen** (Abschnitt 12).
- **Jubiläen** nach Jahren der Mitgliedschaft (Spielwert, nur Anerkennung).

### 14.2 Organisation

Die Gebäudestufe ist das Level der Organisation. Sie bestimmt Stellplätze, Lager, Personalgrenze und welche Einsatzarten möglich sind. Jede Organisation hat 4 bis 8 Stufen.

### 14.3 Dorf

Die Dorfstufe steigt **von selbst** mit Bewohnern und Ausbau. Sie schaltet Dienste frei und hält die Erweiterung in einer verdaulichen Reihenfolge.

| Stufe | Name (Spielwert) | Bedingung | Neu verfügbar |
|---|---|---|---|
| 1 | Weiler | Start | Feuerwehr, Polizei, Grundversorgung von außen sichtbar |
| 2 | Dorf | 5 Bewohner | Sportverein mit Sportplatz Stufe 0 bis 3, Bauhof, Werkstatt und Abschleppdienst, RTW-Stellplatz am Feuerwehrhaus, Leitstellen-Verbesserungen |
| 3 | Kirchdorf | 12 Bewohner, 8 Einsatzarten gekauft | Rettungswache, Hilfsorganisation, Wasserrettung, Familienhaus, Sportplatz bis Stufe 6 |
| 4 | Ortschaft | 25 Bewohner, ein Neubaugebiet erschlossen | THW-Ortsverband, Lehrrettungswache, Sportplatz Stufe 7 und 8 |
| 5 | Flecken | 40 Bewohner, Zusammenarbeit im Mittel 4★ | Großlagen |

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
Hilfsorganisation Verpflegung ──► lange Einsätze ohne Leistungsabfall ──► Deich, Scheunenbrand
Wasserrettung Strömungsretter ──► Person in der Elbe (5★) ──► Hochwasser-Evakuierung
Atemschutzübungsstrecke (Feuerwehr) ──► Belastungsübung im Dorf ──► AGT seltener abwesend
```

Im Store wird der Baum je Dienst gezeigt wie heute, mit einem zusätzlichen Hinweis an Knoten mit Querverbindung („wirkt auch auf: Feuerwehr“).

---

## 16. Store und die Regel „jeder Kauf bringt voran“

### 16.1 Aufbau

Store-Bereich **Einsatzwelt** mit Reitern:

1. **Empfohlen:** die drei Käufe mit der größten Wirkung, berechnet aus dem Protokoll (siehe 16.3), dazu je Dienst der nächste sinnvolle Schritt.
2. **Feuerwehr, Polizei, Rettungsdienst, Hilfsorganisation, Wasserrettung, THW, Werkstatt, Bauhof, Sportverein:** je Dienst die bekannten Bereiche Einsätze (Baum), Personal, Ausrüstung, Fahrzeuge, Gebäude, Ausbau. Gesperrte Dienste erscheinen mit der Bedingung der Dorfstufe.
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

Prüfung in `werkzeuge/pruefe-regelwerk.js` (neu): Für jede Dorfstufe muss es mindestens **fünf Artikel mit Wirkung** geben, die höchstens drei Tageseinnahmen kosten (heute 90 Münzen), und mindestens **einen größeren Meilenstein** pro Monat Einnahmen. So ist immer etwas erreichbar, und es gibt trotzdem etwas, worauf man spart.

### 16.6 Was es nicht gibt

Keine Käufe gegen Euro, keine Lootboxen, keine Zufallsbelohnungen, keine zeitlich verschwindenden Angebote, keine Verbrauchsgüter, die ohne Nutzung ablaufen, keine Strafen für Pausen.

---

## 17. Bauzyklen

### 17.1 Was alles gebaut wird

| Bereich | Baustellen |
|---|---|
| Rettungsdienst | Stellplatz, Container-Wache, Rettungswache, Lehrrettungswache, 6 Ausbauten |
| Hilfsorganisation | 3 Stufen der Unterkunft, Feldküchen-Unterstand |
| Wasserrettung | Wachturm, Wasserrettungsstation, Steg und Slipanlage |
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
- **Baufirma:** Bleibt bei zwei Kolonnen. Mit den neuen Diensten wird das spürbar. Ein Ausbau **dritte Kolonne** (Spielwert 5 000, ab Dorfstufe 3) wird ein sinnvoller Kauf.

---

## 18. Grafiken

### 18.1 Neue Modelle

| Gruppe | Modelle |
|---|---|
| Gebäude | Rettungswache in 4 Stufen, Unterkunft Hilfsorganisation in 4 Stufen, Wachturm und Wasserrettungsstation, THW-Unterkunft in 4 Stufen, Werkstatt in 5 Stufen, Bauhof in 5 Stufen, Vereinsheim, Sporthalle, Tierarztpraxis, Familienhaus |
| Sportplatz | Bolzwiese mit Toren, Trimm-dich-Stationen, Rasen mit Streifen, Laufbahn mit Bahnlinien, Weitsprunggrube, Tribüne, Kiosk, Flutlichtmasten, Hindernisbahn, Windsack und Landemarkierung |
| Rettungsdienst | KTW, RTW, NEF, Rettungshubschrauber mit drehendem Rotor und aufgewirbeltem Staub bei der Landung, Trage mit zugedeckter Person, Tragestuhl |
| Hilfsorganisation | PKW Helfer vor Ort, MTW, KTW, Gerätewagen, Feldküche mit Dampf, Zelt für Betreuung oder Behandlungsplatz |
| Wasserrettung | Rettungsbrett, Schlauchboot, Motorrettungsboot mit Bugwelle, Bootstrailer, Gerätewagen |
| THW | MTW, Gerätekraftwagen, Radlader, Kipper, Netzersatzanlage, Großpumpe mit Schlauch, Abstützung aus Holz, Lichtmast |
| Werkstatt | Pannenhilfsfahrzeug, Abschleppwagen mit Hubbrille (hebt die Vorderachse an), Plateau (kippt ab, Auto rollt hinauf), Bergewagen mit Drehkran |
| Bauhof | Pritschenwagen, Winterdienstfahrzeug mit Schild und Streuteller (Streusalz als Teilchen), Kehrmaschine, Hubsteiger, Baken und Schranken |
| Bau | Linierwagen, Sämaschine, Fertiger und Walze, Autokran, Ramme auf Ponton, Tieflader |

### 18.2 Figuren und Kleidung

Jede Organisation hat eigene Kleidung, damit man auf der Karte sofort sieht, wer unterwegs ist. Warnkleidung ist im Rettungsdienst und bei Arbeiten im Straßenraum üblich, die genauen Farben je Organisation sind Spielentscheidung.

| Organisation | Kleidung |
|---|---|
| Rettungsdienst | leuchtrot und leuchtgelb mit Reflexstreifen |
| Hilfsorganisation | Rot und Weiß, ohne Zeichen |
| Wasserrettung | Rot und Gelb, Rettungsweste, beim Strömungsretter Trockenanzug und Helm |
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

Grobe Summen der neuen Dienste mit allen Stufen, Fahrzeugen, Ausbauten und je Bewohner Ausbildung und Ausrüstung (Regelwerkspreise, also vor dem Preisfaktor):

| Bereich | Regelwerk | Münzen bei 0,05 | Münzen bei 0,035 |
|---|---|---|---|
| Dorf (Bewohner, Mitgliedschaften, Familienhaus, AED, Leitstelle, Tierarzt) | 60 000 | 3 000 | 2 100 |
| Sportplatz | 160 000 | 8 000 | 5 600 |
| Rettungsdienst | 260 000 | 13 000 | 9 100 |
| Hilfsorganisation | 120 000 | 6 000 | 4 200 |
| Wasserrettung | 110 000 | 5 500 | 3 850 |
| THW | 220 000 | 11 000 | 7 700 |
| Werkstatt und Abschleppdienst | 90 000 | 4 500 | 3 150 |
| Bauhof | 80 000 | 4 000 | 2 800 |
| **Summe** | **1 100 000** | **55 000** | **38 500** |

Bei rund 30 Münzen am Tag sind das 5 bzw. 3,5 Jahre zusätzlich zu den rund 5 Jahren für Feuerwehr und Polizei. **Meine Empfehlung ist 0,035** für die neuen Dienste, zusammen mit der Preisleiter aus 16.5. Die Gesamtdauer ist dabei weniger wichtig als der Rhythmus: Alle ein bis drei Tage ein Kauf mit spürbarer Wirkung, ungefähr einmal im Monat ein großer.

---

## 20. Umsetzung in Etappen

Jede Etappe bringt sofort neue Käufe und endet wie bisher mit Tests, Build, Screenshots und Installation.

| Etappe | Inhalt | Repository | Abnahme |
|---|---|---|---|
| **D1 Bewohner** | Datenmodell Version 2, Berufe, Mitgliedschaften, Alarmkollision, Dorfstufe, Übergang | beide | alter Stand ergibt gleiche Bewertung; nie zwei Einsätze gleichzeitig; Kollision deterministisch |
| **D2 Sportplatz** | Stufen 0 bis 5, Fitness, Training, Wirkung auf Tempo und Atemschutz, Belastungsübung automatisch | beide | Fitness steigt mit Training, Wirkung im Protokoll sichtbar; Screenshot Sportplatz je Stufe |
| **D3 Rettungsdienst** | Nachbarwache, Wache in Stufen, Fahrzeuge, Patienten, Transport, Baum, Erreichungsgrad, Landestelle | beide | Reanimation mit und ohne AED; zweiter Notfall bekommt Nachbarwache; Erreichungsgrad in der Bilanz |
| **D4 Werkstatt und Bauhof** | Abschleppen, Straßensperren, Winterdienst mit Reibwert, Arbeitsplätze im Dorf | beide | gestreute Straße bremst wie nass; Feuerwehrzufahrt früher frei |
| **D5 Wirkungsvorschau** | Route `vorschau`, Empfehlungen, Bedarfsnachweis, Preisleiter-Prüfung | beide | Vorschau stimmt mit nachträglicher Rechnung überein |
| **D6 Hilfsorganisation und Wasserrettung** | Helfer vor Ort, Sanitätswachdienst, Betreuung, Verpflegung, Wachstation, Pegel-Kopplung | beide | Verpflegung verhindert Leistungsabfall; Wachdienst bindet Personen |
| **D7 THW und Nachforderung** | Nachforderung nach Führungsstufe, Fachgruppen | beide | THW kommt nur auf Anforderung; Verzug ohne Führung |
| **D8 Großlagen und Sportplatz 6 bis 8** | Hochwasser, Sturm, Busunfall, Laufbahn, Übungsbahn, Halle mit Becken, Abzeichen | beide | Großlage über mehrere Stunden in unter einer Sekunde fortgeschrieben |

D1 und D2 zuerst, weil der Sportplatz ausdrücklich gewünscht ist und weil die Bewohner die Grundlage für alles Weitere sind.

---

## 21. Änderungen am Regelwerk und an der Simulation (Überblick)

- **Regelwerk:** neue Blöcke `ORGANISATIONEN`, `BERUFE`, `DORFSTUFEN`, `FITNESS`, `SPORTPLATZ`, `PATIENTEN`, `TRANSPORT`, `LEITSTELLE`, `EXTERN` (Grundversorgung je Dienst), `PREISFAKTOR_DIENSTE`. Bestehende Blöcke werden um `org`-Werte erweitert. `LEHRGAENGE`, `FAHRZEUGE`, `GERAETE`, `GEBAEUDE`, `AUSBAU`, `EINSATZARTEN` bekommen Einträge für die neuen Dienste.
- **Einsatzarten:** neues Feld `beteiligte` mit `mindestens` und `optimal` je Organisation, `patienten`, `nachforderung` und `abhaengig_von` (z. B. Transport erst nach Befreiung).
- **Simulation:** Disposition je Organisation mit gemeinsamer Personenbelegung, externe Einheiten mit fester Anfahrt, Patienten und Transport aus der Karte, Schichten, Training als Ereignis, Fitness als Faktor, Wirkungsvorschau als zweiter Aufruf derselben Funktion mit verändertem Stand.
- **Eigenschaften, die Tests absichern müssen** (zusätzlich zu den bisherigen): eine Person nie in zwei Einsätzen, auch über Organisationen; Teile gleich Ganzes auch mit Training und Schichten; Vorschau gleich Nachrechnung; Großlage über 3 Tage unter einer Sekunde.
- **Home Assistant:** neue Option `pegel_entitaet` für den Elbpegel (heute nur im Frontend). Sonst keine neuen Optionen.
- **Prüfwerkzeug:** `pruefe-regelwerk.js` prüft zusätzlich die Preisleiter und dass jeder Artikel eine Wirkung hat.

---

## 22. Spätere Ideen (bewusst nicht im ersten Umfang)

- Psychosoziale Notfallversorgung nach belastenden Einsätzen (positiv gewendet: schnellere Rückkehr in den Dienst, keine Strafe ohne).
- Jugendfeuerwehr und Jugend der Hilfsorganisationen: Kinder der Bewohner werden mit 10 Jahren Mitglied und wechseln mit 16 bis 18 in die Einsatzabteilung.
- Kreisausbildung: Lehrgänge an der Kreisausbildungsstätte mit begrenzten Plätzen im Monat.
- Partnerschaft mit dem Nachbardorf (überörtliche Hilfe in beide Richtungen).

---

## 23. Offene Fragen an dich

1. **Preisfaktor** der neuen Dienste: 0,035 (meine Empfehlung) oder wie bisher 0,05?
2. **Berufe und Tagesalarmsicherheit:** einführen wie in 3.4 (bestehende Kräfte ausgenommen) oder ganz weglassen?
3. **Kopplung an dein Training** (12.6): ja oder nein?
4. **Reihenfolge:** D1 Bewohner und D2 Sportplatz zuerst, dann Rettungsdienst. Einverstanden?
5. **Namen:** generisch („Hilfsorganisation“, „Wasserrettung“) oder echte Namen ohne Logos?
6. **Patienten:** „im Spiel stirbt niemand“ so festschreiben?
7. **Bolzplatz g5** bleibt als Kinder-Bolzplatz bestehen?

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

Verkehr
- [§ 52 StVZO](https://www.anwalt24.de/gesetze/stvzo-1/52)

Nicht im Wortlaut geprüft und deshalb vor der Umsetzung nachzuschlagen: die aktuelle Fassung von § 10 NRettDG und der APVO-RettSan (beide in VORIS), die Rechtsgrundlage für das Abschleppen im NPOG, die genauen Leistungstabellen des Feuerwehr-Fitnessabzeichens und die Maße aus DIN 18035-1 (kostenpflichtige Norm).
