# Freischaltreihe des Einsatzspiels

Wunsch von Alex (17.11.2026): „ab level muss doch weg. ... einsatz nach einsatz in einer logischen, abwechslungsreichen reihenfolge die auch stück für stück andere gebäude einbezieht dlrg oder so die man dann kaufen muss um weiter zu kommen.“

Seit Add-on 0.46.7 gibt es im Einsatzspiel kein Level mehr als Sperre. Alles hängt an einer festen Reihe (`FREISCHALTREIHE` in `lebenswelt/pb_hooks/einsatz/regelwerk.js`), die für Elbe Springs und für die Fitness-Welt (Papa, Lebenswelt Fit) gleich ist.

## Regeln

- **Ein 5-Sterne-Tag** (Tagesdurchschnitt ab 4,9, verfallene Einsätze zählen mit 0) schaltet um Mitternacht den **nächsten Schritt** der Reihe frei. Danach wird die Einsatzart wie bisher kostenlos übernommen.
- **Meilensteine** sind Gebäude, die gebaut werden müssen, um weiterzukommen (Bauhof, Werkstatt, Rettungswache, DRK-Unterkunft, DLRG-Wachstation, THW-Unterkunft, außerdem Wertstoffhof, Deponie und Sportplatz für Einsätze, die sie brauchen). Ein Meilenstein ist erledigt, sobald das Gebäude in der Stufe steht; das prüft die Simulation bei jedem Fortschreiben und bei der Fertigstellung einer Baustelle.
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

Bewusst **am echten Level** bleibt nur die Wirtschaft der Stadt: die Höchstzahl der Einwohner in Elbe Springs (`EINWOHNER.grund + je_level · Level`) und die Stadtgebäude, Deko und Viertel der App. Das Level wird weiter gespeichert (`s.level`), aber im Einsatzspiel nirgends mehr als Sperre verwendet.

## Stand für die App

- `s.reihe`, `s.freischalt_guthaben`, `s.stufe`
- `s.naechste_freischaltung`: Einsatzart, die der nächste 5-Sterne-Tag bringt, oder `null`, wenn ein Meilenstein davor steht (ältere Apps zeigen dann nichts Falsches)
- `s.naechster_schritt`: `{nr, von, id, typ: "einsatz" | "bau" | "grosslage", name, org?, art?, gebaeude?, stufe?, danach?, guthaben}`
- `s.eingeloest`: die letzten eingelösten Guthaben-Tage `{id, zeit}`
- je Tag `tage[tag].gemerkt = true`, wenn der Tag als Guthaben gemerkt wurde

## Die Reihe

Spalte „Stufe“: Stufe des Einsatzspiels, solange dieser Schritt der nächste ist. Die Begründung je Block steht als Kommentar im Regelwerk.

