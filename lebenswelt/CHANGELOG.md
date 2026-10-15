# Änderungen

## 0.22.0

- Wird ein Vorgang erledigt (App, Claude, jede Route), werden seine offenen Aufgaben, Teilaufgaben (`eltern` ist eine Aufgabe des Vorgangs) und Unteraufgaben ebenfalls erledigt. Sie bekommen `xp_offen: true` und `erledigt_durch: "vorgang"`, die App bucht die XP wie bei einzeln abgehakten Aufgaben.
- Einmaliger Nachtrag (Migration): dasselbe für alle Vorgänge, die schon erledigt sind.
- Einsatzspiel, echte Wetterwarnungen des Deutschen Wetterdienstes (`DWD_WARNUNGEN`): Die Sensoren der Home-Assistant-Integration „DWD Weather Warnings“ werden alle 10 Minuten gelesen (Option `warn_entitaet`, sonst automatisch gefunden). Eine Warnung setzt für ihre Dauer das Spielwetter (Glätte, Schnee, Sturm ab markantem Wetter, Starkregen) und setzt bei Beginn passende Einsätze an: Sturm bringt Baum auf der Straße und Ast auf dem Gehweg, bei Unwetter auch Stromausfall und die Sturm-Großlage (ab Level 30); Glätte bringt Streuen und Unfälle; Starkregen Wasser im Keller. Nur gekaufte Einsatzarten, jede Warnung wirkt einmal.
- `GET /api/lebenswelt/einsatz/stand` liefert die gerade geltenden Warnungen (`warnungen`).

## 0.21.0

- Einsatzspiel, Sirenen im Dorf (`SIRENEN`): Die Motorsirene am Feuerwehrhaus bleibt, dazu kommen Standorte an Grundschule, Marktplatz, Deich, Werkstatt und Sportplatz (freigeschaltet ab Level 4, 7, 11, 15 und 19). Jeder Standort wird in drei Stufen gebaut: Motorsirene, elektronische Sirene mit Akku und Sprachdurchsage, Hochleistungssirene mit digitaler Auslösung durch die Leitstelle. Mehr Reichweite und weniger Auslöseverzug je Stufe.
- Wer mit der Sirene alarmiert wird, reagiert je nachdem, wie gut die nächste Sirene am Haus (oder am Arbeitsplatz) zu hören ist: nah am schnellsten, am Rand schneller, außer Reichweite wie bisher (90 s). Nachts (22 bis 6 Uhr) bringt eine entfernte Sirene weniger, langsamer als bisher wird es nie. Meldeempfänger und App hängen nicht von Sirenen ab.
- Warnung der Bevölkerung: Bei Elbhochwasser, Bombenfund und Scheunenbrand mit Stromausfall wird schneller geräumt, je mehr vom Dorf die Sirenen erreichen. Bei Stromausfall heulen nur Sirenen mit Akku.
- Die elektronische Sirene am Feuerwehrhaus (`sirene_neu`) ist jetzt die zweite Stufe dieses Standorts. Sie wirkt nur noch auf Kräfte mit Sirenenalarm und nicht mehr pauschal auf alle.
- Ausbauten können eine Voraussetzung haben (`voraussetzung`).

## 0.20.0

- Einsatzspiel, Nachttest im Vollausbau (Level 30, 44 Feuerwehrleute, 42 Fahrzeuge, bis zu 19 Einsätze gleichzeitig):
  - Schneller: Wege werden zwischengespeichert, die Fahrzeugauswahl prüft das Gerät vorab. Ein Spieltag rechnet sich in unter einer Sekunde statt in fast zehn.
  - Auswahl nach Fertigzeit: Unter allen passenden Besetzungen gewinnt die, die am frühesten fertig ist (mit etwas Spielraum, dann weniger Fahrzeuge, mehr Leute). Vorher ging bei voller Wehr oft ein Trupp zu Fuß, obwohl ein Fahrzeug viel schneller gewesen wäre (Hecke, Mülltonne, Katze jetzt meist 5 statt 2 bis 4 Sterne).
  - Mülltonne, Brandserie und Silvester gehen auch mit einem Fahrzeug mit Wasser und Strahlrohr (Schnellangriff).
  - Absichern, Ausleuchten und Verkehrsregelung werden nach dem Eintreffen bewertet, nicht nach der Dauer des Auslösers.
  - Der Helfer vor Ort (HvO) wird nur alarmiert, wenn er vor dem Rettungswagen da ist.
  - Fehler behoben: Absturz der Auswahl bei bestimmten Wohnungsbränden.
