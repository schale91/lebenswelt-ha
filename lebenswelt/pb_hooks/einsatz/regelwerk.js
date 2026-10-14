// Regelwerk des Einsatzspiels (Feuerwehr und Polizei auf der Hauptkarte).
// Reine Daten, keine PocketBase-Aufrufe: läuft in PocketBase (require) und in Node (Prüfskript).
// Das Frontend bekommt es später über /api/lebenswelt/einsatz/regelwerk, damit es nur eine Quelle gibt.
//
// Angelehnt an niedersächsisches Recht und die Feuerwehr-Dienstvorschriften, vereinfacht für ein Spiel.
// Polizei: nur öffentliche Rechtsgrundlagen (NPOG, OWiG, StVO, StPO). Die PDV 100 ist VS-NfD und gehört
// nicht in dieses öffentliche Repository.
//
// Werte mit "spielwert" im Kommentar sind Spielbalance, keine Normangaben.
// Preise sind Münzen der Lebenswelt; PREISFAKTOR gleicht sie an die Wirtschaft der App an.
//
// Anforderungen an Geräte sind Listen von Gruppen. Jede Gruppe ist eine Liste von Alternativen,
// jede Alternative ein Objekt {geraet: anzahl}. Erfüllt, wenn in jeder Gruppe eine Alternative vollständig da ist:
//   [[{steckleiter_teil: 2}, {klappleiter: 1}], [{handschuhe_tier: 1}]]
//   = (2 Steckleiterteile ODER 1 Klappleiter) UND 1 Paar Tierschutzhandschuhe

const VERSION = 2

// Entscheidung 13.10.2026: ein normaler Tag bringt etwa 30 Münzen; mit 0,05 kostet alles zusammen rund 60 000 (etwa fünf Jahre)
const PREISFAKTOR = 0.05 // spielwert
const PREIS_MINIMUM = 10 // spielwert: nichts kostet weniger (außer Kostenlosem)

/** Quellen, auf die sich Einträge über `quelle` beziehen. Stand der Recherche: Oktober 2026. */
const QUELLEN = {
  nbrandschg: { titel: "Niedersächsisches Brandschutzgesetz (NBrandSchG), § 2 Aufgaben der Gemeinden", url: "https://www.anwalt24.de/gesetze/nbrandschg-1/2" },
  fwvo_nds: { titel: "Verordnung über die kommunalen Feuerwehren in Niedersachsen (FwVO), Gliederung in Grundausstattungs-, Stützpunkt- und Schwerpunktfeuerwehren", url: "https://www.niedersachsen.de/download/66249/Nds._GVBl._Nr._12_2010_vom_06.05.2010_S._185-185.pdf" },
  fwvo_nds_2025: { titel: "FwVO, nicht amtlicher Abdruck des NLBK, Stand 8. April 2025", url: "https://www.nlbk.niedersachsen.de/download/217021" },
  fwdv3: { titel: "FwDV 3 Einheiten im Lösch- und Hilfeleistungseinsatz (Abdruck NLBK)", url: "https://www.nlbk.niedersachsen.de/download/192510" },
  fwdv7: { titel: "FwDV 7 Atemschutz (Abdruck NLBK)", url: "https://www.nlbk.niedersachsen.de/download/192509" },
  fwdv10: { titel: "FwDV 10 Die tragbaren Leitern, Fassung 2020 (Abdruck NLBK)", url: "https://www.nlbk.niedersachsen.de/download/192519" },
  fwdv2_nds: { titel: "Ausbildung der Freiwilligen Feuerwehren in Niedersachsen (NLBK, Truppmann/Truppführer modular)", url: "https://www.nlbk.niedersachsen.de/download/151211" },
  din14530: { titel: "DIN 14530 Löschfahrzeuge (Übersicht LF 10, HLF 10, HLF 20, TSF-W)", url: "https://hlfs.hessen.de/sites/hlfs.hessen.de/files/2023-01/4_fb-ausbilder_lernu_fahrzeugkunde-lernunterlage_vers002.doc.pdf" },
  hilfsfrist_nds: { titel: "Landtag Niedersachsen Drs. 17/8112: keine landesweit vorgeschriebene Hilfsfrist, kommunale Bedarfsplanung", url: "https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen%5F17%5F10000/8001-8500/17-8112.pdf" },
  agbf: { titel: "Bedarfsplan Alfeld 2023 nach AGBF-Qualitätskriterien (Eintreffzeit, Erreichungsgrad)", url: "https://www.alfeld.de/fileadmin/Redakteure/bilderarchiv/pdf_dateien/feuerwehren/FWBP-F_Endfassung_Alfeld_2023-05-25.pdf" },
  owig117: { titel: "§ 117 OWiG Unzulässiger Lärm", url: "https://www.gesetze-im-internet.de/owig_1968/__117.html" },
  npog: { titel: "Niedersächsisches Polizei- und Ordnungsbehördengesetz (NPOG), Volltext im Vorschrifteninformationssystem VORIS (dort nach NPOG suchen)", url: "https://voris.wolterskluwer-online.de/" },
  stvo35: { titel: "§ 35 StVO Sonderrechte, § 38 StVO Blaues Blinklicht und gelbes Blinklicht", url: "https://www.gesetze-im-internet.de/stvo_2013/__38.html" },
  stvo12: { titel: "§ 12 StVO Halten und Parken (u. a. vor Feuerwehrzufahrten)", url: "https://www.gesetze-im-internet.de/stvo_2013/__12.html" },
  polizeiakademie: { titel: "Polizeiakademie Niedersachsen: dreijähriges Bachelorstudium, Ernennung zur Polizeikommissarin/zum Polizeikommissar", url: "https://www.bdk.de/der-bdk/was-wir-tun/aktuelles/dokumente/ni_20230930_bachelorabschluss.pdf" },
}

/** Maßstab der Hauptkarte: Meter je Welteinheit. Vorläufig, das Frontend prüft gegen die echten Abstände. */
// 3 statt 5 seit E0: die Modelle sind mit etwa 1 m je Einheit gebaut, und zu Fuß soll der nächste Baum in 5 Minuten erreichbar sein
const METER_JE_EINHEIT = 3 // spielwert

// STRASSEN-ANFANG (aus dem Frontend exportiert mit app/skripte/strassennetz.ts, nicht von Hand ändern)
/** Straßennetz der Hauptkarte: Knoten (Weltkoordinaten) und Kanten mit Länge in Welteinheiten. */
const STRASSEN = {
  quelle: "Frontend scene/layout.ts (STRASSE, SEITENSTRASSE)",
  breite: 6,
  knoten: [
    {
      id: "s00",
      x: 0,
      z: 100
    },
    {
      id: "s01",
      x: 0,
      z: 6
    },
    {
      id: "s02",
      x: 0,
      z: -10
    },
    {
      id: "s03",
      x: -0.15,
      z: -12.35
    },
    {
      id: "s04",
      x: -0.61,
      z: -14.66
    },
    {
      id: "s05",
      x: -1.37,
      z: -16.89
    },
    {
      id: "s06",
      x: -2.41,
      z: -19
    },
    {
      id: "s07",
      x: -3.72,
      z: -20.96
    },
    {
      id: "s08",
      x: -5.27,
      z: -22.73
    },
    {
      id: "s09",
      x: -7.04,
      z: -24.28
    },
    {
      id: "s10",
      x: -9,
      z: -25.59
    },
    {
      id: "s11",
      x: -11.11,
      z: -26.63
    },
    {
      id: "s12",
      x: -13.34,
      z: -27.39
    },
    {
      id: "s13",
      x: -15.65,
      z: -27.85
    },
    {
      id: "s14",
      x: -18,
      z: -28
    },
    {
      id: "s15",
      x: -120,
      z: -28
    },
    {
      id: "t01",
      x: -26,
      z: 6
    },
    {
      id: "t02",
      x: -30,
      z: 7
    },
    {
      id: "t03",
      x: -34,
      z: 10
    },
    {
      id: "t04",
      x: -38,
      z: 13
    },
    {
      id: "t05",
      x: -42,
      z: 14
    },
    {
      id: "t06",
      x: -100,
      z: 14
    }
  ],
  kanten: [
    {
      von: "s00",
      nach: "s01",
      laenge: 94
    },
    {
      von: "s01",
      nach: "s02",
      laenge: 16
    },
    {
      von: "s02",
      nach: "s03",
      laenge: 2.35
    },
    {
      von: "s03",
      nach: "s04",
      laenge: 2.36
    },
    {
      von: "s04",
      nach: "s05",
      laenge: 2.36
    },
    {
      von: "s05",
      nach: "s06",
      laenge: 2.35
    },
    {
      von: "s06",
      nach: "s07",
      laenge: 2.36
    },
    {
      von: "s07",
      nach: "s08",
      laenge: 2.35
    },
    {
      von: "s08",
      nach: "s09",
      laenge: 2.35
    },
    {
      von: "s09",
      nach: "s10",
      laenge: 2.36
    },
    {
      von: "s10",
      nach: "s11",
      laenge: 2.35
    },
    {
      von: "s11",
      nach: "s12",
      laenge: 2.36
    },
    {
      von: "s12",
      nach: "s13",
      laenge: 2.36
    },
    {
      von: "s13",
      nach: "s14",
      laenge: 2.35
    },
    {
      von: "s14",
      nach: "s15",
      laenge: 102
    },
    {
      von: "s01",
      nach: "t01",
      laenge: 26
    },
    {
      von: "t01",
      nach: "t02",
      laenge: 4.12
    },
    {
      von: "t02",
      nach: "t03",
      laenge: 5
    },
    {
      von: "t03",
      nach: "t04",
      laenge: 5
    },
    {
      von: "t04",
      nach: "t05",
      laenge: 4.12
    },
    {
      von: "t05",
      nach: "t06",
      laenge: 58
    }
  ]
}
// STRASSEN-ENDE

/**
 * Feste Orte auf der Hauptkarte (Weltkoordinaten x, z wie im Frontend, `mr` im Bundle).
 * Einsatzstellen ohne festen Bau sind gegen die Karte geprüft (app/skripte/strassennetz.ts im Frontend, Stand E0).
 */
const ORTE = {
  feuerwehrhaus: { name: "Feuerwehrhaus", x: -46, z: -16, fest: true },
  dienststelle: { name: "Dienststelle", x: -19, z: 52, fest: true },
  marktplatz: { name: "Marktplatz", x: 19, z: 62, fest: true },
  deich: { name: "Deich & Elbe", x: 6, z: -38, fest: true },
  bibliothek: { name: "Bibliothek", x: -18, z: 26, fest: true },
  werkstatt: { name: "Werkstatt", x: 46, z: -1, fest: true },
  elternhaus: { name: "Elternhaus", x: -17, z: -6, fest: true },
  // Einsatzstellen (vorläufig)
  baum_feuerwehr: { name: "Linde am Feuerwehrhaus", x: -34, z: -4 },
  baum_bibliothek: { name: "Kastanie an der Bibliothek", x: -12, z: 20 },
  baum_markt: { name: "Eiche am Marktplatz", x: 26, z: 56 },
  hecke_nachbar: { name: "Hecke beim Nachbarn", x: -26, z: 2 },
  hecke_werkstatt: { name: "Hecke an der Werkstatt", x: 40, z: 6 },
  muelltonnen: { name: "Mülltonnen am Markt", x: 12, z: 58 },
  nachbarhaus: { name: "Haus der Nachbarn", x: -30, z: -2 },
  hauptstrasse_ost: { name: "Dorfstraße Nord", x: 0, z: 70 },
  hauptstrasse_west: { name: "Deichstraße West", x: -70, z: -28 },
  kreuzung: { name: "Dorfstraße Ortsmitte", x: 0, z: 30 },
  wiese_deich: { name: "Wiese am Deichfuß", x: 18, z: -30 },
  elbe_ufer: { name: "Elbufer", x: 0, z: -48 },
  scheune: { name: "Scheune am Ortsrand", x: 62, z: -28 },
  schule: { name: "Grundschule", x: -40, z: 40 },
  festplatz: { name: "Festplatz", x: 40, z: 74 },
  sportplatz: { name: "Sportplatz", x: 70, z: 84, fest: true },
}

/** Bauplätze für die Häuser der Einsatzkräfte. Näher am Gerätehaus = teurer (kürzerer Weg im Alarmfall). */
const BAUPLAETZE = [
  { id: "bp01", x: -56, z: -4, preis: 1800 },
  { id: "bp02", x: -58, z: -20, preis: 1700 },
  { id: "bp03", x: -40, z: -37, preis: 1500 },
  // bp04, bp06, bp07 und bp17 bis bp20 liegen an der Seitenstraße südlich des Elternhauses
  { id: "bp04", x: -66, z: 5, preis: 1300 },
  { id: "bp05", x: -30, z: -40, preis: 1200 },
  { id: "bp06", x: -40, z: 23, preis: 1100 },
  { id: "bp07", x: -68, z: 23, preis: 900 },
  { id: "bp08", x: -50, z: 30, preis: 900 },
  { id: "bp09", x: 8, z: 30, preis: 700 },
  { id: "bp10", x: -4, z: 46, preis: 650 },
  { id: "bp11", x: 30, z: -14, preis: 600 },
  { id: "bp12", x: 34, z: 76, preis: 500 },
  { id: "bp13", x: 50, z: 20, preis: 450 },
  { id: "bp14", x: 50, z: 64, preis: 400 },
  { id: "bp15", x: -64, z: 56, preis: 400 },
  { id: "bp16", x: 50, z: -14, preis: 350 },
  { id: "bp17", x: -80, z: 23, preis: 450 },
  { id: "bp18", x: -78, z: 5, preis: 400 },
  { id: "bp19", x: -92, z: 23, preis: 350 },
  { id: "bp20", x: -90, z: 5, preis: 300 },
]

/**
 * Neubaugebiete erweitern das Dorf über die Jahre. Erschließung einmalig, danach Bauplätze einzeln.
 * Die Plätze liegen im Raster ab `ursprung` (Abstand `raster` Einheiten); das Frontend prüft gegen die Karte.
 */
const NEUBAUGEBIETE = [
  { id: "nb_nord", name: "Neubaugebiet Am Deich", ursprung: { x: -104, z: -64 }, spalten: 4, reihen: 3, raster: 12, erschliessung: 6000, preis: 500, bauzeit_h: 24, ab_geraetehaus: 2 },
  { id: "nb_ost", name: "Neubaugebiet Elbblick", ursprung: { x: 72, z: 30 }, spalten: 3, reihen: 4, raster: 12, erschliessung: 12000, preis: 650, bauzeit_h: 48, ab_geraetehaus: 3 },
  { id: "nb_sued", name: "Neubaugebiet Lindenhof", ursprung: { x: -60, z: 90 }, spalten: 4, reihen: 3, raster: 12, erschliessung: 20000, preis: 800, bauzeit_h: 72, ab_geraetehaus: 4 },
]

