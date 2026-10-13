# Einsatzspiel: Feuerwehr und Polizei in der Lebenswelt

Ein Spiel im Spiel auf der **Hauptkarte** der Lebenswelt. Einsätze tauchen im Dorf auf, und die Feuerwehr und die Polizei, die du dir aufgebaut hast, arbeiten sie ab, so gut sie es eben können. Am Anfang hast du nichts.

Die Lebenswelt bleibt in erster Linie eine App für den Alltag. Was du dort erledigst, bringt Münzen. Davon kaufst du die meisten Dinge in der Spielwelt, und einen Teil kannst du für echte Belohnungen ausgeben (das Euro-Konto gibt es schon). Die Spielwelt ist das, was dich über Jahre bei der Stange halten soll.

Die Daten (Einsatzarten, Geräte, Fahrzeuge, Lehrgänge, Regeln) stehen im Regelwerk [`lebenswelt/pb_hooks/einsatz/regelwerk.js`](../../lebenswelt/pb_hooks/einsatz/regelwerk.js). Ob die Verweise darin zusammenpassen, prüft `node werkzeuge/pruefe-regelwerk.js --baum`.

## Grundsätze

1. **Alles passiert auf der Hauptkarte.** Es gibt keine eigene Spielansicht. Fahrzeuge fahren über die echten Straßen, Einsatzkräfte wohnen in Häusern im Dorf, und an der Einsatzstelle sieht man, was dort getan wird.
2. **Angelehnt an die Vorschriften, aber spielbar.** Wer zu wenig Leute oder Gerät hat, kann trotzdem oft helfen. Nur gibt es dann weniger Sterne, und die App sagt, welche Regel verletzt wurde. Ein paar Dinge sind gesperrt, zum Beispiel ein Innenangriff ohne Sicherheitstrupp.
3. **Sterne sind nur Anerkennung.** Für 1 bis 5 Sterne je Einsatz gibt es keine Münzen und keine Punkte. Sie zeigen, wie gut es lief, und schalten neue Einsatzarten frei.
4. **Die Einsätze laufen weiter, auch wenn die App zu ist.** Die Zeit zählt in der Datenbank-App in Home Assistant. Wenn du die App öffnest, siehst du laufende Einsätze live und kannst dir die erledigten im Protokoll ansehen.
5. **Jedes Teil wird einzeln gekauft:** jeder Schlauch, jedes Strahlrohr, jeder Helm. Jedes Fahrzeug hat nur eine bestimmte Zahl an Slots.

## Die Spielschleife

```
Einsatzart kaufen ──► Einsatz tritt regelmäßig auf ──► Alarm
     ▲                                                   │
     │                                  Einsatzkräfte laufen/fahren zum Gerätehaus,
     │                                  ziehen sich um, rücken mit dem aus, was da ist
     │                                                   │
Freischaltung ◄── Sterne ◄── Bewertung ◄── Arbeit vor Ort (oder Einsatz verfällt)
                                │
                     zeigt, was gefehlt hat ──► kaufen, ausbilden, ausbauen
```

## Der Einstieg (so wie du ihn beschrieben hast)

| Schritt | Was passiert |
|---|---|
| 1 | Du kaufst die Einsatzart **Katze auf Baum** (50 Münzen). Ab jetzt sitzt etwa einmal pro Stunde eine Katze in einem Baum. Kommt innerhalb von 5 Minuten niemand, verfällt der Einsatz („Die Katze ist allein heruntergeklettert“). |
| 2 | Ohne Feuerwehr verfällt jeder Einsatz. Das Protokoll zeigt: „Keine Einsatzkraft verfügbar“. |
| 3 | Du kaufst einen **Bauplatz mit Haus**. Dort zieht eine Einsatzkraft ein, mit abgeschlossener Grundausbildung (Truppmann Teil 1), Grund-PSA und zu Fuß. Ob Feuerwehrfrau oder Feuerwehrmann, legst du beim Einzug selbst fest. |
| 4 | Die Einsatzkraft läuft bei Alarm zum Unterstand am Dorfplatz. Ohne Leiter kann sie nichts tun, der Einsatz verfällt („Leiter fehlt“). |
| 5 | Du kaufst eine **Klappleiter** oder zwei **Steckleiterteile**. Jetzt klappt die Rettung, aber höchstens mit 3 Sternen, weil niemand die Leiter sichert (FwDV 10). |
| 6 | Ein zweites Haus, ein Fahrrad, ein Handzugwagen, Tierschutzhandschuhe und eine Transportbox bringen dich auf 5 Sterne. Ab 3 Sternen ist der **Mülltonnenbrand** freigeschaltet. |