- Heimweg nach dem Einsatz: Die Kräfte gehen oder fahren vom Gerätehaus nach Hause (`zurueck_fw`). Kommt unterwegs ein neuer Alarm, starten sie dort, wo sie gerade sind (`ZEITEN.heimweg_tempo`).
- Nachbarhilfe (`NACHBARHILFE`): Ist für einen ernsten Feuerwehreinsatz 30 Minuten niemand frei (tagsüber sind viele auf der Arbeit), übernimmt die Nachbarfeuerwehr mit 15 Minuten Anfahrt, höchstens ein Stern. Vorher konnte ein Wohnungsbrand werktags acht Stunden warten.
- Kein zweiter Einsatz an einem Ort, an dem schon einer läuft, auch nicht über Schutzzonen hinweg (zwei Heckenbrände an derselben Stelle).
- Wartende Einsätze werden alle 15 Minuten neu geprüft (`VERFALL.raster_min`).

## 0.19.0

- Einsatzspiel, zufällige Einsatzorte: Einsatzarten mit `ort_gruppen` treten außer an ihren festen Orten auch an Zufallsorten der Karte auf (`ZUFALLSORTE`, von der privaten Karte geliefert). Katze im Baum in allen Bäumen an freien Grünflächen (`baum`), Unfälle, Pannen, Ölspur, Wild, Streuen und andere Straßeneinsätze auf allen Straßen (`strasse`). Ohne Karte bleibt alles wie bisher.
- `ortName` für lesbare Ortsnamen (auch in Push-Nachrichten), `orteVon` für alle Orte einer Einsatzart.

## 0.18.0

- Einsatzspiel, Weg zum Gerätehaus: Zu Fuß und mit dem Rad geht es über den Gehweg entlang der Straßen (`fussroute`), abgekürzt wird nur am Anfang und am Ende über Hof oder Platz, höchstens `ZEITEN.abkuerzung_max` (30 Einheiten, etwa 90 m). Mit dem Auto über die Straße (`strassenroute`), nicht mehr quer durch Gärten. Auch der Trupp zu Fuß zur Einsatzstelle nimmt den Gehweg.
- Hindernisse direkt am Weg vom Haus (`hindernisseAmWeg`, `BAU.verkehr.weg_radius`): Baustellen in lauten Phasen und Pannen oder Unfälle auf der Straße. Zu Fuß und mit dem Rad wird davor gewartet (`zu_fuss_s`), mit dem Auto vorsichtig vorbeigefahren (`fahrzeug_s`).
- Der Plan jeder Einsatzkraft enthält ihren Weg (`weg`: Start, Verkehrsmittel, los, da, Halt an Hindernissen), damit die App ihn genau so zeigt.
- Kein zweiter Einsatz derselben Art an einem Ort, an dem gerade noch einer läuft (keine zweite Katze im selben Baum).

## 0.17.0

- Einsatzspiel: Einsätze verfallen nicht mehr nach wenigen Minuten. Sie warten bis zu einem Tag auf Kräfte (`VERFALL.frist_min`) und werden alarmiert, sobald jemand frei ist oder das fehlende Gerät gekauft wurde. Wer spät kommt, bekommt wenig Sterne: Ab der sechsfachen Zielzeit bleibt ein Stern (neue Stufe in `STERNE.einsatzende`).
- Solange ein Einsatz einer Art wartet, kommt kein zweiter derselben Art dazu. Nach der ursprünglichen Frist wird nur noch alle fünf Minuten neu alarmiert (nach Käufen sofort).
- Folgeeinsätze, die so lange laufen wie ihr Auslöser (Absperren, Ausleuchten, Behandlungsplatz), verfallen spätestens mit dessen Ende.
- Ein Feuer breitet sich nach der ursprünglichen Frist nicht weiter aus, die Arbeit vor Ort wächst also nicht ins Endlose.
- Push-Benachrichtigungen zu Einsätzen gelten bis zum Einsatzende.