/**
 * Wetter wirkt auf Fahrzeiten und Bremswege. Reibwerte sind übliche Lehrbuchwerte für Reifen auf Asphalt.
 * Bremsweg s = v² / (2 · µ · g); Kurvengrenzgeschwindigkeit v = √(µ · g · r).
 * Quelle im Spiel: Wetter-Entität aus Home Assistant (Option `wetter_entitaet`), sonst Jahreszeit.
 */
const WETTER = {
  trocken: { name: "trocken", reibung: 0.8, tempo: 1.0 },
  nass: { name: "nass", reibung: 0.5, tempo: 0.9 },
  schnee: { name: "Schneedecke", reibung: 0.25, tempo: 0.6, spuren: true },
  glaette: { name: "Glätte", reibung: 0.1, tempo: 0.45, spuren: true },
  sturm: { name: "Sturm", reibung: 0.6, tempo: 0.8 },
  hitze: { name: "Hitze und Trockenheit", reibung: 0.8, tempo: 1.0 },
}

/** Wie die Einsatzkräfte vom Alarm erfahren. Reaktionszeit = bis die Person losgeht. */
const ALARMIERUNG = {
  sirene: { name: "Sirene", reaktion_s: 90, preis: 0, rueckmeldung: false }, // spielwert
  fme: { name: "Funkmeldeempfänger", reaktion_s: 45, preis: 250, rueckmeldung: false },
  fme_rueck: { name: "Digitaler Meldeempfänger mit Rückmeldung", reaktion_s: 35, preis: 600, rueckmeldung: true },
  app: { name: "Alarmierungs-App mit Verfügbarkeit", reaktion_s: 25, preis: 900, rueckmeldung: true, verfuegbarkeit: true },
}

/** Ausbau je Haus: wie schnell die Person zum Gerätehaus bzw. zur Dienststelle kommt. */
const HAUS_AUSBAU = {
  zu_fuss: { name: "zu Fuß", tempo_ms: 1.6, extra_s: 0, preis: 0 },
  fahrrad: { name: "Fahrrad", tempo_ms: 5, extra_s: 10, preis: 120 },
  ebike: { name: "E-Bike", tempo_ms: 7, extra_s: 10, preis: 450, voraussetzung: "fahrrad" },
  auto: { name: "Auto", tempo_ms: 11, extra_s: 35, preis: 1500 },
  einliegerwohnung: { name: "Einliegerwohnung (eine weitere Einsatzkraft zieht ein)", bewohner: 1, preis: 2500, bauzeit_h: 6 },
  // extra_s beim Auto: einsteigen und am Gerätehaus parken. Der Parkplatz im Gebäudeausbau senkt das.
}

/**
 * Freischaltung nach dem Level der Lebenswelt (XP aus dem Alltag, gleiche Kurve wie in der App: der Schritt von Level n
 * auf n + 1 kostet round(100 · (n + 1)^1,4) XP, Start bei Level 0). Vor seinem Level gibt es einen Dienst nicht, auch
 * keine gemeinsamen Einsätze mit ihm. Konzept: docs/einsatzspiel/DORFDIENSTE.md, Abschnitt 14.3.
 */
const FREISCHALTUNG_LEVEL = {
  sportverein: 5,
  zusammenarbeit: 8,
  werkstatt: 12,
  bauhof: 12,
  rettungsdienst: 16,
  drk: 20,
  dlrg: 24,
  thw: 27,
  alle: 30,
}

/**
 * Berufe der Bewohner. Wer auswärts arbeitet, fehlt der Feuerwehr in der Arbeitszeit (Tagesalarmsicherheit). Wer im Dorf
 * arbeitet, kommt in der Arbeitszeit vom Arbeitsplatz aus und braucht einen Moment, um die Arbeit zu unterbrechen
 * (Freistellung nach § 12 NBrandSchG). Beim Schichtdienst an der Dienststelle wird während der Schicht nicht für die
 * Feuerwehr alarmiert. "frei" haben nur Einsatzkräfte, die vor Einführung der Berufe eingezogen sind (wie bisher).
 */
const ARBEITSZEIT = { tage: [1, 2, 3, 4, 5], von: 7, bis: 17 } // spielwert, Ortszeit
const BERUFE = {
  frei: { name: "wie bisher, immer verfügbar", nur_bestand: true },
  dorf: { name: "arbeitet im Dorf", extra_s: 60, arbeitgeber: true }, // spielwert: Arbeit unterbrechen
  auswaerts: { name: "pendelt zur Arbeit", abwesend: true },
  schicht: { name: "Schichtdienst an der Dienststelle", org: "polizei", schichtplan: ["frueh", "spaet", "nacht", "frei", "frei"] },
}
/** Schichten in Ortszeit (Stunden); die Nachtschicht geht bis 6 Uhr am Folgetag. */
const SCHICHTEN = { frueh: [6, 14], spaet: [14, 22], nacht: [22, 30] }

/** Arbeitsplätze im Dorf. Später kommen Werkstatt, Bauhof, Rettungswache und andere dazu. */
const ARBEITGEBER = {
  markt: { name: "Markt", ort: "marktplatz", stellen: 2 },
  schule: { name: "Grundschule", ort: "schule", stellen: 2 },
  hof: { name: "Hof am Ortsrand", ort: "scheune", stellen: 1 },
  bibliothek: { name: "Bibliothek", ort: "bibliothek", stellen: 1 },
  platzwart: { name: "Platzwart am Sportplatz", ort: "sportplatz", stellen: 1, gebaeude: "sportplatz", ab_stufe: 5 },
}

/**
 * Mitgliedschaften zusätzlich zur Hauptorganisation. Polizistinnen und Polizisten, die im Dorf wohnen, können in die
 * Freiwillige Feuerwehr eintreten; außerhalb ihrer Schicht rücken sie dann mit aus. Der Sportverein hebt die Fitness.
 */
const MITGLIEDSCHAFTEN = {
  feuerwehr: { name: "Freiwillige Feuerwehr", eintritt: 150, grundausbildung: "tm1", grundausbildung_h: 16, fuer_org: ["polizei"], braucht_haus: true },
  sportverein: { name: "Sportverein", eintritt: 200, ab_level: 5 },
}

/**
 * Fitness 0 bis 100, Start 50 (dann wirkt sie neutral). Training im Sportverein hebt sie, ohne Training sinkt sie sehr
 * langsam, aber nie unter den Startwert. Wirkung (spielwert): Tempo zu Fuß und mit dem Rad 1 + tempo · (f - 50) / 100,
 * Arbeitszeit vor Ort 1 + arbeit · (f - 50) / 100. Training dienstags und donnerstags um 19 Uhr Ortszeit.
 */
const FITNESS = {
  start: 50,
  max: 100,
  tempo: 0.3,
  arbeit: -0.2,
  training: { tage: [2, 4], stunde: 19 },
  joggen: 0.3, // Gewinn je Training ohne Sportplatz oder im Winter ohne Flutlicht
  trimm: 0.2, // Bewohner ohne Verein am Trimm-dich-Pfad
  abbau: 0.1, // je Trainingstermin ohne Training, bis zum Startwert
  winter_monate: [11, 12, 1, 2],
}

/**
 * Persönliche Schutzausrüstung je Einsatzkraft (Feuerwehr). Stufe 0 ist die Grundausstattung beim Einzug.
 * Jede Stufe lässt sich einzeln aufwerten und wirkt im Einsatz (Werte gelten für die jeweilige Stufe, nicht als Zuschlag):
 *   tempo       Gehgeschwindigkeit zu Fuß im Einsatz (1 = normal), der langsamste im Trupp bestimmt
 *   stolpern    Zeitverlust zu Fuß je Wetterstufe (ZEITEN.stolpern_wetter), der unsicherste im Trupp bestimmt
 *   arbeit      Faktor auf die Arbeitszeit vor Ort (unter 1 = schneller), Mittel über den Trupp
 *   arbeit_th   wie arbeit, nur bei technischer Hilfe (Stichwort TH)
 *   nacht       Sicht im Dunkeln (1 = volle Sicht), zählt, wenn alle im Trupp sie haben
 *   umziehen_s  Sekunden mehr oder weniger beim Umziehen im Gerätehaus
 * Alle Werte sind Spielwerte. Stufe 2 bei der Jacke (DIN EN 469) ist Voraussetzung für den Innenangriff unter Atemschutz.
 */
const PSA_FEUERWEHR = {
  helm: [
    { name: "Helm ohne Visier (gebraucht)", preis: 0, effekt: { arbeit: 1.05 } },
    { name: "Feuerwehrhelm DIN EN 443", preis: 180, effekt: {}, vorteil: "sitzt fest, kein Nachrücken bei der Arbeit" },
    { name: "Feuerwehrhelm DIN EN 443 mit Visier und Nackenschutz", preis: 350, effekt: { arbeit: 0.97 }, vorteil: "Visier schützt die Augen, arbeitet ohne Absetzen" },
    { name: "Feuerwehrhelm mit Helmlampe und Sprechgarnitur", preis: 600, effekt: { arbeit: 0.95, nacht: 1 }, vorteil: "sieht im Dunkeln, funkt ohne Hand am Gerät" },
  ],
  stiefel: [
    { name: "Gummistiefel mit Stahlkappe", preis: 0, effekt: { tempo: 0.85, stolpern: 0.15 } },
    { name: "Feuerwehrstiefel DIN EN 15090", preis: 160, effekt: { tempo: 0.95, stolpern: 0.08, umziehen_s: -10 }, vorteil: "schneller zu Fuß, stolpert seltener, schneller angezogen" },
    { name: "Lederschnürstiefel DIN EN 15090 (Typ F2A) mit Reißverschluss", preis: 320, effekt: { tempo: 1, stolpern: 0.03, umziehen_s: -15 }, vorteil: "am schnellsten zu Fuß, fester Halt bei Nässe und Glätte" },
  ],
  jacke: [
    { name: "Arbeitsanzug", preis: 0, effekt: {} },
    { name: "Einsatzjacke und -hose nach HuPF", preis: 300, effekt: { umziehen_s: -10, arbeit: 0.97 }, vorteil: "schneller angezogen, bewegt sich freier" },
    { name: "Schutzkleidung DIN EN 469 für die Brandbekämpfung", preis: 650, effekt: { umziehen_s: -10, arbeit: 0.97 }, vorteil: "Voraussetzung für den Innenangriff" },
  ],
  th_kleidung: [
    { name: "keine", preis: 0, effekt: {} },
    { name: "Leichte Schutzkleidung für die technische Hilfe", preis: 400, effekt: { arbeit_th: 0.9 }, vorteil: "bei technischer Hilfe beweglicher und schneller" },
  ],
  handschuhe: [
    { name: "Arbeitshandschuhe", preis: 0, effekt: {} },
    { name: "Feuerwehrschutzhandschuhe DIN EN 659", preis: 90, effekt: { arbeit: 0.93 }, vorteil: "greift sicher, arbeitet schneller" },
  ],
  haube: [
    { name: "keine", preis: 0, effekt: {} },
    { name: "Flammschutzhaube DIN EN 13911", preis: 60, effekt: {}, vorteil: "schützt Hals und Ohren vor Hitze" },
  ],
}

/** Persönliche Ausstattung je Polizeibeamtin/-beamter. reaktion_s: Sekunden mehr bis zum Aufbruch. */
const PSA_POLIZEI = {
  weste: [
    { name: "Warnweste", preis: 0, effekt: {} },
    { name: "Unterziehschutzweste", preis: 400, effekt: {}, vorteil: "Eigenschutz bei jedem Einsatz" },
  ],
  funk: [
    { name: "Handfunkgerät (geteilt)", preis: 0, effekt: { reaktion_s: 15 } },
    { name: "eigenes Handfunkgerät", preis: 250, effekt: {}, vorteil: "bricht schneller auf, das Gerät muss nicht erst übergeben werden" },
  ],
  bodycam: [
    { name: "keine", preis: 0, effekt: {} },
    { name: "Bodycam", preis: 300, effekt: {}, vorteil: "dokumentiert den Einsatz" },
  ],
}

/** Lesbare Namen der Ausrüstungsteile für Texte im Protokoll. */
const PSA_NAMEN = {
  helm: "Helm",
  stiefel: "Stiefel",
  jacke: "Einsatzkleidung",
  th_kleidung: "Kleidung für technische Hilfe",
  handschuhe: "Handschuhe",
  haube: "Flammschutzhaube",
  weste: "Schutzweste",
  funk: "Funkgerät",
  bodycam: "Bodycam",
}

/**
 * Sonnenaufgang und -untergang je Monat in Ortszeit (Stunden, gerundet, Norddeutschland um 53,5° Nord).
 * Dazwischen ist es hell; sonst wirkt ZEITEN.nacht_* , abgeschwächt durch Helmlampe, Taschenlampe oder Flutlicht.
 */
const SONNE = [
  [8.5, 16.3], [7.7, 17.3], [6.7, 18.3], [6.6, 20.3], [5.5, 21.2], [4.9, 21.9],
  [5.2, 21.7], [6.0, 20.8], [7.0, 19.6], [7.9, 18.4], [7.9, 16.5], [8.6, 16.0],
]

/**
 * Lehrgänge. Dauer in Echtzeit-Stunden (spielwert, deutlich gekürzt). Während des Lehrgangs fehlt die Person.
 * Feuerwehr: modulare Ausbildung in Niedersachsen (Truppmitglied, Truppführer, darauf aufbauend Gruppen- und Zugführer).
 */