| Nr. | Schritt | Dienst | Art | Stufe | Bemerkung |
| --- | --- | --- | --- | --- | --- |
| 1 | Katze auf Baum (`tier_katze`) | Feuerwehr | Einsatz | 0 | von Anfang an |
| 2 | Ruhestörung bei den Nachbarn (`p_ruhestoerung`) | Polizei | Einsatz | 0 | von Anfang an |
| 3 | Mülltonnenbrand (`b_muelltonne`) | Feuerwehr | Einsatz | 0 | nach Katze auf Baum |
| 4 | Ölspur auf der Fahrbahn (`th_oelspur`) | Feuerwehr | Einsatz | 1 | nach Katze auf Baum |
| 5 | Falschparker in der Feuerwehrzufahrt (`p_falschparker`) | Polizei | Einsatz | 1 | nach Ruhestörung bei den Nachbarn |
| 6 | Heckenbrand (`b_hecke`) | Feuerwehr | Einsatz | 2 | nach Mülltonnenbrand |
| 7 | Hilflose Person (`p_hilflos`) | Polizei | Einsatz | 2 | nach Ruhestörung bei den Nachbarn |
| 8 | Baum auf Straße (`th_baum_strasse`) | Feuerwehr | Einsatz | 3 | nach Ölspur auf der Fahrbahn |
| 9 | Brand im Müllfahrzeug (`b_muellfahrzeug`) | Feuerwehr | Einsatz | 3 | nach Mülltonnenbrand |
| 10 | Verkehrsunfall mit Sachschaden (`p_vu_sachschaden`) | Polizei | Einsatz | 4 | nach Falschparker in der Feuerwehrzufahrt |
| 11 | Wasser im Keller (`th_wasser_keller`) | Feuerwehr | Einsatz | 4 | nach Heckenbrand |
| 12 | Mülltonnenbrand in Serie (`b_brandserie`) | Feuerwehr | Einsatz | 5 | nach Mülltonnenbrand |
| 13 | Wildunfall (`p_wild`) | Polizei | Einsatz | 5 | nach Verkehrsunfall mit Sachschaden |
| 14 | Wertstoffhof mit Containerplatz bauen (deponie Stufe 1) | Gemeinde | Meilenstein | 6 | Meilenstein: Gebäude für die folgenden Einsätze |
| 15 | Brand auf dem Wertstoffhof (`b_wertstoffhof`) | Feuerwehr | Einsatz | 6 | nach Mülltonnenbrand, braucht Wertstoffhof mit Containerplatz |
| 16 | Türöffnung, Person hilflos in Wohnung (`th_tuer`) | Feuerwehr | Einsatz | 7 | nach Hilflose Person |
| 17 | Ladendiebstahl am Markt (`p_ladendiebstahl`) | Polizei | Einsatz | 7 | nach Hilflose Person |
| 18 | Flächenbrand am Deich (`b_flaeche`) | Feuerwehr | Einsatz | 8 | nach Heckenbrand |
| 19 | Graben übergelaufen (`th_graben`) | Feuerwehr | Einsatz | 8 | nach Wasser im Keller |
| 20 | Trunkenheitsfahrt (`p_trunkenheit`) | Polizei | Einsatz | 9 | nach Verkehrsunfall mit Sachschaden |
| 21 | PKW-Brand (`b_pkw`) | Feuerwehr | Einsatz | 9 | nach Heckenbrand |
| 22 | Ölspur nach Unfallflucht (`th_unfallflucht`) | Feuerwehr | Einsatz | 10 | nach Ölspur auf der Fahrbahn |
| 23 | Wohnungseinbruch (`p_einbruch`) | Polizei | Einsatz | 10 | nach Ladendiebstahl am Markt |
| 24 | Person im Aufzug eingeschlossen (`th_aufzug`) | Feuerwehr | Einsatz | 11 | nach Türöffnung, Person hilflos in Wohnung |
| 25 | Rauchmelder piept, niemand öffnet (`rwm`) | Feuerwehr | Einsatz | 11 | nach Türöffnung, Person hilflos in Wohnung |
| 26 | Gemeindearbeiter mit Garage bauen (bauhof Stufe 1) | Bauhof | Meilenstein | 12 | Meilenstein: Bauhof kommt (früher Level 12) |
| 27 | Ast auf dem Gehweg (`bh_ast`) | Bauhof | Einsatz | 12 | erster Einsatz des Dienstes |
| 28 | Kind im Auto eingeschlossen (`th_kind_auto`) | Feuerwehr | Einsatz | 12 | nach Türöffnung, Person hilflos in Wohnung |
| 29 | Glätte: Straßen streuen (`bh_streuen`) | Bauhof | Einsatz | 12 | erster Einsatz des Dienstes |
| 30 | Silvesternacht: Kleinbrände (`silvester`) | Feuerwehr | Einsatz | 12 | nach Heckenbrand |
| 31 | Pannenhilfe-Unterstand bauen (werkstatt Stufe 1) | Werkstatt | Meilenstein | 12 | Meilenstein: Werkstatt und Abschleppdienst kommt (früher Level 12) |
| 32 | Panne auf der Dorfstraße (`ab_panne`) | Werkstatt | Einsatz | 12 | erster Einsatz des Dienstes |
| 33 | Brandmeldeanlage ausgelöst (`bma`) | Feuerwehr | Einsatz | 12 | nach PKW-Brand |
| 34 | PKW im Graben (`ab_graben`) | Werkstatt | Einsatz | 13 | nach Panne auf der Dorfstraße |
| 35 | Verkehrsunfall, Person eingeklemmt (`th_vu`) | Feuerwehr | Einsatz | 13 | nach PKW-Brand |
| 36 | Schlägerei beim Schützenfest (`p_schlaegerei`) | Polizei | Einsatz | 14 | nach Wohnungseinbruch |
| 37 | First Responder: Person bewusstlos (`fr_reanimation`) | Feuerwehr | Einsatz | 14 | nach Türöffnung, Person hilflos in Wohnung |
| 38 | LKW festgefahren bei Glätte (`ab_lkw`) | Werkstatt | Einsatz | 15 | nach PKW im Graben |
| 39 | Gasgeruch im Gebäude (`abc_gas`) | Feuerwehr | Einsatz | 15 | nach Brandmeldeanlage ausgelöst |
| 40 | RTW-Stellplatz am Feuerwehrhaus (Tagdienst) bauen (rettungswache Stufe 1) | Rettungsdienst | Meilenstein | 16 | Meilenstein: Rettungsdienst kommt (früher Level 16) |
| 41 | Krankentransport zur Klinik (`rd_krankentransport`) | Rettungsdienst | Einsatz | 16 | erster Einsatz des Dienstes |
| 42 | Pferd im Graben (`th_pferd`) | Feuerwehr | Einsatz | 16 | nach Verkehrsunfall, Person eingeklemmt |
| 43 | Sturz im Haushalt (`rd_sturz`) | Rettungsdienst | Einsatz | 16 | nach Krankentransport zur Klinik |
| 44 | Allergische Reaktion nach Wespenstich (`rd_wespenstich`) | Rettungsdienst | Einsatz | 16 | nach Krankentransport zur Klinik |
| 45 | Motorradunfall nach Wildwechsel (`th_motorrad`) | Feuerwehr | Einsatz | 17 | nach Verkehrsunfall, Person eingeklemmt |
| 46 | Kreislaufprobleme bei Hitze (`rd_hitze`) | Rettungsdienst | Einsatz | 17 | nach Krankentransport zur Klinik |
| 47 | Vermisstes Kind (`p_vermisst`) | Polizei | Einsatz | 17 | nach Schlägerei beim Schützenfest |
| 48 | Atemnot (`rd_atemnot`) | Rettungsdienst | Einsatz | 17 | nach Sturz im Haushalt |
| 49 | Infektionstransport (`rd_infektion`) | Rettungsdienst | Einsatz | 18 | nach Krankentransport zur Klinik |
| 50 | Zimmerbrand, Menschenleben in Gefahr (`b_wohnung`) | Feuerwehr | Einsatz | 18 | nach Brandmeldeanlage ausgelöst |
| 51 | Fieberkrampf beim Kind (`rd_fieberkrampf`) | Rettungsdienst | Einsatz | 18 | nach Sturz im Haushalt |
| 52 | Brustschmerz (`rd_brustschmerz`) | Rettungsdienst | Einsatz | 18 | nach Atemnot |
| 53 | Trunkenheitsfahrt endet im Graben (`th_trunkenheit`) | Feuerwehr | Einsatz | 19 | nach Verkehrsunfall, Person eingeklemmt |
| 54 | Trimm-dich-Pfad bauen (sportplatz Stufe 3) | Gemeinde | Meilenstein | 19 | Meilenstein: Gebäude für die folgenden Einsätze |
| 55 | Sportverletzung am Sportplatz (`rd_sportverletzung`) | Rettungsdienst | Einsatz | 19 | nach Krankentransport zur Klinik, braucht Trimm-dich-Pfad |
| 56 | Reanimation am Sportplatz (`fr_reanimation_sport`) | Feuerwehr | Einsatz | 19 | nach First Responder: Person bewusstlos |
| 57 | Unterkunft mit Garage bauen (drk_unterkunft Stufe 1) | DRK | Meilenstein | 20 | Meilenstein: DRK-Ortsverein kommt (früher Level 20) |
| 58 | Helfer vor Ort: Person kollabiert (`drk_hvo`) | DRK | Einsatz | 20 | erster Einsatz des Dienstes |
| 59 | Reanimation (`rd_reanimation`) | Rettungsdienst | Einsatz | 20 | nach Brustschmerz |
| 60 | Sanitätswachdienst beim Dorffest (`drk_sanwache`) | DRK | Einsatz | 20 | nach Helfer vor Ort: Person kollabiert |
| 61 | Gasgeruch, Häuser räumen (`abc_raeumung`) | Feuerwehr | Einsatz | 21 | nach Gasgeruch im Gebäude |
| 62 | Verkehrsunfall mit mehreren Verletzten (`th_vu_mehrere`) | Feuerwehr | Einsatz | 21 | nach Verkehrsunfall, Person eingeklemmt |
| 63 | Flutlicht bauen (sportplatz Stufe 6) | Gemeinde | Meilenstein | 21 | Meilenstein: Gebäude für die folgenden Einsätze |
| 64 | Sanitätswachdienst beim Sportfest (`drk_sanwache_sport`) | DRK | Einsatz | 22 | nach Sanitätswachdienst beim Dorffest, braucht Flutlicht |
| 65 | Brand in leerstehendem Haus (`b_leerstand`) | Feuerwehr | Einsatz | 22 | nach Zimmerbrand, Menschenleben in Gefahr |
| 66 | Rinder auf der Straße (`th_rinder`) | Feuerwehr | Einsatz | 22 | nach Pferd im Graben |
| 67 | Deponie mit Sickerwasser- und Gasfassung bauen (deponie Stufe 4) | Gemeinde | Meilenstein | 23 | Meilenstein: Gebäude für die folgenden Einsätze |
| 68 | Brand auf der Deponie (`b_deponie`) | Feuerwehr | Einsatz | 23 | nach Brand auf dem Wertstoffhof, braucht Deponie mit Sickerwasser- und Gasfassung |
| 69 | Scheunenbrand (`b_scheune`) | Feuerwehr | Einsatz | 23 | nach Zimmerbrand, Menschenleben in Gefahr |
| 70 | Wachturm an der Badestelle bauen (wachstation Stufe 1) | DLRG | Meilenstein | 24 | Meilenstein: DLRG-Ortsgruppe kommt (früher Level 24) |
| 71 | Badeunfall an der Elbe (`dlrg_badeunfall`) | DLRG | Einsatz | 24 | erster Einsatz des Dienstes |
| 72 | Person im Eis eingebrochen (`th_eis`) | Feuerwehr | Einsatz | 24 | nach Wasser im Keller |
| 73 | Boot treibt manövrierunfähig (`dlrg_boot`) | DLRG | Einsatz | 25 | nach Badeunfall an der Elbe |
| 74 | Person in der Elbe (`th_person_wasser`) | Feuerwehr | Einsatz | 25 | nach Person im Eis eingebrochen |
| 75 | Person auf dem Stalldach verletzt (`th_stalldach`) | Feuerwehr | Einsatz | 25 | nach Scheunenbrand |
| 76 | Evakuierung bei Hochwasser (`dlrg_hochwasser`) | DLRG | Einsatz | 26 | nach Boot treibt manövrierunfähig |
| 77 | LKW verliert Flüssigkeit (Gefahrgut) (`abc_lkw`) | Feuerwehr | Einsatz | 26 | nach Gasgeruch im Gebäude |
| 78 | Unterkunft des Ortsverbands bauen (thw_unterkunft Stufe 1) | THW | Meilenstein | 27 | Meilenstein: THW-Ortsverband kommt (früher Level 27) |
| 79 | Deichverteidigung bei Elbhochwasser (`th_deich`) | Feuerwehr | Einsatz | 28 | nach Scheunenbrand |
| 80 | Stromausfall im Ortsteil (`th_stromausfall`) | Feuerwehr | Einsatz | 29 | nach Baum auf Straße |
| 81 | Dorffest-Wochenende (`gl_dorffest`) | Feuerwehr | Großlage | 30 | mit Polizei, DRK, Werkstatt |
| 82 | Großlage Sturm im ganzen Dorf (`gl_sturm`) | Feuerwehr | Großlage | 30 | mit Polizei, Rettungsdienst, DRK, Bauhof, Werkstatt, THW |
| 83 | Großlage Scheunenbrand mit Stromausfall (`gl_grossbrand`) | Feuerwehr | Großlage | 30 | mit Polizei, Rettungsdienst, DRK, THW |
| 84 | Großlage Busunfall mit vielen Verletzten (`gl_busunfall`) | Feuerwehr | Großlage | 30 | mit Polizei, Rettungsdienst, DRK, Werkstatt, THW |
| 85 | Großlage Elbhochwasser (`gl_hochwasser`) | Feuerwehr | Großlage | 30 | mit Polizei, DLRG, DRK, Rettungsdienst, Bauhof, THW |
