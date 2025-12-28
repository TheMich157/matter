import json
import socket
from typing import Optional

class GoveeLAN:
    def __init__(self, ip: str, port: int = 4003, device: Optional[str] = None, sku: Optional[str] = None):
        self.ip = ip
        self.port = port
        self.device = device
        self.sku = sku

    def set_ip(self, ip: str):
        self.ip = ip.strip()

    def set_device_info(self, device: Optional[str] = None, sku: Optional[str] = None):
        """Persist optional device + SKU identifiers from the Govee LAN API."""
        if device is not None:
            self.device = device.strip()
        if sku is not None:
            self.sku = sku.strip()

    def _with_device_info(self, payload: dict, device: Optional[str] = None, sku: Optional[str] = None):
        enriched = dict(payload)
        dev = device or self.device
        sku_val = sku or self.sku
        if dev and "device" not in enriched:
            enriched["device"] = dev
        if sku_val and "sku" not in enriched:
            enriched["sku"] = sku_val
        return enriched

    def _wrap_msg(self, cmd: str, data: Optional[dict] = None):
        return {"msg": {"cmd": cmd, "data": data or {}}}

    def _send(self, payload: dict, expect_reply: bool = False, timeout: float = 1.0, device: Optional[str] = None, sku: Optional[str] = None):
        payload = self._with_device_info(payload, device=device, sku=sku)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(timeout)
        try:
            s.sendto(json.dumps(payload).encode("utf-8"), (self.ip, self.port))
            if expect_reply:
                data, _ = s.recvfrom(65535)
                txt = data.decode("utf-8", errors="ignore")
                try:
                    return json.loads(txt)
                except Exception:
                    return {"raw": txt}
            return None
        except (socket.timeout, ConnectionResetError, OSError):
            return None
        finally:
            s.close()

    def on(self):
        return self._send(self._wrap_msg("turn", {"value": 1}))

    def off(self):
        return self._send(self._wrap_msg("turn", {"value": 0}))

    def brightness(self, v: int):
        v = max(1, min(100, int(v)))
        return self._send(self._wrap_msg("brightness", {"value": v}))

    def rgb(self, r: int, g: int, b: int):
        r = max(0, min(255, int(r)))
        g = max(0, min(255, int(g)))
        b = max(0, min(255, int(b)))
        return self._send(self._wrap_msg("colorwc", {"color": {"r": r, "g": g, "b": b}}))

    def color_temp(self, kelvin: int):
        """Set color temperature (official LAN API field name: colorTemInKelvin)."""
        kelvin = max(1000, min(10000, int(kelvin)))
        return self._send(self._wrap_msg("colorwc", {"colorTemInKelvin": kelvin}))

    def send_command(self, cmd: str, data: Optional[dict] = None, expect_reply: bool = False, timeout: float = 1.0, device: Optional[str] = None, sku: Optional[str] = None):
        """Send any Govee LAN API command."""
        return self._send(self._wrap_msg(cmd, data), expect_reply=expect_reply, timeout=timeout, device=device, sku=sku)

    def send_payload(self, payload: dict, expect_reply: bool = False, timeout: float = 1.0, device: Optional[str] = None, sku: Optional[str] = None):
        """Send a fully-formed LAN payload (already contains msg)."""
        return self._send(payload, expect_reply=expect_reply, timeout=timeout, device=device, sku=sku)

    def status(self):
        return self._send(self._wrap_msg("devStatus", {}), expect_reply=True)