const LEHRGAENGE = {
  // Feuerwehr
  tm1: { org: "feuerwehr", name: "Truppmann Teil 1 (Grundausbildung)", dauer_h: 0, preis: 0, quelle: "fwdv2_nds", hinweis: "beim Einzug abgeschlossen" },
  tm2: { org: "feuerwehr", name: "Truppmann Teil 2 (Standortausbildung)", dauer_h: 48, preis: 200, voraussetzung: ["tm1"], quelle: "fwdv2_nds" },
  sprechfunk: { org: "feuerwehr", name: "Sprechfunker Digitalfunk BOS", dauer_h: 12, preis: 150, voraussetzung: ["tm1"] },
  erste_hilfe: { org: "feuerwehr", name: "Erste Hilfe / Sanitätsausbildung", dauer_h: 8, preis: 100, voraussetzung: ["tm1"] },
  agt: { org: "feuerwehr", name: "Atemschutzgeräteträger", dauer_h: 24, preis: 400, voraussetzung: ["tm1", "sprechfunk"], hinweis: "arbeitsmedizinische Eignung nötig", quelle: "fwdv7" },
  fahrberechtigung: { org: "feuerwehr", name: "Feuerwehr-Fahrberechtigung bis 7,5 t", dauer_h: 16, preis: 350, voraussetzung: ["tm1"] },
  fuehrerschein_c: { org: "feuerwehr", name: "Führerschein Klasse C", dauer_h: 72, preis: 1800, voraussetzung: ["fahrberechtigung"] },
  maschinist: { org: "feuerwehr", name: "Maschinist für Löschfahrzeuge", dauer_h: 24, preis: 400, voraussetzung: ["tm2", "fahrberechtigung"] },
  th: { org: "feuerwehr", name: "Technische Hilfeleistung", dauer_h: 24, preis: 450, voraussetzung: ["tm2"] },
  motorsaege: { org: "feuerwehr", name: "Motorsägenführer", dauer_h: 16, preis: 300, voraussetzung: ["tm2"] },
  tf: { org: "feuerwehr", name: "Truppführer", dauer_h: 36, preis: 600, voraussetzung: ["tm2", "sprechfunk"], quelle: "fwdv2_nds" },
  abc: { org: "feuerwehr", name: "ABC-Einsatz", dauer_h: 24, preis: 500, voraussetzung: ["tf", "agt"] },
  boot: { org: "feuerwehr", name: "Bootsführer", dauer_h: 24, preis: 600, voraussetzung: ["tm2"] },
  eisrettung: { org: "feuerwehr", name: "Eis- und Wasserrettung", dauer_h: 12, preis: 300, voraussetzung: ["tm2"] },
  drehleiter: { org: "feuerwehr", name: "Maschinist für Hubrettungsfahrzeuge", dauer_h: 24, preis: 700, voraussetzung: ["maschinist", "fuehrerschein_c"] },
  gf: { org: "feuerwehr", name: "Gruppenführer (NABK)", dauer_h: 72, preis: 1200, voraussetzung: ["tf"] },
  zf: { org: "feuerwehr", name: "Zugführer (NABK)", dauer_h: 96, preis: 2000, voraussetzung: ["gf"] },
  verbandsfuehrer: { org: "feuerwehr", name: "Verbandsführer (NABK)", dauer_h: 120, preis: 3500, voraussetzung: ["zf"] },
  // Polizei
  pk: { org: "polizei", name: "Bachelorstudium Polizeivollzugsdienst (Polizeiakademie Niedersachsen)", dauer_h: 0, preis: 0, quelle: "polizeiakademie", hinweis: "beim Einzug abgeschlossen" },
  einsatztraining: { org: "polizei", name: "Einsatztraining (jährlich)", dauer_h: 8, preis: 150, voraussetzung: ["pk"], verfaellt_tage: 365 },
  vu_aufnahme: { org: "polizei", name: "Verkehrsunfallaufnahme", dauer_h: 16, preis: 300, voraussetzung: ["pk"] },
  krad: { org: "polizei", name: "Kradfahrerlehrgang", dauer_h: 24, preis: 500, voraussetzung: ["pk"] },
  spurensicherung: { org: "polizei", name: "Tatortarbeit und Spurensicherung", dauer_h: 24, preis: 500, voraussetzung: ["pk"] },
  diensthund: { org: "polizei", name: "Diensthundführer", dauer_h: 96, preis: 1500, voraussetzung: ["pk", "einsatztraining"] },
  drohne: { org: "polizei", name: "Fernpilot Polizeidrohne", dauer_h: 24, preis: 700, voraussetzung: ["pk"] },
  dgl: { org: "polizei", name: "Dienstschichtleitung", dauer_h: 48, preis: 1200, voraussetzung: ["pk", "einsatztraining"] },
}

/**
 * Dienstgrade Feuerwehr (Mannschaft und erste Führungsdienstgrade), vereinfacht.
 * Beförderung im Spiel nach Lehrgängen, Einsätzen und Zeit. Wirkt nur auf Anzeige und Führungsfunktion.
 */
const DIENSTGRADE_FEUERWEHR = [
  { kurz: "FMA", name: "Feuerwehrfrau/-mann-Anwärter/in", lehrgaenge: [], einsaetze: 0 },
  { kurz: "FM", name: "Feuerwehrfrau/-mann", lehrgaenge: ["tm1"], einsaetze: 3 },
  { kurz: "OFM", name: "Oberfeuerwehrfrau/-mann", lehrgaenge: ["tm2"], einsaetze: 15 },
  { kurz: "HFM", name: "Hauptfeuerwehrfrau/-mann", lehrgaenge: ["tm2", "sprechfunk"], einsaetze: 40 },
  { kurz: "LM", name: "Löschmeister/in", lehrgaenge: ["tf"], einsaetze: 60 },
  { kurz: "OLM", name: "Oberlöschmeister/in", lehrgaenge: ["gf"], einsaetze: 90 },
  { kurz: "BM", name: "Brandmeister/in", lehrgaenge: ["zf"], einsaetze: 150 },
]

/** Funktionen im Einsatz nach FwDV 3 und was sie voraussetzen. */
const FUNKTIONEN_FEUERWEHR = {
  einheitsfuehrer: { name: "Einheitsführer/in", lehrgang: "tf" },
  maschinist: { name: "Maschinist/in", lehrgang: "maschinist" },
  melder: { name: "Melder/in", lehrgang: "tm1" },
  angriffstrupp: { name: "Angriffstrupp", lehrgang: "tm1", anzahl: 2 },
  wassertrupp: { name: "Wassertrupp", lehrgang: "tm1", anzahl: 2 },
  schlauchtrupp: { name: "Schlauchtrupp", lehrgang: "tm1", anzahl: 2 },
}

/** Taktische Einheiten nach FwDV 3 (Führung/Mannschaft/Gesamt). */
const EINHEITEN = {
  selbststaendiger_trupp: { name: "Selbstständiger Trupp", staerke: [1, 2, 3], quelle: "fwdv3" },
  staffel: { name: "Staffel", staerke: [1, 5, 6], quelle: "fwdv3" },
  gruppe: { name: "Gruppe", staerke: [1, 8, 9], quelle: "fwdv3" },
  zug: { name: "Zug", staerke: [1, 21, 22], hinweis: "Zugführer, Zugtrupp und zwei Gruppen bzw. Gruppe und Staffeln", quelle: "fwdv3" },
}

/**
 * Merkmale, die in Anforderungen wie Geräte vorkommen, aber nicht gekauft werden.
 * Die Simulation leitet sie aus den ausgerückten Fahrzeugen und der Lage ab.
 */
const MERKMALE = {
  fahrzeug_wasser: { name: "Fahrzeug mit Löschwassertank", aus: { fahrzeug_feld: "wasser_l" } },
  dlak_fahrzeug: { name: "Drehleiter", aus: { fahrzeug: ["dlak"] } },
  elw_fahrzeug: { name: "Einsatzleitwagen", aus: { fahrzeug: ["elw1"] } },
  tlf_fahrzeug: { name: "Tanklöschfahrzeug", aus: { fahrzeug: ["tlf3000"] } },
  boot_fahrzeug: { name: "Boot", aus: { fahrzeug: ["mzb"] } },
  polizei_vor_ort: { name: "Polizei an der Einsatzstelle", aus: { lage: "polizei_eingetroffen" } },
}

/**
 * Geräte und Beladung. Jedes Teil wird einzeln gekauft und belegt Slots auf einem Fahrzeug
 * oder liegt im Lager des Gerätehauses bzw. der Dienststelle.
 * effekt: wirkt in der Simulation (loeschen_l_min, tempo, sicherheit, ...).
 */
const GERAETE = {
  // Leitern (FwDV 10)
  klappleiter: { name: "Klappleiter", slots: 1, preis: 120, org: "feuerwehr", kategorie: "leiter", effekt: { hoehe_m: 3.5 }, quelle: "fwdv10" },
  steckleiter_teil: { name: "Steckleiterteil (einzeln)", slots: 1, preis: 90, org: "feuerwehr", kategorie: "leiter", effekt: { hoehe_m_je_teil: 1.8 }, hinweis: "vier Teile als Satz erreichen etwa das 2. OG", quelle: "fwdv10" },
  schiebleiter: { name: "Dreiteilige Schiebleiter", slots: 3, preis: 900, org: "feuerwehr", kategorie: "leiter", effekt: { hoehe_m: 12 }, quelle: "fwdv10" },
  multifunktionsleiter: { name: "Multifunktionsleiter", slots: 2, preis: 500, org: "feuerwehr", kategorie: "leiter", effekt: { hoehe_m: 5 }, quelle: "fwdv10" },
  // Schläuche, einzeln
  d_schlauch: { name: "D-Schlauch 15 m", slots: 0.25, preis: 20, org: "feuerwehr", kategorie: "schlauch", effekt: { laenge_m: 15, groesse: "D" } },
  c_schlauch_15: { name: "C-Schlauch 15 m", slots: 0.25, preis: 30, org: "feuerwehr", kategorie: "schlauch", effekt: { laenge_m: 15, groesse: "C" } },
  c_schlauch_20: { name: "C-Schlauch 20 m", slots: 0.3, preis: 38, org: "feuerwehr", kategorie: "schlauch", effekt: { laenge_m: 20, groesse: "C" } },
  b_schlauch: { name: "B-Schlauch 20 m", slots: 0.5, preis: 55, org: "feuerwehr", kategorie: "schlauch", effekt: { laenge_m: 20, groesse: "B" } },
  a_saugschlauch: { name: "A-Saugschlauch 1,6 m", slots: 0.5, preis: 70, org: "feuerwehr", kategorie: "schlauch", effekt: { laenge_m: 1.6, groesse: "A" } },
  // Armaturen
  saugkorb: { name: "Saugkorb mit Halte- und Ventilleine", slots: 0.5, preis: 80, org: "feuerwehr", kategorie: "armatur" },
  standrohr: { name: "Standrohr mit Unterflurhydrantenschlüssel", slots: 0.5, preis: 150, org: "feuerwehr", kategorie: "armatur", effekt: { wasserquelle: "hydrant" } },
  verteiler: { name: "Verteiler B-CBC", slots: 0.5, preis: 180, org: "feuerwehr", kategorie: "armatur" },
  kupplungsschluessel: { name: "Kupplungsschlüssel (Paar)", slots: 0, preis: 15, org: "feuerwehr", kategorie: "armatur" },
  schlauchtragekorb: { name: "Schlauchtragekorb", slots: 0.5, preis: 60, org: "feuerwehr", kategorie: "armatur", effekt: { verlegen_tempo: 1.3 } },
  // Strahlrohre
  d_strahlrohr: { name: "D-Strahlrohr", slots: 0.25, preis: 60, org: "feuerwehr", kategorie: "strahlrohr", effekt: { loeschen_l_min: 50 } },
  cm_strahlrohr: { name: "C-Mehrzweckstrahlrohr (CM)", slots: 0.25, preis: 120, org: "feuerwehr", kategorie: "strahlrohr", effekt: { loeschen_l_min: 200 } },
  c_hohlstrahlrohr: { name: "C-Hohlstrahlrohr", slots: 0.25, preis: 450, org: "feuerwehr", kategorie: "strahlrohr", effekt: { loeschen_l_min: 235, innenangriff: 1.25 } },
  bm_strahlrohr: { name: "B-Mehrzweckstrahlrohr (BM)", slots: 0.5, preis: 200, org: "feuerwehr", kategorie: "strahlrohr", effekt: { loeschen_l_min: 400 } },
  // Pumpen und Wasser
  kuebelspritze: { name: "Kübelspritze 10 l", slots: 1, preis: 80, org: "feuerwehr", kategorie: "pumpe", effekt: { loeschen_l_min: 10, wasser_l: 10 } },
  ts_alt: { name: "Tragkraftspritze TS 8/8 (gebraucht)", slots: 3, preis: 900, org: "feuerwehr", kategorie: "pumpe", effekt: { pumpe_l_min: 800, zuverlaessig: 0.9 } },
  pfpn_1000: { name: "Tragkraftspritze PFPN 10-1000", slots: 3, preis: 2200, org: "feuerwehr", kategorie: "pumpe", effekt: { pumpe_l_min: 1000 } },
  pfpn_1500: { name: "Tragkraftspritze PFPN 10-1500", slots: 3, preis: 3200, org: "feuerwehr", kategorie: "pumpe", effekt: { pumpe_l_min: 1500 } },
  // Löscher
  pulverloescher: { name: "Pulverlöscher PG 12", slots: 0.5, preis: 90, org: "feuerwehr", kategorie: "loescher", effekt: { loeschen_kleinbrand: 1 } },
  schaumloescher: { name: "Schaumlöscher S 9", slots: 0.5, preis: 110, org: "feuerwehr", kategorie: "loescher", effekt: { loeschen_kleinbrand: 1 } },
  co2_loescher: { name: "CO2-Löscher K 5", slots: 0.5, preis: 120, org: "feuerwehr", kategorie: "loescher", effekt: { loeschen_kleinbrand: 1, elektro: true } },
  feuerpatsche: { name: "Feuerpatsche", slots: 0.25, preis: 25, org: "feuerwehr", kategorie: "vegetation" },
  loeschrucksack: { name: "Löschrucksack", slots: 0.5, preis: 140, org: "feuerwehr", kategorie: "vegetation", effekt: { loeschen_l_min: 15, wasser_l: 20 } },
  schaummittel: { name: "Schaummittel 20 l mit Zumischer", slots: 1, preis: 260, org: "feuerwehr", kategorie: "loeschmittel" },
  // Atemschutz (FwDV 7)
  pressluftatmer: { name: "Pressluftatmer mit Maske", slots: 1, preis: 1400, org: "feuerwehr", kategorie: "atemschutz", quelle: "fwdv7" },
  atemschutzueberwachung: { name: "Atemschutzüberwachungstafel", slots: 0.25, preis: 150, org: "feuerwehr", kategorie: "atemschutz", quelle: "fwdv7" },
  rettungstuch: { name: "Rettungstuch", slots: 0.25, preis: 70, org: "feuerwehr", kategorie: "atemschutz" },
  waermebildkamera: { name: "Wärmebildkamera", slots: 0.5, preis: 2500, org: "feuerwehr", kategorie: "erkundung", effekt: { suchen: 2 } },
  luefter: { name: "Hochleistungslüfter", slots: 2, preis: 1800, org: "feuerwehr", kategorie: "brand", effekt: { rauch_frei: 1.5 } },
  rauchvorhang: { name: "Mobiler Rauchverschluss", slots: 0.5, preis: 600, org: "feuerwehr", kategorie: "brand", effekt: { schaden: 0.8 } },
  // Funk
  hrt: { name: "Handsprechfunkgerät (HRT)", slots: 0.25, preis: 450, org: "beide", kategorie: "funk", hinweis: "jeder Atemschutztrupp führt eins mit" },
  // Technische Hilfe
  motorsaege: { name: "Motorsäge mit Schnittschutzausrüstung", slots: 1, preis: 900, org: "feuerwehr", kategorie: "th" },
  oelbinder: { name: "Ölbindemittel (Sack)", slots: 0.25, preis: 25, org: "feuerwehr", kategorie: "th" },
  besen_schaufel: { name: "Besen und Schaufel", slots: 0.25, preis: 20, org: "feuerwehr", kategorie: "th" },
  tauchpumpe: { name: "Tauchpumpe", slots: 1, preis: 700, org: "feuerwehr", kategorie: "th", effekt: { pumpe_l_min: 400 } },
  wassersauger: { name: "Wassersauger", slots: 1, preis: 500, org: "feuerwehr", kategorie: "th" },
  stromerzeuger: { name: "Stromerzeuger", slots: 2, preis: 1600, org: "feuerwehr", kategorie: "th" },
  beleuchtung: { name: "LED-Flutlicht mit Stativ", slots: 1, preis: 600, org: "beide", kategorie: "th", effekt: { nacht: 1 } },
  rettungssatz: { name: "Hydraulischer Rettungssatz (Spreizer, Schneidgerät, Rettungszylinder)", slots: 4, preis: 9000, org: "feuerwehr", kategorie: "th" },
  unterbaumaterial: { name: "Unterbaumaterial und Keile", slots: 1, preis: 300, org: "feuerwehr", kategorie: "th" },
  tueroeffnung: { name: "Türöffnungswerkzeug", slots: 0.5, preis: 700, org: "feuerwehr", kategorie: "th" },
  mehrgasmessgeraet: { name: "Mehrgasmessgerät", slots: 0.25, preis: 1200, org: "feuerwehr", kategorie: "abc" },
  sprungpolster: { name: "Sprungpolster", slots: 3, preis: 3500, org: "feuerwehr", kategorie: "rettung" },
  hebegurte: { name: "Hebegurte und Großtier-Rettungsset", slots: 2, preis: 1400, org: "feuerwehr", kategorie: "tier" },
  // Tiere
  tierhandschuhe: { name: "Tierschutzhandschuhe", slots: 0, preis: 40, org: "feuerwehr", kategorie: "tier" },
  transportbox: { name: "Tiertransportbox", slots: 0.5, preis: 50, org: "feuerwehr", kategorie: "tier" },
  kescher: { name: "Tierfangkescher", slots: 0.5, preis: 70, org: "feuerwehr", kategorie: "tier" },
  // Wasser und Eis
  rettungsring: { name: "Rettungsring mit Leine", slots: 0.5, preis: 90, org: "feuerwehr", kategorie: "wasser" },
  wathose: { name: "Wathose", slots: 0.25, preis: 120, org: "feuerwehr", kategorie: "wasser" },
  eisretter: { name: "Eisrettungsschlitten", slots: 2, preis: 1600, org: "feuerwehr", kategorie: "wasser" },
  rettungsweste: { name: "Rettungsweste", slots: 0.25, preis: 110, org: "feuerwehr", kategorie: "wasser" },
  sandsack: { name: "Sandsäcke (100 Stück, gefüllt)", slots: 2, preis: 150, org: "feuerwehr", kategorie: "hochwasser" },
  // Sanität
  notfallrucksack: { name: "Notfallrucksack", slots: 0.5, preis: 600, org: "beide", kategorie: "sanitaet" },
  aed: { name: "Automatisierter externer Defibrillator (AED)", slots: 0.25, preis: 1500, org: "beide", kategorie: "sanitaet" },
  // Verkehrsabsicherung
  leitkegel: { name: "Leitkegel (4 Stück)", slots: 0.5, preis: 60, org: "beide", kategorie: "verkehr" },
  warnleuchte: { name: "Warnleuchten (4 Stück)", slots: 0.5, preis: 180, org: "beide", kategorie: "verkehr" },
  faltsignal: { name: "Faltsignal „Unfall“", slots: 0.5, preis: 150, org: "beide", kategorie: "verkehr" },
  // Polizei
  anhaltekelle: { name: "Anhaltekelle", slots: 0, preis: 30, org: "polizei", kategorie: "polizei" },
  unfallaufnahme: { name: "Unfallaufnahme-Set (Kamera, Maßband, Kreide)", slots: 0.5, preis: 400, org: "polizei", kategorie: "polizei" },
  atemalkohol: { name: "Atemalkohol-Vortestgerät", slots: 0.25, preis: 450, org: "polizei", kategorie: "polizei" },
  spurensicherung: { name: "Spurensicherungskoffer", slots: 1, preis: 900, org: "polizei", kategorie: "polizei" },
  absperrband: { name: "Absperrband", slots: 0, preis: 10, org: "beide", kategorie: "verkehr" },
  taschenlampe: { name: "Taschenlampe", slots: 0, preis: 40, org: "beide", kategorie: "allgemein", effekt: { nacht: 0.5 } },
  laser_messgeraet: { name: "Lasermessgerät Geschwindigkeit", slots: 0.5, preis: 2500, org: "polizei", kategorie: "polizei" },
  drohne: { name: "Drohne mit Wärmebild", slots: 1, preis: 6000, org: "beide", kategorie: "erkundung", effekt: { suchen: 3 } },
}

