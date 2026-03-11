"""Select entities for Looop Denki."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DAY_LABELS, DOMAIN
from .coordinator import LooopDenkiCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up select from config entry."""
    coordinator: LooopDenkiCoordinator = hass.data[DOMAIN][entry.entry_id].coordinator
    async_add_entities([LooopDenkiDaySelector(coordinator, entry.entry_id)])


class LooopDenkiDaySelector(CoordinatorEntity[LooopDenkiCoordinator], SelectEntity):
    """Select the day to show in the panel/dataset sensor."""

    _attr_has_entity_name = True
    _attr_name = "Graph Day"
    _attr_icon = "mdi:calendar-range"

    def __init__(self, coordinator: LooopDenkiCoordinator, entry_id: str) -> None:
        """Initialize selector."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry_id}_graph_day"
        self._attr_options = list(DAY_LABELS.values())

    @property
    def current_option(self) -> str:
        """Return selected day label."""
        day = self.coordinator.selected_day
        return DAY_LABELS.get(day, DAY_LABELS["today"])

    @property
    def extra_state_attributes(self) -> dict[str, str]:
        """Add marker for custom panel lookup."""
        return {"looop_denki_day_selector": "true"}

    async def async_select_option(self, option: str) -> None:
        """Change selected day."""
        label_to_key = {label: key for key, label in DAY_LABELS.items()}
        self.coordinator.selected_day = label_to_key.get(option, "today")
        self.coordinator.async_update_listeners()
