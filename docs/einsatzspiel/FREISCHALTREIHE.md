# Freischaltreihe des Einsatzspiels

Wunsch von Alex (17.11.2026): „ab level muss doch weg. ... einsatz nach einsatz in einer logischen, abwechslungsreichen reihenfolge die auch stück für stück andere gebäude einbezieht dlrg oder so die man dann kaufen muss um weiter zu kommen.“

Seit Add-on 0.46.7 gibt es im Einsatzspiel kein Level mehr als Sperre. Alles hängt an einer festen Reihe (`FREISCHALTREIHE` in `lebenswelt/pb_hooks/einsatz/regelwerk.js`), die für Elbe Springs und für die Fitness-Welt (Papa, Lebenswelt Fit) gleich ist.

## Regeln

- **Ein 5-Sterne-Tag** (Tagesdurchschnitt ab 4,9, verfallene Einsätze zählen mit 0) schaltet um Mitternacht den **nächsten Schritt** der Reihe frei. Danach wird die Einsatzart wie bisher kostenlos übernommen.
- **Meilensteine** sind Pflicht, um weiterzukommen. Drei Arten:
  - **Gebäude** (Bauhof, Werkstatt, Rettungswache, DRK-Unterkunft, DLRG-Wachstation, THW-Unterkunft, Polizeistation, außerdem Wertstoffhof, Deponie und Sportplatz für Einsätze, die sie brauchen), bei Diensten mit Personal zusammen mit so vielen Kräften dort.
  - **Einsatzkräfte** („Feuerwehr: 9 Einsatzkräfte“): so viele Mitglieder des Dienstes (auch mit zweiter Mitgliedschaft). Für die Feuerwehr heißt das Wohnhäuser bzw. Einliegerwohnungen, für Polizei, Werkstatt, Bauhof und Rettungsdienst Personal einstellen, für DRK, DLRG und THW Bewohner treten bei. Maßstab ist `mindestens.personen` der folgenden Einsätze und ihrer Folgeeinsätze: Ohne eigene Leute käme nur die Hilfe von außen mit höchstens 3 Sternen, ein Schnitt von 4,9 wäre so nicht möglich.
  - **Viertel erschließen** (Wunsch von Alex vom 17.11.2026, „blockausbau ... die müssen pflicht sein“): Kirchweg vor dem Aufzug-Einsatz (Arztpraxis), Gewerbe vor Bauhof und Werkstatt (dort stehen sie), Wohnviertel 2 vor 20 Feuerwehrleuten (im ersten Wohnviertel ist Platz für 9 Häuser, mit Einliegerwohnung 18 Bewohner). Freizeit und Land hängt an keinem Einsatz und ist deshalb kein Meilenstein, man kann es ab Stufe 24 freiwillig erschließen; Kirchweg und Gewerbe ab Stufe 7, Wohnviertel 2 ab 8 auch vor ihrem Meilenstein. Preise wie die Ringe der Gebiete im Nebel: Kirchweg und Gewerbe 300, Wohnviertel 2 600, Freizeit 1000 Münzen. In noch nicht erschlossenen Vierteln entsteht kein Einsatz und wird nichts gebaut. Der Hafen ist von Anfang an da.