/**
 * Fahrzeuge. besatzung = Sitzplätze [Führung, Mannschaft]. slots = Platz für Beladung.
 * grundbeladung kommt beim Kauf mit, alles andere wird einzeln gekauft und eingeräumt.
 * stellplatz: belegt einen Stellplatz im Gerätehaus bzw. an der Dienststelle.
 */
const FAHRZEUGE = {
  // Feuerwehr
  handzugwagen: {
    org: "feuerwehr", name: "Handzugwagen", besatzung: [0, 0], gezogen: true, slots: 6, preis: 250,
    tempo_kmh: 5, stellplatz: 1, fahrer: null, grundbeladung: {},
    hinweis: "Startfahrzeug, wird von Einsatzkräften gezogen",
  },
  tsa: {
    org: "feuerwehr", name: "Tragkraftspritzenanhänger (TSA)", besatzung: [0, 0], anhaenger: true, slots: 10, preis: 1200,
    tempo_kmh: 40, stellplatz: 1, fahrer: null, grundbeladung: {}, voraussetzung_fahrzeug: ["mtw", "pkw_kdo"],
    hinweis: "braucht ein Zugfahrzeug",
  },
  pkw_kdo: { org: "feuerwehr", name: "Kommandowagen (PKW)", besatzung: [1, 3], slots: 3, preis: 3500, tempo_kmh: 60, stellplatz: 1, fahrer: "fahrberechtigung", grundbeladung: {} },
  mtw: { org: "feuerwehr", name: "Mannschaftstransportwagen (MTW)", besatzung: [1, 8], slots: 4, preis: 5500, tempo_kmh: 55, stellplatz: 1, fahrer: "fahrberechtigung", grundbeladung: {} },
  tsf: {
    org: "feuerwehr", name: "Tragkraftspritzenfahrzeug (TSF)", norm: "DIN 14530-16", besatzung: [1, 5], slots: 16, preis: 9000,
    tempo_kmh: 50, stellplatz: 1, fahrer: "fahrberechtigung", quelle: "din14530",
    grundbeladung: { pfpn_1000: 1, a_saugschlauch: 4, saugkorb: 1, b_schlauch: 4, c_schlauch_15: 6, verteiler: 1, cm_strahlrohr: 2, standrohr: 1, steckleiter_teil: 4, kupplungsschluessel: 3 },
  },
  tsf_w: {
    org: "feuerwehr", name: "Tragkraftspritzenfahrzeug mit Wasser (TSF-W)", norm: "DIN 14530-17", besatzung: [1, 5], slots: 18, preis: 13000,
    wasser_l: 750, schnellangriff: true, tempo_kmh: 50, stellplatz: 1, fahrer: "fahrberechtigung", quelle: "din14530",
    grundbeladung: { pfpn_1000: 1, a_saugschlauch: 4, saugkorb: 1, b_schlauch: 4, c_schlauch_15: 6, verteiler: 1, cm_strahlrohr: 2, standrohr: 1, steckleiter_teil: 4, kupplungsschluessel: 3 },
  },
  mlf: {
    org: "feuerwehr", name: "Mittleres Löschfahrzeug (MLF)", norm: "DIN 14530-25", besatzung: [1, 5], slots: 16, preis: 18000,
    wasser_l: 1000, pumpe_l_min: 1000, schnellangriff: true, tempo_kmh: 60, stellplatz: 1, fahrer: "fuehrerschein_c",
    grundbeladung: { b_schlauch: 6, c_schlauch_15: 8, verteiler: 1, cm_strahlrohr: 2, standrohr: 1, steckleiter_teil: 4, a_saugschlauch: 4, saugkorb: 1, kupplungsschluessel: 3 },
    hinweis: "Wassermenge spielwert",
  },
  lf10: {
    org: "feuerwehr", name: "Löschgruppenfahrzeug LF 10", norm: "DIN 14530-5", besatzung: [1, 8], slots: 20, preis: 26000,
    wasser_l: 1200, pumpe_l_min: 1000, schnellangriff: true, tempo_kmh: 65, stellplatz: 1, fahrer: "fuehrerschein_c", quelle: "din14530",
    grundbeladung: { b_schlauch: 8, c_schlauch_15: 10, verteiler: 1, cm_strahlrohr: 3, bm_strahlrohr: 1, standrohr: 1, steckleiter_teil: 4, a_saugschlauch: 4, saugkorb: 1, kupplungsschluessel: 4 },
  },
  hlf10: {
    org: "feuerwehr", name: "Hilfeleistungslöschgruppenfahrzeug HLF 10", norm: "DIN 14530-26", besatzung: [1, 8], slots: 24, preis: 34000,
    wasser_l: 1000, pumpe_l_min: 1000, schnellangriff: true, tempo_kmh: 65, stellplatz: 1, fahrer: "fuehrerschein_c", quelle: "din14530",
    grundbeladung: { b_schlauch: 8, c_schlauch_15: 10, verteiler: 1, cm_strahlrohr: 3, standrohr: 1, steckleiter_teil: 4, a_saugschlauch: 4, saugkorb: 1, rettungssatz: 1, kupplungsschluessel: 4 },
  },
  hlf20: {
    org: "feuerwehr", name: "Hilfeleistungslöschgruppenfahrzeug HLF 20", norm: "DIN 14530-27", besatzung: [1, 8], slots: 28, preis: 42000,
    wasser_l: 1600, pumpe_l_min: 2000, schnellangriff: true, tempo_kmh: 65, stellplatz: 1, fahrer: "fuehrerschein_c", quelle: "din14530",
    grundbeladung: { b_schlauch: 10, c_schlauch_15: 12, verteiler: 1, cm_strahlrohr: 3, bm_strahlrohr: 1, standrohr: 1, steckleiter_teil: 4, schiebleiter: 1, a_saugschlauch: 4, saugkorb: 1, rettungssatz: 1, stromerzeuger: 1, kupplungsschluessel: 4 },
  },
  tlf3000: {
    org: "feuerwehr", name: "Tanklöschfahrzeug TLF 3000", besatzung: [1, 2], slots: 10, preis: 32000,
    wasser_l: 3000, pumpe_l_min: 2000, schnellangriff: true, tempo_kmh: 60, stellplatz: 1, fahrer: "fuehrerschein_c",
    grundbeladung: { c_schlauch_15: 6, b_schlauch: 4, cm_strahlrohr: 2, verteiler: 1, kupplungsschluessel: 2 },
  },
  dlak: {
    org: "feuerwehr", name: "Drehleiter mit Korb DLA (K) 23/12", besatzung: [1, 2], slots: 6, preis: 60000,
    leiter_m: 23, tempo_kmh: 60, stellplatz: 1, fahrer: "drehleiter",
    grundbeladung: { kupplungsschluessel: 1 },
  },
  rw: { org: "feuerwehr", name: "Rüstwagen (RW)", besatzung: [1, 2], slots: 30, preis: 38000, tempo_kmh: 60, stellplatz: 1, fahrer: "fuehrerschein_c", grundbeladung: { rettungssatz: 1, stromerzeuger: 1, beleuchtung: 2, unterbaumaterial: 1 } },
  elw1: { org: "feuerwehr", name: "Einsatzleitwagen ELW 1", besatzung: [1, 2], slots: 4, preis: 9000, tempo_kmh: 70, stellplatz: 1, fahrer: "fahrberechtigung", fuehrung: true, grundbeladung: { hrt: 2 } },
  gw_l: { org: "feuerwehr", name: "Gerätewagen Logistik (GW-L)", besatzung: [1, 2], slots: 34, preis: 22000, tempo_kmh: 60, stellplatz: 1, fahrer: "fuehrerschein_c", grundbeladung: { b_schlauch: 20, sandsack: 2 } },
  mzb: { org: "feuerwehr", name: "Mehrzweckboot mit Trailer", besatzung: [1, 2], slots: 4, preis: 15000, tempo_kmh: 40, stellplatz: 1, fahrer: "boot", wasser: true, grundbeladung: { rettungsweste: 3, rettungsring: 1 } },
  // Polizei
  fusstreife: { org: "polizei", name: "Fußstreife", besatzung: [0, 2], slots: 1, preis: 0, tempo_kmh: 5, stellplatz: 0, fahrer: null, grundbeladung: { taschenlampe: 1 } },
  fahrradstreife: { org: "polizei", name: "Fahrradstreife (2 Diensträder)", besatzung: [0, 2], slots: 1, preis: 600, tempo_kmh: 18, stellplatz: 0, fahrer: "pk", grundbeladung: { taschenlampe: 1 } },
  fustw: { org: "polizei", name: "Funkstreifenwagen (FuStW)", besatzung: [0, 2], slots: 6, preis: 7000, tempo_kmh: 70, stellplatz: 1, fahrer: "pk", grundbeladung: { leitkegel: 1, warnleuchte: 1, anhaltekelle: 1, absperrband: 1, taschenlampe: 2 } },
  krad: { org: "polizei", name: "Polizeimotorrad", besatzung: [0, 1], slots: 1, preis: 5000, tempo_kmh: 80, stellplatz: 1, fahrer: "krad", grundbeladung: { anhaltekelle: 1 } },
  zivil: { org: "polizei", name: "Zivilstreifenwagen", besatzung: [0, 2], slots: 4, preis: 6000, tempo_kmh: 70, stellplatz: 1, fahrer: "pk", grundbeladung: { taschenlampe: 2 } },
  grukw: { org: "polizei", name: "Gruppenkraftwagen", besatzung: [1, 8], slots: 8, preis: 14000, tempo_kmh: 65, stellplatz: 1, fahrer: "pk", grundbeladung: { leitkegel: 2, absperrband: 2, beleuchtung: 1 } },
  vu_wagen: { org: "polizei", name: "Verkehrsunfallaufnahmefahrzeug", besatzung: [0, 2], slots: 8, preis: 11000, tempo_kmh: 70, stellplatz: 1, fahrer: "vu_aufnahme", grundbeladung: { unfallaufnahme: 1, leitkegel: 2, warnleuchte: 1, faltsignal: 1 } },
  hundestreife: { org: "polizei", name: "Diensthundstreife", besatzung: [0, 1], slots: 2, preis: 9000, tempo_kmh: 70, stellplatz: 1, fahrer: "diensthund", hund: true, grundbeladung: {} },
}

