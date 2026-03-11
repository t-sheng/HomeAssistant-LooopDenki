"""Sensor entities for Looop Denki."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DAY_LABELS, DOMAIN
from .coordinator import DaySummary, LooopDenkiCoordinator


@dataclass(slots=True)
class MetricDef:
    """Metric definition for day-based sensor creation."""

    key: str
    name: str
    value_fn: Callable[[DaySummary | None, dict[str, Any]], Any]
    unit: str | None = None
    state_class: SensorStateClass | None = None


METRICS: tuple[MetricDef, ...] = (
    MetricDef(
        key="current_energy_price",
        name="Current Energy Price",
        value_fn=lambda day, raw: _current_value(day, raw),
        unit="JPY",
    ),
    MetricDef(
        key="lowest_energy_price",
        name="Lowest Energy Price",
        value_fn=lambda day, _: None if day is None else day.min_price,
        unit="JPY",
    ),
    MetricDef(
        key="lowest_energy_price_hours",
        name="Lowest Energy Price Hours",
        value_fn=lambda day, _: None if day is None else ", ".join(day.min_hours),
    ),
    MetricDef(
        key="highest_energy_price",
        name="Highest Energy Price",
        value_fn=lambda day, _: None if day is None else day.max_price,
        unit="JPY",
    ),
    MetricDef(
        key="highest_energy_price_hours",
        name="Highest Energy Price Hours",
        value_fn=lambda day, _: None if day is None else ", ".join(day.max_hours),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensor entities from config entry."""
    coordinator: LooopDenkiCoordinator = hass.data[DOMAIN][entry.entry_id].coordinator

    entities: list[SensorEntity] = []
    for day_key, label in DAY_LABELS.items():
        for metric in METRICS:
            entities.append(
                LooopDenkiDayMetricSensor(
                    coordinator=coordinator,
                    entry_id=entry.entry_id,
                    day_key=day_key,
                    day_label=label,
                    metric=metric,
                )
            )

    entities.append(LooopDenkiSelectedDayDatasetSensor(coordinator, entry.entry_id))
    async_add_entities(entities)


class LooopDenkiDayMetricSensor(CoordinatorEntity[LooopDenkiCoordinator], SensorEntity):
    """A per-day metric sensor."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: LooopDenkiCoordinator,
        entry_id: str,
        day_key: str,
        day_label: str,
        metric: MetricDef,
    ) -> None:
        """Initialize day sensor."""
        super().__init__(coordinator)
        self._day_key = day_key
        self._metric = metric
        self._attr_name = f"{metric.name} {day_label}"
        self._attr_unique_id = f"{entry_id}_{metric.key}_{day_key}"
        self._attr_native_unit_of_measurement = metric.unit
        self._attr_state_class = metric.state_class

    @property
    def native_value(self):
        """Return native sensor value."""
        data = self.coordinator.data
        if not data:
            return None
        day_data: DaySummary | None = data["days"].get(self._day_key)
        return self._metric.value_fn(day_data, data)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return useful context as attributes."""
        data = self.coordinator.data
        if not data:
            return {}
        return {
            "day": self._day_key,
            "area_code": data.get("area_code"),
            "price_offset": data.get("price_offset"),
            "updated_at": data.get("updated_at"),
        }


class LooopDenkiSelectedDayDatasetSensor(CoordinatorEntity[LooopDenkiCoordinator], SensorEntity):
    """Graph dataset for selected day."""

    _attr_has_entity_name = True
    _attr_name = "Selected Day Price Dataset"
    _attr_icon = "mdi:chart-line"

    def __init__(self, coordinator: LooopDenkiCoordinator, entry_id: str) -> None:
        """Initialize dataset sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry_id}_selected_day_dataset"

    @property
    def native_value(self) -> str | None:
        """Return selected day label."""
        data = self.coordinator.data
        if not data:
            return None
        selected = self.coordinator.selected_day
        return DAY_LABELS.get(selected, DAY_LABELS["today"])

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Expose all price arrays for graphing."""
        data = self.coordinator.data
        if not data:
            return {}

        selected_key = self.coordinator.selected_day
        selected_day: DaySummary | None = data["days"].get(selected_key)

        return {
            "looop_denki_dataset": "true",
            "selected_day": selected_key,
            "selected_day_label": DAY_LABELS.get(selected_key, DAY_LABELS["today"]),
            "selected_day_prices": [] if selected_day is None else selected_day.prices,
            "selected_day_levels": [] if selected_day is None else selected_day.levels,
            "selected_day_time_slots": _time_slots(len([] if selected_day is None else selected_day.prices)),
            "yesterday_prices": _safe_prices(data, "yesterday"),
            "today_prices": _safe_prices(data, "today"),
            "tomorrow_prices": _safe_prices(data, "tomorrow"),
            "updated_at": data.get("updated_at"),
        }


def _safe_prices(data: dict[str, Any], day_key: str) -> list[float]:
    """Get day prices safely from coordinator data."""
    day: DaySummary | None = data["days"].get(day_key)
    return [] if day is None else day.prices


def _time_slots(count: int) -> list[str]:
    """Build labels for half-hour slots."""
    slots: list[str] = []
    for slot in range(count):
        total_minutes = slot * 30
        hour = (total_minutes // 60) % 24
        minute = total_minutes % 60
        slots.append(f"{hour:02d}:{minute:02d}")
    return slots


def _current_value(day: DaySummary | None, raw_data: dict[str, Any]) -> float | None:
    """Get current slot value for a given day."""
    if day is None:
        return None
    current_slot = raw_data.get("current_slot")
    if not isinstance(current_slot, int):
        return None
    if current_slot >= len(day.prices):
        return None
    return day.prices[current_slot]
