import json
import socket

class GoveeLAN:
    def __init__(self, ip: str, port: int = 4003):
        self.ip = ip
        self.port = port

    def set_ip(self, ip: str):
        self.ip = ip.strip()

    def _send(self, payload: dict, expect_reply: bool = False, timeout: float = 1.0):
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
        return self._send({"msg": {"cmd": "turn", "data": {"value": 1}}})

    def off(self):
        return self._send({"msg": {"cmd": "turn", "data": {"value": 0}}})

    def brightness(self, v: int):
        v = max(1, min(100, int(v)))
        return self._send({"msg": {"cmd": "brightness", "data": {"value": v}}})

    def rgb(self, r: int, g: int, b: int):
        r = max(0, min(255, int(r)))
        g = max(0, min(255, int(g)))
        b = max(0, min(255, int(b)))
        return self._send({"msg": {"cmd": "colorwc", "data": {"color": {"r": r, "g": g, "b": b}}}})

    def status(self):
        return self._send({"msg": {"cmd": "devStatus", "data": {}}}, expect_reply=True)
