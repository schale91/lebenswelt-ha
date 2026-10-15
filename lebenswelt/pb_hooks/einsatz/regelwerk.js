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
  thwg: { titel: "§ 1 THW-Gesetz: Hilfe auf Anforderung der für die Gefahrenabwehr zuständigen Stellen", url: "https://www.gesetze-im-internet.de/thw-helfrg/__1.html" },
  rettungsschwimmen: { titel: "Deutsche Prüfungsordnung Schwimmen, Retten, Rettungsschwimmen (Abdruck DLRG)", url: "https://koenigswinter.dlrg.de/fileadmin/groups/9220020/DLRG_Koenigswinter/Pruefungsordnung/po1.pdf" },
  nkatsg_mitwirkung: { titel: "MI Niedersachsen: Gliederung und Sollstärke der Einheiten im Sanitäts- und Betreuungsdienst", url: "https://www.mi.niedersachsen.de/startseite/themen/innere_sicherheit/brand_katastrophenschutz/katastrophenschutz/gliederung-und-sollstarke-der-einheiten-des-katastrophenschutzes-im-sanitats-und-betreuungsdienst-221740.html" },
  bedarfvo_rettd: { titel: "Verordnung über die Bemessung des Bedarfs an Einrichtungen des Rettungsdienstes (BedarfVO-RettD), Nds. GVBl. Nr. 18/2023", url: "https://www.niedersachsen.de/download/199212/Nds._GVBl._Nr._18_2023_vom_19.09.2023_S._201-215.pdf" },
  nrettdg_besetzung: { titel: "Landtag Niedersachsen Drs. 18/10734, Besetzung der Rettungsmittel nach § 10 NRettDG", url: "https://www.landtag-niedersachsen.de/Drucksachen/Drucksachen_18_12500/10501-11000/18-10734.pdf" },
  notsang: { titel: "§ 5 Notfallsanitätergesetz (Ausbildung)", url: "https://www.gesetze-im-internet.de/notsang/__5.html" },
  din_en_1789: { titel: "DIN EN 1789 Rettungsdienstfahrzeuge und deren Ausrüstung, Krankenkraftwagen", url: "https://www.dinmedia.de/de/norm/din-en-1789/94004682" },
  din_75079: { titel: "DIN 75079 Notarzt-Einsatzfahrzeuge", url: "https://www.dinmedia.de/de/norm/din-75079/388433461" },
  luftvg25: { titel: "§ 25 LuftVG, Landung außerhalb von Flugplätzen zur Hilfeleistung", url: "https://lxgesetze.de/luftvg/25" },
  reanimation: { titel: "Universitätsklinikum Freiburg, Zahlen und Fakten zur Reanimation", url: "https://www.uniklinik-freiburg.de/fileadmin/mediapool/06_presse/migration/100ProAnimation_Zahlen_Fakten.pdf" },
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
  werkstatt_dorf: { name: "Kfz-Werkstatt", x: 20, z: 82, fest: true },
  bauhof: { name: "Bauhof", x: -62, z: 32, fest: true },
  rettungswache: { name: "Rettungswache", x: 56, z: 86, fest: true },
  drk_unterkunft: { name: "DRK-Unterkunft", x: -52, z: 74, fest: true },
  wachstation: { name: "Wasserrettungsstation", x: 14, z: -44, fest: true },
  thw_unterkunft: { name: "THW-Unterkunft", x: 76, z: -40, fest: true },
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

/**
 * Sirenen im Dorf (Spielwerte; Reichweiten in Karteneinheiten, auf das verkleinerte Dorf bezogen).
 * Signale wie in Niedersachsen üblich: Feueralarm eine Minute Dauerton, zweimal unterbrochen (drei Töne zu 12 s mit 12 s
 * Pause), Warnung der Bevölkerung eine Minute auf- und abschwellend, Entwarnung eine Minute Dauerton.
 * Wer mit der Sirene alarmiert wird (ALARMIERUNG.sirene), reagiert je nachdem, wie gut die nächste Sirene am Haus zu
 * hören ist: nah (innerhalb nah_anteil der Reichweite), am Rand, gar nicht (wie bisher: Nachbarn, Telefonkette). Nachts
 * weckt eine entfernte Sirene nicht jeden (nie langsamer als ohne). Meldeempfänger und App hängen nicht davon ab.
 * Großlagen mit `warnung` räumen schneller, je mehr vom Dorf die Sirenen erreichen; mit `stromausfall` heulen nur
 * Sirenen mit Akku. Die Sirene am Feuerwehrhaus ist von Anfang an da (grundstufe), die anderen werden gebaut.
 * Aus den Stufen entstehen Ausbauten (AUSBAU, gebaeude "ort", Feld sirene), gebaut wird wie bei allen Ausbauten.
 */
const SIRENEN = {
  standorte: {
    feuerwehrhaus: { ort: "feuerwehrhaus", name: "Feuerwehrhaus", grundstufe: 1, ab_level: 0 },
    schule: { ort: "schule", name: "Grundschule", ab_level: 4 },
    marktplatz: { ort: "marktplatz", name: "Marktplatz", ab_level: 7 },
    deich: { ort: "deich", name: "Deich", ab_level: 11 },
    werkstatt: { ort: "werkstatt", name: "Werkstatt", ab_level: 15 },
    sportplatz: { ort: "sportplatz", name: "Sportplatz", ab_level: 19 },
  },
  stufen: {
    1: { name: "Motorsirene", radius: 55, verzug_s: 10, akku: false, sprache: false, preis: 1800, bauzeit_h: 6 },
    2: { name: "Elektronische Sirene mit Akku und Sprachdurchsage", radius: 75, verzug_s: 5, akku: true, sprache: true, preis: 4500, bauzeit_h: 6 },
    3: { name: "Hochleistungssirene, digital von der Leitstelle ausgelöst", radius: 95, verzug_s: 0, akku: true, sprache: true, preis: 8000, bauzeit_h: 8 },
  },
  // ohne_s wie früher die Sirene für alle (ALARMIERUNG.sirene): Sirenen machen schneller, nie langsamer als bisher
  hoeren: { nah_s: 45, fern_s: 65, ohne_s: 90, nacht_s: 20, nah_anteil: 0.5 },
  nacht: { von: 22, bis: 6 },
  warnung: { faktor_max: 0.25 },
  // Bundesweiter Warntag: zweiter Donnerstag im September gegen 11 Uhr, Entwarnung gegen 11:45 Uhr
  warntag: { monat: 9, wochentag: 4, nr: 2, stunde: 11, entwarnung_min: 45 },
}

/**
 * Echte Wetterwarnungen des Deutschen Wetterdienstes (Integration „DWD Weather Warnings“ in Home Assistant, Warnzelle
 * der Gemeinde). Eine Warnung setzt für ihre Dauer das Spielwetter und setzt beim Beginn passende Einsätze an (nach
 * min Minuten, zufällig im Bereich), sofern die Einsatzart gekauft ist und ihr Level erreicht ist. Erkannt wird am
 * Namen des DWD-Ereignisses (Großbuchstaben, z. B. STURMBÖEN, GLATTEIS). Die erste passende Regel gilt.
 * stufe: Warnstufe des DWD (1 Wetterwarnung, 2 markantes Wetter, 3 Unwetter, 4 extremes Unwetter).
 */