## 0.16.0

- Einsatzspiel, alle zusammen (ab Level 30): Sechs Großlagen (`grosslage`), die nicht gekauft werden, sondern ab dem Level selten von selbst kommen: Elbhochwasser, Sturm im ganzen Dorf, Busunfall mit vielen Verletzten, Bombenfund mit Evakuierung (bei Erdarbeiten an einer Baustelle), Scheunenbrand mit Stromausfall, Dorffest-Wochenende. Die Leitstelle alarmiert alle beteiligten Dienste gleichzeitig, das THW kommt wie sonst auf Anforderung. Jede Person ist nie in zwei Einsätzen zugleich.
- Wie oft Großlagen kommen, hängt an der Zusammenarbeit der letzten gemeinsamen Einsätze (`GROSSLAGE`); jede Großlage bewertet selbst die Zusammenarbeit mit der Polizei.
- DRK: Behandlungsplatz bei vielen Verletzten.
- Einsatzarten mit `ab_level`, die an Baustellen hängen, kommen erst ab ihrem Level.

## 0.15.0

- Einsatzspiel, THW-Ortsverband (ab Level 27, `ORGANISATIONEN.thw`): Mitgliedschaft für Bewohner als zweite Organisation (Grundausbildung), Lehrgänge Motorsäge, Kraftfahrer, Elektrofachkraft und Gruppenführung, Unterkunft in vier Stufen (Stufe 0 als Lagerraum in der Scheune, Stufe 3 mit Übungsgelände), MTW, Gerätekraftwagen, Radlader, Geräte der Bergungsgruppe und der Fachgruppen (Netzersatzanlage, Großpumpe, Sandsack-Füllanlage). Ohne eigene Helfer kommt der Ortsverband der Kreisstadt.
- Das THW hat keine eigenen Einsätze, es kommt nur auf Anforderung (`nachforderung`, § 1 THWG): Gebäude abstützen nach Scheunenbrand und Brand im Leerstand, Ausleuchten bei Scheunenbrand, Deichverteidigung und Verkehrsunfall mit mehreren Verletzten (nur nachts, `nur_dunkel`), Großpumpen und Sandsäcke am Deich, Sturmschaden räumen, Notstrom beim neuen Feuerwehreinsatz „Stromausfall im Ortsteil“.
- Nachforderung (`NACHFORDERUNG`): Ohne Gruppen- oder Zugführung vor Ort wird zehn Minuten später angefordert, das steht im Protokoll.

## 0.14.0

- Einsatzspiel, DLRG-Ortsgruppe (ab Level 24, `ORGANISATIONEN.dlrg`): Mitgliedschaft für Bewohner als zweite Organisation mit Rettungsschwimmabzeichen Bronze, das Fitness 40 verlangt (`fitness_min`); Silber ab Fitness 55, Strömungsretter ab 65, dazu Wasserretter, Bootsführer und Wachführer. Wachstation in vier Stufen (Sonnenschirm, Wachturm, Station mit Bootshaus, Steg und Funkraum), Gerätewagen mit Bootstrailer, MTW, Boote und Wasserrettungsgerät. Ohne Mitglieder kommt der Wasserrettungszug des Landkreises.
- Wachdienst (`WACHDIENST`): Ab dem Wachturm sitzen von Juni bis August samstags und sonntags von 11 bis 18 Uhr zwei Mitglieder auf dem Turm. Sie rücken zu Wassereinsätzen in 30 Sekunden aus, Patienten an der Badestelle bekommen sofort Erste Hilfe, und der Feuerwehr fehlen sie in der Zeit.
- Einsätze: Badeunfall (Sommer, mit Rettungsdienst-Teil), Boot treibt manövrierunfähig, Evakuierung bei Hochwasser (mit Betreuung durch das DRK), Strömungsretter bei Person im Eis und Person in der Elbe, Suche am Ufer beim vermissten Kind.
- Lehrgänge und Mitgliedschaften können eine Mindestfitness verlangen (`fitness_min`).

## 0.13.0

