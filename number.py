"""Number-Plattform für Open Grow Box."""
import logging
from homeassistant.components.number import NumberEntity, NumberMode, RestoreNumber
from .const import DOMAIN, STAGES, VPD_DEFAULTS, DEFAULT_LEAF_OFFSET

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = []

    for i in range(1, 4):
        entities.append(OgbSettingNumber(
            coordinator, f"p{i}_harvest", f"P{i} Ernte-Tag", 0, 150, 1, "Tage", "mdi:calendar-check"
        ))

    entities.append(OgbSettingNumber(coordinator, "vpd_tolerance",    "Toleranz",               5,    25,   1,    "%",   "mdi:plus-minus-box"))
    entities.append(OgbSettingNumber(coordinator, "manual_target",    "Manueller VPD Zielwert", 0.4,  2.5,  0.05, "kPa", "mdi:target"))
    # NEU: Leaf VPD Offset
    entities.append(OgbSettingNumber(coordinator, "leaf_offset",      "Leaf VPD Offset",        0.0,  5.0,  0.1,  "°C",  "mdi:leaf"))
    entities.append(OgbSettingNumber(coordinator, "ppfd_factor",      "PPFD Faktor (Lux→PPFD)", 0.005, 0.05, 0.001,"",    "mdi:white-balance-sunny"))

    entities.append(OgbSettingNumber(coordinator, "light_on_hour",        "Licht An (Stunde)",  0,   23,   1,  "h",  "mdi:clock-start"))
    entities.append(OgbSettingNumber(coordinator, "light_off_hour",       "Licht Aus (Stunde)", 0,   23,   1,  "h",  "mdi:clock-end"))
    entities.append(OgbSettingNumber(coordinator, "light_brightness_pct", "Licht Helligkeit",   1,   100,  1,  "%",  "mdi:brightness-6"))

    entities.append(OgbSettingNumber(coordinator, "exhaust_min_limit", "Abluft Limit Min", 0,   50,  5, "%", "mdi:fan-speed-1"))
    entities.append(OgbSettingNumber(coordinator, "exhaust_max_limit", "Abluft Limit Max", 50,  100, 5, "%", "mdi:fan-speed-3"))
    entities.append(OgbSettingNumber(coordinator, "intake_min_limit",  "Zuluft Limit Min", 0,   50,  5, "%", "mdi:fan-speed-1"))
    entities.append(OgbSettingNumber(coordinator, "intake_max_limit",  "Zuluft Limit Max", 50,  100, 5, "%", "mdi:fan-speed-3"))
    entities.append(OgbSettingNumber(coordinator, "intake_offset",     "Zuluft Offset",    -50, 50,  5, "%", "mdi:fan-chevron-up"))

    entities.append(OgbSettingNumber(coordinator, "target_temp_min", "Min Temperatur",   15, 30,  0.5, "°C", "mdi:thermometer-low"))
    entities.append(OgbSettingNumber(coordinator, "target_temp_max", "Max Temperatur",   20, 40,  0.5, "°C", "mdi:thermometer-high"))
    entities.append(OgbSettingNumber(coordinator, "target_hum_min",  "Min Feuchtigkeit", 20, 65,  1,   "%",  "mdi:water-percent"))
    entities.append(OgbSettingNumber(coordinator, "target_hum_max",  "Max Feuchtigkeit", 40, 95,  1,   "%",  "mdi:water-percent-alert"))

    for stage in STAGES:
        entities.append(OgbPhaseEditorNumber(coordinator, stage, "min", VPD_DEFAULTS[stage]["min"]))
        entities.append(OgbPhaseEditorNumber(coordinator, stage, "max", VPD_DEFAULTS[stage]["max"]))

    async_add_entities(entities)


class OgbSettingNumber(RestoreNumber):
    def __init__(self, coordinator, key, label, v_min, v_max, step, unit, icon):
        self.coordinator = coordinator
        self._key = key
        self._attr_name = f"{coordinator.entry.title} {label}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{key}"
        self.entity_id = f"number.{coordinator.prefix}_{key}"
        self._attr_native_min_value = v_min
        self._attr_native_max_value = v_max
        self._attr_native_step = step
        self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon
        self._attr_mode = NumberMode.SLIDER
        self._attr_native_value = coordinator.data.get(key)

    @property
    def native_value(self):
        return self._attr_native_value

    async def async_set_native_value(self, value: float):
        self._attr_native_value = value
        self.coordinator.data[self._key] = value
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last_data = await self.async_get_last_number_data()
        if last_data is not None and last_data.native_value is not None:
            val = float(last_data.native_value)
            val = max(self._attr_native_min_value, min(self._attr_native_max_value, val))
            self._attr_native_value = val
            self.coordinator.data[self._key] = val
        else:
            default = self.coordinator.data.get(self._key)
            if default is not None:
                self._attr_native_value = float(default)
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )


class OgbPhaseEditorNumber(RestoreNumber):
    def __init__(self, coordinator, stage, limit_type, default_val):
        self.coordinator = coordinator
        self._stage = stage
        self._type = limit_type
        self._default = default_val
        self._attr_name = f"{coordinator.entry.title} {stage} {limit_type.capitalize()}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{stage.lower()}_{limit_type}"
        self.entity_id = f"number.{coordinator.prefix}_{stage.lower()}_{limit_type}"
        self._attr_native_min_value = 0.2
        self._attr_native_max_value = 2.5
        self._attr_native_step = 0.05
        self._attr_native_unit_of_measurement = "kPa"
        self._attr_mode = NumberMode.BOX
        self._attr_native_value = float(default_val)

    @property
    def native_value(self):
        return self._attr_native_value

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last_data = await self.async_get_last_number_data()
        self.coordinator.data.setdefault("custom_limits", {})
        self.coordinator.data["custom_limits"].setdefault(self._stage, {})
        if last_data is not None and last_data.native_value is not None:
            val = float(last_data.native_value)
        else:
            val = float(self._default)
        self._attr_native_value = val
        self.coordinator.data["custom_limits"][self._stage][self._type] = val
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )
        self.async_write_ha_state()

    async def async_set_native_value(self, value: float):
        self._attr_native_value = value
        self.coordinator.data["custom_limits"][self._stage][self._type] = value
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()