Damit es knapp und spannend bleibt, liegen die Bäume für die Katze unterschiedlich weit vom Gerätehaus entfernt. Den nächsten Baum schafft man zu Fuß in 5 Minuten, den am Markt erst mit Fahrrad oder einem Haus, das näher liegt.

## Einsatzarten und Freischaltbaum

Jede Einsatzart wird freigeschaltet, wenn die vorige gut genug lief (Sterne in Klammern), und danach gekauft. Folgeeinsätze wie „Verkehrsregelung“ entstehen von selbst, sobald die Polizei sie übernehmen kann.

**Feuerwehr**

- Katze auf Baum (Start, stündlich, Verfall 5 min)
  - Mülltonnenbrand (3★)
    - **Heckenbrand** (3★, alle 3 h, 10 min Löschzeit, breitet sich aus)
      - Wasser im Keller (3★, häufiger bei Regen)
        - Person im Eis eingebrochen (4★, nur bei Frost)
          - Person in der Elbe (4★, Boot nötig)
      - Flächenbrand am Deich (4★, nur Frühjahr und Sommer bei Trockenheit)
      - PKW-Brand (4★, Atemschutz)
        - Brandmeldeanlage ausgelöst (3★, meist Fehlalarm, manchmal echter Zimmerbrand)
          - Gasgeruch im Gebäude (4★, ABC-Lehrgang, Messgerät)
          - **Zimmerbrand, Menschenleben in Gefahr** (4★, Gruppe, Sicherheitstrupp)
            - Scheunenbrand (3★, Zug, lange Schlauchleitung)
              - Deichverteidigung bei Elbhochwasser (3★, 20 bis 40 Kräfte, Sandsäcke)
        - Verkehrsunfall, Person eingeklemmt (4★, Rettungssatz, häufiger bei Glätte)
          - Pferd im Graben (3★)
  - Ölspur (4★)
    - Baum auf Straße (3★, vor allem bei Sturm, Motorsägenlehrgang)

**Polizei**

- Ruhestörung bei den Nachbarn (Start, zweimal am Tag, vor allem abends und nachts)
  - Falschparker in der Feuerwehrzufahrt (3★). Solange er dort steht, braucht die Feuerwehr länger.
    - Verkehrsunfall mit Sachschaden (3★)
      - Wildunfall (3★, in der Dämmerung)
      - Trunkenheitsfahrt (4★)
  - Hilflose Person (3★)
    - Ladendiebstahl am Markt (3★)
      - Wohnungseinbruch (4★, Spurensicherung)
        - Schlägerei beim Schützenfest (3★, Sommerwochenenden)
          - Vermisstes Kind (3★, Diensthund, Drohne, Feuerwehr hilft suchen)
    - Türöffnung bei hilfloser Person (Feuerwehr, 3★) und daraus First Responder (4★)

Feuerwehr und Polizei greifen ineinander: Ein PKW-Brand braucht für volle Sterne die Polizei zur Verkehrsregelung, eine Türöffnung sollte von der Polizei begleitet werden, und ein Falschparker bremst die Feuerwehr aus.

## Was man alles kaufen kann