- Einsatzspiel, DRK-Ortsverein (ab Level 20, `ORGANISATIONEN.drk`): Ehrenamtliche aus dem Dorf treten über `kaufen` mit `art: "mitgliedschaft"`, `id: "drk"` ein (zweite Organisation neben Feuerwehr, Polizei oder Rettungsdienst, Grundausbildung Sanitätsdienst) und werden wie die Feuerwehr von zu Hause alarmiert. Unterkunft in vier Stufen (Stufe 0 als Gruppenraum im Gemeindehaus an der Bibliothek, Stufe 3 als Katastrophenschutzzentrum ab Level 24), Fahrzeuge PKW Helfer vor Ort, MTW, Gerätewagen Sanitätsdienst und Feldküche (Anhänger), Lehrgänge Betreuung, Verpflegung und Gruppenführung. Ohne Mitglieder kommt die Schnelleinsatzgruppe aus dem Nachbarort.
- Einsätze: Helfer vor Ort (mit Rettungsdienst-Teil), Sanitätswachdienst beim Dorffest (samstags im Sommer) und beim Sportfest (ab Sportplatz Stufe 6), Betreuung nach Wohnungsbrand, Räumung und Brand im Leerstand, Verpflegung beim Deicheinsatz.
- Erste Hilfe für Patienten: vom DRK wie von der Feuerwehr, sofort während eines Sanitätswachdienstes am selben Ort (`wache`), und mit dem Kauf „Paralleler Alarm Helfer vor Ort“ fährt der Helfer vor Ort bei jedem Notfall gleichzeitig mit dem RTW los.
- Lange Einsätze: Mit Verpflegung durch das DRK (Feldküche und Feldkoch frei) geht die Arbeit nach drei Stunden schneller (`RETTUNG.verpflegung_ab_min`).
- Anhänger brauchen ihr eigenes Zugfahrzeug (vorher galt die Liste des Tragkraftspritzenanhängers für alle).

## 0.12.0

- Benachrichtigungen ohne Firebase: Neue Option `ha_benachrichtigung` (notify-Dienst der Home-Assistant-App, z. B. `mobile_app_alex_handy`). Wünsche zur Freigabe, Spaziergänge mit Nilo und fällige Wiedervorlagen beim LKA gehen dann zusätzlich als Benachrichtigung der Home-Assistant-App an die Person mit voller Lebenswelt. Einsätze und Garmin bleiben in der eigenen App. Logik in `pb_hooks/benachrichtigung.js`.
- „Test-Benachrichtigung“ in der App prüft auch diesen Weg.

## 0.11.0

- Einsatzspiel, Rettungsdienst (ab Level 16, `ORGANISATIONEN.rettungsdienst`): Rettungswache in vier Stufen (Stufe 1 als RTW-Stellplatz am Feuerwehrhaus nur tagsüber, Stufe 4 als Lehrrettungswache ab Level 27), Personal (Rettungssanitäter, Notfallsanitäter), Lehrgänge (`rs`, `nfs` nur an der Lehrrettungswache, `desinfektor`), Fahrzeuge KTW, RTW und NEF, zwölf Geräte. Ohne eigene Wache oder wenn kein Fahrzeug frei ist, kommt der RTW der Nachbarwache (`EXTERN`, 14 min, höchstens 3 Sterne).
- Patienten (`patient`: rot, gelb, grün) mit Transport ins Krankenhaus, Übergabe, Rückfahrt und Wiederherstellung (`RETTUNG`, Plan `transport`). Ergebnis im Einsatz (`patient`: stabil, mit Verzögerung, verschlechtert; niemand stirbt). Notarzt (`notarzt`): eigenes NEF mit Notarztvertrag, tagsüber der Rettungshubschrauber, sonst aus der Stadt (Plan `notarzt`). Abzüge für fehlenden oder späten Notarzt und für einen RTW ohne Notfallsanitäter (§ 10 NRettDG).
- Hilfsfrist im Spiel 8 Minuten, der Stand merkt sich die letzten 50 Notfälle (`hilfsfrist`) für den Erreichungsgrad.
- Elf Einsatzarten des Rettungsdienstes mit Freischaltbaum ab dem Krankentransport, dazu Rettungsdienst-Teile in neun bestehenden Einsätzen (erst ab Level 16) und fünf gemeinsame Einsätze von Feuerwehr, Polizei und Rettungsdienst (`ab_level` 16) mit dem neuen Polizei-Teil Blutprobe.
- Leitstelle und Ersthelfer: strukturierte Notrufabfrage (Rettungsdienst wird gleich mit alarmiert), Telefonreanimation, öffentliche Defibrillatoren an vier Orten, Landestelle am Sportplatz. Ausbauten mit `ab_level` und `bereich`.
- Bewohner können als Rettungsdienstler einziehen (`bewohner: {org: "rettungsdienst"}`, Schichtdienst) und zusätzlich in die Feuerwehr eintreten.

