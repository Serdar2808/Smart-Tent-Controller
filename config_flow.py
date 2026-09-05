"""Config Flow und Options Flow für Open Grow Box."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from .const import (
    DOMAIN, DEFAULT_TOLERANCE, DEFAULT_LIGHT_ON, DEFAULT_LIGHT_OFF,
    DEFAULT_FAN_MIN, DEFAULT_FAN_MAX, DEFAULT_NIGHT_VPD,
)


def _base_schema(data: dict = None) -> vol.Schema:
    d = data or {}
    return vol.Schema({
        # Bereich (Pflicht)
        vol.Required("area_name", default=d.get("area_name", "")): selector.selector({"area": {}}),
        # Sensoren (Pflicht)
        vol.Required("sensor_temp", default=d.get("sensor_temp", "")): selector.selector({
            "entity": {"domain": "sensor", "device_class": "temperature"}
        }),
        vol.Required("sensor_hum", default=d.get("sensor_hum", "")): selector.selector({
            "entity": {"domain": "sensor", "device_class": "humidity"}
        }),
        # Geräte (optional)
        vol.Optional("fan_exhaust", default=d.get("fan_exhaust", "")): selector.selector({
            "entity": {"domain": "fan"}
        }),
        vol.Optional("fan_intake", default=d.get("fan_intake", "")): selector.selector({
            "entity": {"domain": "fan"}
        }),
        vol.Optional("humidifier", default=d.get("humidifier", "")): selector.selector({
            "entity": {"domain": "humidifier"}
        }),
        vol.Optional("light", default=d.get("light", "")): selector.selector({
            "entity": {"domain": "light"}
        }),
        # Grundeinstellungen
        vol.Required("light_on_hour", default=d.get("light_on_hour", DEFAULT_LIGHT_ON)): selector.selector({
            "number": {"min": 0, "max": 23, "step": 1, "mode": "slider", "unit_of_measurement": "h"}
        }),
        vol.Required("light_off_hour", default=d.get("light_off_hour", DEFAULT_LIGHT_OFF)): selector.selector({
            "number": {"min": 0, "max": 23, "step": 1, "mode": "slider", "unit_of_measurement": "h"}
        }),
        vol.Required("vpd_tolerance", default=d.get("vpd_tolerance", DEFAULT_TOLERANCE)): selector.selector({
            "number": {"min": 5, "max": 25, "step": 1, "mode": "slider", "unit_of_measurement": "%"}
        }),
        vol.Required("exhaust_min", default=d.get("exhaust_min", DEFAULT_FAN_MIN)): selector.selector({
            "number": {"min": 0, "max": 50, "step": 5, "mode": "slider", "unit_of_measurement": "%"}
        }),
        vol.Required("exhaust_max", default=d.get("exhaust_max", DEFAULT_FAN_MAX)): selector.selector({
            "number": {"min": 50, "max": 100, "step": 5, "mode": "slider", "unit_of_measurement": "%"}
        }),
        vol.Required("vpd_night_target", default=d.get("vpd_night_target", DEFAULT_NIGHT_VPD)): selector.selector({
            "number": {"min": 0.4, "max": 1.5, "step": 0.05, "mode": "slider", "unit_of_measurement": "kPa"}
        }),
    })


class OgbConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            if user_input["light_on_hour"] == user_input["light_off_hour"]:
                errors["light_off_hour"] = "light_hours_equal"
            elif user_input["exhaust_min"] >= user_input["exhaust_max"]:
                errors["exhaust_max"] = "exhaust_limits_invalid"
            else:
                await self.async_set_unique_id(
                    user_input["area_name"].lower().replace(" ", "_")
                )
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=user_input["area_name"],
                    data=user_input,
                )
        return self.async_show_form(
            step_id="user",
            data_schema=_base_schema(user_input or {}),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return OgbOptionsFlow()


class OgbOptionsFlow(config_entries.OptionsFlow):

    async def async_step_init(self, user_input=None):
        errors = {}
        # self.config_entry steht dir hier trotzdem vollautomatisch zur Verfügung!
        current = {**self.config_entry.data, **self.config_entry.options}
        if user_input is not None:
            if user_input["light_on_hour"] == user_input["light_off_hour"]:
                errors["light_off_hour"] = "light_hours_equal"
            elif user_input["exhaust_min"] >= user_input["exhaust_max"]:
                errors["exhaust_max"] = "exhaust_limits_invalid"
            else:
                return self.async_create_entry(title="", data=user_input)
        return self.async_show_form(
            step_id="init",
            data_schema=_base_schema(current),
            errors=errors,
        )
