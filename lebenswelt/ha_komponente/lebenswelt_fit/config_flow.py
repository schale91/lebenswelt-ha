"""Lebenswelt Fit hinzufügen: keine Eingaben, nur bestätigen."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from . import DOMAIN


class LebensweltFitFlow(ConfigFlow, domain=DOMAIN):
    """Legt den einen Eintrag an; die Datenbank prüft jede Anfrage selbst."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is None:
            return self.async_show_form(step_id="user")
        return self.async_create_entry(title="Lebenswelt Fit", data={})