## 0.10.0

- Einsatzspiel, Werkstatt mit Abschleppdienst und Bauhof (ab Level 12, `FREISCHALTUNG_LEVEL.werkstatt` und `.bauhof`, neue Organisationen in `ORGANISATIONEN`). Gebäude `werkstatt` und `bauhof` in vier Ausbaustufen (Stufe 0: kein Betrieb im Dorf), Personal über `kaufen` mit `art: "personal"` (`id: "werkstatt"` bzw. `"bauhof"`, begrenzt durch `personal_max`), eigene Geräte, Fahrzeuge (gelbes Rundumlicht, keine Sonderrechte: `ohne_sonderrechte`) und Lehrgänge. Arbeitgeber im Dorf: Kfz-Werkstatt und Bauhof.
- Grundversorgung von außen (`EXTERN`): Ohne eigenen Betrieb kommen der Abschleppdienst aus der Stadt (35 min) und die Straßenmeisterei (60 min), höchstens 3 Sterne. Im Plan steht dann `extern`.
- Einsätze: Panne, PKW im Graben, LKW bei Glätte, Bergung nach Unfall, Falschparker umsetzen, Glätte streuen, Ast auf dem Gehweg, Fahrbahn nachreinigen, Absperrung bei Sturmschaden. `start_level` schaltet eine Einsatzart ohne Vorgänger ab dem Level frei. `sperrt`: Solange der Einsatz offen ist, kostet die Stelle Einsatzfahrten in der Nähe Zeit.
- Folgeeinsätze nur, wenn die Organisation freigeschaltet ist: Unfall und Sachschaden führen zur Bergung, Ölspur und Unfallflucht zur Reinigung durch den Bauhof, Baum auf der Straße zur Absperrung, Falschparker zum Umsetzen.
- Winterdienst: Nach dem Streuen gilt bei Glätte und Schnee eine Weile der Reibwert für Nässe (`gestreut_bis` im Stand).
- Besen und Schaufel gibt es jetzt für alle Organisationen.

## 0.9.0

- Einsatzspiel, gemeinsame Einsätze von Feuerwehr und Polizei (ab Level 8, `FREISCHALTUNG_LEVEL.zusammenarbeit`): Kind im Auto eingeschlossen, Rinder auf der Straße, Mülltonnenbrand in Serie, Ölspur nach Unfallflucht, Gasgeruch mit Räumung der Häuser, LKW verliert Gefahrgut, Brand in leerstehendem Haus, Silvesternacht. Jeder hat einen Polizei-Teil als Folgeeinsatz (Halter ermitteln, Straße sperren, Brandermittlung, Fahndung, Räumung, Vollsperrung, Sachbeschädigung).
- Einsatzarten mit `ab_level` sind erst ab diesem Level kaufbar.
- Bewertung der Zusammenarbeit (`bewertung.zusammenarbeit`, 1 bis 5 Sterne, zählt nicht in die Sterne des Einsatzes): Wie schnell war die Polizei nach der Feuerwehr da (Ziel `gemeinsam.ziel_min`)? Die letzten 20 stehen im Stand unter `zusammenarbeit`. Der Auslöser kennt seinen Partner (`gemeinsam`).
- `bedingung.daten` (MM-TT) für Einsätze an bestimmten Tagen, zum Beispiel Silvester.

## 0.8.0