- Ein Meilenstein ist erledigt, sobald alles da ist; das prüft die Simulation bei jedem Fortschreiben, beim Kauf und bei der Fertigstellung einer Baustelle (auch beim Einzug in ein neues Haus).
- **Guthaben:** Ein 5-Sterne-Tag vor einem offenen Meilenstein verfällt nicht, er wird gemerkt (höchstens 3, `REIHE_GUTHABEN_MAX`) und eingelöst, sobald das Gebäude fertig ist: Die nächsten Einsätze werden sofort freigeschaltet, bis zum nächsten Meilenstein.
- **Nichts wird übersprungen.** Was schon freigeschaltet oder aktiv ist (auch aus älteren Ständen), zählt als erledigt; der Zeiger steht auf dem ersten offenen Schritt.
- **Organisationen** gibt es erst, wenn die Reihe ihren Meilenstein erreicht hat. Dann sind sie mit der Grundversorgung von außen da (RTW der Nachbarwache, Abschleppdienst aus der Stadt) und ihr Gebäude ist im Shop zu kaufen. Ein Gebäude, das ein älterer Stand schon gebaut hat, bleibt nutzbar und zählt als erledigter Meilenstein.
- **Großlagen** stehen am Ende der Reihe, je eine pro 5-Sterne-Tag. Das Freischalten aktiviert sie (sie werden nicht gekauft). Dann sind alle Dienste da. Der Bombenfund hängt weiter an Baustellen und kommt ab Stufe 30. Baustellen- und Folgeeinsätze stehen nicht in der Reihe.

## Stufe statt Level

Die vielen alten Grenzen im Regelwerk (`ab_level` bei Fahrzeugen, Gebäudestufen, Ausbauten, Sirenen, Gebieten, Krankenhaus, Sportverein) bleiben als Zahlen stehen, gemeint ist jetzt aber die **Stufe der Reihe** (`s.stufe`, 0 bis 30). Sie folgt nur aus dem Fortschritt (`s.reihe`, Index des nächsten Schritts) und steigt zwischen festen Ankern gleichmäßig:

| Anker | Stufe |
| --- | --- |
| Start | 0 |
| Meilenstein Bauhof, Meilenstein Werkstatt | 12 |
| Meilenstein Rettungswache | 16 |
| Meilenstein DRK-Unterkunft | 20 |
| Meilenstein DLRG-Wachstation | 24 (auch das Krankenhaus) |
| Meilenstein THW-Unterkunft | 27 |
| erste Großlage bis Ende | 30 |

So bleiben die Zahlen im Regelwerk gültig, und ein Gebäude ist an seinem Meilenstein immer baubar. Der Zeitpunkt ist jetzt ein Schritt der Reihe: Die App zeigt „kommt nach: <Schritt>“ statt „ab Level N“.

Bewusst **am echten Level** bleibt nur die Wirtschaft der Stadt: die Höchstzahl der Einwohner in Elbe Springs (`EINWOHNER.grund + je_level · Level`, aber nie weniger, als die Reihe bis zum nächsten Schritt an Kräften verlangt) und die Stadtgebäude, Deko, Tiere und Viertel-Ausbaustufen der App. Welche Viertel es gibt, hängt nicht mehr am Level, sondern an `s.viertel`.

## Viertel

- `s.viertel`: erschlossene Viertel (`kirche`, `gewerbe`, `wohnen2`, `freizeit`), Kauf `{art: "erschliessung", id}`. Lage und Straßen stehen in der App (`app/src/stadt/raster.ts`), sie liest `s.viertel` (mit älterem Add-on wie früher das Level).
- Übernahme alter Stände (einmal, wenn `s.viertel` fehlt): offen ist, was die App bisher nach dem Level zeigte (Kirchweg und Gewerbe ab Level 7, Wohnviertel 2 ab 8, Freizeit ab 24), dazu jedes Viertel, in dem schon etwas steht (Werkstatt, Bauhof oder THW im Gewerbe, mehr als 9 Wohnhäuser). Danach hängt nichts mehr am Level. Neue Stände beginnen mit `viertel: []`. Das Level wird weiter gespeichert (`s.level`), aber im Einsatzspiel nirgends mehr als Sperre verwendet.

## Stand für die App

- `s.reihe`, `s.freischalt_guthaben`, `s.stufe`
- `s.naechste_freischaltung`: Einsatzart, die der nächste 5-Sterne-Tag bringt, oder `null`, wenn ein Meilenstein davor steht (ältere Apps zeigen dann nichts Falsches)
- `s.naechster_schritt`: `{nr, von, id, typ: "einsatz" | "bau" | "grosslage" | "kraefte" | "viertel", name, org?, art?, gebaeude?, stufe?, kraefte?, kraefte_jetzt?, viertel?, preis?, danach?, guthaben}`
- `s.viertel`: erschlossene Viertel
- `s.eingeloest`: die letzten eingelösten Guthaben-Tage `{id, zeit}`
- je Tag `tage[tag].gemerkt = true`, wenn der Tag als Guthaben gemerkt wurde

