"""Hardware-Entdeckung für Open Grow Box."""
import logging
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


def get_entities_in_area(
    hass: HomeAssistant,
    area_name: str,
    domain: str = None,
    keywords: list = None
) -> list:
    """
    Gibt alle Entitäten eines Bereichs zurück.
    Optional gefiltert nach Domain und/oder Keywords im Namen/entity_id.
    
    FIX: keywords-Parameter ergänzt damit Temp/Hum-Sensoren getrennt gefunden werden.
    """
    ent_reg = er.async_get(hass)
    area_reg = ar.async_get(hass)
    dev_reg = dr.async_get(hass)

    target_area = next(
        (a for a in area_reg.areas.values() if a.name.lower() == area_name.lower()),
        None
    )
    if not target_area:
        _LOGGER.warning("OGB Discovery: Area '%s' nicht gefunden.", area_name)
        return []

    found_entities = []
    for entity in ent_reg.entities.values():
        if domain and entity.domain != domain:
            continue

        # Bereichs-Zugehörigkeit prüfen (direkt oder via Device)
        in_area = (entity.area_id == target_area.id)
        if not in_area and entity.device_id:
            device = dev_reg.async_get(entity.device_id)
            if device and device.area_id == target_area.id:
                in_area = True

        if not in_area:
            continue

        # Keyword-Filter: Name oder entity_id muss eines der Keywords enthalten
        if keywords:
            state = hass.states.get(entity.entity_id)
            friendly = (state.attributes.get("friendly_name", "") if state else "").lower()
            eid_lower = entity.entity_id.lower()
            if not any(kw.lower() in friendly or kw.lower() in eid_lower for kw in keywords):
                continue

        found_entities.append(entity.entity_id)

    return found_entities


def find_entity_by_keyword(
    hass: HomeAssistant,
    area_name: str,
    domain: str,
    keywords: list
) -> str:
    """Sucht die am besten passende Entität in einer Area via Keywords."""
    entities = get_entities_in_area(hass, area_name, domain, keywords=keywords)
    return entities[0] if entities else None