- Einsatzspiel, Dorfbewohner: Wer in ein Haus zieht, hat einen Beruf. `kaufen` mit `art: "bauplatz"` (und bei der Einliegerwohnung) nimmt `bewohner: {org, beruf, arbeitgeber}` an. Feuerwehr: `beruf: "dorf"` mit einem Arbeitgeber im Dorf (`ARBEITGEBER`, begrenzte Stellen) kommt in der Arbeitszeit vom Arbeitsplatz und braucht 60 s mehr; `beruf: "auswaerts"` fehlt werktags von 7 bis 17 Uhr. Polizei: wohnt im Dorf, Schichtdienst an der Dienststelle, zählt zu deren Personal. Wer schon da war, bleibt „wie bisher“ (`beruf: "frei"`). Ohne `bewohner` gilt das auch für neue Häuser (ältere App-Versionen).
- Mitgliedschaften: `kaufen` mit `art: "mitgliedschaft"`. Polizistinnen und Polizisten mit Haus im Dorf treten mit `id: "feuerwehr"` in die Feuerwehr ein (Grundausbildung als Lehrgang) und rücken außerhalb ihrer Schicht mit aus; Lehrgänge und Schutzausrüstung der Feuerwehr gibt es dann auch für sie (`psa` mit `org`). Eine Person ist nie in zwei Einsätzen zugleich.
- Level der Lebenswelt: Der Server liest es aus dem Spielstand (Summe der Skill-XP) und merkt es sich im Stand (`level`, nur steigend). `FREISCHALTUNG_LEVEL` legt fest, ab wann ein Dienst kommt (Sportverein ab 5, Rettungswache ab 16, alle zusammen ab 30).
- Sportplatz (`GEBAEUDE.sportplatz`, Ort `sportplatz`) in neun Stufen mit Level-Grenzen, eigene Bauphasen für den Rasenplatz (im Winter länger). Sportverein (`mitgliedschaft` `sportverein`) trainiert dienstags und donnerstags um 19 Uhr; Fitness (Start 50) macht schneller zu Fuß, mit dem Rad und bei der Arbeit.
- Stand Version 2, ältere Stände werden beim Laden übernommen.

## 0.7.0

- Fitness-Welt: Neue Option `fitness_personen` (HA-Benutzer-ID oder Anmeldename). Diese Personen bekommen in der App nur die Fitness-Welt: dieselbe Karte, dasselbe Einsatzspiel und derselbe Shop mit denselben Preisen, aber kein Smarthome, keine Aufgaben und kein Kraftbuch. `GET /api/lebenswelt/ich` liefert dazu `profil` (`voll` oder `fitness`).
- Neue Route `GET /api/lebenswelt/familie`: Bewegung der letzten 14 Tage aller Personen, die in der Fitness-Welt etwas eingetragen haben (Schritte, Heim-Physio, Physio in der Praxis, Nilo schieben), dazu ihr Schrittziel. Gelesen wird aus dem Spielstand (`state.bewegungen`), es gibt keine neue Sammlung.
- Updates per Knopf (`POST /api/lebenswelt/app-paket` und `/installieren`) sind für Personen der Fitness-Welt gesperrt (403).
- Spielstände merken sich ihr Profil (Feld `profil`, Migration). Ohne Option `person` arbeitet Claude weiter für die eine Person mit voller Lebenswelt, auch wenn eine Fitness-Welt dazukommt.
- Push-Nachrichten: an die Familie, wenn in der Fitness-Welt „Nilo schieben“ eingetragen wird; um 19 Uhr Ortszeit an Personen der Fitness-Welt, die heute noch nichts eingetragen haben; an die Person, die freigeben soll, sobald Wünsche zur Freigabe (Dokumente `freigabe`) angelegt werden.
- `GET /api/lebenswelt/familie` liefert zusätzlich den Stand der Wünsche (`wuensche`: Vorschlag, Titel, Status, Anmerkung).
- Schiffsverkehr auf der Elbe: neues Programm `ais/ais.py` empfängt AIS-Daten von aisstream.io für einen Umkreis um `zone.home` (Optionen `ais_schluessel`, `ais_radius_km`) und legt die Schiffe mit Lage relativ zum Zuhause in `/data/ais.json` ab. Neue Route `GET /api/lebenswelt/schiffe`. Im Container dafür `python3` und `py3-websockets`, Start über `start.sh`.

## 0.6.2

