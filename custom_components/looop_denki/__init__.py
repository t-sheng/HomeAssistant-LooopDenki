"""Looop Denki integration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, PANEL_URL_PATH, PLATFORMS, STATIC_URL_PATH
from .coordinator import LooopDenkiCoordinator


@dataclass(slots=True)
class LooopDenkiRuntimeData:
    """Runtime storage for integration entry."""

    coordinator: LooopDenkiCoordinator


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the integration via YAML (not used)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Looop Denki from a config entry."""
    coordinator = LooopDenkiCoordinator(hass, entry.data, entry.options)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = LooopDenkiRuntimeData(coordinator=coordinator)

    if not hass.data[DOMAIN].get("panel_registered"):
        frontend_file = Path(__file__).parent / "frontend" / "looop-denki-panel.js"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    STATIC_URL_PATH,
                    str(frontend_file.parent),
                    cache_headers=False,
                )
            ]
        )
        panel_custom.async_register_panel(
            hass,
            webcomponent_name="looop-denki-panel",
            frontend_url_path=PANEL_URL_PATH,
            module_url=f"{STATIC_URL_PATH}/looop-denki-panel.js",
            sidebar_title="Looop Denki",
            sidebar_icon="mdi:chart-line",
        )
        hass.data[DOMAIN]["panel_registered"] = True

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options update and reload entry."""
    await hass.config_entries.async_reload(entry.entry_id)
