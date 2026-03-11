# HomeAssistant-LooopDenki

Unofficial Home Assistant custom integration for interacting with Looop Denki price data.

## Features

- HACS-compatible custom integration (`looop_denki`)
- Config flow UI with:
	- Area code dropdown (01-10)
	- Price offset input (added to every API `price_data` value)
- Price polling every 30 minutes from:
	- `https://looop-denki.com/api/prices?select_area={Area_Code}`
- Sensors for each day (`Yesterday`, `Today`, `Tomorrow`):
	- Current Energy Price
	- Lowest Energy Price
	- Lowest Energy Price Hours
	- Highest Energy Price
	- Highest Energy Price Hours
- Built-in custom panel at `/looop-denki` with day switcher and line chart

## Install with HACS

1. Open HACS in Home Assistant.
2. Go to `Integrations`.
3. Open the menu (top-right) and select `Custom repositories`.
4. Add this repository URL and choose category `Integration`.
5. Find `Looop Denki` in HACS and install it.
6. Restart Home Assistant.

## Add the Integration

1. Open `Settings` -> `Devices & services` -> `Add Integration`.
2. Search for `Looop Denki`.
3. Configure:
	 - `Area Code` (dropdown)
	 - `Price Offset` (float)

Area code options:

- `北海道電力 - 01`
- `東北電力 - 02`
- `東京電力 - 03`
- `中部電力 - 04`
- `北陸電力 - 05`
- `関西電力 - 06`
- `中国電力 - 07`
- `四国電力 - 08`
- `九州電力 - 09`
- `沖縄電力 - 10`

## Day Buckets and Levels

From the API payload:

- `0` = Yesterday
- `1` = Today
- `2` = Tomorrow

Level values:

- `-0.5` = Cheapest price for that day
- `0` = Usual
- `0.5` = A little expensive
- `1` = Alert / highest price for the day

## Entities

This integration creates day-scoped sensors for `yesterday`, `today`, and `tomorrow`.

Examples:

- `Current Energy Price Today`
- `Lowest Energy Price Today`
- `Lowest Energy Price Hours Today`
- `Highest Energy Price Today`
- `Highest Energy Price Hours Today`

The same sensor set is also created for `Yesterday` and `Tomorrow`.

Additional helper entities:

- `Graph Day` (`select`) to choose `Yesterday`, `Today`, or `Tomorrow`
- `Selected Day Price Dataset` (`sensor`) with graph-ready attributes

## Chart Panel

After setup, open this path in Home Assistant:

- `/looop-denki`

The panel shows:

- A day selector (`Yesterday`, `Today`, `Tomorrow`)
- A full-day line chart based on the selected day's prices

## Notes

- Tomorrow data may be unavailable at some times. In this case, chart and entities for tomorrow can be empty/unavailable.
- `Price Offset` is applied to all fetched `price_data` values before calculations.
