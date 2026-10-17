// Private Karte einer Person über das öffentliche Regelwerk legen: Straßennetz, Orte, Bauplätze, Löschwasser, Gebiete.
// Zwei Karten gibt es: "dorf" (die echte Karte des 3D-Dorfs) und "elbe" (Elbe Springs, aus dem Stadtplan der App).
// Reine Funktionen ohne PocketBase, in Node getestet.

function mitKarte(R, k) {
  if (!karteGueltig(k)) return R
  const orte = {}
  for (const [id, o] of Object.entries(R.ORTE)) orte[id] = k.orte && k.orte[id] ? Object.assign({}, o, { x: k.orte[id].x, z: k.orte[id].z }) : o
  // Elbe Springs schickt nur die Lage der bebauten Plätze (Haustüren), die übrigen bleiben für neue Wohnhäuser frei
  const liste = k.welt === "elbe" ? R.BAUPLAETZE.map((b) => (k.bauplaetze || []).find((x) => x && x.id === b.id) || b) : k.bauplaetze || R.BAUPLAETZE
  const bauplaetze = liste.map((b) => {
    const alt = R.BAUPLAETZE.find((x) => x.id === b.id)
    return Object.assign({}, alt || { preis: 500 }, { id: b.id, x: b.x, z: b.z }, b.preis ? { preis: b.preis } : {})
  })
  const zahl = (v) => typeof v === "number" && isFinite(v)
  // Neubaugebiete: Ursprung und, wenn die App sie kennt, die einzelnen Plätze (echte Grundstücke oder an einer
  // Planstraße), genau so viele wie das Raster des Regelwerks hat
  const neubaugebiete = R.NEUBAUGEBIETE.map((n) => {
    const g = k.neubaugebiete && k.neubaugebiete[n.id]
    if (!g || !zahl(g.x) || !zahl(g.z)) return n
    const aus = Object.assign({}, n, { ursprung: { x: g.x, z: g.z } })
    if (Array.isArray(g.plaetze) && g.plaetze.length === n.spalten * n.reihen && g.plaetze.every((p) => p && zahl(p.x) && zahl(p.z))) aus.plaetze = g.plaetze.map((p) => ({ x: p.x, z: p.z }))
    return aus
  })
  const schutz = Array.isArray(k.schutz) ? k.schutz.filter((z) => z && zahl(z.x) && zahl(z.z) && zahl(z.r) && z.r > 0) : R.SCHUTZZONEN || []
  // Löschwasser der echten Karte; fehlt ein Feld, gilt das Regelwerk
  const punkte = (l) => (Array.isArray(l) ? l.filter((h) => h && typeof h.id === "string" && zahl(h.x) && zahl(h.z)).map((h) => ({ id: h.id, x: h.x, z: h.z })) : null)
  const hydranten = punkte(k.hydranten) || R.HYDRANTEN
  const hydrantPlaetze = punkte(k.hydrant_plaetze) || R.HYDRANT_PLAETZE
  const gewaesser = Array.isArray(k.gewaesser)
    ? k.gewaesser.filter((g) => g && typeof g.name === "string" && Array.isArray(g.punkte) && g.punkte.length >= 2 && g.punkte.every((p) => Array.isArray(p) && zahl(p[0]) && zahl(p[1])))
    : R.GEWAESSER
  // Zufallsorte der echten Karte (Bäume, Straßenabschnitte): Einsatzarten mit ort_gruppen wählen auch daraus
  const zufallsorte = {}
  if (k.zufallsorte && typeof k.zufallsorte === "object")
    for (const [g, liste] of Object.entries(k.zufallsorte))
      if (/^[a-z_]+$/.test(g) && Array.isArray(liste)) zufallsorte[g] = liste.filter((o) => o && zahl(o.x) && zahl(o.z)).slice(0, 80).map((o) => ({ x: o.x, z: o.z }))
  // Geländehöhen der echten Karte (m über NHN als Raster): Wassereinsätze eher in Senken (tief_gewicht)
  const gl = k.gelaende
  const gelaende =
    gl && zahl(gl.x0) && zahl(gl.z0) && zahl(gl.raster) && gl.raster > 0 && Number.isInteger(gl.spalten) && Number.isInteger(gl.reihen) && gl.spalten >= 2 && gl.reihen >= 2 && Array.isArray(gl.nhn) && gl.nhn.length === gl.spalten * gl.reihen && gl.nhn.length <= 5000 && gl.nhn.every(zahl)
      ? { x0: gl.x0, z0: gl.z0, raster: gl.raster, spalten: gl.spalten, reihen: gl.reihen, nhn: gl.nhn.slice() }
      : R.GELAENDE || null
  // Gebiete im Nebel nach der echten Karte: Ursprung, Startgebiet, Grenze und besondere Quadrate
  const g = k.gebiete
  const rechteck = (r) => r && Number.isInteger(r.i0) && Number.isInteger(r.i1) && Number.isInteger(r.j0) && Number.isInteger(r.j1) && r.i0 <= r.i1 && r.j0 <= r.j1
  const gebiete =
    g && g.ursprung && zahl(g.ursprung.x) && zahl(g.ursprung.z) && zahl(g.raster) && g.raster >= 20 && rechteck(g.start) && rechteck(g.grenze)
      ? Object.assign({}, R.GEBIETE, {
          ursprung: { x: g.ursprung.x, z: g.ursprung.z },
          raster: g.raster,
          start: g.start,
          grenze: g.grenze,
          besonders: g.besonders && typeof g.besonders === "object" ? Object.fromEntries(Object.entries(g.besonders).filter(([key, b]) => /^-?\d+:-?\d+$/.test(key) && b && typeof b.art === "string" && typeof b.name === "string").slice(0, 20)) : R.GEBIETE.besonders,
        })
      : R.GEBIETE
  // Elbe Springs: 10 m je Kachel, keine Gebiete im Nebel, flach (die Stadt kennt ihre Grenzen selbst)
  const elbe = k.welt === "elbe"
  return Object.assign({}, R, {
    METER_JE_EINHEIT: elbe && zahl(k.meter_je_einheit) && k.meter_je_einheit > 0 ? k.meter_je_einheit : R.METER_JE_EINHEIT,
    GEBIETE: elbe ? null : gebiete,
    STRASSEN: k.strassen,
    ORTE: orte,
    BAUPLAETZE: bauplaetze,
    NEUBAUGEBIETE: neubaugebiete,
    SCHUTZZONEN: schutz,
    HYDRANTEN: hydranten,
    HYDRANT_PLAETZE: hydrantPlaetze,
    GEWAESSER: gewaesser,
    ZUFALLSORTE: zufallsorte,
    GELAENDE: elbe ? null : gelaende,
    KARTE: elbe ? "elbe" : "privat",
  })
}

function karteGueltig(k) {
  const zahl = (v) => typeof v === "number" && isFinite(v)
  const s = k && k.strassen
  if (!s || !Array.isArray(s.knoten) || !Array.isArray(s.kanten) || s.knoten.length < 2) return false
  const ids = new Set(s.knoten.map((n) => n.id))
  if (!s.knoten.every((n) => typeof n.id === "string" && zahl(n.x) && zahl(n.z))) return false
  if (!s.kanten.every((e) => ids.has(e.von) && ids.has(e.nach) && zahl(e.laenge) && e.laenge > 0)) return false
  if (k.orte && !Object.values(k.orte).every((o) => o && zahl(o.x) && zahl(o.z))) return false
  if (k.bauplaetze && !(Array.isArray(k.bauplaetze) && k.bauplaetze.every((b) => typeof b.id === "string" && zahl(b.x) && zahl(b.z)))) return false
  return true
}

module.exports = { mitKarte, karteGueltig }
