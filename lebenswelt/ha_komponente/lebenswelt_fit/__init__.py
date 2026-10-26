"""Lebenswelt Fit: Weiterleitung von der App Lebenswelt Fit zur Lebenswelt Datenbank.

Lebenswelt Fit läuft ohne Home-Assistant-Anmeldung auf einem gekoppelten Handy. Ihre Anfragen kommen an
/api/lebenswelt_fit/<pfad> und gehen unverändert an /api/lebenswelt/<pfad> der Lebenswelt Datenbank. Prüfen tut
die Datenbank: Ohne gültigen Geräteschlüssel (aus der Kopplung per QR-Code) geht nur das Koppeln selbst. Weitergegeben
werden nur Methode, Pfad, Abfrage, Inhalt und der Geräteschlüssel, keine anderen Kopfzeilen.

Diese Datei legt das Add-on „Lebenswelt Datenbank“ beim Start hierher (custom_components/lebenswelt_fit) und
trägt das Ziel ein. Eingeschaltet wird sie als Integration „Lebenswelt Fit“ (Einstellungen → Geräte & Dienste →
Integration hinzufügen), ohne Eingaben; alternativ mit der Zeile ``lebenswelt_fit:`` in configuration.yaml.
"""

from __future__ import annotations

import asyncio
import re

from aiohttp import ClientError, ClientTimeout, web
import voluptuous as vol

from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType

DOMAIN = "lebenswelt_fit"
ZIEL = "http://@ZIEL@:8090/api/lebenswelt/"
PFAD = re.compile(r"^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$")
GROESSE_MAX = 4 * 1024 * 1024

CONFIG_SCHEMA = vol.Schema({DOMAIN: vol.Schema({})}, extra=vol.ALLOW_EXTRA)


def _anmelden(hass: HomeAssistant) -> None:
    """Weiterleitung einmal anmelden (Ansichten lassen sich in Home Assistant nicht wieder abmelden)."""
    if hass.data.get(DOMAIN):
        return
    hass.data[DOMAIN] = True
    hass.http.register_view(FitWeiterleitung(hass))


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Mit ``lebenswelt_fit:`` in configuration.yaml."""
    if DOMAIN in config:
        _anmelden(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Als Integration hinzugefügt."""
    _anmelden(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Entfernen: Die Weiterleitung bleibt bis zum nächsten Neustart, ohne Integration startet sie danach nicht mehr."""
    return True


class FitWeiterleitung(HomeAssistantView):
    """Reicht Anfragen an die Lebenswelt Datenbank weiter; die Datenbank prüft den Geräteschlüssel."""

    url = "/api/lebenswelt_fit/{pfad:.+}"
    name = "api:lebenswelt_fit"
    requires_auth = False

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def _weiter(self, request: web.Request, pfad: str) -> web.Response:
        if not PFAD.match(pfad):
            return web.json_response({"fehler": "Unbekannter Pfad."}, status=404)
        kopf = {"X-Lebenswelt-Fit": "1"}
        ausweis = request.headers.get("Authorization", "")
        if ausweis.startswith("Bearer "):
            kopf["X-Lebenswelt-Geraet"] = ausweis[7:].strip()[:200]
        koerper = None
        if request.method in ("POST", "PUT", "DELETE"):
            if (request.content_length or 0) > GROESSE_MAX:
                return web.json_response({"fehler": "Zu groß."}, status=413)
            koerper = await request.read()
            if len(koerper) > GROESSE_MAX:
                return web.json_response({"fehler": "Zu groß."}, status=413)
            kopf["Content-Type"] = "application/json"
        sitzung = async_get_clientsession(self._hass)
        try:
            async with sitzung.request(
                request.method,
                ZIEL + pfad,
                params=request.query,
                data=koerper,
                headers=kopf,
                timeout=ClientTimeout(total=30),
                allow_redirects=False,
            ) as antwort:
                inhalt = await antwort.read()
                return web.Response(
                    body=inhalt,
                    status=antwort.status,
                    content_type=antwort.content_type or "application/json",
                    headers={"Cache-Control": "no-store"},
                )
        except (ClientError, asyncio.TimeoutError):
            return web.json_response({"fehler": "Lebenswelt Datenbank nicht erreichbar."}, status=502)

    async def get(self, request: web.Request, pfad: str) -> web.Response:
        return await self._weiter(request, pfad)

    async def post(self, request: web.Request, pfad: str) -> web.Response:
        return await self._weiter(request, pfad)

    async def put(self, request: web.Request, pfad: str) -> web.Response:
        return await self._weiter(request, pfad)

    async def delete(self, request: web.Request, pfad: str) -> web.Response:
        return await self._weiter(request, pfad)