- Neue Unteraufgaben bekommen beim Anlegen zwei Wochen als `faellig`, wenn keine mitkommt: Aufgaben mit `vorgang` oder `eltern` sowie Dokumente vom Typ `unteraufgabe`. Gilt für App und Claude, nur beim Anlegen; danach lässt sich die Fälligkeit frei ändern.

## 0.6.1

- Vorgänge „Warten auf LKA (KTA PMK)“: Wer einen Vorgang neu auf diesen Status setzt (App, Claude, jede Route), bekommt automatisch eine Wiedervorlage in zwei Monaten als `frist` (am Monatsende gekappt, Ortszeit). Kommt in derselben Änderung eine `frist` mit, bleibt sie stehen. Regeln in `pb_hooks/vorgaenge.js`.
- Einmaliger Nachtrag (Migration): Vorgänge, die schon beim LKA liegen und keine Frist haben, bekommen den 31.10.2026.
- Morgens um 6:30 Uhr (Winterzeit) bzw. 7:30 Uhr (Sommerzeit) eine Push-Nachricht, wenn eine Wiedervorlage heute fällig ist. Die Nachricht nennt nur die Zahl der Vorgänge, keinen Titel und keine Nummer.

## 0.6.0

- Löschwasser im Einsatzspiel: Bei Bränden mit Strahlrohren muss eine Wasserversorgung aufgebaut werden. Gewählt wird die schnellste Quelle: ein Unterflurhydrant (mit Standrohr) oder ein offenes Gewässer wie die Elbe (Pumpe, mindestens zwei A-Saugschläuche, Saugkorb), sofern die B- und C-Schläuche bis dorthin reichen. Leitung verlegen kostet Zeit (`ZEITEN.leitung_m_s`, `wasser_hydrant_s`, `wasser_ansaugen_s`), in der sich das Feuer weiter ausbreitet. Wasser im Tank überbrückt den Aufbau. Ohne erreichbare Quelle gilt der Faktor `nur_tankwasser` bzw. `ohne_wasser`. Der Plan enthält `wasser` (Quelle, Lage, Meter, Verzug).
- Neue Listen `HYDRANTEN`, `HYDRANT_PLAETZE` und `GEWAESSER` im Regelwerk; die private Karte ersetzt sie (Felder `hydranten`, `hydrant_plaetze`, `gewaesser`). Überflurhydranten gibt es nicht.
- Ausbau `hydrant_a` und `hydrant_b`: zwei zusätzliche Unterflurhydranten mit Hinweisschild an den Hydrantenplätzen der Karte.

## 0.5.2

- Einsätze ohne freie Kräfte verfallen nicht mehr sofort: Sie bleiben offen (`wartet: true`, mit Grund), werden zu jeder vollen Minute und direkt nach jedem Kauf neu alarmiert und verfallen erst, wenn ihre Frist abläuft. Wer spät alarmiert wird, kommt entsprechend später an (das kostet wie bisher Sterne).

## 0.5.1

- Schutzzonen im Einsatzspiel: Einsatzarten mit `harmlos: true` (Katze auf Baum, Ruhestörung, Falschparker, Baulärm) dürfen überall stattfinden, alle anderen (Brände, Verletzte, Wasser) nie in einer Schutzzone. Auch Folgeeinsätze und Baustellen-Einsätze halten sich daran. Die Zonen kommen nur aus der privaten Karte (Feld `schutz`), im Regelwerk ist die Liste leer.

## 0.5.0