| Bereich | Beispiele | Wirkung |
|---|---|---|
| Einsatzarten | 29 Stück, von 50 bis 20 000 Münzen | mehr und schwierigere Einsätze, mehrere gleichzeitig |
| Häuser | 16 Bauplätze im Dorf und 3 Neubaugebiete mit je 12 Plätzen | mehr Einsatzkräfte. Je näher am Gerätehaus, desto teurer und schneller. |
| Haus-Ausbau | Fahrrad, E-Bike, Auto, Einliegerwohnung | kürzerer Weg zum Gerätehaus, eine zweite Person im Haus |
| Alarmierung | Sirene, Meldeempfänger, Meldeempfänger mit Rückmeldung, App | kürzere Reaktionszeit. Mit Rückmeldung weiß man, wer kommt, und rückt nicht vergeblich aus. |
| Lehrgänge | Truppmann 2, Sprechfunker, Atemschutz, Maschinist, Truppführer, TH, Motorsäge, Gruppen- und Zugführer; bei der Polizei Unfallaufnahme, Diensthundführer, Drohne | schalten Funktionen frei, die Person fehlt während des Lehrgangs |
| PSA | Helm in 4 Stufen, Stiefel, Jacke bis DIN EN 469, Handschuhe, Flammschutzhaube, TH-Kleidung | Voraussetzung für Innenangriff und für volle Sterne |
| Geräte | 69 Stück, jeder Schlauch einzeln, Strahlrohre, Pumpen, Leitern, Atemschutz, Wärmebildkamera, Rettungssatz, Sandsäcke | belegen Slots, werden nach dem Einsatz gepflegt (Schläuche 6 h, Atemschutz 4 h) |
| Fahrzeuge | Handzugwagen bis Drehleiter und Boot, Fußstreife bis Gruppenkraftwagen | Sitzplätze, Slots, Wasser, Pumpe, Tempo, brauchen einen Stellplatz und Fahrer mit Fahrberechtigung |
| Gebäude | Gerätehaus in 5 Stufen bis zur Schwerpunktfeuerwehr; Dienststelle bis zum Polizeikommissariat | Stellplätze, Lager, schneller umziehen |
| Ausbau | Spinde, Parkplätze, Alarmmonitor, Schlauchwaschanlage, Trockenturm, Atemschutzwerkstatt, Hydrantennetz | weniger Zeitverlust und Pflegezeit |

Alles zusammen kostet grob 1 bis 1,5 Millionen Münzen (bei rund 40 Einsatzkräften mit Ausbildung, PSA und Haus-Ausbau, allen Fahrzeugen und etwa drei Stück je Gerät). Wie viele Jahre das reicht, hängt davon ab, wie viele Münzen der Alltag pro Tag bringt. Mit `PREISFAKTOR` im Regelwerk lassen sich alle Preise auf einmal anpassen, sobald die Einnahmen bekannt sind.

## Sterne

Fünf Sterne gibt es, wenn alles stimmt. Abgezogen wird für:

- zu späte Ankunft im Vergleich zur Ziel-Eintreffzeit der Einsatzart (bis zu 3 Sterne),
- zu wenige Personen im Vergleich zur optimalen Stärke (bis zu 1,5),
- fehlende Geräte aus der Optimal-Liste (bis zu 1,5),
- unzureichende PSA (0,5),
- einen stark angewachsenen Schaden bei Bränden (1),
- jede verletzte Regel (1 bis 2): Leiter nicht gesichert, keine Führungskraft, Pumpe ohne Maschinist, keine Atemschutzüberwachung, Einsatzstelle im Verkehr nicht abgesichert, Polizei ohne Eigensicherung zu zweit.

