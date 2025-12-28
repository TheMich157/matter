# Changelog

## 2.0.0
**Highlights**
- LAN API console to send any raw `cmd`/`data` or full `msg` payload, with optional device/SKU identifiers.
- Native color temperature slider that issues `colorTemInKelvin` commands over LAN.
- Scene sender for triggering any official Govee app `sceneId` locally.
- Version bumped to **2.0.0** with refreshed documentation.

**Backend**
- Added device/SKU-aware helpers and `/api/device/raw` for arbitrary LAN payloads.
- Added `/api/device/color-temperature` for Kelvin-based control.
- Added `/api/device/scene` endpoint to activate official scenes via `sceneId`.

**Frontend**
- Added LAN API console UI, color temperature control, and sceneId input with discovery-powered device/SKU persistence.
- Updated automation/logging to surface new commands and status feedback.