- Updates der App per Knopf: Das Add-on lädt neue Versionen alle 10 Minuten vom Zweig `app-paket` herunter. Eingespielt wird erst, wenn in der App „Installieren“ getippt wird, und zwar nach `www/lebenswelt-*/` (nur Ordner mit `server.json`, diese Datei bleibt unberührt).
- Neue Optionen `app_quelle` und `app_token`, Zugriff auf den Konfigurationsordner von Home Assistant (nur für diese Ordner genutzt).
- Routen `/api/lebenswelt/app-paket` (Stand, Nachsehen) und `/api/lebenswelt/app-paket/installieren`.
- Android-App: Liegt sie im Paket (`lebenswelt.apk`), kommt sie mit in den App-Ordner.
- Einsatzspiel: Tagesbilanz. Jeder Einsatz bekommt weiter seine Sterne; um Mitternacht (Ortszeit) wird der Durchschnitt aller Einsätze des Tages abgerechnet (verfallene zählen mit 0). Daraus gibt es XP (in der App zum Abholen am Feuerwehrhaus), und neue Einsatzarten werden nur noch freigeschaltet, wenn der Tagesdurchschnitt reicht und die vorausgesetzte Art an dem Tag erfolgreich war. Neue Route `POST /api/lebenswelt/einsatz/sofort` löst zum Ausprobieren sofort einen Einsatz aus.
- Karte: Seitenstraße südlich des Elternhauses (im Straßennetz für die Wege der Einsatzkräfte). Bauplätze bp04, bp06 und bp07 liegen jetzt an ihr, dazu die neuen Bauplätze bp17 bis bp20.
- Eigene Karte: Legt die App ein Dokument `karte` mit Schlüssel `dorf` ab (Wegenetz, Lage der Orte, Bauplätze, Neubaugebiete), rechnet das Einsatzspiel für diese Person damit statt mit der erfundenen Karte des Regelwerks. So bleibt eine Karte nach dem echten Wohnort nur in der eigenen Datenbank. Die Route `/api/lebenswelt/einsatz/regelwerk` liefert dann `KARTE: "privat"`.
- Push-Nachrichten an die Android-App über Firebase (Option `fcm_dienstkonto`): neue Einsätze, neue Garmin-Aktivitäten, Update verfügbar. Routen `/api/lebenswelt/push/geraet`, `/api/lebenswelt/push`, `/api/lebenswelt/push/test`. `openssl` im Container.

## 0.4.0

- Bauen mit Bauzeit: Gebäudestufen, Ausbauten, Häuser und Neubaugebiete werden in Phasen gebaut. Zwei Baukolonnen, Wetterverzug, Behelfsbetrieb während des Umbaus, Baustellen als Hindernis an der Strecke, Einsätze auf der Baustelle, Bauchronik.

## 0.3.0

- Einsatzspiel: Simulation läuft im Hintergrund (Minutentakt), auch wenn die App zu ist. Einsätze entstehen, werden disponiert, bewertet (Sterne) und schalten weitere Einsatzarten frei. Ohne KI, ohne Guthaben.
- Neue Routen unter `/api/lebenswelt/einsatz/` (Regelwerk, Stand, Protokoll, Kaufen, Einräumen, Personal).
- Wetter für die Simulation aus der Wetter-Entität von Home Assistant (Option `wetter_entitaet`), alle 10 Minuten.
- Kaufbuch: Käufe im Einsatzspiel bucht der Server von den Münzen ab; ein Gerät mit älterem Spielstand bekommt die Ausgaben beim Hochladen nachgezogen (Antwort 409 mit berichtigtem Stand).
- `GET /api/lebenswelt/dokumente` ohne `typ` liefert die Dokumente des Einsatzspiels nicht mehr mit.
- Sterne nach Einsatzende statt Eintreffen. Ausrüstung wirkt je Stufe (Tempo, Stolpern, Umziehen, Sicht im Dunkeln, Arbeit), Dunkelheit nach Sonnenzeiten, ohne Verteiler nur ein Strahlrohr. Das Protokoll nennt, was Zeit gekostet hat.
- Dokumente des Einsatzspiels sind über die allgemeinen Dokument-Routen nur lesbar. Ein ungültiger Stand wird nie gespeichert; ein unlesbarer wird gesichert und neu begonnen.

## 0.2.1

- Garmin-Abgleich auf Abruf (`POST /api/lebenswelt/garmin`) mit Rückmeldung.

## 0.2.0

- Dokumentenspeicher für Aufgaben, Vorgänge, Training und mehr (`/api/lebenswelt/dokumente`, `/api/lebenswelt/suche`).
- Zugang für vertraute Apps (Standard: der Home-Assistant-MCP-Server, über den Claude arbeitet).
- Garmin: übernimmt alle 15 Minuten die letzten Aktivitäten aus Home Assistant, ohne GPS-Koordinaten.
- Sonntags werden erledigte Vorgänge anonymisiert.

## 0.1.0

- Erste Version: Spielstand je Home-Assistant-Person, Zugriff nur über Ingress.
