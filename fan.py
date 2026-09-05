"""Fan-Plattform für die Open Grow Box Abluft-Steuerung."""
import logging
from homeassistant.components.fan import FanEntity, FanEntityFeature
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([OgbExhaustFan(coordinator)])


class OgbExhaustFan(FanEntity):
    """Virtueller Lüfter der die Abluft-Steuerung der Integration widerspiegelt."""

    def __init__(self, coordinator):
        self.coordinator = coordinator
        self._attr_name = f"{coordinator.entry.title} Abluft"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_exhaust_fan"
        self.entity_id = f"fan.{coordinator.prefix}_exhaust"
        self._attr_icon = "mdi:fan"
        self._attr_supported_features = FanEntityFeature.SET_SPEED

    @property
    def percentage(self):
        """Zeigt den Speed des echten Lüfters an."""
        real_fan_id = self.coordinator.data["overrides"].get("fan_exhaust")
        if real_fan_id and real_fan_id != "Auto (Discovery)":
            state = self.hass.states.get(real_fan_id)
            if state:
                return state.attributes.get("percentage", 0)
        return 0

    @property
    def is_on(self):
        return (self.percentage or 0) > 0

    async def async_set_percentage(self, percentage: int):
        """Manuelles Übersteuern aus der Card."""
        real_fan_id = self.coordinator.data["overrides"].get("fan_exhaust")
        if real_fan_id and real_fan_id != "Auto (Discovery)":
            await self.hass.services.async_call(
                "fan", "set_percentage",
                {"entity_id": real_fan_id, "percentage": percentage}
            )
            await self.coordinator.async_request_refresh()

    async def async_turn_on(self, percentage: int = None, **kwargs):
        await self.async_set_percentage(percentage or 25)

    async def async_turn_off(self, **kwargs):
        await self.async_set_percentage(0)

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )
