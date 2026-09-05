"""Coordinator für die Open Grow Box Integration."""
import logging
import math
import time
from datetime import timedelta, datetime
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.core import HomeAssistant, callback
from .const import DOMAIN, VPD_DEFAULTS, DEFAULT_LEAF_OFFSET, DEFAULT_PPFD_FACTOR

_LOGGER = logging.getLogger(__name__)

# Cooldowns in Sekunden — 10s für schnelles Testen, im Betrieb erhöhen
DEVICE_COOLDOWNS = {
    "humidifier": 10,
    "fan_exhaust": 10,
    "fan_intake":  10,
    "light":       10,
}


def _is_daytime(h, on_h, off_h):
    if on_h < off_h:   return on_h <= h < off_h
    elif on_h > off_h: return h >= on_h or h < off_h
    return True

def _calc_vpd(temp, hum):
    svp = 0.61078 * math.exp((17.27 * temp) / (temp + 237.3))
    return round(svp * (1 - hum / 100.0), 3)

def _calc_leaf_vpd(air_temp, leaf_temp, hum):
    """Korrekte Leaf VPD: SVP(Blatt) - SVP(Luft)*RH/100"""
    svp_leaf = 0.61078 * math.exp((17.27 * leaf_temp) / (leaf_temp + 237.3))
    svp_air  = 0.61078 * math.exp((17.27 * air_temp)  / (air_temp  + 237.3))
    return round(svp_leaf - svp_air * (hum / 100.0), 3)

def _calc_dewpoint(temp, hum):
    try:
        g = (17.27 * temp) / (237.3 + temp) + math.log(hum / 100.0)
        return round((237.3 * g) / (17.27 - g), 1)
    except (ValueError, ZeroDivisionError):
        return 0.0


class OgbCoordinator(DataUpdateCoordinator):

    def __init__(self, hass: HomeAssistant, entry):
        self._regulation_interval = 30
        super().__init__(hass, _LOGGER, name=DOMAIN,
                         update_interval=timedelta(seconds=self._regulation_interval))
        self.entry = entry
        self.prefix = entry.title.lower().replace(" ", "_")
        self.area_name = entry.data.get("area_name", "")
        self._last_action: dict = {}

        cfg = {**entry.data, **entry.options}
        self.data = {
            "vpd_ist": 0.0, "temp_ist": 0.0, "hum_ist": 0.0, "dew_point": 0.0,
            "vpd_target": 0.0, "vpd_min": 0.0, "vpd_max": 0.0,
            "leaf_vpd": 0.0, "leaf_temp": 0.0,
            "lux": None, "ppfd": None,

            # FIX: vpd_stage ist UNABHÄNGIG von den Pflanzen-Stages
            # Steuert ausschließlich den VPD-Zielwert
            "vpd_stage": "Seedling",

            "vpd_auto": False, "vpd_manual_mode": False,
            "light_auto": False, "exhaust_limit_mode": False,
            "min_max_control": False, "vpd_night_hold": False,
            "vpd_interval_enabled": False, "intake_linked": True,
            "leaf_vpd_enabled": False,
            "manual_target":     1.0,
            "vpd_tolerance":     cfg.get("vpd_tolerance",  10.0),
            "leaf_offset":       DEFAULT_LEAF_OFFSET,
            "ppfd_factor":       DEFAULT_PPFD_FACTOR,
            "light_on_hour":     cfg.get("light_on_hour",  6),
            "light_off_hour":    cfg.get("light_off_hour", 18),
            "light_brightness_pct": 100,
            "exhaust_min_limit": cfg.get("exhaust_min", 20),
            "exhaust_max_limit": cfg.get("exhaust_max", 100),
            "intake_min_limit":  20, "intake_max_limit": 100,
            "intake_offset":     -10,
            "target_temp_min":   20.0, "target_temp_max": 28.0,
            "target_hum_min":    40.0, "target_hum_max":  70.0,
            "monitor_interval":  30,
            "active_plant":      "P1",
            "p1_harvest": 0, "p2_harvest": 0, "p3_harvest": 0,
            "custom_limits": {},
            "overrides": {
                "temp":        cfg.get("sensor_temp"),
                "hum":         cfg.get("sensor_hum"),
                "fan_exhaust": cfg.get("fan_exhaust"),
                "fan_intake":  cfg.get("fan_intake") or None,
                "humidifier":  cfg.get("humidifier") or None,
                "light":       cfg.get("light") or None,
                "illuminance": None,
                "co2": None,
                "p1_soil": None, "p1_ec": None,
                "p2_soil": None, "p2_ec": None,
                "p3_soil": None, "p3_ec": None,
            },
            "plants": {
                f"P{i}": {
                    # Pflanzeneigene Stage — NUR für Doku, beeinflusst NICHT VPD
                    "stage": "Seedling",
                    "strain": "", "breeder": "", "notes": "",
                    "start_date": "", "flower_date": "",
                    "phase_history": "{}",
                    "soil": None, "ec": None,
                }
                for i in range(1, 4)
            }
        }

    async def async_setup(self):
        """State-Tracking: nur Display-Update, keine Regelung."""
        from homeassistant.helpers.event import async_track_state_change_event

        temp_eid = self.data["overrides"].get("temp")
        hum_eid  = self.data["overrides"].get("hum")
        if not temp_eid or not hum_eid:
            _LOGGER.warning("OGB: Temp/Hum nicht konfiguriert!")
            return

        watch = list({e for e in [temp_eid, hum_eid] if e})

        @callback
        def _on_sensor_change(event):
            self.hass.async_create_task(self._update_display_only())

        async_track_state_change_event(self.hass, watch, _on_sensor_change)
        _LOGGER.debug("OGB: Display-Tracking aktiv für %s", watch)

    async def _update_display_only(self):
        """Nur Werte berechnen, KEINE Gerätesteuerung."""
        temp = self._read_sensor("temp")
        hum  = self._read_sensor("hum")
        if temp is None or hum is None:
            return

        vpd_ist   = _calc_vpd(temp, hum)
        dew_point = _calc_dewpoint(temp, hum)
        leaf_offset = float(self.data.get("leaf_offset", DEFAULT_LEAF_OFFSET))
        leaf_temp   = round(temp - leaf_offset, 1)
        leaf_vpd    = _calc_leaf_vpd(temp, leaf_temp, hum) if self.data.get("leaf_vpd_enabled") else vpd_ist

        # FIX: vpd_stage statt plants[active_p]["stage"]
        stage  = self.data.get("vpd_stage", "Seedling")
        limits = self.data["custom_limits"].get(stage, VPD_DEFAULTS.get(stage, VPD_DEFAULTS["Seedling"]))

        if self.data.get("vpd_manual_mode"):
            target = float(self.data.get("manual_target", 1.0))
        else:
            target = (limits.get("min", 0.8) + limits.get("max", 1.2)) / 2

        tol_val = (self.data.get("vpd_tolerance", 10.0) / 100) * target

        # Lux + PPFD
        lux  = self._read_raw(self.data["overrides"].get("illuminance"))
        ppfd = round(lux * float(self.data.get("ppfd_factor", DEFAULT_PPFD_FACTOR)), 1) if lux is not None else None

        self.data.update({
            "vpd_ist":    vpd_ist, "temp_ist": round(temp, 1),
            "hum_ist":    round(hum, 1), "dew_point": dew_point,
            "leaf_temp":  leaf_temp, "leaf_vpd": leaf_vpd,
            "vpd_target": round(target, 3),
            "vpd_min":    round(max(target - tol_val, limits.get("min", 0.4)), 3),
            "vpd_max":    round(min(target + tol_val, limits.get("max", 2.0)), 3),
            "lux": lux, "ppfd": ppfd,
        })
        self.async_set_updated_data(self.data)

    async def _async_update_data(self):
        """Haupt-Zyklus: Daten + Regelung."""
        temp = self._read_sensor("temp")
        hum  = self._read_sensor("hum")
        if temp is None or hum is None:
            return self.data

        vpd_ist   = _calc_vpd(temp, hum)
        dew_point = _calc_dewpoint(temp, hum)
        leaf_offset = float(self.data.get("leaf_offset", DEFAULT_LEAF_OFFSET))
        leaf_temp   = round(temp - leaf_offset, 1)
        leaf_vpd    = _calc_leaf_vpd(temp, leaf_temp, hum) if self.data.get("leaf_vpd_enabled") else vpd_ist
        effective_vpd = leaf_vpd if self.data.get("leaf_vpd_enabled") else vpd_ist

        # FIX: VPD-Stage ist unabhängig von Pflanzen-Stages
        stage  = self.data.get("vpd_stage", "Seedling")
        limits = self.data["custom_limits"].get(stage, VPD_DEFAULTS.get(stage, VPD_DEFAULTS["Seedling"]))

        current_hour = datetime.now().hour
        on_h  = int(self.data.get("light_on_hour", 6))
        off_h = int(self.data.get("light_off_hour", 18))
        is_day = _is_daytime(current_hour, on_h, off_h)

        if self.data.get("vpd_manual_mode"):
            target = float(self.data.get("manual_target", 1.0))
        else:
            target = (limits.get("min", 0.8) + limits.get("max", 1.2)) / 2

        tol_val = (self.data.get("vpd_tolerance", 10.0) / 100) * target

        # Bodensensoren
        for pid in ["P1", "P2", "P3"]:
            pl = pid.lower()
            self.data["plants"][pid]["soil"] = self._read_raw(self.data["overrides"].get(f"{pl}_soil"))
            self.data["plants"][pid]["ec"]   = self._read_raw(self.data["overrides"].get(f"{pl}_ec"))

        lux  = self._read_raw(self.data["overrides"].get("illuminance"))
        ppfd = round(lux * float(self.data.get("ppfd_factor", DEFAULT_PPFD_FACTOR)), 1) if lux is not None else None

        self.data.update({
            "vpd_ist":    vpd_ist, "temp_ist": round(temp, 1),
            "hum_ist":    round(hum, 1), "dew_point": dew_point,
            "leaf_temp":  leaf_temp, "leaf_vpd": leaf_vpd,
            "vpd_target": round(target, 3),
            "vpd_min":    round(max(target - tol_val, limits.get("min", 0.4)), 3),
            "vpd_max":    round(min(target + tol_val, limits.get("max", 2.0)), 3),
            "lux": lux, "ppfd": ppfd,
        })

        should_regulate = is_day or self.data.get("vpd_night_hold", False)

        if self.data.get("min_max_control"):
            if should_regulate:
                await self._run_min_max_logic(self.data["temp_ist"], self.data["hum_ist"])
        elif self.data.get("vpd_auto"):
            if should_regulate:
                await self._run_control_logic(effective_vpd)

        if self.data.get("light_auto"):
            await self._run_light_logic(not is_day)

        return self.data

    def _is_cooldown_active(self, key: str) -> bool:
        last = self._last_action.get(key, 0)
        cd   = DEVICE_COOLDOWNS.get(key, 10)
        remaining = cd - (time.time() - last)
        if remaining > 0:
            _LOGGER.debug("OGB Cooldown %s: %.0fs", key, remaining)
            return True
        return False

    def _register_action(self, key: str):
        self._last_action[key] = time.time()

    def _read_sensor(self, key):
        eid = self.data["overrides"].get(key)
        if not eid: return None
        st = self.hass.states.get(eid)
        if st and st.state not in ["unknown", "unavailable"]:
            try: return float(st.state)
            except: pass
        return None

    def _read_raw(self, eid):
        if not eid: return None
        st = self.hass.states.get(eid)
        if st and st.state not in ["unknown", "unavailable"]:
            try: return round(float(st.state), 2)
            except: pass
        return None

    def _is_on(self, eid):
        if not eid: return False
        st = self.hass.states.get(eid)
        return st is not None and st.state == "on"

    async def _run_control_logic(self, vpd_now):
        min_v = self.data["vpd_min"]
        max_v = self.data["vpd_max"]
        fan_ex = self.data["overrides"].get("fan_exhaust")
        fan_in = self.data["overrides"].get("fan_intake")
        hum_id = self.data["overrides"].get("humidifier")
        if not fan_ex: return
        use_lim = self.data.get("exhaust_limit_mode", False)
        ex_min  = self.data["exhaust_min_limit"] if use_lim else 0
        ex_max  = self.data["exhaust_max_limit"] if use_lim else 100

        if vpd_now < min_v:
            diff  = min_v - vpd_now
            speed = min(ex_min + min(50, int(diff * 100)), ex_max)
            if not self._is_cooldown_active("fan_exhaust"):
                await self._set_fan(fan_ex, speed); self._register_action("fan_exhaust")
            await self._control_intake(fan_in, speed)
            if hum_id and self._is_on(hum_id) and not self._is_cooldown_active("humidifier"):
                await self._call("humidifier", "turn_off", hum_id); self._register_action("humidifier")
        elif vpd_now > max_v:
            if not self._is_cooldown_active("fan_exhaust"):
                await self._set_fan(fan_ex, ex_min); self._register_action("fan_exhaust")
            await self._control_intake(fan_in, ex_min)
            if hum_id and not self._is_on(hum_id) and not self._is_cooldown_active("humidifier"):
                await self._call("humidifier", "turn_on", hum_id); self._register_action("humidifier")

    async def _control_intake(self, fan_in, exhaust_speed):
        if not fan_in: return
        if self.data.get("intake_linked", True):
            speed = max(0, exhaust_speed + self.data.get("intake_offset", -10))
        else:
            speed = max(self.data.get("intake_min_limit", 20),
                        min(self.data.get("intake_max_limit", 100), exhaust_speed))
        if not self._is_cooldown_active("fan_intake"):
            await self._set_fan(fan_in, speed); self._register_action("fan_intake")

    async def _run_light_logic(self, is_night: bool):
        lid = self.data["overrides"].get("light")
        if not lid: return
        on = self._is_on(lid)
        if not is_night and not on and not self._is_cooldown_active("light"):
            brightness = int(self.data.get("light_brightness_pct", 100) * 2.55)
            await self.hass.services.async_call("light", "turn_on",
                {"entity_id": lid, "brightness": brightness})
            self._register_action("light")
        elif is_night and on and not self._is_cooldown_active("light"):
            await self.hass.services.async_call("light", "turn_off", {"entity_id": lid})
            self._register_action("light")

    async def _run_min_max_logic(self, temp, hum):
        fan_ex = self.data["overrides"].get("fan_exhaust")
        hum_id = self.data["overrides"].get("humidifier")
        use_lim = self.data.get("exhaust_limit_mode", False)
        ex_min  = self.data["exhaust_min_limit"] if use_lim else 0
        ex_max  = self.data["exhaust_max_limit"] if use_lim else 100
        speed   = ex_max if (temp > self.data.get("target_temp_max", 28.0) or
                             hum  > self.data.get("target_hum_max",  70.0)) else ex_min
        if fan_ex and not self._is_cooldown_active("fan_exhaust"):
            await self._set_fan(fan_ex, speed); self._register_action("fan_exhaust")
        if hum_id:
            if hum < self.data.get("target_hum_min", 40.0) and not self._is_on(hum_id):
                if not self._is_cooldown_active("humidifier"):
                    await self._call("humidifier", "turn_on", hum_id); self._register_action("humidifier")
            elif hum >= self.data.get("target_hum_min", 40.0) and self._is_on(hum_id):
                if not self._is_cooldown_active("humidifier"):
                    await self._call("humidifier", "turn_off", hum_id); self._register_action("humidifier")

    async def _set_fan(self, eid, pct):
        try: await self.hass.services.async_call("fan", "set_percentage", {"entity_id": eid, "percentage": int(pct)})
        except Exception as e: _LOGGER.error("OGB Fan %s: %s", eid, e)

    async def _call(self, domain, service, eid):
        try: await self.hass.services.async_call(domain, service, {"entity_id": eid})
        except Exception as e: _LOGGER.error("OGB %s.%s %s: %s", domain, service, eid, e)