const DWD_WARNUNGEN = {
  regeln: [
    {
      muster: ["GLATTEIS", "GLÄTTE"], wetter: "glaette",
      ausloesen: [{ art: "bh_streuen", min: [10, 45] }, { art: "p_vu_sachschaden", min: [40, 180] }, { art: "ab_graben", min: [60, 240], stufe_min: 2 }, { art: "th_vu", min: [60, 240], stufe_min: 3 }],
    },
    {
      muster: ["SCHNEEVERWEHUNG", "SCHNEEFALL"], wetter: "schnee",
      ausloesen: [{ art: "bh_streuen", min: [20, 60] }, { art: "p_vu_sachschaden", min: [60, 240] }],
    },
    {
      muster: ["ORKAN", "STURM"], stufe_min: 2, wetter: "sturm",
      ausloesen: [{ art: "th_baum_strasse", min: [20, 90] }, { art: "bh_ast", min: [30, 120] }, { art: "th_stromausfall", min: [60, 180], stufe_min: 3 }, { art: "gl_sturm", min: [30, 90], stufe_min: 3 }],
    },
    {
      muster: ["STARKREGEN", "DAUERREGEN"], stufe_min: 2, wetter: "nass",
      ausloesen: [{ art: "th_wasser_keller", min: [60, 180] }],
    },
  ],
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
 * Organisationen mit ihrem Gebäude. Werkstatt und Bauhof kommen ab Level 12 (FREISCHALTUNG_LEVEL).
 */
const ORGANISATIONEN = {
  feuerwehr: { name: "Feuerwehr", gebaeude: "geraetehaus" },
  polizei: { name: "Polizei", gebaeude: "dienststelle" },
  werkstatt: { name: "Werkstatt und Abschleppdienst", gebaeude: "werkstatt", ab_level: 12 },
  bauhof: { name: "Bauhof", gebaeude: "bauhof", ab_level: 12 },
  rettungsdienst: { name: "Rettungsdienst", gebaeude: "rettungswache", ab_level: 16, reaktion_s: 60 },
  drk: { name: "DRK-Ortsverein", gebaeude: "drk_unterkunft", ab_level: 20, reaktion_s: 300 },
  dlrg: { name: "DLRG-Ortsgruppe", gebaeude: "wachstation", ab_level: 24, reaktion_s: 300 },
  thw: { name: "THW-Ortsverband", gebaeude: "thw_unterkunft", ab_level: 27, reaktion_s: 360, nur_nachforderung: true },
}

/**
 * Grundversorgung von außen: Ab ihrem Level ist eine Organisation sofort da, aber von außerhalb und langsam. Sie
 * übernimmt, wenn im Dorf niemand ausrücken kann. Höchstens max_sterne. Konzept DORFDIENSTE.md, Abschnitt 2.
 */
const EXTERN = {
  werkstatt: { name: "Abschleppdienst aus der Stadt", anfahrt_min: 35, max_sterne: 3, ab_level: 12 }, // spielwert
  bauhof: { name: "Straßenmeisterei des Kreises", anfahrt_min: 60, max_sterne: 3, ab_level: 12 }, // spielwert
  rettungsdienst: { name: "RTW der Nachbarwache", anfahrt_min: 14, max_sterne: 3, ab_level: 16 }, // spielwert
  drk: { name: "Schnelleinsatzgruppe aus dem Nachbarort", anfahrt_min: 30, max_sterne: 3, ab_level: 20 }, // spielwert
  dlrg: { name: "Wasserrettungszug des Landkreises", anfahrt_min: 35, max_sterne: 3, ab_level: 24 }, // spielwert
  thw: { name: "THW-Ortsverband der Kreisstadt", anfahrt_min: 45, max_sterne: 3, ab_level: 27 }, // spielwert
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
  rettungswache: { name: "Schichtdienst an der Rettungswache", org: "rettungsdienst", schichtplan: ["frueh", "frueh", "spaet", "spaet", "frei"] },
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
  werkstatt: { name: "Kfz-Werkstatt", ort: "werkstatt_dorf", stellen: 2, gebaeude: "werkstatt", ab_stufe: 2 },
  bauhof: { name: "Bauhof", ort: "bauhof", stellen: 2, gebaeude: "bauhof", ab_stufe: 1 },
}

/**
 * Mitgliedschaften zusätzlich zur Hauptorganisation. Polizistinnen und Polizisten, die im Dorf wohnen, können in die
 * Freiwillige Feuerwehr eintreten; außerhalb ihrer Schicht rücken sie dann mit aus. Der Sportverein hebt die Fitness.
 */
const MITGLIEDSCHAFTEN = {
  feuerwehr: { name: "Freiwillige Feuerwehr", eintritt: 150, grundausbildung: "tm1", grundausbildung_h: 16, fuer_org: ["polizei", "rettungsdienst"], braucht_haus: true },
  sportverein: { name: "Sportverein", eintritt: 200, ab_level: 5 },
  // Ehrenamt im DRK-Ortsverein, wie die Feuerwehr von zu Hause alarmiert (zweite Organisation neben der Hauptorganisation)
  drk: { name: "DRK-Ortsverein", eintritt: 120, ab_level: 20, grundausbildung: "sanitaetshelfer", grundausbildung_h: 16, fuer_org: ["feuerwehr", "polizei", "rettungsdienst"], braucht_haus: true },
  // Wasserrettung: Wer eintritt, legt das Rettungsschwimmabzeichen Bronze ab und braucht dafür etwas Fitness
  dlrg: { name: "DLRG-Ortsgruppe", eintritt: 120, ab_level: 24, grundausbildung: "rs_bronze", grundausbildung_h: 16, fitness_min: 40, quelle: "rettungsschwimmen", fuer_org: ["feuerwehr", "polizei", "rettungsdienst"], braucht_haus: true },
  // Technisches Hilfswerk: Ehrenamt im Ortsverband, kommt nur auf Anforderung der Einsatzleitung
  thw: { name: "THW-Ortsverband", eintritt: 100, ab_level: 27, grundausbildung: "thw_grund", grundausbildung_h: 24, quelle: "thwg", fuer_org: ["feuerwehr", "polizei", "rettungsdienst"], braucht_haus: true },
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
  // Werkstatt und Bauhof: Beruf bei der Einstellung, dazu einzelne Lehrgänge
  kfz: { org: "werkstatt", name: "Kfz-Mechatronikerin/Kfz-Mechatroniker", dauer_h: 0, preis: 0, hinweis: "bei der Einstellung vorhanden" },
  ladungssicherung: { org: "werkstatt", name: "Ladungssicherung", dauer_h: 8, preis: 150, voraussetzung: ["kfz"] },
  bergung: { org: "werkstatt", name: "Bergung schwerer Fahrzeuge", dauer_h: 24, preis: 500, voraussetzung: ["kfz", "ladungssicherung"] },
  gemeindearbeit: { org: "bauhof", name: "Gemeindearbeiterin/Gemeindearbeiter", dauer_h: 0, preis: 0, hinweis: "bei der Einstellung vorhanden" },
  winterdienst: { org: "bauhof", name: "Winterdienst-Fahrerin/Fahrer", dauer_h: 8, preis: 150, voraussetzung: ["gemeindearbeit"] },
  baumkontrolle: { org: "bauhof", name: "Baumkontrolle", dauer_h: 16, preis: 300, voraussetzung: ["gemeindearbeit"] },
  // Rettungsdienst (Spielwerte, Dauer gekürzt). Notfallsanitäter nur an der Lehrrettungswache (Stufe 4).
  rs: { org: "rettungsdienst", name: "Rettungssanitäterin/Rettungssanitäter", dauer_h: 48, preis: 800, hinweis: "Bewohner und Eingestellte bringen ihn mit" },
  nfs: { org: "rettungsdienst", name: "Notfallsanitäterin/Notfallsanitäter", dauer_h: 240, preis: 4000, voraussetzung: ["rs"], gebaeude: { rettungswache: 4 }, quelle: "notsang", hinweis: "nur an der Lehrrettungswache" },
  desinfektor: { org: "rettungsdienst", name: "Desinfektorin/Desinfektor", dauer_h: 24, preis: 400, voraussetzung: ["rs"], hinweis: "halbiert die Wiederherstellung nach Infektionstransporten" },
  // DRK (Spielwerte)
  sanitaetshelfer: { org: "drk", name: "Sanitätshelferin/Sanitätshelfer", dauer_h: 16, preis: 0, hinweis: "Grundausbildung beim Eintritt" },
  betreuungshelfer: { org: "drk", name: "Betreuungshelferin/Betreuungshelfer", dauer_h: 16, preis: 200, voraussetzung: ["sanitaetshelfer"] },
  verpflegungshelfer: { org: "drk", name: "Verpflegungshelferin/Verpflegungshelfer (Feldkoch)", dauer_h: 16, preis: 200, voraussetzung: ["sanitaetshelfer"] },
  drk_gruppenfuehrer: { org: "drk", name: "Gruppenführerin/Gruppenführer Sanitätsdienst", dauer_h: 40, preis: 600, voraussetzung: ["sanitaetshelfer"] },
  // DLRG (Spielwerte). Das Abzeichen wird im Spiel über das Training erneuert, ohne Zutun.
  rs_bronze: { org: "dlrg", name: "Rettungsschwimmabzeichen Bronze", dauer_h: 16, preis: 0, quelle: "rettungsschwimmen", hinweis: "beim Eintritt, Fitness 40" },
  rs_silber: { org: "dlrg", name: "Rettungsschwimmabzeichen Silber", dauer_h: 16, preis: 200, voraussetzung: ["rs_bronze"], fitness_min: 55, quelle: "rettungsschwimmen" },
  wasserretter: { org: "dlrg", name: "Wasserretterin/Wasserretter", dauer_h: 40, preis: 500, voraussetzung: ["rs_silber"] },
  stroemungsretter: { org: "dlrg", name: "Strömungsretterin/Strömungsretter", dauer_h: 24, preis: 600, voraussetzung: ["wasserretter"], fitness_min: 65 },
  bootsfuehrer: { org: "dlrg", name: "Bootsführerin/Bootsführer", dauer_h: 24, preis: 500, voraussetzung: ["wasserretter"] },
  wachfuehrer: { org: "dlrg", name: "Wachführerin/Wachführer", dauer_h: 24, preis: 400, voraussetzung: ["wasserretter"] },
  // THW (Spielwerte)
  thw_grund: { org: "thw", name: "Grundausbildung THW", dauer_h: 24, preis: 0, hinweis: "beim Eintritt" },
  thw_motorsaege: { org: "thw", name: "Motorsägenführerin/Motorsägenführer", dauer_h: 16, preis: 300, voraussetzung: ["thw_grund"] },
  thw_kraftfahrer: { org: "thw", name: "Kraftfahrerin/Kraftfahrer C/CE", dauer_h: 40, preis: 900, voraussetzung: ["thw_grund"] },
  thw_elektro: { org: "thw", name: "Elektrofachkraft Notversorgung", dauer_h: 40, preis: 700, voraussetzung: ["thw_grund"] },
  thw_gf: { org: "thw", name: "Gruppenführerin/Gruppenführer THW", dauer_h: 40, preis: 800, voraussetzung: ["thw_grund"] },
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
  rtw_fahrzeug: { name: "Rettungswagen", aus: { fahrzeug: ["rtw"] } },
  ktw_fahrzeug: { name: "Krankentransportwagen", aus: { fahrzeug: ["ktw"] } },
  feldkueche_fahrzeug: { name: "Feldküche", aus: { fahrzeug: ["feldkueche"] } },
  radlader_fahrzeug: { name: "Radlader", aus: { fahrzeug: ["radlader"] } },
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
  besen_schaufel: { name: "Besen und Schaufel", slots: 0.25, preis: 20, org: "beide", kategorie: "th" },
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
  // Rettungsdienst (DIN EN 1789; Medikamente sind Teil der Grundbeladung)
  tragestuhl: { name: "Tragestuhl", slots: 1, preis: 900, org: "rettungsdienst", kategorie: "tragen" },
  schaufeltrage: { name: "Schaufeltrage", slots: 1, preis: 700, org: "rettungsdienst", kategorie: "tragen" },
  vakuummatratze: { name: "Vakuummatratze", slots: 1, preis: 1200, org: "rettungsdienst", kategorie: "tragen" },
  spineboard: { name: "Spineboard", slots: 1, preis: 500, org: "rettungsdienst", kategorie: "tragen" },
  vakuumschienen: { name: "Vakuumschienen-Set", slots: 0.5, preis: 400, org: "rettungsdienst", kategorie: "versorgung" },
  sauerstoff: { name: "Sauerstoffeinheit", slots: 0.5, preis: 600, org: "rettungsdienst", kategorie: "versorgung" },
  waermeerhalt: { name: "Wärmeerhaltungsset", slots: 0.25, preis: 80, org: "rettungsdienst", kategorie: "versorgung" },
  kinder_notfallset: { name: "Kinder-Notfallset", slots: 0.5, preis: 700, org: "rettungsdienst", kategorie: "versorgung" },
  infektionsschutz: { name: "Infektionsschutzset", slots: 0.25, preis: 150, org: "rettungsdienst", kategorie: "versorgung" },
  defi_monitor: { name: "Defibrillator mit EKG-Monitor", slots: 1, preis: 4500, org: "rettungsdienst", kategorie: "monitoring" },
  beatmung: { name: "Beatmungsgerät", slots: 1, preis: 3500, org: "rettungsdienst", kategorie: "monitoring" },
  thoraxkompression: { name: "Mechanische Thoraxkompressionshilfe", slots: 1, preis: 6000, org: "rettungsdienst", kategorie: "monitoring" },
  // DRK: Betreuung und Verpflegung
  betreuungsset: { name: "Betreuungsset (Decken, Feldbetten, Getränke)", slots: 2, preis: 400, org: "drk", kategorie: "betreuung" },
  thermobehaelter: { name: "Thermobehälter für Verpflegung", slots: 0.5, preis: 120, org: "drk", kategorie: "betreuung" },
  sanitaetszelt: { name: "Sanitätszelt", slots: 2, preis: 1200, org: "drk", kategorie: "betreuung" },
  // DLRG: Wasserrettung
  rettungsbrett: { name: "Rettungsbrett", slots: 1, preis: 300, org: "dlrg", kategorie: "wasserrettung" },
  wurfsack: { name: "Wurfsack", slots: 0.25, preis: 60, org: "dlrg", kategorie: "wasserrettung" },
  stroemungsretter_set: { name: "Strömungsretter-Ausrüstung (Trockenanzug, Helm, Weste)", slots: 1, preis: 1200, org: "dlrg", kategorie: "wasserrettung" },
  schlauchboot: { name: "Schlauchboot mit Außenborder", slots: 4, preis: 6000, org: "dlrg", kategorie: "boot" },
  motorrettungsboot: { name: "Motorrettungsboot", slots: 8, preis: 18000, org: "dlrg", kategorie: "boot" },
  // THW: Fachgruppen
  abstuetzsystem: { name: "Abstützsystem Holz (Bergungsgruppe)", slots: 3, preis: 2500, org: "thw", kategorie: "bergung" },
  lichtmast: { name: "Lichtmast mit Aggregat", slots: 2, preis: 3000, org: "thw", kategorie: "bergung" },
  netzersatzanlage: { name: "Netzersatzanlage (Fachgruppe Notversorgung)", slots: 6, preis: 15000, org: "thw", kategorie: "notversorgung" },
  grosspumpe: { name: "Großpumpe 5000 l/min (Fachgruppe Wassergefahren)", slots: 4, preis: 9000, org: "thw", kategorie: "wassergefahren" },
  sandsackfueller: { name: "Sandsack-Füllanlage", slots: 4, preis: 7000, org: "thw", kategorie: "wassergefahren" },
  thw_motorsaegen: { name: "Motorsägen-Satz", slots: 1, preis: 1500, org: "thw", kategorie: "raeumen" },
  // Werkstatt und Abschleppdienst
  starthilfe: { name: "Starthilfegerät", slots: 0.5, preis: 150, org: "werkstatt", kategorie: "pannenhilfe" },
  abschleppseil: { name: "Abschleppseil und Abschleppstange", slots: 0.5, preis: 60, org: "werkstatt", kategorie: "pannenhilfe" },
  abschleppbrille: { name: "Hubbrille", slots: 2, preis: 1200, org: "werkstatt", kategorie: "abschleppen", effekt: { abschleppen: 1 } },
  plateau: { name: "Schiebeplateau", slots: 3, preis: 2500, org: "werkstatt", kategorie: "abschleppen", effekt: { abschleppen: 1.3 } },
  seilwinde: { name: "Seilwinde", slots: 1, preis: 900, org: "werkstatt", kategorie: "bergen" },
  drehkran: { name: "Drehkran", slots: 4, preis: 6000, org: "werkstatt", kategorie: "bergen" },
  // Bauhof
  streusalz: { name: "Streusalz (Sack)", slots: 0.25, preis: 15, org: "bauhof", kategorie: "winterdienst" },
  streuer: { name: "Streuautomat", slots: 2, preis: 1800, org: "bauhof", kategorie: "winterdienst" },
  schneeschild: { name: "Schneeschild", slots: 2, preis: 1500, org: "bauhof", kategorie: "winterdienst" },
  kehrbesen: { name: "Kehrbesen mit Wassertank", slots: 2, preis: 1600, org: "bauhof", kategorie: "reinigung" },
  absperrschranke: { name: "Absperrschranke mit Leuchte", slots: 0.5, preis: 120, org: "bauhof", kategorie: "absperrung" },
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
  // Werkstatt und Abschleppdienst (gelbes Rundumlicht nach § 52 Abs. 4 StVZO, keine Sonderrechte)
  pannenhilfe: { org: "werkstatt", name: "Pannenhilfsfahrzeug", besatzung: [0, 1], slots: 4, preis: 4000, tempo_kmh: 50, stellplatz: 1, fahrer: "kfz", ohne_sonderrechte: true, grundbeladung: { starthilfe: 1, abschleppseil: 1 } },
  abschleppwagen: { org: "werkstatt", name: "Abschleppwagen mit Hubbrille", besatzung: [0, 2], slots: 6, preis: 9000, tempo_kmh: 45, stellplatz: 1, fahrer: "kfz", ohne_sonderrechte: true, grundbeladung: { abschleppbrille: 1, abschleppseil: 1 } },
  plateauwagen: { org: "werkstatt", name: "Abschleppwagen mit Schiebeplateau", besatzung: [0, 2], slots: 8, preis: 12000, tempo_kmh: 45, stellplatz: 1, fahrer: "kfz", ohne_sonderrechte: true, grundbeladung: { plateau: 1, seilwinde: 1 } },
  bergewagen: { org: "werkstatt", name: "Schwerer Bergewagen mit Drehkran", besatzung: [0, 2], slots: 10, preis: 25000, tempo_kmh: 40, stellplatz: 1, fahrer: "bergung", ohne_sonderrechte: true, grundbeladung: { drehkran: 1, seilwinde: 1 } },
  // Bauhof
  pritschenwagen: { org: "bauhof", name: "Pritschenwagen", besatzung: [0, 2], slots: 6, preis: 3500, tempo_kmh: 45, stellplatz: 1, fahrer: "gemeindearbeit", ohne_sonderrechte: true, grundbeladung: { besen_schaufel: 2, absperrschranke: 2 } },
  winterdienstfahrzeug: { org: "bauhof", name: "Kommunalfahrzeug mit Schneeschild und Streuer", besatzung: [0, 2], slots: 6, preis: 12000, tempo_kmh: 35, stellplatz: 1, fahrer: "winterdienst", ohne_sonderrechte: true, grundbeladung: { streuer: 1, schneeschild: 1 } },
  kehrmaschine: { org: "bauhof", name: "Kehrmaschine", besatzung: [0, 1], slots: 3, preis: 9000, tempo_kmh: 25, stellplatz: 1, fahrer: "gemeindearbeit", ohne_sonderrechte: true, grundbeladung: { kehrbesen: 1 } },
  // Rettungsdienst (DIN EN 1789, DIN 75079). Das NEF bringt den Notarzt, wenn es einen Notarztvertrag gibt.
  ktw: { org: "rettungsdienst", name: "Krankentransportwagen (KTW, Typ A2)", besatzung: [0, 2], slots: 5, preis: 7000, tempo_kmh: 60, stellplatz: 1, fahrer: "rs", quelle: "din_en_1789", grundbeladung: { tragestuhl: 1 } },
  rtw: { org: "rettungsdienst", name: "Rettungswagen (RTW, Typ C)", besatzung: [0, 2], slots: 9, preis: 14000, tempo_kmh: 65, stellplatz: 1, fahrer: "rs", quelle: "din_en_1789", grundbeladung: { notfallrucksack: 1, sauerstoff: 1 } },
  nef: { org: "rettungsdienst", name: "Notarzteinsatzfahrzeug (NEF)", besatzung: [0, 1], slots: 4, preis: 6500, tempo_kmh: 75, stellplatz: 1, fahrer: "rs", quelle: "din_75079", nef: true, grundbeladung: { defi_monitor: 1 }, hinweis: "bringt den Notarzt, wenn es einen Notarztvertrag gibt" },
  // DRK-Ortsverein (Katastrophenschutz, ohne Logo und ohne Kreuz in der Darstellung)
  hvo_pkw: { org: "drk", name: "PKW Helfer vor Ort", besatzung: [0, 2], slots: 3, preis: 4500, tempo_kmh: 70, stellplatz: 1, fahrer: "sanitaetshelfer", grundbeladung: { notfallrucksack: 1 } },
  mtw_drk: { org: "drk", name: "Mannschaftstransportwagen (MTW)", besatzung: [1, 7], slots: 6, preis: 6000, tempo_kmh: 60, stellplatz: 1, fahrer: "sanitaetshelfer", grundbeladung: {} },
  gw_san: { org: "drk", name: "Gerätewagen Sanitätsdienst", besatzung: [1, 3], slots: 12, preis: 14000, tempo_kmh: 55, stellplatz: 1, fahrer: "sanitaetshelfer", grundbeladung: { notfallrucksack: 2, sanitaetszelt: 1 } },
  feldkueche: { org: "drk", name: "Feldküche (Anhänger)", besatzung: [0, 0], anhaenger: true, slots: 4, preis: 9000, tempo_kmh: 40, stellplatz: 1, fahrer: null, voraussetzung_fahrzeug: ["mtw_drk", "gw_san"], grundbeladung: { thermobehaelter: 2 } },
  // DLRG-Ortsgruppe (Rot und Gelb, ohne Logo)
  mtw_dlrg: { org: "dlrg", name: "Mannschaftstransportwagen Wasserrettung", besatzung: [1, 7], slots: 5, preis: 6000, tempo_kmh: 60, stellplatz: 1, fahrer: "rs_bronze", grundbeladung: { wurfsack: 2 } },
  gw_wasserrettung: { org: "dlrg", name: "Gerätewagen Wasserrettung mit Bootstrailer", besatzung: [1, 5], slots: 14, preis: 16000, tempo_kmh: 55, stellplatz: 1, fahrer: "rs_bronze", grundbeladung: { rettungsbrett: 1, wurfsack: 2 } },
  // THW-Ortsverband (THW-Blau, ohne Logo)
  mtw_thw: { org: "thw", name: "Mannschaftslastwagen (MTW OV)", besatzung: [1, 7], slots: 6, preis: 7000, tempo_kmh: 60, stellplatz: 1, fahrer: "thw_grund", grundbeladung: { lichtmast: 1 } },
  gkw: { org: "thw", name: "Gerätekraftwagen (Bergungsgruppe)", besatzung: [1, 8], slots: 16, preis: 30000, tempo_kmh: 50, stellplatz: 1, fahrer: "thw_kraftfahrer", grundbeladung: { abstuetzsystem: 1, lichtmast: 1, thw_motorsaegen: 1 } },
  radlader: { org: "thw", name: "Radlader mit Tieflader (Fachgruppe Räumen)", besatzung: [0, 2], slots: 2, preis: 35000, tempo_kmh: 35, stellplatz: 1, fahrer: "thw_kraftfahrer", merkmal_raeumen: true, grundbeladung: {} },
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
  // radius: um Start und Ziel beim Ausrücken; weg_radius: direkt an der Route vom Haus zum Gerätehaus
  verkehr: { radius: 20, weg_radius: 12, fahrzeug_s: 25, zu_fuss_s: 8 },
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
  // Werkstatt und Abschleppdienst (Konzept DORFDIENSTE.md, Abschnitt 9). Stufe 0: Abschleppdienst aus der Stadt.
  werkstatt: [
    { name: "kein Betrieb im Dorf", bauzeit_h: 0, stellplaetze: 0, preis: 0, lager_slots: 0, personal_max: 0 },
    { name: "Pannenhilfe-Unterstand", bauzeit_h: 4, stellplaetze: 1, preis: 3000, lager_slots: 4, personal_max: 1, ab_level: 12 },
    { name: "Kfz-Werkstatt mit Abschleppwagen", bauzeit_h: 24, stellplaetze: 2, preis: 12000, lager_slots: 10, personal_max: 3, ab_level: 12 },
    { name: "Abschlepphof mit Verwahrplatz", bauzeit_h: 36, stellplaetze: 3, preis: 20000, lager_slots: 16, personal_max: 4, ab_level: 12 },
    { name: "Bergungszentrum mit Kran", bauzeit_h: 72, stellplaetze: 4, preis: 40000, lager_slots: 24, personal_max: 5, ab_level: 12 },
  ],
  // Bauhof der Gemeinde (Abschnitt 10). Stufe 0: Straßenmeisterei des Kreises.
  bauhof: [
    { name: "kein Bauhof im Dorf", bauzeit_h: 0, stellplaetze: 0, preis: 0, lager_slots: 0, personal_max: 0 },
    { name: "Gemeindearbeiter mit Garage", bauzeit_h: 4, stellplaetze: 1, preis: 3000, lager_slots: 6, personal_max: 1, ab_level: 12 },
    { name: "Bauhof mit Halle", bauzeit_h: 24, stellplaetze: 2, preis: 10000, lager_slots: 14, personal_max: 2, ab_level: 12 },
    { name: "Bauhof mit Salzlager und Winterdienst", bauzeit_h: 36, stellplaetze: 3, preis: 18000, lager_slots: 20, personal_max: 3, ab_level: 12, gestreut_h: 4 },
    { name: "Bauhof mit Werkstatt und Sandsacklager", bauzeit_h: 48, stellplaetze: 4, preis: 30000, lager_slots: 30, personal_max: 4, ab_level: 12, gestreut_h: 4 },
  ],
  // Rettungswache (Abschnitt 5.5). Stufe 0: Nachbarwache. Stufe 1 steht am Feuerwehrhaus und ist nur tagsüber besetzt.
  rettungswache: [
    { name: "Nachbarwache (kein Standort im Dorf)", bauzeit_h: 0, stellplaetze: 0, preis: 0, lager_slots: 0, personal_max: 0 },
    { name: "RTW-Stellplatz am Feuerwehrhaus (Tagdienst)", bauzeit_h: 6, stellplaetze: 1, preis: 5000, lager_slots: 6, personal_max: 2, ab_level: 16, ort: "feuerwehrhaus", tagdienst: [7, 19] },
    { name: "Rettungswache in Containerbauweise", bauzeit_h: 24, stellplaetze: 2, preis: 12000, lager_slots: 12, personal_max: 4, ab_level: 16 },
    { name: "Rettungswache", bauzeit_h: 72, stellplaetze: 3, preis: 35000, lager_slots: 22, personal_max: 8, ab_level: 16 },
    { name: "Rettungswache mit Lehrrettungswache", bauzeit_h: 96, stellplaetze: 4, preis: 60000, lager_slots: 30, personal_max: 10, ab_level: 27, hinweis: "Ausbildung zur Notfallsanitäterin und zum Notfallsanitäter im Dorf" },
  ],
  // DRK-Unterkunft (Abschnitt 6). Stufe 0: Gruppenraum im Gemeindehaus (an der Bibliothek), ab Level 20 sofort da.
  drk_unterkunft: [
    { name: "Gruppenraum im Gemeindehaus", bauzeit_h: 0, stellplaetze: 1, preis: 0, lager_slots: 6, ort: "bibliothek" },
    { name: "Unterkunft mit Garage", bauzeit_h: 24, stellplaetze: 2, preis: 6000, lager_slots: 12, ab_level: 20 },
    { name: "Unterkunft mit Fahrzeughalle und Lager", bauzeit_h: 48, stellplaetze: 4, preis: 18000, lager_slots: 24, ab_level: 20 },
    { name: "Katastrophenschutzzentrum", bauzeit_h: 96, stellplaetze: 6, preis: 45000, lager_slots: 40, ab_level: 24, hinweis: "später auch für die Wasserrettung" },
  ],
  // Wasserrettungsstation an der Elbe (Abschnitt 7). Ab dem Wachturm gibt es den Wachdienst an Sommerwochenenden.
  wachstation: [
    { name: "Rettungsschwimmer mit Sonnenschirm", bauzeit_h: 0, stellplaetze: 0, preis: 0, lager_slots: 3 },
    { name: "Wachturm an der Badestelle", bauzeit_h: 12, stellplaetze: 0, preis: 4000, lager_slots: 8, ab_level: 24, wachdienst: true },
    { name: "Wasserrettungsstation mit Bootshaus und Slipanlage", bauzeit_h: 48, stellplaetze: 2, preis: 20000, lager_slots: 22, ab_level: 24, wachdienst: true },
    { name: "Station mit Steg, Strömungsrettungslager und Funkraum", bauzeit_h: 72, stellplaetze: 3, preis: 35000, lager_slots: 34, ab_level: 24, wachdienst: true, hinweis: "Strömungsretter rücken schneller aus" },
  ],
  // Unterkunft des THW-Ortsverbands (Abschnitt 8). Stufe 0: Lagerraum in einer Scheune.
  thw_unterkunft: [
    { name: "Lagerraum in einer Scheune", bauzeit_h: 0, stellplaetze: 1, preis: 0, lager_slots: 8, ort: "scheune" },
    { name: "Unterkunft des Ortsverbands", bauzeit_h: 24, stellplaetze: 2, preis: 10000, lager_slots: 20, ab_level: 27 },
    { name: "Unterkunft mit Fahrzeughalle und Werkstatt", bauzeit_h: 48, stellplaetze: 4, preis: 25000, lager_slots: 36, ab_level: 27 },
    { name: "Unterkunft mit Übungsgelände", bauzeit_h: 72, stellplaetze: 5, preis: 40000, lager_slots: 44, ab_level: 27, hinweis: "Trümmerkegel und Übungsbecken" },
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
const GEBAEUDE_ORT = { geraetehaus: "feuerwehrhaus", dienststelle: "dienststelle", sportplatz: "sportplatz", werkstatt: "werkstatt_dorf", bauhof: "bauhof", rettungswache: "rettungswache", drk_unterkunft: "drk_unterkunft", wachstation: "wachstation", thw_unterkunft: "thw_unterkunft" }

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
  wache_kueche: { gebaeude: "dienststelle", name: "Sozialraum", preis: 1500, effekt: { schicht: 1 }, bauzeit_h: 6, klein: true, ab_stufe: 1 },
  gewahrsam: { gebaeude: "dienststelle", name: "Gewahrsamsraum", preis: 6000, effekt: { festnahme: 1 }, bauzeit_h: 24, ab_stufe: 2 },
  // Rettungswache
  notarztvertrag: { gebaeude: "rettungswache", name: "Notarztvertrag mit der Klinik", preis: 8000, effekt: { notarzt: 1 }, bauzeit_h: 1, klein: true, ab_stufe: 2, hinweis: "mit NEF kommt der Notarzt aus dem Dorf" },
  desinfektionsraum: { gebaeude: "rettungswache", name: "Desinfektionsraum", preis: 6000, effekt: { wiederherstellung_faktor: 0.5 }, bauzeit_h: 12, ab_stufe: 3, hinweis: "Fahrzeug nach dem Transport schneller wieder einsatzbereit" },
  fahrzeughalle_warm: { gebaeude: "rettungswache", name: "Beheizte Fahrzeughalle", preis: 9000, effekt: { rd_ausruecken_s: -20 }, bauzeit_h: 24, ab_stufe: 3, hinweis: "schneller ausrücken" },
  // Leitstelle und Ersthelfer (kein Gebäude im Dorf, ab Level 16)
  notrufabfrage: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Strukturierte Notrufabfrage in der Leitstelle", preis: 3000, effekt: { notrufabfrage: 1 }, bauzeit_h: 1, klein: true, ab_stufe: 0, hinweis: "der Rettungsdienst wird gleich mit alarmiert, nicht erst nachgefordert" },
  telefonreanimation: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Telefonreanimation", preis: 2000, effekt: { telefonreanimation: 1 }, bauzeit_h: 1, klein: true, ab_stufe: 0, quelle: "reanimation", hinweis: "Anrufende drücken bis zum Eintreffen" },
  aed_markt: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Öffentlicher Defibrillator am Markt", preis: 1500, effekt: { aed_ort: "marktplatz" }, bauzeit_h: 1, klein: true, ab_stufe: 0 },
  aed_feuerwehr: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Öffentlicher Defibrillator am Feuerwehrhaus", preis: 1500, effekt: { aed_ort: "feuerwehrhaus" }, bauzeit_h: 1, klein: true, ab_stufe: 0 },
  aed_schule: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Öffentlicher Defibrillator an der Schule", preis: 1500, effekt: { aed_ort: "schule" }, bauzeit_h: 1, klein: true, ab_stufe: 0 },
  aed_sportplatz: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Öffentlicher Defibrillator am Sportplatz", preis: 1500, effekt: { aed_ort: "sportplatz" }, bauzeit_h: 1, klein: true, ab_stufe: 0 },
  landestelle: { gebaeude: "ort", bereich: "rettungsdienst", ab_level: 16, name: "Landestelle am Sportplatz", preis: 4000, effekt: { rth_min: -3 }, bauzeit_h: 12, ab_stufe: 0, quelle: "luftvg25", hinweis: "der Rettungshubschrauber landet näher" },
  hvo_parallel: { gebaeude: "ort", bereich: "drk", ab_level: 20, name: "Paralleler Alarm Helfer vor Ort", preis: 2500, effekt: { hvo_parallel: 1 }, bauzeit_h: 1, klein: true, ab_stufe: 0, hinweis: "die Leitstelle alarmiert den Helfer vor Ort gleichzeitig mit dem RTW" },
}

// Sirenen als Ausbauten: je Standort die Stufen über der Grundstufe, jede setzt die vorige voraus. Die elektronische
// Sirene am Feuerwehrhaus behält ihre alte Kennung (sirene_neu), damit vorhandene Stände sie behalten.
for (const sid of Object.keys(SIRENEN.standorte)) {
  const st = SIRENEN.standorte[sid]
  let vorher = null
  for (const n of [1, 2, 3]) {
    if (n <= (st.grundstufe || 0)) continue
    const stufe = SIRENEN.stufen[n]
    const id = sid === "feuerwehrhaus" && n === 2 ? "sirene_neu" : "sirene_" + sid + "_" + n
    const a = {
      gebaeude: "ort", name: stufe.name + " (" + st.name + ")", preis: stufe.preis, bauzeit_h: stufe.bauzeit_h, klein: true, ab_stufe: 0, ab_level: st.ab_level,
      sirene: { standort: sid, stufe: n },
      hinweis: n === 1 ? "Kräfte mit Sirenenalarm in der Nähe hören den Alarm" : n === 2 ? "größere Reichweite, heult auch bei Stromausfall, warnt mit Sprachdurchsage" : "noch größere Reichweite, löst ohne Verzug aus",
    }
    if (vorher) a.voraussetzung = vorher
    AUSBAU[id] = a
    vorher = id
  }
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
    ort_gruppen: ["baum"],
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
    mindestens: { personen: 1, geraete: [[{ pulverloescher: 1 }, { schaumloescher: 1 }, { kuebelspritze: 1 }, { loeschrucksack: 1 }, { fahrzeug_wasser: 1, cm_strahlrohr: 1 }]] }, // auch Schnellangriff aus dem Tank
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
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Ölspur auf der Fahrbahn", stichwort: "TH klein", preis: 250,
    freischaltung: { nach: "tier_katze", sterne: 4 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west", "kreuzung"], intervall_min: 300, ablauf_min: 20, arbeit_min: 15, ziel_eintreffen_min: 10,
    mindestens: { personen: 2, geraete: [[{ oelbinder: 2 }], [{ besen_schaufel: 1 }]] },
    optimal: { personen: 4, geraete: [[{ oelbinder: 4 }], [{ leitkegel: 1 }], [{ warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["p_verkehrsregelung", "bh_oel"],
    text: "Ein Traktor verliert Hydrauliköl, die Spur zieht sich durch den Ort.",
    verfallen_text: "Der Bauhof hat die Spur übernommen. Ein Radfahrer ist gestürzt.",
  },
  // Feuerwehr, Wetterlagen
  th_baum_strasse: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Baum auf Straße", stichwort: "TH Sturm", preis: 600,
    freischaltung: { nach: "th_oelspur", sterne: 3 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west"], intervall_min: 600, ablauf_min: 30, arbeit_min: 20, ziel_eintreffen_min: 10,
    bedingung: { wetter: ["sturm"], sonst_faktor: 0.1 },
    mindestens: { personen: 2, qualifikation: { motorsaege: 1 }, geraete: [[{ motorsaege: 1 }]] },
    optimal: { personen: 6, geraete: [[{ leitkegel: 1 }], [{ warnleuchte: 1 }], [{ beleuchtung: 1 }]] },
    psa: { helm: 2 },
    regeln: ["verkehrsabsicherung", "einheitsfuehrer"],
    folge: ["bh_absperrung", "thw_raeumen"],
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
    folge: ["rd_notarzt", "dlrg_wasserrettung"],
    text: "Ein Spaziergänger ist auf dem Altarm durchs Eis gebrochen.",
    verfallen_text: "Passanten haben die Person mit einem Ast herausgezogen, sie ist stark unterkühlt.",
  },
  // Feuerwehr, mittlere Lagen
  b_pkw: {
    ort_gruppen: ["strasse"],
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
    folge: ["p_tuer_begleitung", "rd_versorgung"],
    text: "Eine ältere Nachbarin öffnet nicht, durch die Tür sind Hilferufe zu hören.",
    verfallen_text: "Der Rettungsdienst hat die Tür mit dem Schlüsseldienst geöffnet, deutlich später.",
  },
  fr_reanimation: {
    org: "feuerwehr", name: "First Responder: Person bewusstlos", stichwort: "FR", preis: 2000,
    freischaltung: { nach: "th_tuer", sterne: 4 },
    orte: ["marktplatz", "festplatz", "bibliothek"], intervall_min: 1440, ablauf_min: 6, arbeit_min: 10, ziel_eintreffen_min: 5,
    mindestens: { personen: 2, qualifikation: { erste_hilfe: 2 }, geraete: [[{ aed: 1 }], [{ notfallrucksack: 1 }]] },
    optimal: { personen: 3, geraete: [[{ hrt: 1 }]] },
    folge: ["rd_notarzt"],
    text: "Ein Mann ist am Markt zusammengebrochen, Passanten beginnen mit der Herzdruckmassage.",
    verfallen_text: "Der Rettungsdienst war nach zwölf Minuten da. Jede Minute zählt.",
  },
  th_vu: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Verkehrsunfall, Person eingeklemmt", stichwort: "TH VU P", preis: 4000,
    freischaltung: { nach: "b_pkw", sterne: 4 },
    orte: ["kreuzung", "hauptstrasse_ost", "hauptstrasse_west"], intervall_min: 1440, ablauf_min: 15, arbeit_min: 25, ziel_eintreffen_min: 8,
    bedingung: { wetter: ["glaette", "schnee", "nass"], faktor: 2.5 },
    mindestens: { personen: 6, qualifikation: { th: 2, tf: 1 }, geraete: [[{ rettungssatz: 1 }], [{ pulverloescher: 1 }, { fahrzeug_wasser: 1, cm_strahlrohr: 1 }], [{ unterbaumaterial: 1 }]] },
    optimal: { personen: 9, einheit: "gruppe", qualifikation: { erste_hilfe: 2 }, geraete: [[{ notfallrucksack: 1 }], [{ leitkegel: 1 }, { warnleuchte: 1 }], [{ beleuchtung: 1 }], [{ hrt: 2 }]] },
    psa: { helm: 2, jacke: 1, handschuhe: 1, th_kleidung: 1 },
    regeln: ["einheitsfuehrer", "brandschutz_sicherstellen", "verkehrsabsicherung"],
    folge: ["p_vu_aufnahme", "ab_bergung", "rd_notarzt"],
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
    folge: ["p_absperrung", "rd_versorgung", "drk_betreuung"],
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
    folge: ["p_absperrung", "thw_abstuetzen", "thw_ausleuchten"],
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
    folge: ["rd_notarzt", "dlrg_wasserrettung"],
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
    folge: ["p_absperrung", "drk_verpflegung", "thw_ausleuchten", "thw_pumpen"],
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
    folge: ["rd_versorgung"],
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
    folge: ["ab_umsetzen"],
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
    folge: ["rd_versorgung"],
    text: "Eine ältere Person irrt orientierungslos über den Platz.",
    verfallen_text: "Angehörige haben die Person gefunden.",
  },
  p_vu_sachschaden: {
    ort_gruppen: ["strasse"],
    org: "polizei", name: "Verkehrsunfall mit Sachschaden", stichwort: "VU", preis: 400,
    freischaltung: { nach: "p_falschparker", sterne: 3 },
    orte: ["kreuzung", "hauptstrasse_ost", "marktplatz"], intervall_min: 720, ablauf_min: 40, arbeit_min: 20, ziel_eintreffen_min: 15,
    bedingung: { wetter: ["glaette", "schnee", "nass"], faktor: 3 },
    mindestens: { personen: 2 },
    optimal: { personen: 2, qualifikation: { vu_aufnahme: 1 }, geraete: [[{ unfallaufnahme: 1 }], [{ leitkegel: 1 }, { warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["ab_bergung"],
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
    ort_gruppen: ["strasse"],
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
    folge: ["p_trunkenheit", "rd_versorgung"],
    text: "Vor dem Festzelt prügeln sich mehrere Personen.",
    verfallen_text: "Der Sicherheitsdienst hat die Gruppen getrennt, ein Verletzter.",
  },
  p_trunkenheit: {
    ort_gruppen: ["strasse"],
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
    folge: ["fw_suche", "dlrg_ufersuche"],
    text: "Ein sechsjähriges Kind ist vom Spielplatz verschwunden, die Eltern sind verzweifelt.",
    verfallen_text: "Das Kind wurde von Anwohnern im Schilf gefunden, unterkühlt.",
  },
  // Folgeeinsätze (werden nicht gekauft, sondern von anderen ausgelöst)
  // ---------- Werkstatt und Abschleppdienst (ab Level 12, Konzept DORFDIENSTE.md Abschnitt 9) ----------
  // sperrt: solange der Einsatz offen ist, kostet die Stelle Einsatzfahrten in der Nähe Zeit (wie eine Baustelle)
  ab_panne: {
    ort_gruppen: ["strasse"],
    org: "werkstatt", name: "Panne auf der Dorfstraße", stichwort: "Panne", preis: 200, start_level: 12, harmlos: true, sperrt: true,
    orte: ["hauptstrasse_ost", "hauptstrasse_west", "kreuzung", "marktplatz"], intervall_min: 1440, ablauf_min: 90, arbeit_min: 20, ziel_eintreffen_min: 20,
    mindestens: { personen: 1, geraete: [[{ starthilfe: 1 }, { abschleppseil: 1 }]] },
    optimal: { personen: 1, geraete: [[{ abschleppbrille: 1 }, { plateau: 1 }]] },
    text: "Ein Auto springt nicht mehr an und steht halb auf der Fahrbahn.",
    verfallen_text: "Der Fahrer hat einen Abschleppdienst aus der Stadt gerufen, die Straße war lange halb blockiert.",
  },
  ab_graben: {
    org: "werkstatt", name: "PKW im Graben", stichwort: "Bergung", preis: 600, harmlos: true,
    freischaltung: { nach: "ab_panne", sterne: 3 },
    orte: ["wiese_deich", "hauptstrasse_west"], intervall_min: 2880, ablauf_min: 120, arbeit_min: 40, ziel_eintreffen_min: 25,
    bedingung: { wetter: ["glaette", "schnee", "nass"], faktor: 2 },
    mindestens: { personen: 1, geraete: [[{ seilwinde: 1 }]] },
    optimal: { personen: 2, geraete: [[{ plateau: 1 }], [{ warnleuchte: 1 }]] },
    text: "Ein Auto ist von der Straße abgekommen und steckt im Graben fest. Niemand ist verletzt.",
    verfallen_text: "Ein Landwirt hat das Auto mit dem Traktor herausgezogen. Die Stoßstange ist ab.",
  },
  ab_lkw: {
    ort_gruppen: ["strasse"],
    org: "werkstatt", name: "LKW festgefahren bei Glätte", stichwort: "Bergung schwer", preis: 1500, sperrt: true,
    freischaltung: { nach: "ab_graben", sterne: 3 },
    orte: ["hauptstrasse_ost", "kreuzung"], intervall_min: 1440, ablauf_min: 120, arbeit_min: 50, ziel_eintreffen_min: 30,
    bedingung: { wetter: ["glaette", "schnee"], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 2, qualifikation: { bergung: 1 }, geraete: [[{ drehkran: 1 }], [{ seilwinde: 1 }]] },
    optimal: { personen: 2, geraete: [[{ warnleuchte: 2 }]] },
    text: "Ein Sattelzug steht quer und kommt auf der glatten Straße nicht mehr weiter.",
    verfallen_text: "Ein Bergeunternehmen aus der Stadt kam nach Stunden, die Straße war so lange dicht.",
  },
  ab_bergung: {
    org: "werkstatt", name: "Fahrzeugbergung nach Unfall", stichwort: "Bergung", folge_nur: true, sperrt: true,
    ablauf_min: 90, arbeit_min: 25, ziel_eintreffen_min: 20,
    mindestens: { personen: 1, geraete: [[{ abschleppbrille: 1 }, { plateau: 1 }]] },
    optimal: { personen: 2, geraete: [[{ plateau: 1 }]] },
    text: "Die Unfallfahrzeuge müssen von der Straße, erst dann ist sie wieder frei.",
  },
  ab_umsetzen: {
    org: "werkstatt", name: "Falschparker umsetzen", stichwort: "Abschleppen", folge_nur: true,
    ablauf_min: 60, arbeit_min: 10, ziel_eintreffen_min: 20,
    mindestens: { personen: 1, geraete: [[{ abschleppbrille: 1 }, { plateau: 1 }]] },
    optimal: { personen: 1, geraete: [[{ plateau: 1 }]] },
    text: "Die Polizei lässt das Auto aus der Feuerwehrzufahrt umsetzen.",
  },
  // ---------- Bauhof (ab Level 12, Abschnitt 10) ----------
  // wirkung.gestreut_h: so lange gilt auf den Straßen nach dem Streuen bei Glätte und Schnee der Reibwert für "nass"
  bh_streuen: {
    ort_gruppen: ["strasse"],
    org: "bauhof", name: "Glätte: Straßen streuen", stichwort: "Winterdienst", preis: 250, start_level: 12, harmlos: true,
    orte: ["hauptstrasse_ost", "kreuzung", "hauptstrasse_west"], intervall_min: 240, ablauf_min: 240, arbeit_min: 45, ziel_eintreffen_min: 30,
    bedingung: { wetter: ["glaette", "schnee"], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 1, geraete: [[{ streuer: 1 }, { streusalz: 4 }]] },
    optimal: { personen: 2, geraete: [[{ streuer: 1 }], [{ schneeschild: 1 }]] },
    wirkung: { gestreut_h: 8 },
    text: "Die Straßen sind glatt. Wer zuerst streut, verhindert Unfälle.",
    verfallen_text: "Die Straßenmeisterei kam erst spät durch, bis dahin blieb es glatt.",
  },
  bh_ast: {
    org: "bauhof", name: "Ast auf dem Gehweg", stichwort: "Verkehrssicherung", preis: 150, start_level: 12, harmlos: true,
    orte: ["bibliothek", "schule", "marktplatz"], intervall_min: 1440, ablauf_min: 240, arbeit_min: 15, ziel_eintreffen_min: 60,
    bedingung: { wetter: ["sturm"], faktor: 3 },
    mindestens: { personen: 1, geraete: [[{ besen_schaufel: 1 }]] },
    optimal: { personen: 2, geraete: [[{ absperrschranke: 1 }]] },
    text: "Ein abgebrochener Ast liegt auf dem Gehweg, Fußgänger müssen auf die Straße.",
    verfallen_text: "Ein Anwohner hat den Ast zur Seite gezogen.",
  },
  bh_oel: {
    org: "bauhof", name: "Fahrbahn nachreinigen", stichwort: "Reinigung", folge_nur: true, sperrt: true,
    ablauf_min: 180, arbeit_min: 30, ziel_eintreffen_min: 30,
    mindestens: { personen: 1, geraete: [[{ besen_schaufel: 1 }, { kehrbesen: 1 }]] },
    optimal: { personen: 2, geraete: [[{ kehrbesen: 1 }], [{ absperrschranke: 2 }]] },
    text: "Nach dem Abstreuen bleibt ein Ölfilm. Die Fahrbahn muss gereinigt werden.",
  },
  bh_absperrung: {
    org: "bauhof", name: "Absperrung bei Sturmschaden", stichwort: "Absperrung", folge_nur: true, dauer_wie_ausloeser: true,
    ablauf_min: 90, arbeit_min: 0, ziel_eintreffen_min: 30,
    mindestens: { personen: 1, geraete: [[{ absperrschranke: 2 }]] },
    optimal: { personen: 2, geraete: [[{ absperrschranke: 4 }]] },
    text: "Die Straße muss abgesperrt werden, bis der Baum weg ist.",
  },
  // ---------- Rettungsdienst (ab Level 16, Konzept DORFDIENSTE.md Abschnitt 5) ----------
  // patient: Dringlichkeit rot, gelb oder grün; danach Transport ins Krankenhaus (RETTUNG). notarzt: Notarzt-Indikation.
  // Hilfsfrist im Spiel 8 Minuten (BedarfVO-RettD: 15 Minuten in 95 % der Notfälle, auf die Karte heruntergerechnet).
  rd_krankentransport: {
    org: "rettungsdienst", name: "Krankentransport zur Klinik", stichwort: "KTP", preis: 300, start_level: 16, patient: "gruen",
    orte: ["marktplatz", "bibliothek", "schule", "hauptstrasse_ost"], intervall_min: 720, ablauf_min: 120, arbeit_min: 15, ziel_eintreffen_min: 30,
    mindestens: { personen: 2, geraete: [[{ ktw_fahrzeug: 1 }, { rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, geraete: [[{ ktw_fahrzeug: 1 }], [{ tragestuhl: 1 }]] },
    text: "Eine Patientin muss zur Untersuchung in die Klinik, liegend und mit Begleitung.",
    verfallen_text: "Der Transport kam von der Nachbarwache, die Untersuchung musste verschoben werden.",
  },
  rd_sturz: {
    org: "rettungsdienst", name: "Sturz im Haushalt", stichwort: "RD 1", preis: 500, patient: "gelb",
    freischaltung: { nach: "rd_krankentransport", sterne: 3 }, quelle: "bedarfvo_rettd",
    orte: ["marktplatz", "bibliothek", "hauptstrasse_ost"], intervall_min: 1440, ablauf_min: 40, arbeit_min: 20, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, geraete: [[{ tragestuhl: 1 }], [{ vakuumschienen: 1 }]] },
    text: "Ein älterer Herr ist gestürzt und kommt nicht mehr allein hoch, das Handgelenk schmerzt.",
    verfallen_text: "Die Nachbarwache war nach langer Zeit da.",
  },
  rd_atemnot: {
    org: "rettungsdienst", name: "Atemnot", stichwort: "RD 1", preis: 800, patient: "gelb",
    freischaltung: { nach: "rd_sturz", sterne: 3 },
    orte: ["marktplatz", "bibliothek", "schule"], intervall_min: 1440, ablauf_min: 30, arbeit_min: 20, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }], [{ sauerstoff: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ defi_monitor: 1 }]] },
    text: "Eine Frau bekommt schlecht Luft und kann kaum noch sprechen.",
    verfallen_text: "Die Nachbarwache kam spät, die Frau musste länger kämpfen.",
  },
  rd_brustschmerz: {
    org: "rettungsdienst", name: "Brustschmerz", stichwort: "RD 2", preis: 1500, patient: "rot", notarzt: true,
    freischaltung: { nach: "rd_atemnot", sterne: 4 },
    orte: ["marktplatz", "festplatz", "bibliothek"], intervall_min: 2160, ablauf_min: 25, arbeit_min: 25, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }], [{ defi_monitor: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ sauerstoff: 1 }], [{ schaufeltrage: 1 }, { tragestuhl: 1 }]] },
    text: "Ein Mann hat starke Schmerzen in der Brust, die in den linken Arm ziehen.",
    verfallen_text: "Der Rettungsdienst von außerhalb kam spät.",
  },
  rd_reanimation: {
    org: "rettungsdienst", name: "Reanimation", stichwort: "RD 3", preis: 2500, patient: "rot", notarzt: true, reanimation: true,
    freischaltung: { nach: "rd_brustschmerz", sterne: 4 }, quelle: "reanimation",
    orte: ["marktplatz", "festplatz", "schule", "bibliothek"], intervall_min: 4320, ablauf_min: 20, arbeit_min: 30, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }], [{ defi_monitor: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ beatmung: 1 }], [{ thoraxkompression: 1 }]] },
    text: "Eine Frau ist zusammengebrochen und atmet nicht mehr. Jede Minute zählt.",
    verfallen_text: "Die Nachbarwache brauchte zu lange. Ohne Hilfe sinkt die Chance mit jeder Minute.",
  },
  rd_fieberkrampf: {
    org: "rettungsdienst", name: "Fieberkrampf beim Kind", stichwort: "RD 2 Kind", preis: 1500, patient: "rot", notarzt: true,
    freischaltung: { nach: "rd_sturz", sterne: 4 },
    orte: ["schule", "festplatz", "marktplatz"], intervall_min: 4320, ablauf_min: 25, arbeit_min: 20, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }], [{ kinder_notfallset: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ sauerstoff: 1 }]] },
    text: "Ein Kleinkind mit hohem Fieber krampft, die Eltern sind in großer Sorge.",
    verfallen_text: "Der Krampf hörte von selbst auf, bis Hilfe kam, verging viel Zeit.",
  },
  rd_wespenstich: {
    org: "rettungsdienst", name: "Allergische Reaktion nach Wespenstich", stichwort: "RD 1", preis: 600, patient: "gelb",
    freischaltung: { nach: "rd_krankentransport", sterne: 3 },
    orte: ["festplatz", "marktplatz", "sportplatz"], intervall_min: 1440, ablauf_min: 25, arbeit_min: 15, ziel_eintreffen_min: 8,
    bedingung: { monate: [6, 7, 8, 9], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ sauerstoff: 1 }]] },
    text: "Nach einem Wespenstich schwillt das Gesicht eines Jungen an.",
    verfallen_text: "Die Eltern sind selbst in die Klinik gefahren.",
  },
  rd_hitze: {
    org: "rettungsdienst", name: "Kreislaufprobleme bei Hitze", stichwort: "RD 1", preis: 600, patient: "gelb",
    freischaltung: { nach: "rd_krankentransport", sterne: 3 },
    orte: ["festplatz", "sportplatz", "marktplatz"], intervall_min: 1440, ablauf_min: 30, arbeit_min: 15, ziel_eintreffen_min: 8,
    bedingung: { wetter: ["hitze"], faktor: 2, sonst_faktor: 0.3 },
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, geraete: [[{ waermeerhalt: 1 }], [{ tragestuhl: 1 }]] },
    text: "Eine Besucherin ist in der Sonne zusammengesackt.",
    verfallen_text: "Sie hat sich im Schatten erholt, untersucht wurde sie nicht.",
  },
  rd_sportverletzung: {
    org: "rettungsdienst", name: "Sportverletzung am Sportplatz", stichwort: "RD 1", preis: 700, patient: "gelb",
    freischaltung: { nach: "rd_krankentransport", sterne: 3 }, braucht_gebaeude: { sportplatz: 3 },
    orte: ["sportplatz"], intervall_min: 2880, ablauf_min: 40, arbeit_min: 20, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, geraete: [[{ vakuumschienen: 1 }], [{ schaufeltrage: 1 }, { vakuummatratze: 1 }]] },
    text: "Beim Training ist ein Spieler umgeknickt, der Knöchel ist dick.",
    verfallen_text: "Mitspieler haben ihn in die Klinik gefahren.",
  },
  rd_infektion: {
    org: "rettungsdienst", name: "Infektionstransport", stichwort: "KTP Infekt", preis: 900, patient: "gruen", infektion: true,
    freischaltung: { nach: "rd_krankentransport", sterne: 4 },
    orte: ["bibliothek", "schule", "hauptstrasse_ost"], intervall_min: 2880, ablauf_min: 120, arbeit_min: 20, ziel_eintreffen_min: 30,
    mindestens: { personen: 2, geraete: [[{ ktw_fahrzeug: 1 }, { rtw_fahrzeug: 1 }], [{ infektionsschutz: 2 }]] },
    optimal: { personen: 2, qualifikation: { desinfektor: 1 } },
    text: "Ein Patient mit ansteckender Erkrankung muss in die Klinik. Danach wird das Fahrzeug gründlich desinfiziert.",
    verfallen_text: "Die Nachbarwache hat den Transport übernommen.",
  },
  // Rettungsdienst-Teil in bestehenden Einsätzen (Folgeeinsätze, erst ab Level 16)
  rd_versorgung: {
    org: "rettungsdienst", name: "Patient versorgen", stichwort: "RD 1", folge_nur: true, patient: "gelb",
    ablauf_min: 40, arbeit_min: 15, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ vakuummatratze: 1 }, { tragestuhl: 1 }]] },
    text: "An der Einsatzstelle gibt es eine verletzte Person, sie muss versorgt und in die Klinik gebracht werden.",
  },
  rd_notarzt: {
    org: "rettungsdienst", name: "Notfallpatient mit Notarzt", stichwort: "RD 2", folge_nur: true, patient: "rot", notarzt: true,
    ablauf_min: 30, arbeit_min: 25, ziel_eintreffen_min: 8,
    mindestens: { personen: 2, geraete: [[{ rtw_fahrzeug: 1 }]] },
    optimal: { personen: 2, qualifikation: { nfs: 1 }, geraete: [[{ defi_monitor: 1 }], [{ vakuummatratze: 1 }, { spineboard: 1 }]] },
    text: "Eine schwer verletzte oder lebensbedrohlich erkrankte Person braucht Rettungsdienst und Notarzt.",
  },
  // ---------- Alle zusammen: Großlagen (ab Level 30, Konzept DORFDIENSTE.md 13.7) ----------
  // grosslage: wird nicht gekauft, kommt ab dem Level von selbst, selten. Die Leitstelle alarmiert alle Teile zugleich
  // (außer Nachforderungen wie das THW). Wie oft, hängt an der Zusammenarbeit der letzten gemeinsamen Einsätze.
  gl_hochwasser: {
    org: "feuerwehr", name: "Großlage Elbhochwasser", stichwort: "Großlage Hochwasser", preis: 0, ab_level: 30, grosslage: true, warnung: true,
    orte: ["deich"], intervall_min: 20160, ablauf_min: 90, arbeit_min: 300, ziel_eintreffen_min: 20,
    bedingung: { monate: [1, 2, 3, 4, 6], faktor: 1, sonst_faktor: 0.05 },
    mindestens: { personen: 9, qualifikation: { gf: 1 }, geraete: [[{ sandsack: 10 }]] },
    optimal: { personen: 20, qualifikation: { zf: 1 }, geraete: [[{ elw_fahrzeug: 1 }], [{ beleuchtung: 2 }], [{ sandsack: 30 }]] },
    regeln: ["einheitsfuehrer", "eigenschutz_wasser"],
    folge: ["p_raeumung", "dlrg_hochwasser", "drk_verpflegung", "drk_betreuung", "rd_versorgung", "bh_absperrung", "thw_pumpen", "thw_ausleuchten"],
    gemeinsam: { ziel_min: 20 },
    text: "Die Elbe steigt über das mittlere Hochwasser. Deich verteidigen, Häuser räumen, Menschen mit Booten holen, alle versorgen.",
    verfallen_text: "Kräfte aus dem ganzen Landkreis haben übernommen.",
  },
  gl_sturm: {
    org: "feuerwehr", name: "Großlage Sturm im ganzen Dorf", stichwort: "Großlage Sturm", preis: 0, ab_level: 30, grosslage: true,
    orte: ["hauptstrasse_ost", "kreuzung", "hauptstrasse_west"], intervall_min: 10080, ablauf_min: 60, arbeit_min: 180, ziel_eintreffen_min: 15,
    bedingung: { wetter: ["sturm"], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 6, qualifikation: { motorsaege: 1 }, geraete: [[{ motorsaege: 1 }]] },
    optimal: { personen: 12, qualifikation: { gf: 1 }, geraete: [[{ motorsaege: 2 }], [{ beleuchtung: 1 }], [{ leitkegel: 2 }]] },
    psa: { helm: 2 },
    regeln: ["verkehrsabsicherung", "einheitsfuehrer"],
    folge: ["p_strassensperre", "rd_versorgung", "drk_verpflegung", "bh_absperrung", "ab_bergung", "thw_raeumen"],
    gemeinsam: { ziel_min: 15 },
    text: "Ein Orkan zieht über das Dorf: Bäume auf mehreren Straßen, Dächer beschädigt, Autos getroffen.",
    verfallen_text: "Die Nachbarwehren haben die Straßen erst am nächsten Tag frei bekommen.",
  },
  gl_busunfall: {
    org: "feuerwehr", name: "Großlage Busunfall mit vielen Verletzten", stichwort: "Großlage MANV", preis: 0, ab_level: 30, grosslage: true,
    orte: ["kreuzung", "hauptstrasse_ost"], intervall_min: 20160, ablauf_min: 20, arbeit_min: 90, ziel_eintreffen_min: 10,
    bedingung: { wetter: ["glaette", "schnee", "nass"], faktor: 1, sonst_faktor: 0.3 },
    mindestens: { personen: 9, qualifikation: { th: 2 }, geraete: [[{ rettungssatz: 1 }], [{ leitkegel: 1 }, { warnleuchte: 1 }]] },
    optimal: { personen: 18, qualifikation: { zf: 1, erste_hilfe: 4 }, geraete: [[{ elw_fahrzeug: 1 }], [{ notfallrucksack: 2 }], [{ beleuchtung: 2 }]] },
    regeln: ["einheitsfuehrer", "brandschutz_sicherstellen", "verkehrsabsicherung"],
    folge: ["p_vollsperrung", "rd_notarzt", "rd_notarzt", "rd_versorgung", "drk_behandlungsplatz", "drk_betreuung", "ab_bergung", "thw_ausleuchten"],
    gemeinsam: { ziel_min: 10 },
    text: "Ein Linienbus ist auf glatter Straße umgekippt. Viele Verletzte, Sichtung nach rot, gelb und grün.",
    verfallen_text: "Rettungskräfte aus dem ganzen Kreis haben übernommen.",
  },
  gl_bombe: {
    org: "feuerwehr", name: "Großlage Bombenfund mit Evakuierung", stichwort: "Großlage Kampfmittel", preis: 0, ab_level: 30, grosslage: true, baustelle: true, phasen: ["erdarbeiten"], warnung: true,
    orte: ["baustelle"], intervall_min: 4320, ablauf_min: 60, arbeit_min: 240, ziel_eintreffen_min: 20,
    mindestens: { personen: 6, qualifikation: { gf: 1 } },
    optimal: { personen: 12, geraete: [[{ elw_fahrzeug: 1 }], [{ leitkegel: 2 }]] },
    regeln: ["einheitsfuehrer"],
    folge: ["p_raeumung", "drk_betreuung", "rd_versorgung", "bh_absperrung", "thw_ausleuchten"],
    gemeinsam: { ziel_min: 15 },
    text: "Bei den Erdarbeiten liegt eine Fliegerbombe im Boden. Der Kampfmittelbeseitigungsdienst entschärft erst, wenn der Gefahrenbereich geräumt ist.",
    verfallen_text: "Kräfte aus dem Landkreis haben geräumt, die Entschärfung verzögerte sich um Stunden.",
  },
  gl_grossbrand: {
    org: "feuerwehr", name: "Großlage Scheunenbrand mit Stromausfall", stichwort: "Großlage Brand", preis: 0, ab_level: 30, grosslage: true, warnung: true, stromausfall: true,
    orte: ["scheune"], intervall_min: 20160, ablauf_min: 15, arbeit_min: 240, ziel_eintreffen_min: 10,
    bedingung: { wetter: ["hitze"], faktor: 1, sonst_faktor: 0.1 },
    mindestens: { personen: 9, qualifikation: { gf: 1 }, geraete: [[{ pressluftatmer: 2 }], [{ fahrzeug_wasser: 1 }]] },
    optimal: { personen: 20, qualifikation: { zf: 1 }, geraete: [[{ elw_fahrzeug: 1 }], [{ dlak_fahrzeug: 1 }], [{ beleuchtung: 2 }]] },
    regeln: ["einheitsfuehrer"],
    folge: ["p_absperrung", "rd_versorgung", "drk_verpflegung", "thw_strom", "thw_abstuetzen", "thw_ausleuchten"],
    gemeinsam: { ziel_min: 15 },
    text: "Nach Tagen ohne Regen brennt die große Scheune lichterloh, die Freileitung ist gerissen, der Ortsteil hat keinen Strom.",
    verfallen_text: "Nachbarwehren haben den Brand gelöscht, die Scheune brannte nieder.",
  },
  gl_dorffest: {
    org: "feuerwehr", name: "Dorffest-Wochenende", stichwort: "Großlage Fest", preis: 0, ab_level: 30, grosslage: true, harmlos: true,
    orte: ["festplatz"], intervall_min: 120, ablauf_min: 120, arbeit_min: 480, ziel_eintreffen_min: 60,
    bedingung: { wochentage: [6], stunden: [12], monate: [8], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 2 },
    optimal: { personen: 4, geraete: [[{ pulverloescher: 2 }]] },
    folge: ["p_verkehrsregelung", "drk_sanwache", "ab_umsetzen"],
    gemeinsam: { ziel_min: 30 },
    text: "Das ganze Dorf feiert. Brandsicherheitswache, Verkehr, Sanitätsdienst, Wache an der Badestelle und ein Abschleppwagen für Falschparker.",
    verfallen_text: "Das Fest lief ohne Brandsicherheitswache.",
  },
  drk_behandlungsplatz: {
    org: "drk", name: "Behandlungsplatz bei vielen Verletzten", stichwort: "MANV", folge_nur: true, dauer_wie_ausloeser: true,
    ablauf_min: 60, arbeit_min: 0, ziel_eintreffen_min: 30,
    mindestens: { personen: 4, qualifikation: { sanitaetshelfer: 4 }, geraete: [[{ sanitaetszelt: 1 }]] },
    optimal: { personen: 8, qualifikation: { drk_gruppenfuehrer: 1 }, geraete: [[{ notfallrucksack: 2 }], [{ betreuungsset: 1 }]] },
    text: "Das DRK baut einen Behandlungsplatz auf, sichtet die Verletzten und versorgt sie bis zum Transport.",
  },
  // ---------- THW (ab Level 27, Konzept DORFDIENSTE.md Abschnitt 8) ----------
  // Nur auf Anforderung (nachforderung): Ohne Gruppen- oder Zugführer der Feuerwehr vor Ort dauert die Anforderung länger.
  thw_abstuetzen: {
    org: "thw", name: "Gebäude abstützen", stichwort: "THW Bergung", folge_nur: true, nachforderung: true, quelle: "thwg",
    ablauf_min: 90, arbeit_min: 90, ziel_eintreffen_min: 40,
    mindestens: { personen: 4, geraete: [[{ abstuetzsystem: 1 }]] },
    optimal: { personen: 8, qualifikation: { thw_gf: 1 }, geraete: [[{ lichtmast: 1 }], [{ thw_motorsaegen: 1 }]] },
    text: "Nach dem Brand ist die Scheune einsturzgefährdet. Das THW stützt Giebel und Dach ab.",
  },
  thw_ausleuchten: {
    org: "thw", name: "Einsatzstelle ausleuchten", stichwort: "THW Licht", folge_nur: true, nachforderung: true, nur_dunkel: true, dauer_wie_ausloeser: true,
    ablauf_min: 90, arbeit_min: 0, ziel_eintreffen_min: 40,
    mindestens: { personen: 2, geraete: [[{ lichtmast: 1 }]] },
    optimal: { personen: 4, geraete: [[{ lichtmast: 2 }]] },
    text: "Der Einsatz dauert bis in die Nacht. Das THW leuchtet die Einsatzstelle großflächig aus.",
  },
  thw_pumpen: {
    org: "thw", name: "Großpumpen und Sandsäcke", stichwort: "THW Wasser", folge_nur: true, nachforderung: true, dauer_wie_ausloeser: true,
    ablauf_min: 120, arbeit_min: 0, ziel_eintreffen_min: 45,
    mindestens: { personen: 4, geraete: [[{ grosspumpe: 1 }, { sandsackfueller: 1 }]] },
    optimal: { personen: 8, geraete: [[{ grosspumpe: 1 }], [{ sandsackfueller: 1 }], [{ lichtmast: 1 }]] },
    text: "Das THW bringt Großpumpen und eine Sandsack-Füllanlage an den Deich.",
  },
  thw_raeumen: {
    org: "thw", name: "Sturmschaden räumen", stichwort: "THW Räumen", folge_nur: true, nachforderung: true,
    ablauf_min: 90, arbeit_min: 40, ziel_eintreffen_min: 40,
    mindestens: { personen: 3, qualifikation: { thw_motorsaege: 1 }, geraete: [[{ thw_motorsaegen: 1 }]] },
    optimal: { personen: 6, geraete: [[{ radlader_fahrzeug: 1 }]] },
    text: "Der umgestürzte Baum ist zerteilt, jetzt räumt das THW Stamm und Wurzelteller von der Straße.",
  },
  thw_strom: {
    org: "thw", name: "Notstrom einspeisen", stichwort: "THW Strom", folge_nur: true, nachforderung: true,
    ablauf_min: 120, arbeit_min: 120, ziel_eintreffen_min: 45,
    mindestens: { personen: 3, qualifikation: { thw_elektro: 1 }, geraete: [[{ netzersatzanlage: 1 }]] },
    optimal: { personen: 5, geraete: [[{ lichtmast: 1 }]] },
    text: "Das THW speist mit der Netzersatzanlage Strom in den Ortsteil ein, bis der Netzbetreiber den Schaden behoben hat.",
  },
  th_stromausfall: {
    org: "feuerwehr", name: "Stromausfall im Ortsteil", stichwort: "TH Strom", preis: 1800, ab_level: 27,
    freischaltung: { nach: "th_baum_strasse", sterne: 3 },
    orte: ["marktplatz", "schule", "bibliothek"], intervall_min: 4320, ablauf_min: 30, arbeit_min: 30, ziel_eintreffen_min: 10,
    bedingung: { wetter: ["sturm", "schnee", "glaette"], faktor: 2, sonst_faktor: 0.3 },
    mindestens: { personen: 2, geraete: [[{ stromerzeuger: 1 }, { beleuchtung: 1 }]] },
    optimal: { personen: 6, geraete: [[{ stromerzeuger: 1 }], [{ beleuchtung: 2 }]] },
    folge: ["thw_strom"],
    text: "Nach einem Kabelschaden ist der halbe Ort ohne Strom. Die Feuerwehr versorgt die wichtigsten Stellen, für mehr braucht es das THW.",
    verfallen_text: "Der Netzbetreiber hat nach Stunden repariert.",
  },
  // ---------- DLRG-Ortsgruppe (ab Level 24, Konzept DORFDIENSTE.md Abschnitt 7) ----------
  dlrg_badeunfall: {
    org: "dlrg", name: "Badeunfall an der Elbe", stichwort: "Wasser", preis: 800, start_level: 24, quelle: "rettungsschwimmen",
    orte: ["elbe_ufer"], intervall_min: 2880, ablauf_min: 15, arbeit_min: 15, ziel_eintreffen_min: 8,
    bedingung: { monate: [6, 7, 8], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 2, qualifikation: { rs_bronze: 2 }, geraete: [[{ rettungsbrett: 1 }, { wurfsack: 1 }]] },
    optimal: { personen: 3, qualifikation: { rs_silber: 1 }, geraete: [[{ rettungsbrett: 1 }], [{ schlauchboot: 1 }]] },
    folge: ["rd_notarzt"],
    text: "Ein Schwimmer ist in der Strömung in Not geraten und ruft um Hilfe.",
    verfallen_text: "Badegäste haben ihn mit einer Luftmatratze ans Ufer gebracht.",
  },
  dlrg_boot: {
    org: "dlrg", name: "Boot treibt manövrierunfähig", stichwort: "Wasser", preis: 1200,
    freischaltung: { nach: "dlrg_badeunfall", sterne: 3 },
    orte: ["elbe_ufer"], intervall_min: 4320, ablauf_min: 40, arbeit_min: 40, ziel_eintreffen_min: 15,
    bedingung: { monate: [4, 5, 6, 7, 8, 9, 10], faktor: 1, sonst_faktor: 0.2 },
    mindestens: { personen: 3, qualifikation: { bootsfuehrer: 1 }, geraete: [[{ schlauchboot: 1 }, { motorrettungsboot: 1 }]] },
    optimal: { personen: 4, geraete: [[{ motorrettungsboot: 1 }], [{ wurfsack: 2 }]] },
    text: "Ein Sportboot hat einen Motorschaden und treibt auf die Buhnen zu.",
    verfallen_text: "Ein Schiff der Wasserschutzpolizei hat es nach langer Zeit abgeschleppt.",
  },
  dlrg_hochwasser: {
    org: "dlrg", name: "Evakuierung bei Hochwasser", stichwort: "Wasser Hochwasser", preis: 2500,
    freischaltung: { nach: "dlrg_boot", sterne: 4 },
    orte: ["deich"], intervall_min: 20160, ablauf_min: 60, arbeit_min: 90, ziel_eintreffen_min: 30,
    bedingung: { monate: [1, 2, 3, 4, 6], faktor: 1, sonst_faktor: 0.1 },
    mindestens: { personen: 4, qualifikation: { bootsfuehrer: 1, stroemungsretter: 1 }, geraete: [[{ motorrettungsboot: 1 }], [{ stroemungsretter_set: 1 }]] },
    optimal: { personen: 6, qualifikation: { stroemungsretter: 2 }, geraete: [[{ stroemungsretter_set: 2 }]] },
    folge: ["drk_betreuung", "thw_pumpen"],
    text: "Hinter dem Sommerdeich sind Häuser eingeschlossen. Die Bewohner müssen mit dem Boot geholt werden.",
    verfallen_text: "Die Bewohner wurden von außerhalb geholt, viel später.",
  },
  dlrg_wasserrettung: {
    org: "dlrg", name: "Strömungsretter unterstützen", stichwort: "Wasser", folge_nur: true,
    ablauf_min: 20, arbeit_min: 20, ziel_eintreffen_min: 10,
    mindestens: { personen: 2, qualifikation: { rs_silber: 1 }, geraete: [[{ wurfsack: 1 }, { rettungsbrett: 1 }]] },
    optimal: { personen: 3, qualifikation: { stroemungsretter: 1 }, geraete: [[{ stroemungsretter_set: 1 }], [{ schlauchboot: 1 }]] },
    text: "Die Feuerwehr fordert die Wasserrettung nach, die Strömung ist stark.",
  },
  dlrg_ufersuche: {
    org: "dlrg", name: "Suche am Ufer", stichwort: "Suche", folge_nur: true,
    ablauf_min: 40, arbeit_min: 45, ziel_eintreffen_min: 20,
    mindestens: { personen: 2, qualifikation: { rs_bronze: 2 } },
    optimal: { personen: 4, geraete: [[{ schlauchboot: 1 }]] },
    text: "Die Polizei bittet die DLRG, das Ufer und die Buhnenfelder abzusuchen.",
  },
  // ---------- DRK-Ortsverein (ab Level 20, Konzept DORFDIENSTE.md Abschnitt 6) ----------
  drk_hvo: {
    org: "drk", name: "Helfer vor Ort: Person kollabiert", stichwort: "HvO", preis: 300, start_level: 20, quelle: "nkatsg_mitwirkung",
    orte: ["marktplatz", "bibliothek", "schule", "hauptstrasse_ost"], intervall_min: 1440, ablauf_min: 20, arbeit_min: 15, ziel_eintreffen_min: 6,
    mindestens: { personen: 1, geraete: [[{ notfallrucksack: 1 }]] },
    optimal: { personen: 2, qualifikation: { sanitaetshelfer: 1 }, geraete: [[{ aed: 1 }]] },
    folge: ["rd_versorgung"],
    text: "Ein Nachbar ist im Garten kollabiert. Der Helfer vor Ort ist in wenigen Minuten da, der RTW kommt dazu.",
    verfallen_text: "Niemand vom Ortsverein war erreichbar.",
  },
  drk_sanwache: {
    org: "drk", name: "Sanitätswachdienst beim Dorffest", stichwort: "SanWD", preis: 500, harmlos: true,
    freischaltung: { nach: "drk_hvo", sterne: 3 },
    orte: ["festplatz"], intervall_min: 90, ablauf_min: 120, arbeit_min: 240, ziel_eintreffen_min: 60, wache: true,
    bedingung: { wochentage: [6], stunden: [13], monate: [5, 6, 7, 8, 9], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 2, qualifikation: { sanitaetshelfer: 2 }, geraete: [[{ notfallrucksack: 1 }]] },
    optimal: { personen: 4, geraete: [[{ sanitaetszelt: 1 }], [{ aed: 1 }]] },
    text: "Samstag ist Dorffest. Der Sanitätsdienst steht bereit, bis der letzte Gast nach Hause geht.",
    verfallen_text: "Das Fest lief ohne Sanitätsdienst.",
  },
  drk_sanwache_sport: {
    org: "drk", name: "Sanitätswachdienst beim Sportfest", stichwort: "SanWD", preis: 700, harmlos: true,
    freischaltung: { nach: "drk_sanwache", sterne: 3 }, braucht_gebaeude: { sportplatz: 6 },
    orte: ["sportplatz"], intervall_min: 90, ablauf_min: 120, arbeit_min: 180, ziel_eintreffen_min: 60, wache: true,
    bedingung: { wochentage: [6], stunden: [10], monate: [4, 5, 6, 7, 8, 9, 10], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 2, qualifikation: { sanitaetshelfer: 2 }, geraete: [[{ notfallrucksack: 1 }]] },
    optimal: { personen: 3, geraete: [[{ sanitaetszelt: 1 }], [{ aed: 1 }]] },
    text: "Sportfest am Sportplatz: Der Sanitätsdienst ist vor Ort, falls sich jemand verletzt.",
    verfallen_text: "Das Sportfest lief ohne Sanitätsdienst.",
  },
  drk_hvo_parallel: {
    org: "drk", name: "Helfer vor Ort bis zum RTW", stichwort: "HvO", folge_nur: true, dauer_wie_ausloeser: true,
    ablauf_min: 15, arbeit_min: 0, ziel_eintreffen_min: 6,
    mindestens: { personen: 1, geraete: [[{ notfallrucksack: 1 }]] },
    optimal: { personen: 2, qualifikation: { sanitaetshelfer: 1 }, geraete: [[{ aed: 1 }]] },
    text: "Der Helfer vor Ort überbrückt die Zeit bis zum Rettungswagen.",
  },
  drk_betreuung: {
    org: "drk", name: "Betreuung der Betroffenen", stichwort: "Betreuung", folge_nur: true,
    ablauf_min: 60, arbeit_min: 90, ziel_eintreffen_min: 30,
    mindestens: { personen: 2, geraete: [[{ betreuungsset: 1 }]] },
    optimal: { personen: 3, qualifikation: { betreuungshelfer: 1 }, geraete: [[{ thermobehaelter: 1 }]] },
    text: "Die Bewohner stehen auf der Straße. Sie brauchen Decken, etwas Warmes und jemanden, der sich kümmert.",
  },
  drk_verpflegung: {
    org: "drk", name: "Verpflegung der Einsatzkräfte", stichwort: "Verpflegung", folge_nur: true, dauer_wie_ausloeser: true,
    ablauf_min: 120, arbeit_min: 0, ziel_eintreffen_min: 60,
    mindestens: { personen: 2, qualifikation: { verpflegungshelfer: 1 }, geraete: [[{ feldkueche_fahrzeug: 1 }, { thermobehaelter: 4 }]] },
    optimal: { personen: 3, geraete: [[{ feldkueche_fahrzeug: 1 }]] },
    text: "Lange Einsätze zehren an den Kräften. Die Feldküche versorgt alle mit Essen und Getränken.",
  },
  // ---------- Feuerwehr, Polizei und Rettungsdienst (ab Level 16, Konzept DORFDIENSTE.md 13.6) ----------
  th_vu_mehrere: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Verkehrsunfall mit mehreren Verletzten", stichwort: "TH VU 2", preis: 2500, ab_level: 16,
    freischaltung: { nach: "th_vu", sterne: 4 },
    orte: ["kreuzung", "hauptstrasse_ost"], intervall_min: 4320, ablauf_min: 15, arbeit_min: 50, ziel_eintreffen_min: 10,
    mindestens: { personen: 6, qualifikation: { th: 2 }, geraete: [[{ rettungssatz: 1 }], [{ leitkegel: 1 }, { warnleuchte: 1 }]] },
    optimal: { personen: 9, einheit: "gruppe", qualifikation: { erste_hilfe: 2 }, geraete: [[{ notfallrucksack: 1 }], [{ beleuchtung: 1 }], [{ hrt: 2 }]] },
    regeln: ["einheitsfuehrer", "brandschutz_sicherstellen", "verkehrsabsicherung"],
    folge: ["p_vollsperrung", "rd_notarzt", "rd_versorgung", "ab_bergung", "thw_ausleuchten"], gemeinsam: { ziel_min: 10 },
    text: "Zwei Autos sind frontal zusammengestoßen, in beiden Fahrzeugen sitzen Verletzte.",
    verfallen_text: "Die Nachbarwehr hat übernommen.",
  },
  th_motorrad: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Motorradunfall nach Wildwechsel", stichwort: "TH VU", preis: 1200, ab_level: 16,
    freischaltung: { nach: "th_vu", sterne: 3 },
    orte: ["hauptstrasse_west", "wiese_deich"], intervall_min: 2880, ablauf_min: 15, arbeit_min: 25, ziel_eintreffen_min: 10,
    bedingung: { monate: [4, 5, 6, 7, 8, 9, 10], faktor: 1, sonst_faktor: 0.2 },
    mindestens: { personen: 2, geraete: [[{ oelbinder: 2 }], [{ leitkegel: 1 }, { warnleuchte: 1 }]] },
    optimal: { personen: 4, qualifikation: { erste_hilfe: 1 }, geraete: [[{ notfallrucksack: 1 }], [{ besen_schaufel: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["p_strassensperre", "rd_notarzt"], gemeinsam: { ziel_min: 10 },
    text: "Ein Motorradfahrer ist einem Reh ausgewichen und gestürzt. Benzin läuft aus.",
    verfallen_text: "Die Nachbarwehr hat die Einsatzstelle abgesichert.",
  },
  th_trunkenheit: {
    org: "feuerwehr", name: "Trunkenheitsfahrt endet im Graben", stichwort: "TH VU", preis: 1000, ab_level: 16,
    freischaltung: { nach: "th_vu", sterne: 3 },
    orte: ["wiese_deich", "hauptstrasse_west"], intervall_min: 2880, ablauf_min: 20, arbeit_min: 20, ziel_eintreffen_min: 10,
    bedingung: { stunden: [22, 23, 0, 1, 2, 3, 4], faktor: 1, sonst_faktor: 0.3 },
    mindestens: { personen: 2, geraete: [[{ leitkegel: 1 }, { warnleuchte: 1 }]] },
    optimal: { personen: 4, geraete: [[{ beleuchtung: 1 }], [{ unterbaumaterial: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["p_blutprobe", "rd_versorgung", "ab_graben"], gemeinsam: { ziel_min: 10 },
    text: "Ein Auto liegt im Graben, der Fahrer riecht nach Alkohol und blutet an der Stirn.",
    verfallen_text: "Ein Landwirt hat das Auto gesichert, die Polizei kam allein.",
  },
  th_stalldach: {
    org: "feuerwehr", name: "Person auf dem Stalldach verletzt", stichwort: "TH Höhe", preis: 1500, ab_level: 16,
    freischaltung: { nach: "b_scheune", sterne: 3 },
    orte: ["scheune"], intervall_min: 4320, ablauf_min: 20, arbeit_min: 40, ziel_eintreffen_min: 10,
    mindestens: { personen: 4, geraete: [[{ schiebleiter: 1 }, { multifunktionsleiter: 1 }, { dlak_fahrzeug: 1 }]] },
    optimal: { personen: 6, qualifikation: { erste_hilfe: 1 }, geraete: [[{ dlak_fahrzeug: 1 }], [{ notfallrucksack: 1 }]] },
    psa: { helm: 2 },
    folge: ["p_absperrung", "rd_notarzt"], gemeinsam: { ziel_min: 15 },
    text: "Beim Ausbessern des Stalldachs ist ein Landwirt durchgebrochen und hängt verletzt im Gebälk.",
    verfallen_text: "Die Höhenretter aus der Stadt haben ihn geholt, nach langer Zeit.",
  },
  fr_reanimation_sport: {
    org: "feuerwehr", name: "Reanimation am Sportplatz", stichwort: "FR", preis: 1500, ab_level: 16,
    freischaltung: { nach: "fr_reanimation", sterne: 4 },
    orte: ["sportplatz"], intervall_min: 4320, ablauf_min: 6, arbeit_min: 10, ziel_eintreffen_min: 5,
    mindestens: { personen: 2, qualifikation: { erste_hilfe: 2 }, geraete: [[{ aed: 1 }], [{ notfallrucksack: 1 }]] },
    optimal: { personen: 3, geraete: [[{ hrt: 1 }]] },
    folge: ["p_strassensperre", "rd_notarzt"], gemeinsam: { ziel_min: 8 },
    text: "Beim Fußball ist ein Spieler zusammengebrochen. Die Polizei hält die Zufahrt für Rettungswagen und Hubschrauber frei.",
    verfallen_text: "Der Rettungsdienst war allein da, die ersten Minuten fehlten.",
  },
  // ---------- Gemeinsame Einsätze von Feuerwehr und Polizei (ab Level 8, Konzept DORFDIENSTE.md 13.5) ----------
  // gemeinsam.ziel_min: so viele Minuten nach dem Eintreffen der Feuerwehr soll die Polizei da sein (Zusammenarbeit)
  th_kind_auto: {
    org: "feuerwehr", name: "Kind im Auto eingeschlossen", stichwort: "TH Kind Pkw", preis: 1500, ab_level: 8,
    freischaltung: { nach: "th_tuer", sterne: 3 },
    orte: ["marktplatz", "festplatz", "schule"], intervall_min: 2880, ablauf_min: 10, arbeit_min: 5, ziel_eintreffen_min: 6,
    bedingung: { monate: [5, 6, 7, 8, 9], faktor: 1, sonst_faktor: 0.2 },
    mindestens: { personen: 1, geraete: [[{ tueroeffnung: 1 }]] },
    optimal: { personen: 2, qualifikation: { erste_hilfe: 1 }, geraete: [[{ notfallrucksack: 1 }]] },
    folge: ["p_halter"], gemeinsam: { ziel_min: 6 },
    text: "Auf dem Parkplatz sitzt ein Kleinkind allein im verschlossenen Auto, die Sonne steht drauf.",
    verfallen_text: "Ein Passant hat die Scheibe eingeschlagen. Es ging gut, aber knapp.",
  },
  th_rinder: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Rinder auf der Straße", stichwort: "TH Tier", preis: 1200, ab_level: 8, harmlos: true,
    freischaltung: { nach: "th_pferd", sterne: 3 },
    orte: ["hauptstrasse_ost", "kreuzung", "wiese_deich"], intervall_min: 4320, ablauf_min: 25, arbeit_min: 20, ziel_eintreffen_min: 12,
    mindestens: { personen: 3 },
    optimal: { personen: 6, geraete: [[{ leitkegel: 1 }], [{ warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["p_strassensperre"], gemeinsam: { ziel_min: 8 },
    text: "Eine Herde Jungrinder ist ausgebrochen und steht auf der Straße.",
    verfallen_text: "Der Landwirt hat die Tiere selbst zurückgetrieben, ein Auto hat eins gestreift.",
  },
  b_brandserie: {
    org: "feuerwehr", name: "Mülltonnenbrand in Serie", stichwort: "B klein Serie", preis: 900, ab_level: 8,
    freischaltung: { nach: "b_muelltonne", sterne: 4 },
    orte: ["muelltonnen", "festplatz", "schule"], intervall_min: 1440, ablauf_min: 8, arbeit_min: 5, ziel_eintreffen_min: 6, wachstum: 0.08,
    bedingung: { stunden: [21, 22, 23, 0, 1, 2, 3], faktor: 2, sonst_faktor: 0.3 },
    mindestens: { personen: 1, geraete: [[{ pulverloescher: 1 }, { schaumloescher: 1 }, { kuebelspritze: 1 }, { loeschrucksack: 1 }, { fahrzeug_wasser: 1, cm_strahlrohr: 1 }]] }, // auch Schnellangriff aus dem Tank
    optimal: { personen: 2, geraete: [[{ schaumloescher: 1 }, { cm_strahlrohr: 1, c_schlauch_15: 2, standrohr: 1 }]] },
    psa: { helm: 1, handschuhe: 1 },
    folge: ["p_brandermittlung"], gemeinsam: { ziel_min: 15 },
    text: "Schon wieder brennt nachts eine Mülltonne. Die Polizei vermutet Brandstiftung.",
    verfallen_text: "Die Tonne ist heruntergebrannt, die Spuren sind mit verbrannt.",
  },
  th_unfallflucht: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "Ölspur nach Unfallflucht", stichwort: "TH klein", preis: 1100, ab_level: 8,
    freischaltung: { nach: "th_oelspur", sterne: 3 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west", "kreuzung"], intervall_min: 2880, ablauf_min: 20, arbeit_min: 15, ziel_eintreffen_min: 10,
    mindestens: { personen: 2, geraete: [[{ oelbinder: 2 }], [{ besen_schaufel: 1 }]] },
    optimal: { personen: 4, geraete: [[{ oelbinder: 4 }], [{ leitkegel: 1 }], [{ warnleuchte: 1 }]] },
    regeln: ["verkehrsabsicherung"],
    folge: ["p_fahndung", "bh_oel"], gemeinsam: { ziel_min: 10 },
    text: "Ein Auto hat einen Zaun gerammt und ist weitergefahren, Öl läuft über die Fahrbahn.",
    verfallen_text: "Der Bauhof hat abgestreut, vom Verursacher fehlt jede Spur.",
  },
  abc_raeumung: {
    org: "feuerwehr", name: "Gasgeruch, Häuser räumen", stichwort: "ABC Gas Räumung", preis: 5000, ab_level: 8,
    freischaltung: { nach: "abc_gas", sterne: 4 },
    orte: ["nachbarhaus", "schule"], intervall_min: 5760, ablauf_min: 12, arbeit_min: 30, ziel_eintreffen_min: 8,
    mindestens: { personen: 6, qualifikation: { agt: 2, abc: 1 }, geraete: [[{ mehrgasmessgeraet: 1 }], [{ pressluftatmer: 2 }]] },
    optimal: { personen: 9, einheit: "gruppe", geraete: [[{ luefter: 1 }], [{ hrt: 2 }]] },
    psa: { jacke: 2 },
    regeln: ["einheitsfuehrer", "atemschutz_ueberwachung", "sicherheitstrupp"],
    folge: ["p_raeumung", "drk_betreuung"], gemeinsam: { ziel_min: 8 },
    text: "In der Straße riecht es überall nach Gas. Die Nachbarhäuser müssen geräumt werden.",
    verfallen_text: "Der Netzbetreiber hat die Leitung abgesperrt, die Bewohner standen lange auf der Straße.",
  },
  abc_lkw: {
    ort_gruppen: ["strasse"],
    org: "feuerwehr", name: "LKW verliert Flüssigkeit (Gefahrgut)", stichwort: "ABC Gefahrgut", preis: 7000, ab_level: 8,
    freischaltung: { nach: "abc_gas", sterne: 4 },
    orte: ["hauptstrasse_ost", "hauptstrasse_west"], intervall_min: 7200, ablauf_min: 15, arbeit_min: 40, ziel_eintreffen_min: 10,
    mindestens: { personen: 6, qualifikation: { abc: 1, agt: 2 }, geraete: [[{ mehrgasmessgeraet: 1 }], [{ oelbinder: 4 }]] },
    optimal: { personen: 9, einheit: "gruppe", geraete: [[{ pressluftatmer: 2 }], [{ leitkegel: 1 }], [{ hrt: 2 }]] },
    psa: { jacke: 2, handschuhe: 1 },
    regeln: ["einheitsfuehrer", "verkehrsabsicherung"],
    folge: ["p_vollsperrung"], gemeinsam: { ziel_min: 10 },
    text: "Ein LKW mit Warntafel verliert eine Flüssigkeit. Erst muss klar sein, was ausläuft.",
    verfallen_text: "Der Werkfeuerwehrdienst des Herstellers kam aus der Stadt, die Straße war stundenlang dicht.",
  },
  b_leerstand: {
    org: "feuerwehr", name: "Brand in leerstehendem Haus", stichwort: "B Gebäude", preis: 6000, ab_level: 8,
    freischaltung: { nach: "b_wohnung", sterne: 3 },
    orte: ["scheune", "nachbarhaus"], intervall_min: 7200, ablauf_min: 12, arbeit_min: 35, ziel_eintreffen_min: 8, wachstum: 0.15,
    mindestens: { personen: 6, geraete: [[{ ts_alt: 1 }, { pfpn_1000: 1 }, { pfpn_1500: 1 }, { fahrzeug_wasser: 1 }], [{ c_schlauch_15: 4 }, { c_schlauch_20: 3 }], [{ cm_strahlrohr: 2 }, { c_hohlstrahlrohr: 2 }]] },
    optimal: { personen: 9, einheit: "gruppe", geraete: [[{ verteiler: 1 }], [{ b_schlauch: 2 }], [{ waermebildkamera: 1 }]] },
    psa: { helm: 1, jacke: 2, handschuhe: 1 },
    regeln: ["einheitsfuehrer", "maschinist_pumpe"],
    folge: ["p_brandermittlung", "drk_betreuung", "thw_abstuetzen"], gemeinsam: { ziel_min: 15 },
    text: "Aus einem leerstehenden Haus schlagen Flammen. Ob jemand drin war, weiß niemand.",
    verfallen_text: "Die Nachbarwehren haben gelöscht, vom Haus blieb nur die Hülle.",
  },
  silvester: {
    org: "feuerwehr", name: "Silvesternacht: Kleinbrände", stichwort: "B klein", preis: 800, ab_level: 8,
    freischaltung: { nach: "b_hecke", sterne: 3 },
    orte: ["muelltonnen", "hecke_nachbar", "festplatz"], intervall_min: 60, ablauf_min: 10, arbeit_min: 6, ziel_eintreffen_min: 8, wachstum: 0.1,
    bedingung: { daten: ["12-31", "01-01"], stunden: [22, 23, 0, 1, 2], faktor: 1, sonst_faktor: 0 },
    mindestens: { personen: 1, geraete: [[{ pulverloescher: 1 }, { schaumloescher: 1 }, { kuebelspritze: 1 }, { loeschrucksack: 1 }, { fahrzeug_wasser: 1, cm_strahlrohr: 1 }]] }, // auch Schnellangriff aus dem Tank
    optimal: { personen: 2, geraete: [[{ schaumloescher: 1 }, { cm_strahlrohr: 1, c_schlauch_15: 2, standrohr: 1 }], [{ beleuchtung: 1 }]] },
    psa: { helm: 1, handschuhe: 1 },
    folge: ["p_silvester"], gemeinsam: { ziel_min: 12 },
    text: "Eine Rakete ist in die Hecke geflogen, nebenan knallen Böller in Briefkästen.",
    verfallen_text: "Die Hecke ist abgebrannt, die Nachbarn haben mit Eimern gelöscht.",
  },
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
  // Teile der Polizei bei gemeinsamen Einsätzen
  p_halter: {
    org: "polizei", name: "Halter ermitteln, Eltern finden", stichwort: "Hilfeleistung", folge_nur: true,
    ablauf_min: 20, arbeit_min: 0, ziel_eintreffen_min: 8, dauer_wie_ausloeser: true,
    mindestens: { personen: 1 }, optimal: { personen: 2 },
    text: "Wem gehört das Auto, und wo sind die Eltern?",
  },
  p_strassensperre: {
    org: "polizei", name: "Straße sperren", stichwort: "Verkehr", folge_nur: true,
    ablauf_min: 25, arbeit_min: 0, ziel_eintreffen_min: 10, dauer_wie_ausloeser: true,
    mindestens: { personen: 1 }, optimal: { personen: 2, geraete: [[{ leitkegel: 1 }], [{ anhaltekelle: 1 }]] },
    text: "Solange die Tiere auf der Straße stehen, muss der Verkehr angehalten werden.",
  },
  p_brandermittlung: {
    org: "polizei", name: "Ermittlung zur Brandursache", stichwort: "Ermittlung", folge_nur: true,
    ablauf_min: 60, arbeit_min: 40, ziel_eintreffen_min: 15,
    mindestens: { personen: 2 }, optimal: { personen: 2, qualifikation: { spurensicherung: 1 }, geraete: [[{ spurensicherung: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    text: "Brandstiftung ist nicht ausgeschlossen. Die Brandstelle wird gesichert und untersucht.",
  },
  p_fahndung: {
    org: "polizei", name: "Fahndung nach dem Verursacher", stichwort: "Unfallflucht", folge_nur: true,
    ablauf_min: 30, arbeit_min: 30, ziel_eintreffen_min: 10,
    mindestens: { personen: 2 }, optimal: { personen: 2, qualifikation: { vu_aufnahme: 1 }, geraete: [[{ unfallaufnahme: 1 }]] },
    regeln: ["eigensicherung_zwei"],
    text: "Spuren am Zaun, Lacksplitter, eine Ölspur: Wer ist hier weitergefahren?",
  },
  p_raeumung: {
    org: "polizei", name: "Häuser räumen und absperren", stichwort: "Räumung", folge_nur: true,
    ablauf_min: 20, arbeit_min: 0, ziel_eintreffen_min: 8, dauer_wie_ausloeser: true,
    mindestens: { personen: 2 }, optimal: { personen: 4, geraete: [[{ absperrband: 1 }], [{ leitkegel: 1 }]] },
    text: "Die Nachbarhäuser müssen geräumt und abgesperrt werden, bis die Feuerwehr Entwarnung gibt.",
  },
  p_vollsperrung: {
    org: "polizei", name: "Vollsperrung und Umleitung", stichwort: "Verkehr", folge_nur: true,
    ablauf_min: 20, arbeit_min: 0, ziel_eintreffen_min: 10, dauer_wie_ausloeser: true,
    mindestens: { personen: 2 }, optimal: { personen: 4, geraete: [[{ leitkegel: 2 }], [{ absperrband: 1 }], [{ warnleuchte: 1 }]] },
    text: "Die Straße muss in beide Richtungen gesperrt und der Verkehr umgeleitet werden.",
  },
  p_blutprobe: {
    org: "polizei", name: "Blutprobe und Führerschein", stichwort: "Verkehr", folge_nur: true,
    ablauf_min: 30, arbeit_min: 30, ziel_eintreffen_min: 10,
    mindestens: { personen: 2 }, optimal: { personen: 2, geraete: [[{ atemalkohol: 1 }]] },
    text: "Der Fahrer muss zur Blutprobe, der Führerschein wird sichergestellt.",
  },
  p_silvester: {
    org: "polizei", name: "Sachbeschädigung in der Silvesternacht", stichwort: "Sachbeschädigung", folge_nur: true,
    ablauf_min: 30, arbeit_min: 20, ziel_eintreffen_min: 12,
    mindestens: { personen: 2 }, optimal: { personen: 2 },
    regeln: ["eigensicherung_zwei"],
    text: "Böller in Briefkästen, die Nachbarn rufen an.",
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
    { ueber: 5, abzug: 4 }, // sehr spät (etwa nach langem Warten auf Kräfte): nur noch ein Stern
  ],
  psa_unzureichend: 0.5,
  schaden_hoch: 1, // Brand ist stark angewachsen (wachstum · Verzug > 1)
  runden: "halbe", // halbe Sterne erlaubt
  freischaltung_standard: 3,
}

/**
 * Verfall (Spielwerte): Einsätze bleiben lange offen. Wer spät kommt, bekommt wenig Sterne, aber der Einsatz ist nicht verloren.
 * frist_min: so lange wartet ein Einsatz mindestens auf Kräfte; gilt, wenn ablauf_min der Einsatzart kürzer ist.
 * raster_min: nach Ablauf von ablauf_min wird ein wartender Einsatz nur noch in diesem Raster neu alarmiert; sofort nach Käufen
 *   und sobald eine Person, ein Fahrzeug oder Gerät wieder frei wird.
 * Folgeeinsätze, die so lange laufen wie ihr Auslöser (Absichern, Verkehr regeln), verfallen spätestens mit dessen Ende.
 * Ein Feuer breitet sich nach ablauf_min nicht weiter aus (abgebrannt, dann nur noch Nachlöschen).
 */
const VERFALL = {
  frist_min: 24 * 60,
  raster_min: 15,
}

/**
 * Rettungsdienst (Spielwerte, Konzept DORFDIENSTE.md 5.6): Transport ins Krankenhaus über die Hauptstraße nach Süden,
 * Übergabe, Rückfahrt und Wiederherstellung. Notarzt per NEF (mit Notarztvertrag), tagsüber per Rettungshubschrauber
 * oder aus der Stadt. Patient: Minuten bis zur Versorgung je Dringlichkeit [stabil bis, verzögert bis].
 */
const RETTUNG = {
  verpflegung_ab_min: 180, // spielwert: danach arbeiten die Kräfte mit Verpflegung durch das DRK schneller
  verpflegung_faktor: 0.85,
  hilfsfrist_min: 8,
  erreichungsgrad_ziel: 0.95,
  notarzt_ziel_min: 15,
  transport_min: 25,
  uebergabe_min: 10,
  wiederherstellung_min: 10,
  infektion_faktor: 3,
  rth_min: 12,
  rth_name: "Rettungshubschrauber",
  notarzt_stadt_min: 25,
  aed_umkreis: 40,
  aed_bonus_min: 3,
  telefon_bonus_min: 2,
  erste_hilfe_anteil: 0.5,
  patient: { rot: [10, 18], gelb: [15, 30], gruen: [45, 120] },
}

/** Großlagen: wie oft, je nach Zusammenarbeit (Durchschnitt der letzten gemeinsamen Einsätze, 1 bis 5 Sterne). */
const GROSSLAGE = { faktor_basis: 0.5, faktor_je_stern: 0.1, ohne_zusammenarbeit: 0.8 } // spielwert

/** Nachforderung (THW): ohne Gruppen- oder Zugführer der Feuerwehr vor Ort wird später angefordert (Konzept 13.2). */
const NACHFORDERUNG = { fuehrung: ["gf", "zf", "verbandsfuehrer", "wachfuehrer"], verzug_min: 10 } // spielwert

/** Wachdienst der DLRG an der Badestelle (Spielwerte): so viele Mitglieder sitzen auf dem Wachturm und fehlen der Feuerwehr. */
const WACHDIENST = { tage: [6, 0], von: 11, bis: 18, monate: [6, 7, 8], personen: 2, ort: "elbe_ufer", reaktion_s: 30 }

/** Personal der Polizei: Beamtinnen und Beamte werden an die Dienststelle versetzt (begrenzt durch personal_max). */
const PERSONAL = {
  polizei: { name: "Beamtin/Beamter an die Dienststelle versetzen", preis: 600 }, // spielwert
  werkstatt: { org: "werkstatt", name: "Mechanikerin/Mechaniker einstellen", preis: 500, lehrgaenge: ["kfz"] }, // spielwert
  bauhof: { org: "bauhof", name: "Gemeindearbeiterin/Gemeindearbeiter einstellen", preis: 400, lehrgaenge: ["gemeindearbeit"] }, // spielwert
  rettungssanitaeter: { org: "rettungsdienst", name: "Rettungssanitäterin/Rettungssanitäter einstellen", preis: 500, lehrgaenge: ["rs"] }, // spielwert
  notfallsanitaeter: { org: "rettungsdienst", name: "Notfallsanitäterin/Notfallsanitäter einstellen", preis: 1500, lehrgaenge: ["rs", "nfs"] }, // spielwert
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
  abkuerzung_max: 30, // spielwert: zu Fuß und mit dem Rad am Anfang und Ende über Hof oder Platz (Einheiten, etwa 90 m)
  heimweg_tempo: 0.7, // spielwert: nach dem Einsatz ohne Eile zurück nach Hause (Anteil am Tempo zum Alarm)
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

/**
 * Nachbarhilfe (Spielwerte): Ist für einen ernsten Feuerwehreinsatz so lange niemand frei (nach_min, mindestens die
 * Frist der Einsatzart), alarmiert die Leitstelle die Nachbarfeuerwehr. Sie kommt vom Ortseingang, höchstens max_sterne.
 * Harmlose Einsätze (Katze im Baum) warten weiter auf die eigenen Leute.
 */
const NACHBARHILFE = {
  feuerwehr: { name: "Nachbarfeuerwehr", nach_min: 30, anfahrt_min: 15, max_sterne: 1 },
}

/**
 * Zufallsorte: Punkte aus der Karte, an denen Einsätze mit ort_gruppen außer an ihren festen Orten auftreten können
 * (baum: Bäume an freien Grünflächen; strasse: Abschnitte aller Straßen). Das öffentliche Regelwerk hat keine, die
 * private Karte der App liefert sie (dienst.js, mitKarte).
 */
const ZUFALLSORTE = {}
const ZUFALLSORT_NAMEN = { baum: "Baum im Dorf", strasse: "Dorfstraße" }

module.exports = {
  NACHBARHILFE,
  DWD_WARNUNGEN,
  SIRENEN,
  ZUFALLSORTE,
  ZUFALLSORT_NAMEN,
  VERFALL,
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
  ORGANISATIONEN,
  EXTERN,
  FREISCHALTUNG_LEVEL,
  RETTUNG,
  WACHDIENST,
  NACHFORDERUNG,
  GROSSLAGE,
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
