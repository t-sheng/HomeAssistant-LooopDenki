"""Data coordinator for Looop Denki."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Any

from aiohttp import ClientError

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .const import API_URL, CONF_AREA_CODE, CONF_PRICE_OFFSET, DAY_BUCKETS, DAY_LABELS, UPDATE_INTERVAL

_LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class DaySummary:
    """Normalized price data for a day."""

    day: str
    label: str
    prices: list[float]
    levels: list[float]
    min_price: float | None
    max_price: float | None
    min_hours: list[str]
    max_hours: list[str]


class LooopDenkiCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinate data fetching for Looop Denki API."""

    def __init__(self, hass: HomeAssistant, config: dict[str, Any], options: dict[str, Any]) -> None:
        """Initialize coordinator."""
        self.hass = hass
        self._session = async_get_clientsession(hass)
        self.area_code = str(options.get(CONF_AREA_CODE, config.get(CONF_AREA_CODE)))
        self.price_offset = float(options.get(CONF_PRICE_OFFSET, config.get(CONF_PRICE_OFFSET, 0.0)))
        self.selected_day = "today"

        super().__init__(
            hass,
            _LOGGER,
            name="Looop Denki coordinator",
            update_interval=UPDATE_INTERVAL,
        )

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch and normalize API data."""
        try:
            response = await self._session.get(API_URL.format(area_code=self.area_code), timeout=15)
            response.raise_for_status()
            payload = await response.json()
        except (ClientError, ValueError, TimeoutError) as err:
            raise UpdateFailed(f"Failed to fetch API data: {err}") from err

        if not isinstance(payload, dict):
            raise UpdateFailed("Unexpected payload type")

        normalized: dict[str, DaySummary | None] = {
            "yesterday": None,
            "today": None,
            "tomorrow": None,
        }

        for bucket, day_key in DAY_BUCKETS.items():
            day_obj = payload.get(bucket)
            if not isinstance(day_obj, dict):
                continue

            prices_raw = day_obj.get("price_data")
            levels_raw = day_obj.get("level")
            if not isinstance(prices_raw, list) or not isinstance(levels_raw, list):
                continue

            prices = [round(float(value) + self.price_offset, 3) for value in prices_raw]
            levels = [float(value) for value in levels_raw]

            # Keep both arrays aligned so index -> half-hour slot is always valid.
            slots = min(len(prices), len(levels))
            prices = prices[:slots]
            levels = levels[:slots]

            if slots == 0:
                normalized[day_key] = DaySummary(
                    day=day_key,
                    label=DAY_LABELS[day_key],
                    prices=[],
                    levels=[],
                    min_price=None,
                    max_price=None,
                    min_hours=[],
                    max_hours=[],
                )
                continue

            min_price = min(prices)
            max_price = max(prices)
            min_indices = [idx for idx, value in enumerate(prices) if value == min_price]
            max_indices = [idx for idx, value in enumerate(prices) if value == max_price]

            normalized[day_key] = DaySummary(
                day=day_key,
                label=DAY_LABELS[day_key],
                prices=prices,
                levels=levels,
                min_price=min_price,
                max_price=max_price,
                min_hours=[_slot_to_range(value) for value in min_indices],
                max_hours=[_slot_to_range(value) for value in max_indices],
            )

        now = dt_util.now()
        slot_index = min(now.hour * 2 + (1 if now.minute >= 30 else 0), 47)

        today_summary = normalized["today"]
        current_price = None
        if today_summary is not None and slot_index < len(today_summary.prices):
            current_price = today_summary.prices[slot_index]

        return {
            "days": normalized,
            "selected_day": self.selected_day,
            "current_slot": slot_index,
            "current_price": current_price,
            "area_code": self.area_code,
            "price_offset": self.price_offset,
            "updated_at": now.isoformat(),
        }


def _slot_to_range(slot: int) -> str:
    """Convert half-hour slot index into readable range."""
    start_minutes = slot * 30
    start_hour = (start_minutes // 60) % 24
    start_minute = start_minutes % 60

    end_minutes = start_minutes + 30
    end_hour = (end_minutes // 60) % 24
    end_minute = end_minutes % 60

    return f"{start_hour:02d}:{start_minute:02d}-{end_hour:02d}:{end_minute:02d}"