/**
 * Bauen. Jedes Gebäude, jede Ausbaustufe, jeder Ausbau, jedes Haus und jedes Neubaugebiet hat eine Bauzeit
 * (Echtzeit-Stunden, spielwert; bauzeit_h an der jeweiligen Stelle, Häuser BAU.haus_h). Gebaut wird in Phasen,
 * die das Frontend mit Baufahrzeugen zeigt. Während des Baus wirkt die Baustelle auf die Einsätze.
 */
const BAU = {
  haus_h: 4,
  phasen: [
    { id: "erdarbeiten", name: "Erdarbeiten", anteil: 0.2, fahrzeuge: ["bagger", "kipper"], laut: true },
    { id: "rohbau", name: "Rohbau", anteil: 0.35, fahrzeuge: ["kran", "betonmischer"], laut: true },
    { id: "dach", name: "Dach und Fassade", anteil: 0.2, fahrzeuge: ["kran", "kipper"], laut: true },
    { id: "innenausbau", name: "Innenausbau", anteil: 0.2, fahrzeuge: ["transporter"] },
    { id: "abnahme", name: "Abnahme", anteil: 0.05, fahrzeuge: [] },
  ],
  // kleine Ausbauten (Spinde, Alarmmonitor, ...) ohne Erdarbeiten und Kran
  phasen_klein: [
    { id: "anlieferung", name: "Anlieferung", anteil: 0.3, fahrzeuge: ["kipper"], laut: true },
    { id: "einbau", name: "Einbau", anteil: 0.6, fahrzeuge: ["transporter"] },
    { id: "abnahme", name: "Abnahme", anteil: 0.1, fahrzeuge: [] },
  ],
  // Rasenplatz: nach dem Säen muss der Rasen anwachsen, bevor die Linien kommen
  phasen_rasen: [
    { id: "erdarbeiten", name: "Bodenaustausch", anteil: 0.2, fahrzeuge: ["bagger", "kipper"], laut: true },
    { id: "drainage", name: "Drainage", anteil: 0.15, fahrzeuge: ["bagger"], laut: true },
    { id: "einsaat", name: "Einsaat", anteil: 0.1, fahrzeuge: ["traktor"] },
    { id: "anwachsen", name: "Rasen wächst an", anteil: 0.45, fahrzeuge: [] },
    { id: "linierung", name: "Linierung", anteil: 0.05, fahrzeuge: ["linierwagen"] },
    { id: "abnahme", name: "Abnahme", anteil: 0.05, fahrzeuge: [] },
  ],
  // Behelfsbetrieb, solange am Gerätehaus bzw. an der Dienststelle gebaut wird (Container-Umkleide, enge Zufahrt)
  behelf: { umziehen_s: 30, ausruecken_s: 20, reaktion_s: 20 },
  // Baustellenampel und Baufahrzeuge auf der Straße in lauten Phasen: wer in der Nähe vorbei muss, verliert Zeit
  verkehr: { radius: 20, fahrzeug_s: 25, zu_fuss_s: 8 },
  // Anteil der Zeit, der bei diesem Wetter auf der Baustelle verloren geht (wird am Ende einmal nachgerechnet)
  wetter_verzug: { sturm: 1, schnee: 0.6, glaette: 0.6, nass: 0.25 },
  // Die Baufirma hat zwei Kolonnen; weitere Aufträge warten, bis eine frei wird
  parallel_max: 2,
}

/**
 * Gebäude in Stufen. Gerätehaus angelehnt an die Gliederung der Ortsfeuerwehren in Niedersachsen
 * (Grundausstattungs-, Stützpunkt-, Schwerpunktfeuerwehr). stellplaetze begrenzt die Zahl der Fahrzeuge.
 */
const GEBAEUDE = {
  geraetehaus: [
    { name: "Unterstand am Dorfplatz", bauzeit_h: 0, stellplaetze: 1, preis: 0, umziehen_s: 90, lager_slots: 6 },
    { name: "Kleines Gerätehaus", bauzeit_h: 8, stellplaetze: 1, preis: 2500, umziehen_s: 75, lager_slots: 12 },
    { name: "Gerätehaus Grundausstattungsfeuerwehr", bauzeit_h: 24, stellplaetze: 2, preis: 9000, umziehen_s: 60, lager_slots: 20, quelle: "fwvo_nds", hinweis: "mindestens ein Löschfahrzeug mit Staffelbesatzung" },
    { name: "Gerätehaus Stützpunktfeuerwehr", bauzeit_h: 48, stellplaetze: 4, preis: 30000, umziehen_s: 50, lager_slots: 40, quelle: "fwvo_nds", hinweis: "Löschfahrzeug mit Gruppenbesatzung und ein weiteres Fahrzeug" },
    { name: "Gerätehaus Schwerpunktfeuerwehr", bauzeit_h: 96, stellplaetze: 7, preis: 90000, umziehen_s: 40, lager_slots: 80, quelle: "fwvo_nds" },
  ],
  dienststelle: [
    { name: "Büro der Kontaktbeamtin/des Kontaktbeamten", bauzeit_h: 0, stellplaetze: 0, preis: 0, lager_slots: 4, personal_max: 1 },
    { name: "Polizeistation", bauzeit_h: 24, stellplaetze: 2, preis: 8000, lager_slots: 12, personal_max: 4 },
    { name: "Polizeikommissariat", bauzeit_h: 72, stellplaetze: 5, preis: 40000, lager_slots: 30, personal_max: 12, rund_um_die_uhr: true },
  ],
  // Sportplatz in der Südostecke (Konzept DORFDIENSTE.md, Abschnitt 12). fitness: Gewinn je Training im Verein,
  // trimm: Trimm-dich-Pfad für alle, licht: Training auch im Winter. Maße angelehnt an DIN 18035-1, verkleinert.
  sportplatz: [
    { name: "kein Sportplatz", bauzeit_h: 0, preis: 0 },
    { name: "Brachfläche", bauzeit_h: 1, preis: 2000, ab_level: 5 },
    { name: "Bolzwiese mit zwei Toren", bauzeit_h: 4, preis: 1500, ab_level: 5, fitness: 0.5 },
    { name: "Trimm-dich-Pfad", bauzeit_h: 8, preis: 3000, ab_level: 5, fitness: 0.5, trimm: true },
    { name: "Rasenplatz mit Drainage", bauzeit_h: 48, bauzeit_winter_h: 120, phasen: "rasen", preis: 12000, ab_level: 5, fitness: 0.8, trimm: true, hinweis: "Rasen wächst im Winter langsamer an" },
    { name: "Vereinsheim mit Umkleiden und Duschen", bauzeit_h: 48, preis: 15000, ab_level: 12, fitness: 0.8, trimm: true },
    { name: "Flutlicht", bauzeit_h: 12, preis: 8000, ab_level: 12, fitness: 0.8, trimm: true, licht: true },
    { name: "400-m-Laufbahn mit Tribüne und Kiosk", bauzeit_h: 72, preis: 30000, ab_level: 20, fitness: 1, trimm: true, licht: true },
    { name: "Übungsbahn der Feuerwehr und Kraftraum", bauzeit_h: 36, preis: 20000, ab_level: 24, fitness: 1, trimm: true, licht: true },
    { name: "Sporthalle mit Lehrschwimmbecken", bauzeit_h: 120, preis: 60000, ab_level: 27, fitness: 1, trimm: true, licht: true },
  ],
}

/** Wo an einem Gebäude gebaut wird (Ort aus ORTE). */
const GEBAEUDE_ORT = { geraetehaus: "feuerwehrhaus", dienststelle: "dienststelle", sportplatz: "sportplatz" }

/** Ausbauten, die einzeln gekauft werden. */
const AUSBAU = {
  spinde: { gebaeude: "geraetehaus", name: "Spinde mit fester Anordnung", preis: 600, effekt: { umziehen_s: -15 }, bauzeit_h: 2, klein: true, ab_stufe: 1 },
  schwarz_weiss: { gebaeude: "geraetehaus", name: "Schwarz-Weiß-Trennung", preis: 4000, effekt: { gesundheit: 1 }, bauzeit_h: 12, ab_stufe: 2 },
  parkplatz: { gebaeude: "geraetehaus", name: "Parkplätze für Einsatzkräfte", preis: 1500, effekt: { auto_extra_s: -20 }, bauzeit_h: 6, ab_stufe: 1 },
  fahrradstaender: { gebaeude: "geraetehaus", name: "Überdachte Fahrradständer", preis: 300, effekt: { fahrrad_extra_s: -5 }, bauzeit_h: 2, klein: true, ab_stufe: 0 },
  alarmmonitor: { gebaeude: "geraetehaus", name: "Alarmmonitor mit Einsatzkarte", preis: 1200, effekt: { ausruecken_s: -20 }, bauzeit_h: 1, klein: true, ab_stufe: 1 },
  schlauchwaesche: { gebaeude: "geraetehaus", name: "Schlauchwaschanlage", preis: 5000, effekt: { schlauchpflege_faktor: 0.5 }, bauzeit_h: 8, klein: true, ab_stufe: 2 },
  schlauchturm: { gebaeude: "geraetehaus", name: "Schlauchtrockenturm", preis: 9000, effekt: { schlauchpflege_faktor: 0.5 }, bauzeit_h: 24, ab_stufe: 3 },
  atemschutzwerkstatt: { gebaeude: "geraetehaus", name: "Atemschutzwerkstatt", preis: 12000, effekt: { atemschutz_pflege_faktor: 0.4 }, bauzeit_h: 24, ab_stufe: 3 },
  funkraum: { gebaeude: "geraetehaus", name: "Funkraum", preis: 3000, effekt: { fuehrung: 1 }, bauzeit_h: 6, klein: true, ab_stufe: 2 },
  uebungshof: { gebaeude: "geraetehaus", name: "Übungshof", preis: 8000, effekt: { lehrgang_faktor: 0.8 }, bauzeit_h: 24, ab_stufe: 3 },
  // Zusätzliche Unterflurhydranten an den Plätzen aus HYDRANT_PLAETZE (Index), mit Hinweisschild nach DIN 4066
  hydrant_a: { gebaeude: "ort", name: "Unterflurhydrant mit Hinweisschild (Platz 1)", preis: 2500, effekt: { hydrant_platz: 0 }, bauzeit_h: 8, ab_stufe: 0, quelle: "nbrandschg", hinweis: "verkürzt den Weg zur Wasserversorgung bei Bränden in der Nähe" },
  hydrant_b: { gebaeude: "ort", name: "Unterflurhydrant mit Hinweisschild (Platz 2)", preis: 2500, effekt: { hydrant_platz: 1 }, bauzeit_h: 8, ab_stufe: 0, quelle: "nbrandschg", hinweis: "verkürzt den Weg zur Wasserversorgung bei Bränden in der Nähe" },
  hydrantennetz: { gebaeude: "ort", name: "Hydrantennetz im Dorf erneuern", preis: 15000, effekt: { hydrant_l_min: 1600 }, bauzeit_h: 72, ab_stufe: 0, quelle: "nbrandschg", hinweis: "Grundversorgung mit Löschwasser ist Aufgabe der Gemeinde" },
  sirene_neu: { gebaeude: "ort", name: "Elektronische Sirene", preis: 2000, effekt: { reaktion_s: -15 }, bauzeit_h: 4, klein: true, ab_stufe: 0 },
  wache_kueche: { gebaeude: "dienststelle", name: "Sozialraum", preis: 1500, effekt: { schicht: 1 }, bauzeit_h: 6, klein: true, ab_stufe: 1 },
  gewahrsam: { gebaeude: "dienststelle", name: "Gewahrsamsraum", preis: 6000, effekt: { festnahme: 1 }, bauzeit_h: 24, ab_stufe: 2 },
}

/**
 * Einsatzarten. Werden zuerst freigeschaltet (Vorgänger gut genug bewältigt), dann gekauft.
 * Ab dem Kauf treten sie regelmäßig auf.
 *
 * intervall_min: mittlerer Abstand zwischen zwei Einsätzen dieser Art (mit Streuung ±30 %).
 * ablauf_min: Zeit ab Meldung, bis jemand eingetroffen sein muss, sonst verfällt der Einsatz.
 * arbeit_min: reine Arbeitszeit vor Ort bei optimaler Besetzung.
 * ziel_eintreffen_min: angestrebte Eintreffzeit (orientiert an kommunalen Bedarfsplänen, keine NDS-Vorgabe).
 * ziel_ende_min: Einsatz beendet für volle Sterne; ohne Angabe ziel_eintreffen_min + arbeit_min.
 * wachstum: Lagen, die mit der Zeit schlimmer werden (Brand breitet sich aus): Faktor je Minute Verzug.
 * mindestens: ohne das wird nicht ausgerückt bzw. nicht begonnen.
 * optimal: fehlt etwas davon, gibt es Abzüge bei den Sternen.
 * regeln: Vorschriften, die geprüft werden (siehe REGELN).
 * bedingung: Wetter, Jahreszeit, Uhrzeit.
 * folge: weitere Einsätze, die automatisch mit entstehen (z. B. Verkehrsregelung durch die Polizei).
 */
