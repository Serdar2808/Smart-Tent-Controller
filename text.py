"""Text-Plattform für Pflanzen-Details."""
import logging
from homeassistant.components.text import TextEntity, TextMode
from homeassistant.helpers.restore_state import RestoreEntity
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = []
    for i in range(1, 4):
        p_id = f"P{i}"
        entities.append(OgbPlantText(coordinator, p_id, "strain",        "Strain",          "mdi:dna"))
        entities.append(OgbPlantText(coordinator, p_id, "breeder",       "Breeder",         "mdi:store"))
        entities.append(OgbPlantText(coordinator, p_id, "notes",         "Notizen",         "mdi:notebook-edit"))
        entities.append(OgbPlantText(coordinator, p_id, "start_date",    "Startdatum",      "mdi:calendar-plus"))
        entities.append(OgbPlantText(coordinator, p_id, "flower_date",   "Bluetebeginn",    "mdi:calendar-clock"))
        # Phase-Historie als JSON: {"EarlyVeg": {"start": "2024-01-01", "end": "2024-02-01"}, ...}
        entities.append(OgbPlantText(coordinator, p_id, "phase_history", "Phasen Historie", "mdi:history"))
    async_add_entities(entities)


class OgbPlantText(TextEntity, RestoreEntity):
    def __init__(self, coordinator, p_id, key, label, icon):
        self.coordinator = coordinator
        self._p_id = p_id
        self._key = key
        self._attr_name = f"{coordinator.entry.title} {p_id} {label}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{p_id.lower()}_{key}"
        self.entity_id = f"text.{coordinator.prefix}_{p_id.lower()}_{key}"
        self._attr_icon = icon
        self._attr_native_min = 0
        self._attr_native_max = 1024
        self._attr_mode = TextMode.TEXT
        self._value = "{}" if key == "phase_history" else ""

    @property
    def native_value(self):
        return self._value

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state not in ["unknown", "unavailable"]:
            self._value = last_state.state
            self.coordinator.data["plants"][self._p_id][self._key] = last_state.state
        else:
            self._value = self.coordinator.data["plants"][self._p_id].get(self._key, "")
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )

    async def async_set_value(self, value: str):
        self._value = value
        self.coordinator.data["plants"][self._p_id][self._key] = value
        self.async_write_ha_state()