Ein erfolgreicher Einsatz bekommt immer mindestens 1 Stern, ein verfallener 0. Halbe Sterne sind erlaubt. Für Niedersachsen gibt es keine landesweit vorgeschriebene Hilfsfrist, die Kommunen planen das selbst ([Landtag Drs. 17/8112](https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen%5F17%5F10000/8001-8500/17-8112.pdf)). Die Ziel-Eintreffzeiten im Spiel orientieren sich deshalb an kommunalen Bedarfsplänen, die nach den AGBF-Kriterien arbeiten ([Beispiel Alfeld 2023](https://www.alfeld.de/fileadmin/Redakteure/bilderarchiv/pdf_dateien/feuerwehren/FWBP-F_Endfassung_Alfeld_2023-05-25.pdf)), und sind auf die Größe der Karte heruntergerechnet.

## Wetter und Physik

- Das Wetter kommt aus Home Assistant (Wetter-Entität). Gibt es keine, wird es aus der Jahreszeit geschätzt.
- Je nach Fahrbahn gelten andere Reibwerte (trocken 0,8, nass 0,5, Schnee 0,25, Glätte 0,1). Daraus folgen der Bremsweg `v²/(2µg)` und die höchste Kurvengeschwindigkeit `√(µgr)`. Bei Schnee fahren alle langsamer, bremsen früher, rutschen in Kurven sichtbar und hinterlassen Spuren.
- Das Wetter bestimmt auch, welche Einsätze häufiger kommen: Glätte bringt mehr Unfälle, Sturm umgestürzte Bäume, Starkregen Wasser im Keller, Hitze Flächenbrände, Frost Eiseinbrüche.
- Einsatzfahrzeuge mit Blaulicht und Martinshorn haben Wegerecht (§ 38 StVO): Die anderen Autos fahren rechts ran und halten. Kein Fahrzeug fährt durch ein anderes hindurch, an der Einsatzstelle halten sie mit Abstand an.

## Polizei: worauf sie sich stützt

Die Polizei-Einsätze stützen sich nur auf **öffentliche** Rechtsgrundlagen: § 117 OWiG (unzulässiger Lärm), das NPOG, die StVO (§ 12 Halten und Parken, §§ 35 und 38 Sonder- und Wegerechte) und die StPO. Dazu kommt allgemein bekannte Praxis, etwa dass eine Streife aus Gründen der Eigensicherung zu zweit fährt.

**Die PDV 100 ist als Verschlusssache (VS-NfD) eingestuft und kommt in diesem öffentlichen Repository nicht vor.** Das gilt auch für spätere Ergänzungen: keine Inhalte aus VS-NfD-Vorschriften, internen Erlassen oder Lagebildern hier eintragen.

## Feuerwehr: worauf sie sich stützt

| Thema | Grundlage |
|---|---|
| Wer die Feuerwehr stellt und ausrüstet (Gemeinde, Löschwasser-Grundversorgung) | [NBrandSchG § 2](https://www.anwalt24.de/gesetze/nbrandschg-1/2) |
| Gerätehaus-Stufen: Grundausstattungs-, Stützpunkt- und Schwerpunktfeuerwehr | [FwVO Niedersachsen](https://www.niedersachsen.de/download/66249/Nds._GVBl._Nr._12_2010_vom_06.05.2010_S._185-185.pdf), aktueller [nicht amtlicher Abdruck des NLBK, Stand 2025](https://www.nlbk.niedersachsen.de/download/217021) |
| Trupp, Staffel 1/5/6, Gruppe 1/8/9, Zug; Funktionen Angriffs-, Wasser- und Schlauchtrupp | [FwDV 3](https://www.nlbk.niedersachsen.de/download/192510) |
| Atemschutz, Überwachung, Sicherheitstrupp, Funk je Trupp | [FwDV 7](https://www.nlbk.niedersachsen.de/download/192509) |
| Tragbare Leitern, Vornahme mit mehreren Einsatzkräften | [FwDV 10, Fassung 2020](https://www.nlbk.niedersachsen.de/download/192519) |
| Ausbildung (Truppmann Teil 1 und 2, Truppführer, darauf Gruppen- und Zugführer an der NABK) | [NLBK, Ausbildung der Freiwilligen Feuerwehren](https://www.nlbk.niedersachsen.de/download/151211) |
| Fahrzeuge: LF 10 mit 1/8 und 1200 l, HLF 20 mit 1600 l und 2000 l/min, TSF-W mit Staffel | [DIN 14530, Lernunterlage HLFS Hessen](https://hlfs.hessen.de/sites/hlfs.hessen.de/files/2023-01/4_fb-ausbilder_lernu_fahrzeugkunde-lernunterlage_vers002.doc.pdf) |
| Polizeiausbildung: dreijähriges Bachelorstudium an der Polizeiakademie Niedersachsen | [BDK Niedersachsen 2023](https://www.bdk.de/der-bdk/was-wir-tun/aktuelles/dokumente/ni_20230930_bachelorabschluss.pdf) |

Vereinfacht und deshalb als Spielwert markiert sind unter anderem: Lehrgangsdauern (stark verkürzt), Preise, Reaktions- und Umziehzeiten, Wassermengen beim MLF, die Dienstgrade samt Beförderungsbedingungen und die Zahl der Teile, ab der eine Steckleiter einen bestimmten Baum erreicht. Die Dienstgrade sind an Niedersachsen angelehnt. Die genauen Voraussetzungen aus der FwVO habe ich nicht im Wortlaut geprüft.
