"""Tests des Schiffsempfangs: python3 test/ais_test.py"""
import asyncio
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lebenswelt", "ais"))
import ais  # noqa: E402

HEIM = (53.5, 10.0)


def position(mmsi, lat, lon, sog=8.0, cog=90.0, art="PositionReport"):
    return {"MessageType": art, "MetaData": {"MMSI": mmsi, "ShipName": "MS TESTFAHRT  "}, "Message": {art: {"UserID": mmsi, "Latitude": lat, "Longitude": lon, "Sog": sog, "Cog": cog, "TrueHeading": 511, "NavigationalStatus": 0}}}


class Verarbeitung(unittest.TestCase):
    def test_position_wird_relativ_zum_zuhause(self):
        schiffe = {}
        self.assertTrue(ais.verarbeite(position(211000001, 53.5, 10.01), schiffe, HEIM, 100))
        s = schiffe["211000001"]
        self.assertEqual(s["name"], "MS TESTFAHRT")
        self.assertAlmostEqual(s["ost_m"], 662, delta=5)  # 0,01° Länge bei 53,5° Breite
        self.assertEqual(s["nord_m"], 0)
        self.assertIsNone(s["kurs"])  # 511 = nicht verfügbar

    def test_stammdaten_mit_laenge_typ_und_ziel(self):
        schiffe = {}
        ais.verarbeite({"MessageType": "ShipStaticData", "MetaData": {"MMSI": 5}, "Message": {"ShipStaticData": {"UserID": 5, "Type": 79, "Name": "GMS ELBE", "Destination": "HAMBURG", "Dimension": {"A": 80, "B": 30, "C": 5, "D": 6}}}}, schiffe, HEIM, 1)
        self.assertEqual(schiffe["5"]["laenge"], 110)
        self.assertEqual(schiffe["5"]["breite"], 11)
        self.assertEqual(schiffe["5"]["typ"], 79)
        self.assertEqual(schiffe["5"]["ziel"], "HAMBURG")

    def test_ungueltiges_wird_ignoriert(self):
        schiffe = {}
        self.assertFalse(ais.verarbeite({"MessageType": "PositionReport", "MetaData": {}, "Message": {}}, schiffe, HEIM, 1))
        self.assertFalse(ais.verarbeite(position(7, 91, 10), schiffe, HEIM, 1))
        self.assertFalse(ais.verarbeite({"MessageType": "Unbekannt", "MetaData": {"MMSI": 8}, "Message": {}}, schiffe, HEIM, 1))

    def test_ausgabe_nur_mit_frischer_position(self):
        schiffe = {}
        ais.verarbeite(position(1, 53.5, 10.0), schiffe, HEIM, 0)
        ais.verarbeite(position(2, 53.5, 10.0), schiffe, HEIM, 2000)
        ais.verarbeite({"MessageType": "ShipStaticData", "MetaData": {"MMSI": 3}, "Message": {"ShipStaticData": {"Type": 60}}}, schiffe, HEIM, 2000)
        aus = ais.ausgabe(schiffe, 2010)
        self.assertEqual([s["mmsi"] for s in aus["schiffe"]], ["2"])
        self.assertEqual(aus["schiffe"][0]["alter_s"], 10)

    def test_aufraeumen_vergisst_alte(self):
        schiffe = {}
        ais.verarbeite(position(1, 53.5, 10.0), schiffe, HEIM, 0)
        ais.verarbeite(position(2, 53.5, 10.0), schiffe, HEIM, 4000)
        ais.aufraeumen(schiffe, 4000)
        self.assertEqual(list(schiffe), ["2"])

    def test_umkreis(self):
        box = ais.umkreis(53.5, 10.0, 5)
        self.assertAlmostEqual(box[0][1][0] - box[0][0][0], 2 * 5 / 111.32, places=5)
        self.assertGreater(box[0][1][1] - box[0][0][1], box[0][1][0] - box[0][0][0])


class Strom(unittest.TestCase):
    """Ende zu Ende gegen einen kleinen Testserver statt aisstream.io (braucht das Paket websockets)."""

    def test_empfang_schreibt_datei(self):
        try:
            import websockets
        except ImportError:
            self.skipTest("websockets nicht installiert")

        async def ablauf():
            abo = {}

            async def server(ws):
                abo.update(json.loads(await ws.recv()))
                await ws.send(json.dumps(position(211000001, 53.5, 10.01)).encode())  # aisstream schickt Binärrahmen
                await ws.send(json.dumps(position(211000002, 53.505, 9.99, cog=270)))

            async with websockets.serve(server, "127.0.0.1", 0) as srv:
                port = srv.sockets[0].getsockname()[1]
                ais.STROM = f"ws://127.0.0.1:{port}"
                ais.SCHREIBEN_S = 0
                ais.zuhause = lambda: HEIM
                await ais.empfange("geheim", 5)
            return abo

        with tempfile.TemporaryDirectory() as d:
            ais.ZIEL = os.path.join(d, "ais.json")
            abo = asyncio.run(ablauf())
            with open(ais.ZIEL, encoding="utf-8") as f:
                stand = json.load(f)
        self.assertEqual(abo["APIKey"], "geheim")
        self.assertIn("PositionReport", abo["FilterMessageTypes"])
        self.assertEqual(sorted(s["mmsi"] for s in stand["schiffe"]), ["211000001", "211000002"])


if __name__ == "__main__":
    unittest.main()