## Die Reihe

Spalte „Stufe“: Stufe des Einsatzspiels, solange dieser Schritt der nächste ist. Die Begründung je Block steht als Kommentar im Regelwerk.

| Nr. | Schritt | Dienst | Art | Stufe | Bemerkung |
| --- | --- | --- | --- | --- | --- |
| 1 | Katze auf Baum (`tier_katze`) | Feuerwehr | Einsatz | 0 | von Anfang an, mindestens 1 Kräfte |
| 2 | Polizei: 1 Einsatzkraft | Polizei | Meilenstein Kräfte | 0 | Personal einstellen |
| 3 | Ruhestörung bei den Nachbarn (`p_ruhestoerung`) | Polizei | Einsatz | 0 | von Anfang an, mindestens 1 Kräfte |
| 4 | Mülltonnenbrand (`b_muelltonne`) | Feuerwehr | Einsatz | 1 | nach Katze auf Baum, mindestens 1 Kräfte |
| 5 | Ölspur auf der Fahrbahn (`th_oelspur`) | Feuerwehr | Einsatz | 1 | nach Katze auf Baum, mindestens 2 Kräfte |
| 6 | Falschparker in der Feuerwehrzufahrt (`p_falschparker`) | Polizei | Einsatz | 2 | nach Ruhestörung bei den Nachbarn, mindestens 1 Kräfte |
| 7 | Heckenbrand (`b_hecke`) | Feuerwehr | Einsatz | 2 | nach Mülltonnenbrand, mindestens 2 Kräfte |
| 8 | Polizeistation bauen (dienststelle Stufe 1) und 2 Kräfte | Polizei | Meilenstein Gebäude und Kräfte | 2 | für die folgenden Einsätze |
| 9 | Hilflose Person (`p_hilflos`) | Polizei | Einsatz | 3 | nach Ruhestörung bei den Nachbarn, mindestens 2 Kräfte |
| 10 | Baum auf Straße (`th_baum_strasse`) | Feuerwehr | Einsatz | 3 | nach Ölspur auf der Fahrbahn, mindestens 2 Kräfte |
| 11 | Brand im Müllfahrzeug (`b_muellfahrzeug`) | Feuerwehr | Einsatz | 4 | nach Mülltonnenbrand, mindestens 2 Kräfte |
| 12 | Verkehrsunfall mit Sachschaden (`p_vu_sachschaden`) | Polizei | Einsatz | 4 | nach Falschparker in der Feuerwehrzufahrt, mindestens 2 Kräfte |
| 13 | Wasser im Keller (`th_wasser_keller`) | Feuerwehr | Einsatz | 4 | nach Heckenbrand, mindestens 2 Kräfte |
| 14 | Mülltonnenbrand in Serie (`b_brandserie`) | Feuerwehr | Einsatz | 5 | nach Mülltonnenbrand, mindestens 1 Kräfte |
| 15 | Wildunfall (`p_wild`) | Polizei | Einsatz | 5 | nach Verkehrsunfall mit Sachschaden, mindestens 1 Kräfte |
| 16 | Wertstoffhof mit Containerplatz bauen (deponie Stufe 1) | Gemeinde | Meilenstein Gebäude | 6 | für die folgenden Einsätze |
| 17 | Feuerwehr: 4 Einsatzkräfte | Feuerwehr | Meilenstein Kräfte | 6 | Wohnhäuser bzw. Einliegerwohnungen |
| 18 | Brand auf dem Wertstoffhof (`b_wertstoffhof`) | Feuerwehr | Einsatz | 6 | nach Mülltonnenbrand, mindestens 4 Kräfte, braucht Wertstoffhof mit Containerplatz |
| 19 | Ladendiebstahl am Markt (`p_ladendiebstahl`) | Polizei | Einsatz | 7 | nach Hilflose Person, mindestens 2 Kräfte |
| 20 | Türöffnung, Person hilflos in Wohnung (`th_tuer`) | Feuerwehr | Einsatz | 7 | nach Hilflose Person, mindestens 2 Kräfte |
| 21 | Flächenbrand am Deich (`b_flaeche`) | Feuerwehr | Einsatz | 8 | nach Heckenbrand, mindestens 4 Kräfte |
| 22 | Trunkenheitsfahrt (`p_trunkenheit`) | Polizei | Einsatz | 8 | nach Verkehrsunfall mit Sachschaden, mindestens 2 Kräfte |
| 23 | Graben übergelaufen (`th_graben`) | Feuerwehr | Einsatz | 8 | nach Wasser im Keller, mindestens 2 Kräfte |
| 24 | PKW-Brand (`b_pkw`) | Feuerwehr | Einsatz | 9 | nach Heckenbrand, mindestens 4 Kräfte |
| 25 | Wohnungseinbruch (`p_einbruch`) | Polizei | Einsatz | 9 | nach Ladendiebstahl am Markt, mindestens 2 Kräfte |
| 26 | Ölspur nach Unfallflucht (`th_unfallflucht`) | Feuerwehr | Einsatz | 10 | nach Ölspur auf der Fahrbahn, mindestens 2 Kräfte |
| 27 | Kirchweg erschließen | Gemeinde | Meilenstein Viertel | 10 | Kirche, Arztpraxis und der Deichkrug, 300 Münzen |
| 28 | Person im Aufzug eingeschlossen (`th_aufzug`) | Feuerwehr | Einsatz | 10 | nach Türöffnung, Person hilflos in Wohnung, mindestens 2 Kräfte |
| 29 | Rauchmelder piept, niemand öffnet (`rwm`) | Feuerwehr | Einsatz | 11 | nach Türöffnung, Person hilflos in Wohnung, mindestens 3 Kräfte |
| 30 | Gewerbe erschließen | Gemeinde | Meilenstein Viertel | 11 | Tankstelle, Werkstatt und Bauhof, 300 Münzen |
| 31 | Gemeindearbeiter mit Garage bauen (bauhof Stufe 1) und 1 Kraft | Bauhof | Meilenstein Gebäude und Kräfte | 12 | Bauhof kommt (früher Level 12) |
| 32 | Ast auf dem Gehweg (`bh_ast`) | Bauhof | Einsatz | 12 | erster Einsatz des Dienstes, mindestens 1 Kräfte |
| 33 | Kind im Auto eingeschlossen (`th_kind_auto`) | Feuerwehr | Einsatz | 12 | nach Türöffnung, Person hilflos in Wohnung, mindestens 1 Kräfte |
| 34 | Glätte: Straßen streuen (`bh_streuen`) | Bauhof | Einsatz | 12 | erster Einsatz des Dienstes, mindestens 1 Kräfte |
| 35 | Silvesternacht: Kleinbrände (`silvester`) | Feuerwehr | Einsatz | 12 | nach Heckenbrand, mindestens 1 Kräfte |
| 36 | Pannenhilfe-Unterstand bauen (werkstatt Stufe 1) und 1 Kraft | Werkstatt | Meilenstein Gebäude und Kräfte | 12 | Werkstatt und Abschleppdienst kommt (früher Level 12) |
| 37 | Panne auf der Dorfstraße (`ab_panne`) | Werkstatt | Einsatz | 12 | erster Einsatz des Dienstes, mindestens 1 Kräfte |
| 38 | Brandmeldeanlage ausgelöst (`bma`) | Feuerwehr | Einsatz | 12 | nach PKW-Brand, mindestens 4 Kräfte |
| 39 | PKW im Graben (`ab_graben`) | Werkstatt | Einsatz | 13 | nach Panne auf der Dorfstraße, mindestens 1 Kräfte |
| 40 | Feuerwehr: 6 Einsatzkräfte | Feuerwehr | Meilenstein Kräfte | 13 | Wohnhäuser bzw. Einliegerwohnungen |
| 41 | Verkehrsunfall, Person eingeklemmt (`th_vu`) | Feuerwehr | Einsatz | 13 | nach PKW-Brand, mindestens 6 Kräfte |
| 42 | Polizei: 4 Einsatzkräfte | Polizei | Meilenstein Kräfte | 14 | Personal einstellen |
| 43 | Schlägerei beim Schützenfest (`p_schlaegerei`) | Polizei | Einsatz | 14 | nach Wohnungseinbruch, mindestens 4 Kräfte |
| 44 | First Responder: Person bewusstlos (`fr_reanimation`) | Feuerwehr | Einsatz | 14 | nach Türöffnung, Person hilflos in Wohnung, mindestens 2 Kräfte |
| 45 | Kfz-Werkstatt mit Abschleppwagen bauen (werkstatt Stufe 2) und 2 Kräfte | Werkstatt | Meilenstein Gebäude und Kräfte | 15 | für die folgenden Einsätze |
| 46 | LKW festgefahren bei Glätte (`ab_lkw`) | Werkstatt | Einsatz | 15 | nach PKW im Graben, mindestens 2 Kräfte |
| 47 | Gasgeruch im Gebäude (`abc_gas`) | Feuerwehr | Einsatz | 15 | nach Brandmeldeanlage ausgelöst, mindestens 6 Kräfte |
| 48 | RTW-Stellplatz am Feuerwehrhaus (Tagdienst) bauen (rettungswache Stufe 1) und 2 Kräfte | Rettungsdienst | Meilenstein Gebäude und Kräfte | 16 | Rettungsdienst kommt (früher Level 16) |
| 49 | Krankentransport zur Klinik (`rd_krankentransport`) | Rettungsdienst | Einsatz | 16 | erster Einsatz des Dienstes, mindestens 2 Kräfte |
| 50 | Pferd im Graben (`th_pferd`) | Feuerwehr | Einsatz | 16 | nach Verkehrsunfall, Person eingeklemmt, mindestens 6 Kräfte |
| 51 | Sturz im Haushalt (`rd_sturz`) | Rettungsdienst | Einsatz | 16 | nach Krankentransport zur Klinik, mindestens 2 Kräfte |
| 52 | Allergische Reaktion nach Wespenstich (`rd_wespenstich`) | Rettungsdienst | Einsatz | 16 | nach Krankentransport zur Klinik, mindestens 2 Kräfte |
| 53 | Motorradunfall nach Wildwechsel (`th_motorrad`) | Feuerwehr | Einsatz | 17 | nach Verkehrsunfall, Person eingeklemmt, mindestens 2 Kräfte |
| 54 | Kreislaufprobleme bei Hitze (`rd_hitze`) | Rettungsdienst | Einsatz | 17 | nach Krankentransport zur Klinik, mindestens 2 Kräfte |
| 55 | Vermisstes Kind (`p_vermisst`) | Polizei | Einsatz | 17 | nach Schlägerei beim Schützenfest, mindestens 4 Kräfte |
| 56 | Atemnot (`rd_atemnot`) | Rettungsdienst | Einsatz | 17 | nach Sturz im Haushalt, mindestens 2 Kräfte |
| 57 | Infektionstransport (`rd_infektion`) | Rettungsdienst | Einsatz | 18 | nach Krankentransport zur Klinik, mindestens 2 Kräfte |
| 58 | Feuerwehr: 9 Einsatzkräfte | Feuerwehr | Meilenstein Kräfte | 18 | Wohnhäuser bzw. Einliegerwohnungen |
| 59 | Zimmerbrand, Menschenleben in Gefahr (`b_wohnung`) | Feuerwehr | Einsatz | 18 | nach Brandmeldeanlage ausgelöst, mindestens 9 Kräfte |
| 60 | Fieberkrampf beim Kind (`rd_fieberkrampf`) | Rettungsdienst | Einsatz | 18 | nach Sturz im Haushalt, mindestens 2 Kräfte |
| 61 | Brustschmerz (`rd_brustschmerz`) | Rettungsdienst | Einsatz | 18 | nach Atemnot, mindestens 2 Kräfte |
| 62 | Trunkenheitsfahrt endet im Graben (`th_trunkenheit`) | Feuerwehr | Einsatz | 19 | nach Verkehrsunfall, Person eingeklemmt, mindestens 2 Kräfte |
| 63 | Trimm-dich-Pfad bauen (sportplatz Stufe 3) | Gemeinde | Meilenstein Gebäude | 19 | für die folgenden Einsätze |
| 64 | Sportverletzung am Sportplatz (`rd_sportverletzung`) | Rettungsdienst | Einsatz | 19 | nach Krankentransport zur Klinik, mindestens 2 Kräfte, braucht Trimm-dich-Pfad |
| 65 | Reanimation am Sportplatz (`fr_reanimation_sport`) | Feuerwehr | Einsatz | 19 | nach First Responder: Person bewusstlos, mindestens 2 Kräfte |
| 66 | Unterkunft mit Garage bauen (drk_unterkunft Stufe 1) und 2 Kräfte | DRK | Meilenstein Gebäude und Kräfte | 20 | DRK-Ortsverein kommt (früher Level 20) |
| 67 | Helfer vor Ort: Person kollabiert (`drk_hvo`) | DRK | Einsatz | 20 | erster Einsatz des Dienstes, mindestens 1 Kräfte |
| 68 | Reanimation (`rd_reanimation`) | Rettungsdienst | Einsatz | 20 | nach Brustschmerz, mindestens 2 Kräfte |
| 69 | Sanitätswachdienst beim Dorffest (`drk_sanwache`) | DRK | Einsatz | 20 | nach Helfer vor Ort: Person kollabiert, mindestens 2 Kräfte |
| 70 | Gasgeruch, Häuser räumen (`abc_raeumung`) | Feuerwehr | Einsatz | 21 | nach Gasgeruch im Gebäude, mindestens 6 Kräfte |
| 71 | Verkehrsunfall mit mehreren Verletzten (`th_vu_mehrere`) | Feuerwehr | Einsatz | 21 | nach Verkehrsunfall, Person eingeklemmt, mindestens 6 Kräfte |
| 72 | Flutlicht bauen (sportplatz Stufe 6) | Gemeinde | Meilenstein Gebäude | 21 | für die folgenden Einsätze |
| 73 | Sanitätswachdienst beim Sportfest (`drk_sanwache_sport`) | DRK | Einsatz | 21 | nach Sanitätswachdienst beim Dorffest, mindestens 2 Kräfte, braucht Flutlicht |
| 74 | Brand in leerstehendem Haus (`b_leerstand`) | Feuerwehr | Einsatz | 22 | nach Zimmerbrand, Menschenleben in Gefahr, mindestens 6 Kräfte |
| 75 | Rinder auf der Straße (`th_rinder`) | Feuerwehr | Einsatz | 22 | nach Pferd im Graben, mindestens 3 Kräfte |
| 76 | Deponie mit Sickerwasser- und Gasfassung bauen (deponie Stufe 4) | Gemeinde | Meilenstein Gebäude | 22 | für die folgenden Einsätze |
| 77 | Brand auf der Deponie (`b_deponie`) | Feuerwehr | Einsatz | 22 | nach Brand auf dem Wertstoffhof, mindestens 9 Kräfte, braucht Deponie mit Sickerwasser- und Gasfassung |
| 78 | Wohnviertel 2 erschließen | Gemeinde | Meilenstein Viertel | 23 | sechs weitere Wohnhäuser an der Mittelstraße, 600 Münzen |
| 79 | Feuerwehr: 20 Einsatzkräfte | Feuerwehr | Meilenstein Kräfte | 23 | Wohnhäuser bzw. Einliegerwohnungen |
| 80 | Scheunenbrand (`b_scheune`) | Feuerwehr | Einsatz | 23 | nach Zimmerbrand, Menschenleben in Gefahr, mindestens 18 Kräfte |
| 81 | Wachturm an der Badestelle bauen (wachstation Stufe 1) und 4 Kräfte | DLRG | Meilenstein Gebäude und Kräfte | 24 | DLRG-Ortsgruppe kommt (früher Level 24) |
| 82 | Badeunfall an der Elbe (`dlrg_badeunfall`) | DLRG | Einsatz | 24 | erster Einsatz des Dienstes, mindestens 2 Kräfte |
| 83 | Person im Eis eingebrochen (`th_eis`) | Feuerwehr | Einsatz | 24 | nach Wasser im Keller, mindestens 3 Kräfte |
| 84 | Boot treibt manövrierunfähig (`dlrg_boot`) | DLRG | Einsatz | 25 | nach Badeunfall an der Elbe, mindestens 3 Kräfte |
| 85 | Person in der Elbe (`th_person_wasser`) | Feuerwehr | Einsatz | 25 | nach Person im Eis eingebrochen, mindestens 3 Kräfte |
| 86 | Person auf dem Stalldach verletzt (`th_stalldach`) | Feuerwehr | Einsatz | 25 | nach Scheunenbrand, mindestens 4 Kräfte |
| 87 | Evakuierung bei Hochwasser (`dlrg_hochwasser`) | DLRG | Einsatz | 26 | nach Boot treibt manövrierunfähig, mindestens 4 Kräfte |
| 88 | LKW verliert Flüssigkeit (Gefahrgut) (`abc_lkw`) | Feuerwehr | Einsatz | 26 | nach Gasgeruch im Gebäude, mindestens 6 Kräfte |
| 89 | Unterkunft des Ortsverbands bauen (thw_unterkunft Stufe 1) und 4 Kräfte | THW | Meilenstein Gebäude und Kräfte | 27 | THW-Ortsverband kommt (früher Level 27) |
| 90 | Deichverteidigung bei Elbhochwasser (`th_deich`) | Feuerwehr | Einsatz | 27 | nach Scheunenbrand, mindestens 20 Kräfte |
| 91 | Stromausfall im Ortsteil (`th_stromausfall`) | Feuerwehr | Einsatz | 28 | nach Baum auf Straße, mindestens 2 Kräfte |
| 92 | DRK: 4 Einsatzkräfte | DRK | Meilenstein Kräfte | 29 | Mitglieder aus den Bewohnern |
| 93 | Dorffest-Wochenende (`gl_dorffest`) | Feuerwehr | Großlage | 30 | mit Polizei, DRK, Werkstatt, mindestens 2 Kräfte |
| 94 | Großlage Sturm im ganzen Dorf (`gl_sturm`) | Feuerwehr | Großlage | 30 | mit Polizei, Rettungsdienst, DRK, Bauhof, Werkstatt, THW, mindestens 6 Kräfte |
| 95 | Großlage Scheunenbrand mit Stromausfall (`gl_grossbrand`) | Feuerwehr | Großlage | 30 | mit Polizei, Rettungsdienst, DRK, THW, mindestens 9 Kräfte |
| 96 | Großlage Busunfall mit vielen Verletzten (`gl_busunfall`) | Feuerwehr | Großlage | 30 | mit Polizei, Rettungsdienst, DRK, Werkstatt, THW, mindestens 9 Kräfte |
| 97 | Großlage Elbhochwasser (`gl_hochwasser`) | Feuerwehr | Großlage | 30 | mit Polizei, DLRG, DRK, Rettungsdienst, Bauhof, THW, mindestens 9 Kräfte |
