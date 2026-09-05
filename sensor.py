"""Sensor-Plattform für Open Grow Box."""
import logging
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = [
        OgbSensor(coordinator, "vpd_ist",    "VPD Live",          "kPa", "mdi:gauge",              2),
        OgbSensor(coordinator, "vpd_target", "VPD Zielwert",      "kPa", "mdi:target",             3),
        OgbSensor(coordinator, "vpd_min",    "VPD Minimum",       "kPa", "mdi:arrow-down-bold",    3),
        OgbSensor(coordinator, "vpd_max",    "VPD Maximum",       "kPa", "mdi:arrow-up-bold",      3),
        OgbSensor(coordinator, "temp_ist",   "Temperatur",        "°C",  "mdi:thermometer",        1),
        OgbSensor(coordinator, "hum_ist",    "Luftfeuchtigkeit",  "%",   "mdi:water-percent",      1),
        OgbSensor(coordinator, "dew_point",  "Taupunkt",          "°C",  "mdi:weather-fog",        1),
        # NEU: Leaf VPD
        OgbSensor(coordinator, "leaf_vpd",   "Leaf VPD",          "kPa", "mdi:leaf",               3),
        OgbSensor(coordinator, "leaf_temp",  "Blatttemperatur",   "°C",  "mdi:thermometer-lines",  1),
        OgbSensor(coordinator, "lux",        "Beleuchtungsstaerke","lx",  "mdi:brightness-7",       0),
        OgbSensor(coordinator, "ppfd",       "PPFD",              "µmol/m²/s","mdi:sun-wireless",  1),
    ]
    async_add_entities(entities)


class OgbSensor(SensorEntity):
    def __init__(self, coordinator, key, label, unit, icon, precision):
        self.coordinator = coordinator
        self._key = key
        self._attr_name = f"{coordinator.entry.title} {label}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{key}"
        self.entity_id = f"sensor.{coordinator.prefix}_{key}"
        self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon
        self._attr_state_class = SensorStateClass.MEASUREMENT
        self._precision = precision

        if unit == "°C":
            self._attr_device_class = SensorDeviceClass.TEMPERATURE
        elif unit == "%":
            self._attr_device_class = SensorDeviceClass.HUMIDITY
        elif unit == "kPa":
            self._attr_device_class = SensorDeviceClass.PRESSURE

    @property
    def native_value(self):
        val = self.coordinator.data.get(self._key)
        try:
            return round(float(val), self._precision) if val is not None else None
        except (ValueError, TypeError):
            return None

    @property
    def available(self):
        return (self.coordinator.data.get("temp_ist") is not None and
                self.coordinator.data.get("hum_ist") is not None)

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )
