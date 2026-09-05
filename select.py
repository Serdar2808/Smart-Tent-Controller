"""Select-Plattform für Open Grow Box."""
import logging
from homeassistant.components.select import SelectEntity
from homeassistant.helpers.restore_state import RestoreEntity
from .const import DOMAIN, STAGES

_LOGGER = logging.getLogger(__name__)
NO_SENSOR = "— Kein Sensor —"


def _get_area_entities(hass, area_name: str, domain: str) -> list:
    from homeassistant.helpers import entity_registry as er, area_registry as ar, device_registry as dr
    ent_reg  = er.async_get(hass)
    area_reg = ar.async_get(hass)
    dev_reg  = dr.async_get(hass)
    target = next((a for a in area_reg.areas.values() if a.name.lower() == area_name.lower()), None)
    if not target:
        return [NO_SENSOR] + sorted(hass.states.async_entity_ids(domain))
    found = []
    for entity in ent_reg.entities.values():
        if entity.domain != domain: continue
        in_area = entity.area_id == target.id
        if not in_area and entity.device_id:
            dev = dev_reg.async_get(entity.device_id)
            if dev and dev.area_id == target.id: in_area = True
        if in_area: found.append(entity.entity_id)
    return [NO_SENSOR] + sorted(found)


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = [
        OgbActivePlantSelect(coordinator),
        # FIX: OgbVpdStageSelect — steuert NUR VPD-Zielwert, unabhängig von Pflanzen
        OgbVpdStageSelect(coordinator),
        OgbUpdateIntervalSelect(coordinator),
        # Per-Plant Stages — NUR für Dokumentation
        OgbPlantPhaseSelect(coordinator, "P1"),
        OgbPlantPhaseSelect(coordinator, "P2"),
        OgbPlantPhaseSelect(coordinator, "P3"),
        # Hardware Selects
        OgbHardwareSelect(coordinator, "temp",         "🌡️ Temperatur Sensor",   "sensor"),
        OgbHardwareSelect(coordinator, "hum",          "💧 Feuchtigkeits Sensor", "sensor"),
        OgbHardwareSelect(coordinator, "fan_exhaust",  "🌬️ Abluft Ventilator",   "fan"),
        OgbHardwareSelect(coordinator, "fan_intake",   "💨 Zuluft Ventilator",   "fan"),
        OgbHardwareSelect(coordinator, "humidifier",   "☁️ Befeuchter",          "humidifier"),
        OgbHardwareSelect(coordinator, "light",        "☀️ Licht",               "light"),
        OgbHardwareSelect(coordinator, "illuminance",  "🔆 Beleuchtungsstärke",  "sensor"),
        OgbHardwareSelect(coordinator, "co2",          "💨 CO₂ Sensor",           "sensor"),
        OgbHardwareSelect(coordinator, "p1_soil",      "🌱 P1 Bodenfeuchtigkeit","sensor"),
        OgbHardwareSelect(coordinator, "p1_ec",        "⚡ P1 EC",               "sensor"),
        OgbHardwareSelect(coordinator, "p2_soil",      "🌱 P2 Bodenfeuchtigkeit","sensor"),
        OgbHardwareSelect(coordinator, "p2_ec",        "⚡ P2 EC",               "sensor"),
        OgbHardwareSelect(coordinator, "p3_soil",      "🌱 P3 Bodenfeuchtigkeit","sensor"),
        OgbHardwareSelect(coordinator, "p3_ec",        "⚡ P3 EC",               "sensor"),
    ]
    async_add_entities(entities)


class OgbActivePlantSelect(SelectEntity, RestoreEntity):
    def __init__(self, coordinator):
        self.coordinator = coordinator
        self._attr_name = f"{coordinator.entry.title} Aktive Pflanze"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_active_plant"
        self.entity_id = f"select.{coordinator.prefix}_active_plant"
        self._attr_options = ["P1", "P2", "P3"]
        self._attr_icon = "mdi:flower"
        self._current = "P1"

    @property
    def current_option(self): return self._current

    async def async_select_option(self, option: str):
        self._current = option
        self.coordinator.data["active_plant"] = option
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state in self._attr_options:
            self._current = last.state
            self.coordinator.data["active_plant"] = last.state
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))


class OgbVpdStageSelect(SelectEntity, RestoreEntity):
    """
    FIX: Steuert ausschließlich den VPD-Zielwert im Coordinator.
    Völlig unabhängig von den Pflanzen-eigenen Stages.
    """
    def __init__(self, coordinator):
        self.coordinator = coordinator
        self._attr_name = f"{coordinator.entry.title} VPD Klima-Phase"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_vpd_stage"
        self.entity_id = f"select.{coordinator.prefix}_vpd_stage"
        self._attr_options = STAGES
        self._attr_icon = "mdi:thermometer-lines"

    @property
    def current_option(self):
        return self.coordinator.data.get("vpd_stage", "Seedling")

    async def async_select_option(self, option: str):
        self.coordinator.data["vpd_stage"] = option
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state in STAGES:
            self.coordinator.data["vpd_stage"] = last.state
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))


class OgbPlantPhaseSelect(SelectEntity, RestoreEntity):
    """Phase pro Pflanze — nur für Dokumentation, kein Einfluss auf VPD."""
    def __init__(self, coordinator, p_id):
        self.coordinator = coordinator
        self._p_id = p_id
        self._attr_name = f"{coordinator.entry.title} {p_id} Wachstumsphase"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{p_id.lower()}_phase"
        self.entity_id = f"select.{coordinator.prefix}_{p_id.lower()}_phase"
        self._attr_options = STAGES
        self._attr_icon = "mdi:sprout"

    @property
    def current_option(self):
        return self.coordinator.data["plants"].get(self._p_id, {}).get("stage", "Seedling")

    async def async_select_option(self, option: str):
        self.coordinator.data["plants"][self._p_id]["stage"] = option
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state in STAGES:
            self.coordinator.data["plants"][self._p_id]["stage"] = last.state
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))


class OgbUpdateIntervalSelect(SelectEntity, RestoreEntity):
    INTERVALS = {"Live (5s)": 5, "15s": 15, "30s": 30, "60s": 60}

    def __init__(self, coordinator):
        self.coordinator = coordinator
        self._attr_name = f"{coordinator.entry.title} Aktualisierungsrate"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_update_interval"
        self.entity_id = f"select.{coordinator.prefix}_update_interval"
        self._attr_options = list(self.INTERVALS.keys())
        self._attr_icon = "mdi:timer-cog"
        self._current = "30s"

    @property
    def current_option(self): return self._current

    async def async_select_option(self, option: str):
        self._current = option
        from datetime import timedelta
        self.coordinator.update_interval = timedelta(seconds=self.INTERVALS.get(option, 30))
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state in self._attr_options:
            self._current = last.state
            from datetime import timedelta
            self.coordinator.update_interval = timedelta(seconds=self.INTERVALS.get(self._current, 30))


class OgbHardwareSelect(SelectEntity, RestoreEntity):
    def __init__(self, coordinator, key, label, domain):
        self.coordinator = coordinator
        self._key = key
        self._domain = domain
        self._attr_name = f"{coordinator.entry.title} {label}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_hw_{key}"
        self.entity_id = f"select.{coordinator.prefix}_hw_{key}"
        self._attr_icon = "mdi:cog-sync"

    @property
    def options(self):
        opts = _get_area_entities(self.coordinator.hass, self.coordinator.area_name, self._domain)
        current = self.coordinator.data["overrides"].get(self._key)
        if current and current != NO_SENSOR and current not in opts:
            opts.append(current)
        return opts

    @property
    def current_option(self):
        val = self.coordinator.data["overrides"].get(self._key)
        return val if val and val != NO_SENSOR else NO_SENSOR

    async def async_select_option(self, option: str):
        self.coordinator.data["overrides"][self._key] = None if option == NO_SENSOR else option
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        
        # Hardware Persistenz: Der UI-Zustand gewinnt IMMER über die Config-Flow Daten
        if last and last.state not in ["unknown", "unavailable"]:
            if last.state == NO_SENSOR:
                # User hat explizit "Kein Sensor" gesetzt → respektieren
                self.coordinator.data["overrides"][self._key] = None
            else:
                # FIX: Bedingungslos den Coordinator mit dem Wert aus der UI überschreiben
                self.coordinator.data["overrides"][self._key] = last.state
                
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )
