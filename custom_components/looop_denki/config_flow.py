"""Config flow for Looop Denki."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers import selector

from .const import (
    AREA_OPTIONS,
    CONF_AREA_CODE,
    CONF_PRICE_OFFSET,
    DEFAULT_AREA_CODE,
    DEFAULT_PRICE_OFFSET,
    DOMAIN,
)


class LooopDenkiConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Looop Denki."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Handle first step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            area_code = user_input[CONF_AREA_CODE]
            if area_code not in AREA_OPTIONS:
                errors[CONF_AREA_CODE] = "invalid_area_code"
            else:
                return self.async_create_entry(
                    title=f"Looop Denki {AREA_OPTIONS[area_code]}",
                    data={
                        CONF_AREA_CODE: area_code,
                        CONF_PRICE_OFFSET: float(user_input[CONF_PRICE_OFFSET]),
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_AREA_CODE, default=DEFAULT_AREA_CODE): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[
                                selector.SelectOptionDict(value=code, label=label)
                                for code, label in AREA_OPTIONS.items()
                            ],
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                    vol.Required(CONF_PRICE_OFFSET, default=DEFAULT_PRICE_OFFSET): vol.Coerce(float),
                }
            ),
            errors=errors,
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        """Get options flow."""
        return LooopDenkiOptionsFlow(config_entry)


class LooopDenkiOptionsFlow(config_entries.OptionsFlow):
    """Handle options for Looop Denki."""

    def __init__(self, config_entry) -> None:
        """Initialize options flow."""
        self._config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        """Manage options."""
        errors: dict[str, str] = {}

        if user_input is not None:
            area_code = user_input[CONF_AREA_CODE]
            if area_code not in AREA_OPTIONS:
                errors[CONF_AREA_CODE] = "invalid_area_code"
            else:
                return self.async_create_entry(
                    title="",
                    data={
                        CONF_AREA_CODE: area_code,
                        CONF_PRICE_OFFSET: float(user_input[CONF_PRICE_OFFSET]),
                    },
                )

        current_area = self._config_entry.options.get(
            CONF_AREA_CODE,
            self._config_entry.data.get(CONF_AREA_CODE, DEFAULT_AREA_CODE),
        )
        current_offset = self._config_entry.options.get(
            CONF_PRICE_OFFSET,
            self._config_entry.data.get(CONF_PRICE_OFFSET, DEFAULT_PRICE_OFFSET),
        )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_AREA_CODE, default=current_area): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[
                                selector.SelectOptionDict(value=code, label=label)
                                for code, label in AREA_OPTIONS.items()
                            ],
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                    vol.Required(CONF_PRICE_OFFSET, default=current_offset): vol.Coerce(float),
                }
            ),
            errors=errors,
        )
