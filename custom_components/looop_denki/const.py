"""Constants for the Looop Denki integration."""

from datetime import timedelta

DOMAIN = "looop_denki"
API_URL = "https://looop-denki.com/api/prices?select_area={area_code}"

CONF_AREA_CODE = "area_code"
CONF_PRICE_OFFSET = "price_offset"

DEFAULT_AREA_CODE = "03"
DEFAULT_PRICE_OFFSET = 0.0
UPDATE_INTERVAL = timedelta(minutes=30)

PLATFORMS = ["sensor", "select"]

AREA_OPTIONS: dict[str, str] = {
    "01": "北海道電力 - 01",
    "02": "東北電力 - 02",
    "03": "東京電力 - 03",
    "04": "中部電力 - 04",
    "05": "北陸電力 - 05",
    "06": "関西電力 - 06",
    "07": "中国電力 - 07",
    "08": "四国電力 - 08",
    "09": "九州電力 - 09",
    "10": "沖縄電力 - 10",
}

DAY_BUCKETS: dict[str, str] = {
    "0": "yesterday",
    "1": "today",
    "2": "tomorrow",
}

DAY_LABELS: dict[str, str] = {
    "yesterday": "Yesterday",
    "today": "Today",
    "tomorrow": "Tomorrow",
}

PANEL_URL_PATH = "looop-denki"
STATIC_URL_PATH = "/looop_denki_static"
