"""Switch-Plattform für Open Grow Box Logik-Schalter."""
import logging
from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.restore_state import RestoreEntity
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = [
        OgbLogicSwitch(coordinator, "vpd_auto",             "VPD Auto-Regelung",        "mdi:robot"),
        OgbLogicSwitch(coordinator, "vpd_manual_mode",      "Manueller VPD Zielwert",   "mdi:target-variant"),
        OgbLogicSwitch(coordinator, "light_auto",           "Licht Automatik",          "mdi:lightbulb-auto"),
        OgbLogicSwitch(coordinator, "exhaust_limit_mode",   "Abluft Limits aktiv",      "mdi:fan-lock"),
        OgbLogicSwitch(coordinator, "vpd_night_hold",       "VPD Night Hold",           "mdi:moon-waning-crescent"),
        OgbLogicSwitch(coordinator, "vpd_interval_enabled", "Zeitbasierte Ueberwachung","mdi:clock-check-outline"),
        OgbLogicSwitch(coordinator, "min_max_control",      "Min-Max Steuerung",        "mdi:tune-vertical"),
        OgbLogicSwitch(coordinator, "intake_linked",        "Zuluft an Abluft koppeln", "mdi:fan-auto"),
        # NEU: Leaf VPD Offset Schalter
        OgbLogicSwitch(coordinator, "leaf_vpd_enabled",     "Leaf VPD Offset aktiv",    "mdi:leaf"),
    ]
    async_add_entities(entities)


class OgbLogicSwitch(SwitchEntity, RestoreEntity):
    def __init__(self, coordinator, key, label, icon):
        self.coordinator = coordinator
        self._key = key
        self._attr_name = f"{coordinator.entry.title} {label}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{key}"
        self.entity_id = f"switch.{coordinator.prefix}_{key}"
        self._attr_icon = icon
        self._is_on = False

    @property
    def is_on(self):
        return self._is_on

    async def async_turn_on(self, **kwargs):
        self._is_on = True
        self.coordinator.data[self._key] = True
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs):
        self._is_on = False
        self.coordinator.data[self._key] = False
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state is not None and last_state.state not in ["unknown", "unavailable"]:
            restored = last_state.state == "on"
            self._is_on = restored
            self.coordinator.data[self._key] = restored
        else:
            self._is_on = self.coordinator.data.get(self._key, False)
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )

    def _handle_coordinator_update(self):
        self.async_write_ha_state()