const EINSATZARTEN = {
  // Feuerwehr, Einstieg
  tier_katze: {
    org: "feuerwehr", name: "Katze auf Baum", stichwort: "TH Tier", preis: 50, start: true, harmlos: true,
    orte: ["baum_feuerwehr", "baum_bibliothek", "baum_markt"],
    intervall_min: 60, ablauf_min: 5, arbeit_min: 4, ziel_eintreffen_min: 4,
    mindestens: { personen: 1, geraete: [[{ steckleiter_teil: 2 }, { klappleiter: 1 }, { multifunktionsleiter: 1 }, { schiebleiter: 1 }]] },
    optimal: { personen: 3, geraete: [[{ tierhandschuhe: 1 }], [{ transportbox: 1 }]] },
    regeln: ["leiter_sicherung"],
    text: "Eine Katze sitzt seit Stunden in der Krone und traut sich nicht herunter.",
    verfallen_text: "Die Katze ist allein heruntergeklettert. Diesmal ging es gut.",
  },
  b_muelltonne: {
    org: "feuerwehr", name: "Mülltonnenbrand", stichwort: "B klein", preis: 120,
    freischaltung: { nach: "tier_katze", sterne: 3 },
    orte: ["muelltonnen"], intervall_min: 120, ablauf_min: 8, arbeit_min: 4, ziel_eintreffen_min: 6, wachstum: 0.08,
    mindestens: { personen: 1, geraete: [[{ pulverloescher: 1 }, { schaumloescher: 1 }, { kuebelspritze: 1 }, { loeschrucksack: 1 }]] },
    optimal: { personen: 2, geraete: [[{ schaumloescher: 1 }, { d_strahlrohr: 1, d_schlauch: 2, standrohr: 1 }, { cm_strahlrohr: 1, c_schlauch_15: 2, standrohr: 1 }]] },
    psa: { helm: 1, handschuhe: 1 },
    text: "Am Markt brennt eine Mülltonne, Rauch zieht über den Platz.",
    verfallen_text: "Die Tonne ist heruntergebrannt, die Nachbarn haben mit Gartenschlauch nachgelöscht.",
  },
  b_hecke: {
    org: "feuerwehr", name: "Heckenbrand", stichwort: "B klein", preis: 300,
    freischaltung: { nach: "b_muelltonne", sterne: 3 },
    orte: ["hecke_nachbar", "hecke_werkstatt"], intervall_min: 180, ablauf_min: 12, arbeit_min: 10, ziel_eintreffen_min: 8, wachstum: 0.1,
    mindestens: { personen: 2, geraete: [[{ ts_alt: 1 }, { pfpn_1000: 1 }, { pfpn_1500: 1 }, { fahrzeug_wasser: 1 }], [{ c_schlauch_15: 2 }, { c_schlauch_20: 2 }], [{ cm_strahlrohr: 1 }, { c_hohlstrahlrohr: 1 }], [{ standrohr: 1 }, { fahrzeug_wasser: 1 }]] },
    optimal: { personen: 6, einheit: "staffel", geraete: [[{ verteiler: 1, b_schlauch: 1 }], [{ hrt: 1 }]] },
    psa: { helm: 1, handschuhe: 1, jacke: 1 },
    regeln: ["einheitsfuehrer", "maschinist_pumpe"],
    text: "Eine Thujahecke brennt auf mehreren Metern und droht auf das Gartenhaus überzugreifen.",
    verfallen_text: "Das Gartenhaus hat Feuer gefangen. Die Nachbarwehr musste übernehmen.",
  },
  th_oelspur: {
    org: "feuerwehr", name: "Ölspur auf der Fahrbahn", stichwort: "TH klein", preis: 250,
    freischaltung: { nach: "tier_katze", sterne: 4 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west", "kreuzung"], intervall_min: 300, ablauf_min: 20, arbeit_min: 15, ziel_eintreffen_min: 10,
    mindestens: { personen: 2, geraete: [[{ oelbinder: 2 }], [{ besen_schaufel: 1 }]] },
    optimal: { personen: 4, geraete: [[{ oelbinder: 4 }], [{ leitkegel: 1 }], [{ warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["p_verkehrsregelung"],
    text: "Ein Traktor verliert Hydrauliköl, die Spur zieht sich durch den Ort.",
    verfallen_text: "Der Bauhof hat die Spur übernommen. Ein Radfahrer ist gestürzt.",
  },
  // Feuerwehr, Wetterlagen
  th_baum_strasse: {
    org: "feuerwehr", name: "Baum auf Straße", stichwort: "TH Sturm", preis: 600,
    freischaltung: { nach: "th_oelspur", sterne: 3 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west"], intervall_min: 600, ablauf_min: 30, arbeit_min: 20, ziel_eintreffen_min: 10,
    bedingung: { wetter: ["sturm"], sonst_faktor: 0.1 },
    mindestens: { personen: 2, qualifikation: { motorsaege: 1 }, geraete: [[{ motorsaege: 1 }]] },
    optimal: { personen: 6, geraete: [[{ leitkegel: 1 }], [{ warnleuchte: 1 }], [{ beleuchtung: 1 }]] },
    psa: { helm: 2 },
    regeln: ["verkehrsabsicherung", "einheitsfuehrer"],
    text: "Eine Pappel ist umgestürzt und blockiert beide Fahrstreifen.",
    verfallen_text: "Die Straße blieb stundenlang gesperrt.",
  },
  th_wasser_keller: {
    org: "feuerwehr", name: "Wasser im Keller", stichwort: "TH Wasser", preis: 500,
    freischaltung: { nach: "b_hecke", sterne: 3 },
    orte: ["nachbarhaus", "bibliothek"], intervall_min: 720, ablauf_min: 40, arbeit_min: 25, ziel_eintreffen_min: 12,
    bedingung: { wetter: ["nass", "sturm"], sonst_faktor: 0.15 },
    mindestens: { personen: 2, geraete: [[{ tauchpumpe: 1 }], [{ b_schlauch: 1 }, { c_schlauch_15: 2 }]] },
    optimal: { personen: 4, geraete: [[{ wassersauger: 1 }], [{ stromerzeuger: 1 }]] },
    psa: { stiefel: 1 },
    text: "Nach Starkregen steht das Wasser knöcheltief im Keller.",
    verfallen_text: "Die Heizung ist abgesoffen.",
  },
  b_flaeche: {
    org: "feuerwehr", name: "Flächenbrand am Deich", stichwort: "B Wald/Fläche", preis: 900,
    freischaltung: { nach: "b_hecke", sterne: 4 },
    orte: ["wiese_deich"], intervall_min: 480, ablauf_min: 15, arbeit_min: 20, ziel_eintreffen_min: 10, wachstum: 0.15,
    bedingung: { wetter: ["hitze", "trocken"], monate: [4, 5, 6, 7, 8, 9], sonst_faktor: 0 },
    mindestens: { personen: 4, geraete: [[{ feuerpatsche: 4 }, { loeschrucksack: 2 }, { fahrzeug_wasser: 1, c_schlauch_15: 2, cm_strahlrohr: 1 }]] },
    optimal: { personen: 9, einheit: "gruppe", geraete: [[{ fahrzeug_wasser: 1 }], [{ loeschrucksack: 2 }], [{ hrt: 2 }]] },
    psa: { helm: 1, stiefel: 1, handschuhe: 1 },
    regeln: ["einheitsfuehrer"],
    text: "Trockenes Gras am Deichfuß brennt, der Wind treibt das Feuer Richtung Weide.",
    verfallen_text: "Mehrere Hektar sind abgebrannt, der Deich ist geschädigt.",
  },
  th_eis: {
    org: "feuerwehr", name: "Person im Eis eingebrochen", stichwort: "TH Wasser Person", preis: 2500,
    freischaltung: { nach: "th_wasser_keller", sterne: 4 },
    orte: ["elbe_ufer"], intervall_min: 1440, ablauf_min: 10, arbeit_min: 12, ziel_eintreffen_min: 7,
    bedingung: { wetter: ["glaette", "schnee"], monate: [12, 1, 2], sonst_faktor: 0 },
    mindestens: { personen: 3, qualifikation: { eisrettung: 1 }, geraete: [[{ eisretter: 1 }, { rettungsring: 1, wathose: 1 }]] },
    optimal: { personen: 6, geraete: [[{ eisretter: 1 }], [{ rettungsweste: 2 }], [{ notfallrucksack: 1 }]] },
    regeln: ["eigenschutz_wasser", "einheitsfuehrer"],
    text: "Ein Spaziergänger ist auf dem Altarm durchs Eis gebrochen.",
    verfallen_text: "Passanten haben die Person mit einem Ast herausgezogen, sie ist stark unterkühlt.",
  },
  // Feuerwehr, mittlere Lagen
  b_pkw: {
    org: "feuerwehr", name: "PKW-Brand", stichwort: "B PKW", preis: 1200,
    freischaltung: { nach: "b_hecke", sterne: 4 },
    orte: ["hauptstrasse_ost", "festplatz", "marktplatz"], intervall_min: 600, ablauf_min: 12, arbeit_min: 12, ziel_eintreffen_min: 8, wachstum: 0.12,
    mindestens: { personen: 4, qualifikation: { agt: 2 }, geraete: [[{ pressluftatmer: 2 }], [{ fahrzeug_wasser: 1 }, { pfpn_1000: 1, standrohr: 1 }], [{ cm_strahlrohr: 1 }, { c_hohlstrahlrohr: 1 }], [{ c_schlauch_15: 2 }]] },
    optimal: { personen: 6, einheit: "staffel", geraete: [[{ schaummittel: 1 }], [{ leitkegel: 1 }], [{ hrt: 1 }], [{ atemschutzueberwachung: 1 }]] },
    psa: { helm: 2, jacke: 2, handschuhe: 1, haube: 1 },
    regeln: ["einheitsfuehrer", "atemschutz_ueberwachung", "verkehrsabsicherung", "maschinist_pumpe"],
    folge: ["p_verkehrsregelung"],
    text: "Ein Kleinwagen brennt im Motorraum, der Fahrer konnte sich retten.",
    verfallen_text: "Das Auto ist ausgebrannt, ein zweites daneben beschädigt.",
  },
  bma: {
    org: "feuerwehr", name: "Brandmeldeanlage ausgelöst", stichwort: "BMA", preis: 1500,
    freischaltung: { nach: "b_pkw", sterne: 3 },
    orte: ["schule", "bibliothek"], intervall_min: 900, ablauf_min: 15, arbeit_min: 10, ziel_eintreffen_min: 8,
    mindestens: { personen: 4, qualifikation: { agt: 2, tf: 1 }, geraete: [[{ pressluftatmer: 2 }]] },
    optimal: { personen: 9, einheit: "gruppe", geraete: [[{ waermebildkamera: 1 }], [{ hrt: 2 }], [{ schiebleiter: 1 }, { dlak_fahrzeug: 1 }]] },
    psa: { helm: 2, jacke: 2, haube: 1 },
    regeln: ["einheitsfuehrer", "atemschutz_ueberwachung"],
    zufall: { fehlalarm: 0.7, folge_bei_echt: "b_wohnung" },
    text: "Die Brandmeldeanlage meldet Rauch im Gebäude. Ob es brennt, ist unklar.",
    verfallen_text: "Der Hausmeister hat Entwarnung gegeben, aber niemand hat nachgesehen.",
  },
  th_tuer: {
    org: "feuerwehr", name: "Türöffnung, Person hilflos in Wohnung", stichwort: "TH Türöffnung", preis: 1100,
    freischaltung: { nach: "p_hilflos", sterne: 3 },
    orte: ["nachbarhaus"], intervall_min: 720, ablauf_min: 15, arbeit_min: 8, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ tueroeffnung: 1 }, { steckleiter_teil: 2 }, { klappleiter: 1 }]] },
    optimal: { personen: 3, qualifikation: { erste_hilfe: 1 }, geraete: [[{ notfallrucksack: 1 }]] },
    regeln: ["polizei_vor_ort"],
    folge: ["p_tuer_begleitung"],
    text: "Eine ältere Nachbarin öffnet nicht, durch die Tür sind Hilferufe zu hören.",
    verfallen_text: "Der Rettungsdienst hat die Tür mit dem Schlüsseldienst geöffnet, deutlich später.",
  },
  fr_reanimation: {
    org: "feuerwehr", name: "First Responder: Person bewusstlos", stichwort: "FR", preis: 2000,
    freischaltung: { nach: "th_tuer", sterne: 4 },
    orte: ["marktplatz", "festplatz", "bibliothek"], intervall_min: 1440, ablauf_min: 6, arbeit_min: 10, ziel_eintreffen_min: 5,
    mindestens: { personen: 2, qualifikation: { erste_hilfe: 2 }, geraete: [[{ aed: 1 }], [{ notfallrucksack: 1 }]] },
    optimal: { personen: 3, geraete: [[{ hrt: 1 }]] },
    text: "Ein Mann ist am Markt zusammengebrochen, Passanten beginnen mit der Herzdruckmassage.",
    verfallen_text: "Der Rettungsdienst war nach zwölf Minuten da. Jede Minute zählt.",
  },
  th_vu: {
    org: "feuerwehr", name: "Verkehrsunfall, Person eingeklemmt", stichwort: "TH VU P", preis: 4000,
    freischaltung: { nach: "b_pkw", sterne: 4 },
    orte: ["kreuzung", "hauptstrasse_ost", "hauptstrasse_west"], intervall_min: 1440, ablauf_min: 15, arbeit_min: 25, ziel_eintreffen_min: 8,
    bedingung: { wetter: ["glaette", "schnee", "nass"], faktor: 2.5 },
    mindestens: { personen: 6, qualifikation: { th: 2, tf: 1 }, geraete: [[{ rettungssatz: 1 }], [{ pulverloescher: 1 }, { fahrzeug_wasser: 1, cm_strahlrohr: 1 }], [{ unterbaumaterial: 1 }]] },
    optimal: { personen: 9, einheit: "gruppe", qualifikation: { erste_hilfe: 2 }, geraete: [[{ notfallrucksack: 1 }], [{ leitkegel: 1 }, { warnleuchte: 1 }], [{ beleuchtung: 1 }], [{ hrt: 2 }]] },
    psa: { helm: 2, jacke: 1, handschuhe: 1, th_kleidung: 1 },
    regeln: ["einheitsfuehrer", "brandschutz_sicherstellen", "verkehrsabsicherung"],
    folge: ["p_vu_aufnahme"],
    text: "Zwei Autos sind an der Kreuzung zusammengestoßen, eine Fahrerin ist eingeklemmt.",
    verfallen_text: "Die Nachbarwehr mit Rettungssatz hat übernommen. Die Rettung dauerte lange.",
  },
  th_pferd: {
    org: "feuerwehr", name: "Pferd im Graben", stichwort: "TH Tier groß", preis: 3000,
    freischaltung: { nach: "th_vu", sterne: 3 },
    orte: ["wiese_deich"], intervall_min: 2880, ablauf_min: 45, arbeit_min: 40, ziel_eintreffen_min: 15,
    mindestens: { personen: 6, qualifikation: { th: 1 }, geraete: [[{ hebegurte: 1 }]] },
    optimal: { personen: 9, geraete: [[{ beleuchtung: 1 }], [{ stromerzeuger: 1 }]] },
    regeln: ["einheitsfuehrer"],
    text: "Ein Pferd ist in einen Entwässerungsgraben gerutscht und kommt allein nicht heraus. Die Tierärztin ist unterwegs.",
    verfallen_text: "Ein Landwirt hat mit dem Frontlader geholfen, das Pferd ist verletzt.",
  },
  abc_gas: {
    org: "feuerwehr", name: "Gasgeruch im Gebäude", stichwort: "ABC Gas", preis: 3500,
    freischaltung: { nach: "bma", sterne: 4 },
    orte: ["nachbarhaus", "schule"], intervall_min: 2880, ablauf_min: 12, arbeit_min: 20, ziel_eintreffen_min: 8,
    mindestens: { personen: 6, qualifikation: { agt: 2, abc: 1 }, geraete: [[{ mehrgasmessgeraet: 1 }], [{ pressluftatmer: 2 }]] },
    optimal: { personen: 9, einheit: "gruppe", geraete: [[{ luefter: 1 }], [{ hrt: 2 }]] },
    psa: { jacke: 2 },
    regeln: ["einheitsfuehrer", "atemschutz_ueberwachung", "sicherheitstrupp", "polizei_absperrung"],
    folge: ["p_absperrung"],
    text: "Im Treppenhaus riecht es stark nach Gas, die Bewohner stehen auf der Straße.",
    verfallen_text: "Der Netzbetreiber hat das Haus abgesperrt und die Leitung geschlossen.",
  },
  // Feuerwehr, große Lagen
  b_wohnung: {
    org: "feuerwehr", name: "Zimmerbrand, Menschenleben in Gefahr", stichwort: "B MiG", preis: 8000,
    freischaltung: { nach: "bma", sterne: 4 },
    orte: ["nachbarhaus"], intervall_min: 4320, ablauf_min: 10, arbeit_min: 30, ziel_eintreffen_min: 8, wachstum: 0.2,
    mindestens: { personen: 9, einheit: "gruppe", qualifikation: { agt: 6, tf: 1, maschinist: 1 }, geraete: [[{ pressluftatmer: 6 }], [{ c_schlauch_15: 6 }], [{ cm_strahlrohr: 2 }, { c_hohlstrahlrohr: 2 }, { cm_strahlrohr: 1, c_hohlstrahlrohr: 1 }], [{ verteiler: 1 }], [{ fahrzeug_wasser: 1 }, { standrohr: 1, b_schlauch: 2 }]] },
    optimal: { personen: 22, einheit: "zug", qualifikation: { gf: 1 }, geraete: [[{ waermebildkamera: 1 }], [{ dlak_fahrzeug: 1 }, { schiebleiter: 1 }], [{ luefter: 1 }], [{ rauchvorhang: 1 }], [{ sprungpolster: 1 }], [{ hrt: 4 }], [{ rettungstuch: 1 }]] },
    psa: { helm: 2, jacke: 2, handschuhe: 1, haube: 1, stiefel: 1 },
    regeln: ["einheitsfuehrer", "atemschutz_ueberwachung", "sicherheitstrupp", "maschinist_pumpe", "zweiter_rettungsweg"],
    folge: ["p_absperrung"],
    text: "Aus dem Obergeschoss dringt Rauch, eine Person ist am Fenster zu sehen.",
    verfallen_text: "Die Nachbarfeuerwehren haben übernommen. Die Wohnung ist ausgebrannt.",
  },
  b_scheune: {
    org: "feuerwehr", name: "Scheunenbrand", stichwort: "B landwirtschaftlich", preis: 12000,
    freischaltung: { nach: "b_wohnung", sterne: 3 },
    orte: ["scheune"], intervall_min: 10080, ablauf_min: 15, arbeit_min: 90, ziel_eintreffen_min: 10, wachstum: 0.15,
    mindestens: { personen: 18, qualifikation: { agt: 4, gf: 1, maschinist: 2 }, geraete: [[{ b_schlauch: 15 }], [{ bm_strahlrohr: 1 }, { cm_strahlrohr: 3 }], [{ fahrzeug_wasser: 2 }], [{ pressluftatmer: 4 }]] },
    optimal: { personen: 30, qualifikation: { zf: 1 }, geraete: [[{ elw_fahrzeug: 1 }], [{ dlak_fahrzeug: 1 }], [{ tlf_fahrzeug: 1 }], [{ beleuchtung: 2 }], [{ a_saugschlauch: 4, saugkorb: 1 }]] },
    regeln: ["einheitsfuehrer", "atemschutz_ueberwachung", "maschinist_pumpe", "wasserversorgung_lange_wegstrecke"],
    folge: ["p_absperrung"],
    text: "Eine Strohscheune steht in Vollbrand, daneben steht ein Stall mit Rindern.",
    verfallen_text: "Kreisfeuerwehrbereitschaft alarmiert, die Scheune ist verloren.",
  },
  th_person_wasser: {
    org: "feuerwehr", name: "Person in der Elbe", stichwort: "TH Wasser Person", preis: 9000,
    freischaltung: { nach: "th_eis", sterne: 4 },
    orte: ["elbe_ufer"], intervall_min: 10080, ablauf_min: 12, arbeit_min: 30, ziel_eintreffen_min: 8,
    bedingung: { monate: [5, 6, 7, 8, 9], sonst_faktor: 0.2 },
    mindestens: { personen: 3, qualifikation: { boot: 1 }, geraete: [[{ boot_fahrzeug: 1 }], [{ rettungsweste: 3 }]] },
    optimal: { personen: 6, geraete: [[{ drohne: 1 }], [{ notfallrucksack: 1 }]] },
    regeln: ["eigenschutz_wasser", "einheitsfuehrer"],
    text: "Ein Schwimmer wird von der Strömung abgetrieben.",
    verfallen_text: "Die DLRG-Wasserrettung hat ihn erreicht.",
  },
  th_deich: {
    org: "feuerwehr", name: "Deichverteidigung bei Elbhochwasser", stichwort: "TH Hochwasser", preis: 20000,
    freischaltung: { nach: "b_scheune", sterne: 3 },
    orte: ["deich"], intervall_min: 43200, ablauf_min: 120, arbeit_min: 240, ziel_eintreffen_min: 60,
    bedingung: { monate: [1, 2, 3, 4, 6], sonst_faktor: 0.1 },
    mindestens: { personen: 20, qualifikation: { zf: 1 }, geraete: [[{ sandsack: 10 }], [{ beleuchtung: 2 }]] },
    optimal: { personen: 40, geraete: [[{ sandsack: 20 }], [{ elw_fahrzeug: 1 }], [{ stromerzeuger: 2 }], [{ drohne: 1 }]] },
    regeln: ["einheitsfuehrer", "eigenschutz_wasser"],
    folge: ["p_absperrung"],
    text: "Der Pegel steigt, am Deichfuß tritt Wasser aus (Qualmwasser). Eine Sandsackauflast muss her.",
    verfallen_text: "Das Technische Hilfswerk hat übernommen, der Deich hielt knapp.",
  },

  // Baustellen: entstehen nur, solange gebaut wird, und kosten nichts (baustelle: true)
  th_baustelle: {
    org: "feuerwehr", name: "Arbeitsunfall auf der Baustelle", stichwort: "TH Person", preis: 0, baustelle: true, phasen: ["rohbau", "dach"],
    orte: ["baustelle"], intervall_min: 600, ablauf_min: 12, arbeit_min: 15, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ klappleiter: 1 }, { steckleiter_teil: 2 }, { multifunktionsleiter: 1 }, { schiebleiter: 1 }]] },
    optimal: { personen: 6, geraete: [[{ notfallrucksack: 1 }], [{ schiebleiter: 1 }, { multifunktionsleiter: 1 }]] },
    psa: { helm: 1, handschuhe: 1 },
    regeln: ["leiter_sicherung", "einheitsfuehrer"],
    text: "Ein Bauarbeiter ist vom Gerüst gestürzt und liegt verletzt im Rohbau. Der Rettungsdienst braucht Hilfe beim Tragen.",
    verfallen_text: "Die Kollegen vom Bau haben ihn allein heruntergetragen.",
  },
  p_baustelle_diebstahl: {
    org: "polizei", name: "Diebstahl von der Baustelle", stichwort: "Diebstahl", preis: 0, baustelle: true,
    orte: ["baustelle"], intervall_min: 900, ablauf_min: 60, arbeit_min: 20, ziel_eintreffen_min: 20,
    bedingung: { stunden: [22, 23, 0, 1, 2, 3, 4], sonst_faktor: 0.1 },
    mindestens: { personen: 1 },
    optimal: { personen: 2, geraete: [[{ taschenlampe: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    text: "Vom Bauzaun aus wurde Kupferkabel aus dem Container geholt. Der Bauleiter hat Anzeige erstattet.",
    verfallen_text: "Die Spuren sind verwischt, die Anzeige läuft gegen Unbekannt.",
  },
  p_baulaerm: {
    org: "polizei", name: "Beschwerde über Baulärm", stichwort: "Lärm", preis: 0, harmlos: true, baustelle: true, phasen: ["erdarbeiten", "rohbau", "anlieferung"],
    orte: ["baustelle"], intervall_min: 720, ablauf_min: 45, arbeit_min: 8, ziel_eintreffen_min: 20,
    bedingung: { stunden: [6, 7, 20, 21], sonst_faktor: 0.15 },
    mindestens: { personen: 1 },
    optimal: { personen: 1 },
    text: "Nachbarn beschweren sich: Der Bagger läuft schon vor sieben Uhr.",
    verfallen_text: "Der Bauleiter hat die Arbeiten von sich aus verschoben.",
  },

  // Polizei
  p_ruhestoerung: {
    org: "polizei", name: "Ruhestörung bei den Nachbarn", stichwort: "Ruhestörung", preis: 80, start_polizei: true, harmlos: true,
    orte: ["nachbarhaus"], intervall_min: 720, ablauf_min: 30, arbeit_min: 8, ziel_eintreffen_min: 15,
    bedingung: { stunden: [20, 21, 22, 23, 0, 1, 2], sonst_faktor: 0.2 },
    mindestens: { personen: 1 },
    optimal: { personen: 2, geraete: [[{ taschenlampe: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    quelle: "owig117",
    text: "Laute Musik und Gegröle aus dem Garten der Nachbarn, es ist nach 22 Uhr.",
    verfallen_text: "Die Party ist von allein zu Ende gegangen. Die Anrufer sind verärgert.",
  },
  p_falschparker: {
    org: "polizei", name: "Falschparker in der Feuerwehrzufahrt", stichwort: "Verkehr", preis: 150, harmlos: true,
    freischaltung: { nach: "p_ruhestoerung", sterne: 3 },
    orte: ["schule", "marktplatz"], intervall_min: 480, ablauf_min: 45, arbeit_min: 10, ziel_eintreffen_min: 20,
    mindestens: { personen: 1 },
    optimal: { personen: 2 },
    wirkung: { feuerwehr_zufahrt_blockiert: true, fahrzeit_faktor: 1.4 },
    quelle: "stvo12",
    text: "Ein Lieferwagen steht in der Feuerwehrzufahrt. Solange er dort steht, kommt die Feuerwehr dort schlechter durch.",
    verfallen_text: "Der Fahrer ist irgendwann weggefahren.",
  },
  p_hilflos: {
    org: "polizei", name: "Hilflose Person", stichwort: "Hilfeleistung", preis: 250,
    freischaltung: { nach: "p_ruhestoerung", sterne: 3 },
    orte: ["marktplatz", "festplatz", "deich"], intervall_min: 720, ablauf_min: 25, arbeit_min: 15, ziel_eintreffen_min: 12,
    bedingung: { wetter: ["glaette", "schnee"], faktor: 1.5 },
    mindestens: { personen: 2 },
    optimal: { personen: 2, geraete: [[{ notfallrucksack: 1 }]] },
    text: "Eine ältere Person irrt orientierungslos über den Platz.",
    verfallen_text: "Angehörige haben die Person gefunden.",
  },
  p_vu_sachschaden: {
    org: "polizei", name: "Verkehrsunfall mit Sachschaden", stichwort: "VU", preis: 400,
    freischaltung: { nach: "p_falschparker", sterne: 3 },
    orte: ["kreuzung", "hauptstrasse_ost", "marktplatz"], intervall_min: 720, ablauf_min: 40, arbeit_min: 20, ziel_eintreffen_min: 15,
    bedingung: { wetter: ["glaette", "schnee", "nass"], faktor: 3 },
    mindestens: { personen: 2 },
    optimal: { personen: 2, qualifikation: { vu_aufnahme: 1 }, geraete: [[{ unfallaufnahme: 1 }], [{ leitkegel: 1 }, { warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    text: "Auffahrunfall an der Kreuzung, beide Fahrer streiten über die Schuld.",
    verfallen_text: "Die Beteiligten haben Daten getauscht und sind weitergefahren.",
  },
  p_ladendiebstahl: {
    org: "polizei", name: "Ladendiebstahl am Markt", stichwort: "Diebstahl", preis: 500,
    freischaltung: { nach: "p_hilflos", sterne: 3 },
    orte: ["marktplatz"], intervall_min: 1440, ablauf_min: 30, arbeit_min: 25, ziel_eintreffen_min: 15,
    bedingung: { stunden: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], sonst_faktor: 0 },
    mindestens: { personen: 2 },
    optimal: { personen: 2, geraete: [[{ hrt: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    text: "Ein Marktbeschicker hält einen Jugendlichen fest, der Ware eingesteckt haben soll.",
    verfallen_text: "Der Beschuldigte ist weggelaufen.",
  },
  p_wild: {
    org: "polizei", name: "Wildunfall", stichwort: "VU Wild", preis: 300,
    freischaltung: { nach: "p_vu_sachschaden", sterne: 3 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west"], intervall_min: 1440, ablauf_min: 40, arbeit_min: 20, ziel_eintreffen_min: 15,
    bedingung: { stunden: [5, 6, 7, 18, 19, 20, 21], faktor: 2 },
    mindestens: { personen: 1 },
    optimal: { personen: 2, geraete: [[{ warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    text: "Ein Reh ist angefahren worden. Die Jagdausübungsberechtigte muss verständigt werden.",
    verfallen_text: "Das Tier liegt noch am Fahrbahnrand.",
  },
  p_einbruch: {
    org: "polizei", name: "Wohnungseinbruch", stichwort: "Einbruch", preis: 1500,
    freischaltung: { nach: "p_ladendiebstahl", sterne: 4 },
    orte: ["nachbarhaus"], intervall_min: 4320, ablauf_min: 60, arbeit_min: 45, ziel_eintreffen_min: 20,
    mindestens: { personen: 2 },
    optimal: { personen: 3, qualifikation: { spurensicherung: 1 }, geraete: [[{ spurensicherung: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    text: "Die Nachbarn kommen aus dem Urlaub zurück, die Terrassentür ist aufgehebelt.",
    verfallen_text: "Die Anzeige wurde online aufgenommen, Spuren sind verwischt.",
  },
  p_schlaegerei: {
    org: "polizei", name: "Schlägerei beim Schützenfest", stichwort: "Körperverletzung", preis: 2500,
    freischaltung: { nach: "p_einbruch", sterne: 3 },
    orte: ["festplatz"], intervall_min: 10080, ablauf_min: 10, arbeit_min: 40, ziel_eintreffen_min: 8,
    bedingung: { monate: [5, 6, 7, 8], wochentage: [5, 6], stunden: [21, 22, 23, 0, 1], sonst_faktor: 0 },
    mindestens: { personen: 4, qualifikation: { einsatztraining: 4 } },
    optimal: { personen: 8, geraete: [[{ hrt: 2 }], [{ notfallrucksack: 1 }]] },
    psa: { weste: 1, bodycam: 1 },
    regeln: ["eigensicherung_zwei"],
    folge: ["p_trunkenheit"],
    text: "Vor dem Festzelt prügeln sich mehrere Personen.",
    verfallen_text: "Der Sicherheitsdienst hat die Gruppen getrennt, ein Verletzter.",
  },
  p_trunkenheit: {
    org: "polizei", name: "Trunkenheitsfahrt", stichwort: "Verkehr", preis: 1800,
    freischaltung: { nach: "p_vu_sachschaden", sterne: 4 },
    orte: ["hauptstrasse_west", "kreuzung"], intervall_min: 4320, ablauf_min: 15, arbeit_min: 45, ziel_eintreffen_min: 10,
    bedingung: { stunden: [22, 23, 0, 1, 2, 3], sonst_faktor: 0.1 },
    mindestens: { personen: 2, geraete: [[{ atemalkohol: 1 }]] },
    optimal: { personen: 2, geraete: [[{ anhaltekelle: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    text: "Ein Zeuge meldet einen Wagen, der in Schlangenlinien durch den Ort fährt.",
    verfallen_text: "Der Wagen ist nicht mehr auffindbar.",
  },
  p_vermisst: {
    org: "polizei", name: "Vermisstes Kind", stichwort: "Vermisstensuche", preis: 6000,
    freischaltung: { nach: "p_schlaegerei", sterne: 3 },
    orte: ["deich", "elbe_ufer", "festplatz"], intervall_min: 20160, ablauf_min: 30, arbeit_min: 60, ziel_eintreffen_min: 10,
    mindestens: { personen: 4 },
    optimal: { personen: 10, qualifikation: { diensthund: 1, drohne: 1 }, geraete: [[{ drohne: 1 }], [{ hrt: 2 }], [{ beleuchtung: 1 }]] },
    regeln: ["einheitsfuehrer"],
    folge: ["fw_suche"],
    text: "Ein sechsjähriges Kind ist vom Spielplatz verschwunden, die Eltern sind verzweifelt.",
    verfallen_text: "Das Kind wurde von Anwohnern im Schilf gefunden, unterkühlt.",
  },
  // Folgeeinsätze (werden nicht gekauft, sondern von anderen ausgelöst)
  p_verkehrsregelung: {
    org: "polizei", name: "Verkehrsregelung an der Einsatzstelle", stichwort: "Verkehr", folge_nur: true,
    ablauf_min: 20, arbeit_min: 0, ziel_eintreffen_min: 12, dauer_wie_ausloeser: true,
    mindestens: { personen: 1 }, optimal: { personen: 2, geraete: [[{ leitkegel: 1 }], [{ anhaltekelle: 1 }]] },
    text: "Die Feuerwehr braucht eine abgesicherte Einsatzstelle.",
  },
  p_vu_aufnahme: {
    org: "polizei", name: "Unfallaufnahme", stichwort: "VU", folge_nur: true,
    ablauf_min: 30, arbeit_min: 30, ziel_eintreffen_min: 12,
    mindestens: { personen: 2 }, optimal: { personen: 2, qualifikation: { vu_aufnahme: 1 }, geraete: [[{ unfallaufnahme: 1 }]] },
    text: "Der Unfall muss aufgenommen werden.",
  },
  p_absperrung: {
    org: "polizei", name: "Absperrung der Einsatzstelle", stichwort: "Absperrung", folge_nur: true,
    ablauf_min: 20, arbeit_min: 0, ziel_eintreffen_min: 12, dauer_wie_ausloeser: true,
    mindestens: { personen: 2 }, optimal: { personen: 4, geraete: [[{ absperrband: 1 }], [{ leitkegel: 1 }]] },
    text: "Schaulustige drängen an die Einsatzstelle.",
  },
  p_tuer_begleitung: {
    org: "polizei", name: "Begleitung Türöffnung", stichwort: "Hilfeleistung", folge_nur: true,
    ablauf_min: 15, arbeit_min: 0, ziel_eintreffen_min: 10, dauer_wie_ausloeser: true,
    mindestens: { personen: 1 }, optimal: { personen: 2 },
    text: "Bei einer gewaltsamen Türöffnung sollte die Polizei dabei sein.",
  },
  fw_suche: {
    org: "feuerwehr", name: "Unterstützung Personensuche", stichwort: "TH Suche", folge_nur: true,
    ablauf_min: 30, arbeit_min: 0, ziel_eintreffen_min: 15, dauer_wie_ausloeser: true,
    mindestens: { personen: 6 }, optimal: { personen: 18, geraete: [[{ waermebildkamera: 1 }], [{ beleuchtung: 2 }], [{ drohne: 1 }]] },
    text: "Die Polizei bittet um Unterstützung bei der Suche im Gelände.",
  },
}

/**
 * Prüfregeln. Verstöße kosten Sterne (abzug) oder verhindern den Beginn (sperrt).
 * Die Simulation entscheidet anhand der Felder `pruefung`, was erfüllt ist.
 */
const REGELN = {
  leiter_sicherung: {
    name: "Leiter gesichert", abzug: 2, quelle: "fwdv10",
    pruefung: { personen_mindestens: 2 },
    text: "Steht nur eine Einsatzkraft da, sichert niemand die Leiter am Fuß.",
  },
  einheitsfuehrer: {
    name: "Einheit wird geführt", abzug: 1, quelle: "fwdv3",
    pruefung: { qualifikation: { tf: 1 } },
    text: "Ohne ausgebildete Führungskraft (mindestens Truppführer) fehlt die Ordnung an der Einsatzstelle.",
  },
  maschinist_pumpe: {
    name: "Pumpe von Maschinist bedient", abzug: 1, quelle: "fwdv3",
    pruefung: { qualifikation: { maschinist: 1 } },
    text: "Die Pumpe läuft ohne ausgebildeten Maschinisten, der Druck schwankt.",
  },
  atemschutz_ueberwachung: {
    name: "Atemschutzüberwachung", abzug: 1, quelle: "fwdv7",
    pruefung: { geraete: [[{ atemschutzueberwachung: 1 }]], hrt_je_trupp: 1 },
    text: "Atemschutztrupps müssen überwacht werden und Funk mitführen.",
  },
  sicherheitstrupp: {
    name: "Sicherheitstrupp bereit", sperrt: "innenangriff", quelle: "fwdv7",
    pruefung: { qualifikation: { agt: 4 }, geraete: [[{ pressluftatmer: 4 }]] },
    text: "Ohne bereitstehenden Sicherheitstrupp geht kein Trupp unter Atemschutz ins Gebäude.",
  },
  verkehrsabsicherung: {
    name: "Einsatzstelle abgesichert", abzug: 1,
    pruefung: { geraete: [[{ leitkegel: 1 }, { warnleuchte: 1 }, { faltsignal: 1 }], [{ polizei_vor_ort: 1 }, { warnleuchte: 1 }]] },
    text: "Auf der Fahrbahn gefährdet der fließende Verkehr die Einsatzkräfte.",
  },
  brandschutz_sicherstellen: {
    name: "Brandschutz sichergestellt", abzug: 1,
    pruefung: { geraete: [[{ pulverloescher: 1 }, { fahrzeug_wasser: 1, cm_strahlrohr: 1 }]] },
    text: "Bei Unfällen mit Fahrzeugen muss ein Löschmittel bereitstehen.",
  },
  zweiter_rettungsweg: {
    name: "Zweiter Rettungsweg", abzug: 1,
    pruefung: { geraete: [[{ steckleiter_teil: 4 }, { schiebleiter: 1 }, { dlak_fahrzeug: 1 }]] },
    text: "Über tragbare Leitern oder die Drehleiter muss ein zweiter Rettungsweg möglich sein.",
  },
  wasserversorgung_lange_wegstrecke: {
    name: "Wasserversorgung über lange Wegstrecke", abzug: 1,
    pruefung: { geraete: [[{ b_schlauch: 20 }]] },
    text: "Der Hydrant reicht nicht, Wasser muss von weiter her gefördert werden.",
  },
  eigenschutz_wasser: {
    name: "Eigenschutz am Wasser", abzug: 2,
    pruefung: { geraete: [[{ rettungsweste: 2 }]] },
    text: "Wer am Wasser arbeitet, trägt eine Rettungsweste.",
  },
  polizei_vor_ort: {
    name: "Polizei vor Ort", abzug: 1,
    pruefung: { polizei_vor_ort: true },
    text: "Bei einer gewaltsamen Türöffnung sollte die Polizei anwesend sein.",
  },
  polizei_absperrung: {
    name: "Absperrung durch die Polizei", abzug: 1,
    pruefung: { polizei_vor_ort: true },
    text: "Gefahrenbereich absperren und Schaulustige fernhalten.",
  },
  eigensicherung_zwei: {
    name: "Eigensicherung", abzug: 2,
    pruefung: { personen_mindestens: 2 },
    text: "Streifen sind aus Gründen der Eigensicherung zu zweit unterwegs (allgemeine Praxis, keine Vorschrift aus diesem Repository).",
  },
}

/**
 * Sterne: 5 möglich, mindestens 1 bei Erfolg, 0 wenn verfallen. Geben keine Punkte, nur Anzeige und Freischaltung.
 * Maßgeblich ist, wann der Einsatz beendet ist (Meldung bis Arbeit erledigt), verglichen mit ziel_ende_min der Einsatzart
 * (ohne Angabe: ziel_eintreffen_min + arbeit_min). In diese Zeit fließen Wege, Stärke, Geräte, Ausrüstung, Wetter und Dunkelheit ein.
 * Dazu kommen Abzüge für Vorschriften (REGELN), fehlende Mindest-Schutzausrüstung und große Schäden.
 */
const STERNE = {
  max: 5,
  // Überschreitung von ziel_ende (Anteil) → Abzug
  einsatzende: [
    { ueber: 0, abzug: 0 },
    { ueber: 0.15, abzug: 0.5 },
    { ueber: 0.3, abzug: 1 },
    { ueber: 0.6, abzug: 2 },
    { ueber: 1, abzug: 3 },
  ],
  psa_unzureichend: 0.5,
  schaden_hoch: 1, // Brand ist stark angewachsen (wachstum · Verzug > 1)
  runden: "halbe", // halbe Sterne erlaubt
  freischaltung_standard: 3,
}

/** Personal der Polizei: Beamtinnen und Beamte werden an die Dienststelle versetzt (begrenzt durch personal_max). */
const PERSONAL = {
  polizei: { name: "Beamtin/Beamter an die Dienststelle versetzen", preis: 600 }, // spielwert
}

/**
 * Schutzzonen: Kreise (x, z, r), in denen nur Einsatzarten mit `harmlos: true` stattfinden (z. B. Katze auf Baum,
 * Ruhestörung), keine Brände, Verletzten oder Überschwemmungen. Gedacht für das eigene Zuhause und das Zuhause von
 * Angehörigen. Hier leer; gesetzt werden sie nur über die private Karte der Person (Dokument karte/dorf, Feld schutz).
 */
const SCHUTZZONEN = []

/**
 * Löschwasser. Unterflurhydranten (Standrohr nötig) und offene Gewässer (Pumpe, mindestens zwei A-Saugschläuche und
 * Saugkorb). Die Lage gehört zur Karte: Hier stehen Werte für die erfundene Karte, die private Karte ersetzt sie
 * (Felder hydranten, hydrant_plaetze, gewaesser). Überflurhydranten gibt es nicht.
 */
const HYDRANTEN = [
  { id: "h1", x: -40, z: -12 },
  { id: "h2", x: 2, z: 30 },
  { id: "h3", x: 12, z: 64 },
]
/** Plätze für zusätzliche Hydranten (Ausbau hydrant_a, hydrant_b). */
const HYDRANT_PLAETZE = [
  { id: "hp1", x: 55, z: -24 },
  { id: "hp2", x: -34, z: 44 },
]
/** Offene Gewässer als Linie, an der angesaugt werden kann. */
const GEWAESSER = [{ id: "elbe", name: "der Elbe", punkte: [[-200, -50], [200, -50]] }]

/** Zeiten der Simulation, die nicht an Orten hängen (spielwert). */
const ZEITEN = {
  ausruecken_s: 45, // vom Erreichen der Mindeststärke bis zur Abfahrt
  warten_auf_staerke_max_s: 180, // danach rückt aus, wer da ist, sofern Mindeststärke erreicht
  rueckfahrt_faktor: 1.3, // ohne Sonderrechte langsamer zurück
  einsatzbereit_s: 300, // nach Rückkehr: Fahrzeug aufrüsten
  schlauchpflege_h: 6, // benutzte Schläuche fehlen so lange (Waschen, Prüfen, Trocknen)
  atemschutz_pflege_h: 4, // benutzte Pressluftatmer und Masken
  zu_fuss_mit_leiter_ms: 1.2,
  handzugwagen_ms: 1.4,
  sonderrechte_tempo: 1.25, // § 35 / § 38 StVO: freie Bahn, aber angepasst
  fehlendes_geraet_arbeit: 0.25, // je fehlender optimal-Gruppe dauert die Arbeit so viel länger
  personen_je_rohr: 2, // ein Trupp je Strahlrohr
  verteiler_abgaenge: 3, // Verteiler B-CBC: drei Rohre; ohne Verteiler nur eines
  nacht_arbeit: 1.25, // Arbeit im Dunkeln ohne Licht
  nacht_zu_fuss: 1.15, // zu Fuß im Dunkeln ohne Licht
  stolpern_wetter: { trocken: 1, hitze: 1, sturm: 1.5, nass: 2, schnee: 3, glaette: 4 },
  // Löschwasser: Leitung verlegen (Schläuche auslegen und kuppeln), Standrohr setzen, Saugleitung kuppeln und ansaugen
  leitung_m_s: 1.2,
  wasser_hydrant_s: 60,
  wasser_ansaugen_s: 150,
  nur_tankwasser: 1.4, // Tank reicht nicht, Wasser muss nachgeholt werden
  ohne_wasser: 2, // nichts in Reichweite, nur was gerade da ist
}

module.exports = {
  VERSION,
  PREISFAKTOR,
  PREIS_MINIMUM,
  QUELLEN,
  METER_JE_EINHEIT,
  STRASSEN,
  ORTE,
  BAUPLAETZE,
  NEUBAUGEBIETE,
  SCHUTZZONEN,
  HYDRANTEN,
  HYDRANT_PLAETZE,
  GEWAESSER,
  WETTER,
  ALARMIERUNG,
  HAUS_AUSBAU,
  FREISCHALTUNG_LEVEL,
  ARBEITSZEIT,
  BERUFE,
  SCHICHTEN,
  ARBEITGEBER,
  MITGLIEDSCHAFTEN,
  FITNESS,
  PSA_FEUERWEHR,
  PSA_POLIZEI,
  PSA_NAMEN,
  SONNE,
  LEHRGAENGE,
  DIENSTGRADE_FEUERWEHR,
  FUNKTIONEN_FEUERWEHR,
  EINHEITEN,
  MERKMALE,
  GERAETE,
  FAHRZEUGE,
  BAU,
  GEBAEUDE,
  GEBAEUDE_ORT,
  AUSBAU,
  EINSATZARTEN,
  REGELN,
  STERNE,
  ZEITEN,
  PERSONAL,
}
