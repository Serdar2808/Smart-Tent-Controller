"""Konstanten für die Open Grow Box Integration."""

DOMAIN = "smart_tent_controller"

STAGES = [
    "Germination", "Clones", "Seedling",
    "EarlyVeg", "MidVeg", "LateVeg",
    "EarlyFlower", "MidFlower", "LateFlower", "Flush"
]

# VPD Defaults mit neuen Werten + vollständige Stage-Referenz
VPD_DEFAULTS = {
    "Germination":  {"min": 0.35, "max": 0.70},
    "Clones":       {"min": 0.40, "max": 0.85},
    "Seedling":     {"min": 0.40, "max": 0.90},
    "EarlyVeg":     {"min": 0.60, "max": 1.20},
    "MidVeg":       {"min": 0.75, "max": 1.45},
    "LateVeg":      {"min": 0.90, "max": 1.65},
    "EarlyFlower":  {"min": 0.80, "max": 1.55},
    "MidFlower":    {"min": 0.90, "max": 1.70},
    "LateFlower":   {"min": 0.90, "max": 1.85},
    "Flush":        {"min": 1.00, "max": 1.60},
}

# Vollständige Stage-Referenzwerte (nur für Anzeige in der Card)
STAGE_REFERENCE = {
    "Germination": {
        "temp": "20–24°C", "hum": "78–85%", "vpd": "0.35–0.70 kPa",
        "light": "100–200 PPFD", "ec": "0.6–0.9 mS/cm", "ph": "5.8–6.2", "co2": "400–800 ppm"
    },
    "Clones": {
        "temp": "20–24°C", "hum": "72–80%", "vpd": "0.40–0.85 kPa",
        "light": "150–300 PPFD", "ec": "0.8–1.2 mS/cm", "ph": "5.8–6.2", "co2": "400–800 ppm"
    },
    "Seedling": {
        "temp": "20–25°C", "hum": "65–75%", "vpd": "0.40–0.90 kPa",
        "light": "150–300 PPFD", "ec": "0.6–1.0 mS/cm", "ph": "5.8–6.2", "co2": "400–800 ppm"
    },
    "EarlyVeg": {
        "temp": "22–26°C", "hum": "65–75%", "vpd": "0.60–1.20 kPa",
        "light": "200–400 PPFD", "ec": "1.0–1.6 mS/cm", "ph": "5.8–6.2", "co2": "600–1000 ppm"
    },
    "MidVeg": {
        "temp": "23–27°C", "hum": "60–72%", "vpd": "0.75–1.45 kPa",
        "light": "300–500 PPFD", "ec": "1.2–1.8 mS/cm", "ph": "5.8–6.2", "co2": "600–1000 ppm"
    },
    "LateVeg": {
        "temp": "24–27°C", "hum": "55–68%", "vpd": "0.90–1.65 kPa",
        "light": "400–600 PPFD", "ec": "1.4–2.0 mS/cm", "ph": "5.8–6.2", "co2": "800–1200 ppm"
    },
    "EarlyFlower": {
        "temp": "22–26°C", "hum": "55–68%", "vpd": "0.80–1.55 kPa",
        "light": "500–700 PPFD", "ec": "1.6–2.2 mS/cm", "ph": "5.8–6.2", "co2": "800–1200 ppm"
    },
    "MidFlower": {
        "temp": "21–25°C", "hum": "48–62%", "vpd": "0.90–1.70 kPa",
        "light": "600–800 PPFD", "ec": "1.8–2.4 mS/cm", "ph": "5.8–6.2", "co2": "1000–1500 ppm"
    },
    "LateFlower": {
        "temp": "19–24°C", "hum": "42–58%", "vpd": "0.90–1.85 kPa",
        "light": "400–600 PPFD", "ec": "1.4–2.0 mS/cm", "ph": "5.8–6.2", "co2": "800–1200 ppm"
    },
    "Flush": {
        "temp": "18–24°C", "hum": "40–55%", "vpd": "1.00–1.60 kPa",
        "light": "300–500 PPFD", "ec": "0.0–0.4 mS/cm", "ph": "5.8–6.2", "co2": "400–800 ppm"
    },
}

DEFAULT_TOLERANCE   = 10.0
DEFAULT_LIGHT_ON    = 6
DEFAULT_LIGHT_OFF   = 18
DEFAULT_FAN_MIN     = 20
DEFAULT_FAN_MAX     = 100
DEFAULT_NIGHT_VPD   = 0.8
DEFAULT_LEAF_OFFSET = 2.0
# PPFD-Faktor für Vollspektrum LED (Lux → PPFD)
# Samsung LM301H EVO ≈ 0.015 bei 40% Power
DEFAULT_PPFD_FACTOR = 0.015
