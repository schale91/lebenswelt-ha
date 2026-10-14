#!/usr/bin/env python3
"""Schiffsverkehr für die Lebenswelt: liest den AIS-Datenstrom von aisstream.io für einen Umkreis um das Zuhause
(zone.home aus Home Assistant) und schreibt die aktuellen Schiffe nach /data/ais.json. Positionen stehen dort nur
relativ zum Zuhause (Meter nach Osten und Norden), damit die App keine Koordinaten braucht und kein Ort im Code steht.

Läuft neben PocketBase im Container (start.sh). Ohne Option ais_schluessel wartet es nur.
"""
import asyncio
import json
import math
import os
import time
import urllib.request

OPTIONEN = os.environ.get("LEBENSWELT_OPTIONEN", "/data/options.json")
ZIEL = os.environ.get("LEBENSWELT_AIS", "/data/ais.json")
STROM = os.environ.get("LEBENSWELT_AIS_URL", "wss://stream.aisstream.io/v0/stream")
TYPEN = ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"]
# Schiffe ohne neue Position fallen nach einer halben Stunde heraus
HALTBAR_S = 30 * 60
SCHREIBEN_S = 10


def lies_optionen():
    try:
        with open(OPTIONEN, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def zuhause():
    """Breite und Länge von zone.home über die Home-Assistant-API des Supervisors."""
    token = os.environ.get("SUPERVISOR_TOKEN", "")
    anfrage = urllib.request.Request("http://supervisor/core/api/states/zone.home", headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(anfrage, timeout=20) as r:
        a = json.load(r).get("attributes", {})
    return float(a["latitude"]), float(a["longitude"])


def umkreis(lat, lon, km):
    """Rechteck um das Zuhause für das Abo, Format von aisstream: [[[lat, lon], [lat, lon]]]."""
    dlat = km / 111.32
    dlon = km / (111.32 * max(0.1, math.cos(math.radians(lat))))
    return [[[lat - dlat, lon - dlon], [lat + dlat, lon + dlon]]]


def relativ(lat, lon, heim):
    """Meter nach Osten und Norden vom Zuhause (genau genug für wenige Kilometer)."""
    ost = (lon - heim[1]) * 111320 * math.cos(math.radians(heim[0]))
    nord = (lat - heim[0]) * 110574
    return round(ost), round(nord)


def _zahl(v, ungueltig=None):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if ungueltig is not None and x >= ungueltig:
        return None
    return x


def verarbeite(nachricht, schiffe, heim, jetzt):
    """Übernimmt eine Nachricht von aisstream in das Verzeichnis schiffe (MMSI -> Daten). Unbekanntes wird ignoriert."""
    art = nachricht.get("MessageType")
    inhalt = (nachricht.get("Message") or {}).get(art) or {}
    meta = nachricht.get("MetaData") or {}
    mmsi = str(meta.get("MMSI") or inhalt.get("UserID") or "")
    if not mmsi or art not in TYPEN:
        return False
    s = schiffe.setdefault(mmsi, {"mmsi": mmsi})
    s["gesehen"] = jetzt
    name = str(meta.get("ShipName") or "").strip()
    if name:
        s["name"] = name
    if art in ("PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport"):
        lat = _zahl(inhalt.get("Latitude"))
        lon = _zahl(inhalt.get("Longitude"))
        if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
            return False
        s["ost_m"], s["nord_m"] = relativ(lat, lon, heim)
        s["sog"] = _zahl(inhalt.get("Sog"), 102.3)
        s["cog"] = _zahl(inhalt.get("Cog"), 360)
        s["kurs"] = _zahl(inhalt.get("TrueHeading"), 360)
        if "NavigationalStatus" in inhalt:
            s["status"] = inhalt.get("NavigationalStatus")
        s["zeit"] = jetzt
        if art == "ExtendedClassBPositionReport" and inhalt.get("Type") is not None:
            s["typ"] = inhalt.get("Type")
        return True
    if art == "ShipStaticData":
        s["typ"] = inhalt.get("Type")
        if str(inhalt.get("Name") or "").strip():
            s["name"] = str(inhalt.get("Name")).strip()
        if str(inhalt.get("Destination") or "").strip():
            s["ziel"] = str(inhalt.get("Destination")).strip()
        _masse(s, inhalt.get("Dimension"))
        return True
    if art == "StaticDataReport":
        a = inhalt.get("ReportA") or {}
        b = inhalt.get("ReportB") or {}
        if a.get("Valid") and str(a.get("Name") or "").strip():
            s["name"] = str(a.get("Name")).strip()
        if b.get("Valid"):
            if b.get("ShipType") is not None:
                s["typ"] = b.get("ShipType")
            _masse(s, b.get("Dimension"))
        return True
    return False


def _masse(s, d):
    d = d or {}
    laenge = (d.get("A") or 0) + (d.get("B") or 0)
    breite = (d.get("C") or 0) + (d.get("D") or 0)
    if 0 < laenge < 500:
        s["laenge"] = laenge
    if 0 < breite < 80:
        s["breite"] = breite


def aufraeumen(schiffe, jetzt):
    """Schiffe, von denen eine Stunde lang nichts kam, vergessen (auch solche ohne Position)."""
    for mmsi in [m for m, s in schiffe.items() if jetzt - s.get("gesehen", 0) > 2 * HALTBAR_S]:
        del schiffe[mmsi]


def ausgabe(schiffe, jetzt, fehler=""):
    liste = []
    for s in schiffe.values():
        if "ost_m" not in s or jetzt - s.get("zeit", 0) > HALTBAR_S:
            continue
        x = {k: s[k] for k in ("mmsi", "name", "typ", "laenge", "breite", "ost_m", "nord_m", "sog", "cog", "kurs", "status", "ziel") if s.get(k) is not None}
        x["alter_s"] = round(jetzt - s["zeit"])
        liste.append(x)
    return {"eingerichtet": True, "zeit": round(jetzt * 1000), "fehler": fehler, "schiffe": sorted(liste, key=lambda x: x["mmsi"])}


def schreibe(daten):
    tmp = ZIEL + ".neu"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False)
    os.replace(tmp, ZIEL)


async def empfange(schluessel, radius_km):
    import websockets  # erst hier, damit die reinen Funktionen ohne Paket testbar bleiben

    heim = zuhause()
    schiffe = {}
    zuletzt = 0.0
    async with websockets.connect(STROM, open_timeout=30, ping_interval=30, max_size=2**22) as ws:
        await ws.send(json.dumps({"APIKey": schluessel, "BoundingBoxes": umkreis(heim[0], heim[1], radius_km), "FilterMessageTypes": TYPEN}))
        schreibe(ausgabe(schiffe, time.time()))
        while True:
            # Auch ohne Nachrichten regelmäßig schreiben, damit die App sieht, dass der Empfang läuft
            try:
                roh = await asyncio.wait_for(ws.recv(), timeout=max(1, SCHREIBEN_S))
            except asyncio.TimeoutError:
                roh = None
            except websockets.ConnectionClosedOK:
                schreibe(ausgabe(schiffe, time.time()))
                return
            jetzt = time.time()
            if roh is not None:
                try:
                    nachricht = json.loads(roh)
                except ValueError:
                    nachricht = None
                if isinstance(nachricht, dict) and nachricht.get("error"):
                    raise RuntimeError(str(nachricht.get("error")))
                if isinstance(nachricht, dict):
                    verarbeite(nachricht, schiffe, heim, jetzt)
            if roh is None or jetzt - zuletzt >= SCHREIBEN_S:
                aufraeumen(schiffe, jetzt)
                schreibe(ausgabe(schiffe, jetzt))
                zuletzt = jetzt


async def main():
    pause = 10
    while True:
        o = lies_optionen()
        schluessel = str(o.get("ais_schluessel") or "").strip()
        if not schluessel:
            schreibe({"eingerichtet": False, "zeit": round(time.time() * 1000), "fehler": "", "schiffe": []})
            await asyncio.sleep(300)
            continue
        try:
            await empfange(schluessel, float(o.get("ais_radius_km") or 5))
            pause = 10
        except Exception as fehler:  # Verbindung weg, Schlüssel falsch, HA nicht erreichbar: später neu versuchen
            schreibe({"eingerichtet": True, "zeit": round(time.time() * 1000), "fehler": str(fehler)[:200], "schiffe": []})
            await asyncio.sleep(pause)
            pause = min(pause * 2, 600)


if __name__ == "__main__":
    asyncio.run(main())
