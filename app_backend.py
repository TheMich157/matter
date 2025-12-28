"""
Flask backend for Govee H612C control
Serves HTTP API at localhost:5000
Also serves static HTML/CSS/JS UI
Embeds GoveeLAN library
"""

import json
import os
import socket
import sys
import threading
import time
from datetime import datetime
from typing import Optional
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

DEFAULT_IP = "192.168.1.66"
CONTROL_PORT = 4003
MCAST_GRP = "239.255.255.250"
SCAN_PORT = 4001
RECV_PORT = 4002


BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(sys.argv[0])))


STATIC_DIR = os.path.join(BASE_DIR, "src")
DEFAULT_RULES_FILE = os.path.join(BASE_DIR, "rules.json")
DATA_DIR = os.path.join(os.path.expanduser("~"), ".govee-lan-controller")
os.makedirs(DATA_DIR, exist_ok=True)
RULES_PATH = os.path.join(DATA_DIR, "rules.json")

# -------------------------
# Packet Monitor
# -------------------------
class PacketMonitor:
    def __init__(self, max_packets=100):
        self.packets = []
        self.max_packets = max_packets
    
    def log_packet(self, ip, port, payload_dict, payload_bytes):
        """Log a UDP packet with all details"""
        packet = {
            "timestamp": datetime.now().isoformat(),
            "protocol": "UDP",
            "destination_ip": ip,
            "destination_port": port,
            "payload_json": payload_dict,
            "payload_size": len(payload_bytes),
            "payload_hex": payload_bytes.hex(),
            "payload_text": payload_bytes.decode("utf-8", errors="replace")
        }
        self.packets.append(packet)
        if len(self.packets) > self.max_packets:
            self.packets.pop(0)
        return packet
    
    def get_packets(self):
        """Return all logged packets"""
        return list(reversed(self.packets))  # newest first
    
    def clear(self):
        """Clear all packets"""
        self.packets.clear()

packet_monitor = PacketMonitor()

# -------------------------
# GoveeLAN Library (embedded) - Enhanced
# -------------------------
class GoveeLAN:
    """
    Enhanced GoveeLAN library with scene management, error recovery, 
    and color mode support for all Govee LAN models
    """
    
    def __init__(self, ip: str, port: int = CONTROL_PORT, device: Optional[str] = None, sku: Optional[str] = None):
        self.ip = ip
        self.port = port
        self.last_status = {}
        self.retry_count = 2
        self.retry_delay = 0.3
        self.scenes = {}
        self.color_mode = "rgb"  # or "ct" for color temperature
        self.device = device
        self.sku = sku

    def set_ip(self, ip: str):
        self.ip = ip.strip()

    def set_device_info(self, device: Optional[str] = None, sku: Optional[str] = None):
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
        """Send UDP packet with automatic retry on failure"""
        last_error = None
        payload = self._with_device_info(payload, device=device, sku=sku)
        
        for attempt in range(self.retry_count + 1):
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.settimeout(timeout)
                
                payload_bytes = json.dumps(payload).encode("utf-8")
                # Log the packet
                packet_monitor.log_packet(self.ip, self.port, payload, payload_bytes)
                # Send it
                s.sendto(payload_bytes, (self.ip, self.port))
                
                if expect_reply:
                    data, _ = s.recvfrom(65535)
                    txt = data.decode("utf-8", errors="ignore")
                    try:
                        result = json.loads(txt)
                        self.last_status = result
                        s.close()
                        return result
                    except Exception:
                        s.close()
                        return {"raw": txt}
                
                s.close()
                return None
                
            except (socket.timeout, ConnectionResetError, OSError) as e:
                last_error = e
                if attempt < self.retry_count:
                    time.sleep(self.retry_delay)
                continue
        
        print(f"[GOVEE] Send failed after {self.retry_count + 1} attempts: {last_error}")
        return None

    def on(self):
        """Turn device ON"""
        return self._send(self._wrap_msg("turn", {"value": 1}))

    def off(self):
        """Turn device OFF"""
        return self._send(self._wrap_msg("turn", {"value": 0}))

    def brightness(self, v: int):
        """Set brightness (1-100)"""
        v = max(1, min(100, int(v)))
        return self._send(self._wrap_msg("brightness", {"value": v}))

    def rgb(self, r: int, g: int, b: int):
        """Set RGB color (0-255 per channel)"""
        r = max(0, min(255, int(r)))
        g = max(0, min(255, int(g)))
        b = max(0, min(255, int(b)))
        return self._send(self._wrap_msg("colorwc", {"color": {"r": r, "g": g, "b": b}}))

    def color_temp(self, kelvin: int):
        """Set color temperature (2000-6500K typical range)"""
        kelvin = max(1000, min(10000, int(kelvin)))
        return self._send(self._wrap_msg("colorwc", {"colorTemInKelvin": kelvin}))

    def scene(self, scene_id: int):
        """Activate a scene (device-specific scene ID)"""
        return self._send(self._wrap_msg("scene", {"sceneId": scene_id}))

    def status(self):
        """Get device status (power, brightness, color, etc.)"""
        return self._send(self._wrap_msg("devStatus", {}), expect_reply=True)

    def send_command(self, cmd: str, data: Optional[dict] = None, expect_reply: bool = False, timeout: float = 1.0, device: Optional[str] = None, sku: Optional[str] = None):
        """Send any Govee LAN API command with optional reply expectation."""
        return self._send(self._wrap_msg(cmd, data), expect_reply=expect_reply, timeout=timeout, device=device, sku=sku)

    def send_payload(self, payload: dict, expect_reply: bool = False, timeout: float = 1.0, device: Optional[str] = None, sku: Optional[str] = None):
        """Send a pre-built LAN API payload (already contains msg)."""
        return self._send(payload, expect_reply=expect_reply, timeout=timeout, device=device, sku=sku)

    def save_scene(self, name: str):
        """Save current state as a scene"""
        status = self.status()
        if status:
            self.scenes[name] = status
            return True
        return False

    def load_scene(self, name: str):
        """Load a saved scene"""
        if name in self.scenes:
            scene = self.scenes[name]
            # Apply scene settings
            if 'power' in scene.get('data', {}):
                if scene['data']['power'] == 1:
                    self.on()
                else:
                    self.off()
            return True
        return False

    def reset_connection(self):
        """Reset connection by power cycling (turn off then on with delay)"""
        self.off()
        time.sleep(1)
        return self.on()


# -------------------------
# Flask App
# -------------------------
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
CORS(app)

govee = GoveeLAN(DEFAULT_IP)

# Automation state
automation_running = False
automation_thread = None
automation_last_fired = set()
rules = []


# -------------------------
# Device Discovery
# -------------------------
def get_local_ipv4s():
    """Get all local IPv4 addresses"""
    ips = set()
    host = socket.gethostname()
    try:
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except Exception:
        pass
    # Also include the IP from a connection to 8.8.8.8
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    return sorted(ips)


def scan_interface(local_ip, timeout=2.0):
    """Scan for Govee devices on a specific interface"""
    found = []
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.bind(("0.0.0.0", RECV_PORT))
        sock.settimeout(0.4)

        # Join multicast on this interface
        mreq = socket.inet_aton(MCAST_GRP) + socket.inet_aton(local_ip)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

        # Force multicast out of this interface
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(local_ip))
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)

        # Send scan message
        scan_msg = {"msg": {"cmd": "scan", "data": {"account_topic": "reserve"}}}
        data = json.dumps(scan_msg).encode("utf-8")
        sock.sendto(data, (MCAST_GRP, SCAN_PORT))
        sock.sendto(data, ("255.255.255.255", SCAN_PORT))

        # Collect replies
        end = time.time() + timeout
        seen_ips = set()
        while time.time() < end:
            try:
                pkt, addr = sock.recvfrom(65535)
                ip = addr[0]
                if ip in seen_ips:
                    continue
                seen_ips.add(ip)
                
                txt = pkt.decode("utf-8", errors="ignore")
                try:
                    obj = json.loads(txt)
                    found.append({"ip": ip, "data": obj})
                except Exception:
                    found.append({"ip": ip, "data": {"raw": txt}})
            except socket.timeout:
                continue
        sock.close()
    except Exception as e:
        print(f"Error scanning {local_ip}: {e}")
    return found


@app.route("/api/discover", methods=["GET"])
def discover_devices():
    """Scan network for Govee devices"""
    try:
        print("[DISCOVERY] Starting device scan...")
        devices = []
        ips = get_local_ipv4s()
        print(f"[DISCOVERY] Local IPs: {ips}")
        
        for local_ip in ips:
            print(f"[DISCOVERY] Scanning from {local_ip}...")
            results = scan_interface(local_ip, timeout=2.0)
            devices.extend(results)
        
        # Deduplicate by IP and enrich with model info
        seen = {}
        for dev in devices:
            ip = dev["ip"]
            if ip not in seen:
                seen[ip] = dev
                # Try to extract model/type info
                data = dev.get("data", {})
                msg = data.get("msg", {})
                dev["device_type"] = msg.get("devType", "Unknown")
                dev["device_name"] = msg.get("devName", f"Govee Light ({ip})")
                dev["sku"] = msg.get("sku", "N/A")
        
        unique_devices = list(seen.values())
        print(f"[DISCOVERY] Found {len(unique_devices)} unique device(s)")
        return jsonify({"status": "ok", "devices": unique_devices})
    except Exception as e:
        print(f"Error in discover_devices: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/on", methods=["POST", "OPTIONS"])
def device_on():
    if request.method == "OPTIONS":
        return "", 200
    try:
        # Debug: log incoming request for troubleshooting
        try:
            raw = request.get_data(as_text=True)
        except Exception:
            raw = None
        print("[DEBUG] /api/device/on headers:", dict(request.headers))
        print("[DEBUG] /api/device/on raw body:", raw)
        data = request.get_json(silent=True) or {}
        print("[DEBUG] /api/device/on parsed json:", data)
        ip = data.get("ip") or govee.ip
        if ip:
            govee.set_ip(ip)
        result = govee.on()
        return jsonify({"status": "ok", "action": "on"})
    except Exception as e:
        print(f"Error in device_on: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/off", methods=["POST", "OPTIONS"])
def device_off():
    if request.method == "OPTIONS":
        return "", 200
    try:
        try:
            raw = request.get_data(as_text=True)
        except Exception:
            raw = None
        print("[DEBUG] /api/device/off headers:", dict(request.headers))
        print("[DEBUG] /api/device/off raw body:", raw)
        data = request.get_json(silent=True) or {}
        print("[DEBUG] /api/device/off parsed json:", data)
        ip = data.get("ip") or govee.ip
        if ip:
            govee.set_ip(ip)
        result = govee.off()
        return jsonify({"status": "ok", "action": "off"})
    except Exception as e:
        print(f"Error in device_off: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/brightness", methods=["POST", "OPTIONS"])
def device_brightness():
    if request.method == "OPTIONS":
        return "", 200
    try:
        try:
            raw = request.get_data(as_text=True)
        except Exception:
            raw = None
        print("[DEBUG] /api/device/brightness headers:", dict(request.headers))
        print("[DEBUG] /api/device/brightness raw body:", raw)
        data = request.get_json(silent=True) or {}
        print("[DEBUG] /api/device/brightness parsed json:", data)
        ip = data.get("ip") or govee.ip
        v = data.get("value", 50)
        if ip:
            govee.set_ip(ip)
        govee.brightness(int(v))
        return jsonify({"status": "ok", "action": "brightness", "value": v})
    except Exception as e:
        print(f"Error in device_brightness: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/color-temperature", methods=["POST", "OPTIONS"])
def device_color_temperature():
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get("ip") or govee.ip
        kelvin = data.get("value", 4000)
        device = data.get("device")
        sku = data.get("sku")
        if ip:
            govee.set_ip(ip)
        if device or sku:
            govee.set_device_info(device=device, sku=sku)
        govee.color_temp(int(kelvin))
        return jsonify({"status": "ok", "action": "color-temperature", "value": kelvin})
    except Exception as e:
        print(f"Error in device_color_temperature: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/color", methods=["POST", "OPTIONS"])
def device_color():
    if request.method == "OPTIONS":
        return "", 200
    try:
        try:
            raw = request.get_data(as_text=True)
        except Exception:
            raw = None
        print("[DEBUG] /api/device/color headers:", dict(request.headers))
        print("[DEBUG] /api/device/color raw body:", raw)
        data = request.get_json(silent=True) or {}
        print("[DEBUG] /api/device/color parsed json:", data)
        ip = data.get("ip") or govee.ip
        r = data.get("r", 255)
        g = data.get("g", 0)
        b = data.get("b", 0)
        if ip:
            govee.set_ip(ip)
        govee.rgb(int(r), int(g), int(b))
        return jsonify({"status": "ok", "action": "color", "r": r, "g": g, "b": b})
    except Exception as e:
        print(f"Error in device_color: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/scene", methods=["POST", "OPTIONS"])
def device_scene():
    """Activate an official Govee scene by its sceneId."""
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get("ip") or govee.ip
        scene_id = data.get("sceneId", data.get("scene_id"))
        device = data.get("device")
        sku = data.get("sku")

        if scene_id is None:
            return jsonify({"status": "error", "message": "sceneId is required"}), 400

        scene_int = int(scene_id)
        if scene_int < 0:
            return jsonify({"status": "error", "message": "sceneId must be non-negative"}), 400
        if ip:
            govee.set_ip(ip)
        if device or sku:
            govee.set_device_info(device=device, sku=sku)

        govee.scene(scene_int)
        return jsonify({"status": "ok", "action": "scene", "sceneId": scene_int})
    except ValueError:
        return jsonify({"status": "error", "message": "sceneId must be a number"}), 400
    except Exception as e:
        print(f"Error in device_scene: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/raw", methods=["POST", "OPTIONS"])
def device_raw():
    """Send an arbitrary Govee LAN payload for advanced API control."""
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get("ip") or govee.ip
        cmd = data.get("cmd")
        payload = data.get("payload")
        expect_reply = bool(data.get("expect_reply", False))
        timeout = float(data.get("timeout", 1.0))
        device = data.get("device")
        sku = data.get("sku")

        if ip:
            govee.set_ip(ip)
        if device or sku:
            govee.set_device_info(device=device, sku=sku)

        if payload:
            if not isinstance(payload, dict):
                return jsonify({"status": "error", "message": "payload must be an object"}), 400
            resp = govee.send_payload(payload, expect_reply=expect_reply, timeout=timeout, device=device, sku=sku)
        else:
            if not cmd:
                return jsonify({"status": "error", "message": "cmd or payload is required"}), 400
            msg_data = data.get("data") or {}
            if not isinstance(msg_data, dict):
                return jsonify({"status": "error", "message": "data must be an object"}), 400
            resp = govee.send_command(cmd, msg_data, expect_reply=expect_reply, timeout=timeout, device=device, sku=sku)

        return jsonify({"status": "ok", "response": resp, "ip": govee.ip})
    except Exception as e:
        print(f"Error in device_raw: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/scene", methods=["POST", "OPTIONS"])
def device_scene():
    """Activate an official Govee sceneId (matches the scene list from the mobile app)."""
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get("ip") or govee.ip
        scene_id = data.get("sceneId") or data.get("scene_id")
        device = data.get("device")
        sku = data.get("sku")

        if not scene_id:
            return jsonify({"status": "error", "message": "sceneId is required"}), 400

        if ip:
            govee.set_ip(ip)
        if device or sku:
            govee.set_device_info(device=device, sku=sku)

        govee.scene(scene_id)
        return jsonify({"status": "ok", "action": "scene", "sceneId": scene_id})
    except Exception as e:
        print(f"Error in device_scene: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/device/status", methods=["POST", "OPTIONS"])
def device_status():
    if request.method == "OPTIONS":
        return "", 200
    try:
        try:
            raw = request.get_data(as_text=True)
        except Exception:
            raw = None
        print("[DEBUG] /api/device/status headers:", dict(request.headers))
        print("[DEBUG] /api/device/status raw body:", raw)
        data = request.get_json(silent=True) or {}
        print("[DEBUG] /api/device/status parsed json:", data)
        ip = data.get("ip") or govee.ip
        if ip:
            govee.set_ip(ip)
        resp = govee.status()
        return jsonify({"status": "ok", "data": resp})
    except Exception as e:
        print(f"Error in device_status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/rules", methods=["GET"])
def get_rules():
    return jsonify({"rules": rules})


@app.route("/api/rules", methods=["POST"])
def add_rule():
    try:
        data = request.get_json(silent=True) or {}
        rule = {
            "time": data.get("time", "00:00"),
            "action": data.get("action", "on"),
        }
        if rule["action"] == "brightness":
            rule["value"] = data.get("value", 50)
        elif rule["action"] == "rgb":
            r = data.get("r", 255)
            g = data.get("g", 0)
            b = data.get("b", 0)
            rule["r"] = r
            rule["g"] = g
            rule["b"] = b
        
        rules.append(rule)
        save_rules_to_file()
        return jsonify({"status": "ok", "rule": rule})
    except Exception as e:
        print(f"Error in add_rule: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/rules/<int:idx>", methods=["DELETE"])
def delete_rule(idx):
    try:
        if 0 <= idx < len(rules):
            rules.pop(idx)
            save_rules_to_file()
            return jsonify({"status": "ok"})
        return jsonify({"status": "error", "message": "Invalid index"}), 400
    except Exception as e:
        print(f"Error in delete_rule: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/automation/start", methods=["POST", "OPTIONS"])
def automation_start():
    global automation_running, automation_thread
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get("ip") or govee.ip
        
        if automation_running:
            return jsonify({"status": "error", "message": "Already running"})
        
        automation_running = True
        govee.set_ip(ip)
        print(f"[AUTOMATION] Started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        def worker():
            global automation_running, automation_last_fired
            while automation_running:
                try:
                    now = datetime.now()
                    hm = now.strftime("%H:%M")
                    day = now.strftime("%Y-%m-%d")
                    
                    for idx, rule in enumerate(rules):
                        if rule.get("time") != hm:
                            continue
                        
                        key = (idx, day, hm)
                        if key in automation_last_fired:
                            continue
                        
                        try:
                            act = rule["action"]
                            action_str = f"Rule #{idx+1} ({hm})"
                            if act == "on":
                                govee.on()
                                print(f"[AUTOMATION] {action_str}: TURN ON")
                            elif act == "off":
                                govee.off()
                                print(f"[AUTOMATION] {action_str}: TURN OFF")
                            elif act == "brightness":
                                val = int(rule["value"])
                                govee.brightness(val)
                                print(f"[AUTOMATION] {action_str}: BRIGHTNESS {val}%")
                            elif act == "rgb":
                                r, g, b = int(rule["r"]), int(rule["g"]), int(rule["b"])
                                govee.rgb(r, g, b)
                                print(f"[AUTOMATION] {action_str}: RGB({r},{g},{b})")
                            automation_last_fired.add(key)
                        except Exception as e:
                            print(f"[AUTOMATION ERROR] Rule {idx}: {e}")
                    
                    import time
                    time.sleep(1.0)
                except Exception as e:
                    print(f"[AUTOMATION ERROR] Worker loop: {e}")
                    import time
                    time.sleep(1.0)
        
        automation_thread = threading.Thread(target=worker, daemon=True)
        automation_thread.start()
        return jsonify({"status": "ok", "message": "Automation started"})
    except Exception as e:
        print(f"Error in automation_start: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/automation/stop", methods=["POST", "OPTIONS"])
def automation_stop():
    global automation_running
    if request.method == "OPTIONS":
        return "", 200
    try:
        automation_running = False
        return jsonify({"status": "ok", "message": "Automation stopped"})
    except Exception as e:
        print(f"Error in automation_stop: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/automation/status", methods=["GET"])
def automation_status():
    return jsonify({"running": automation_running})


def save_rules_to_file():
    try:
        # Write atomically: write to temp file then replace
        tmp = os.path.join(DATA_DIR, "rules.json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"device_ip": govee.ip, "rules": rules}, f, indent=2)
        try:
            os.replace(tmp, RULES_PATH)
        except Exception:
            # Fallback if replace is not available
            os.remove(RULES_PATH) if os.path.exists(RULES_PATH) else None
            os.rename(tmp, RULES_PATH)
    except Exception as e:
        print(f"Error saving rules: {e}")


def load_rules_from_file():
    global rules
    try:
        if not os.path.exists(RULES_PATH) and os.path.exists(DEFAULT_RULES_FILE):
            try:
                with open(DEFAULT_RULES_FILE, "r", encoding="utf-8") as default_rules, \
                        open(RULES_PATH, "w", encoding="utf-8") as dest:
                    json.dump(json.load(default_rules), dest, indent=2)
            except Exception as copy_err:
                print(f"Failed to seed default rules: {copy_err}")

        with open(RULES_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            govee.set_ip(cfg.get("device_ip", DEFAULT_IP))
            rules = cfg.get("rules", [])
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"Error loading rules: {e}")


@app.route("/api/packets", methods=["GET"])
def get_packets():
    """Return all captured UDP packets with full details"""
    try:
        packets = packet_monitor.get_packets()
        return jsonify({"packets": packets})
    except Exception as e:
        print(f"Error in get_packets: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/packets", methods=["DELETE"])
def clear_packets():
    """Clear the packet log"""
    try:
        packet_monitor.clear()
        return jsonify({"status": "ok", "message": "Packet log cleared"})
    except Exception as e:
        print(f"Error in clear_packets: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/rules", methods=["PUT"])
def set_rules():
    """Replace full rules set and persist to disk."""
    global rules
    try:
        data = request.get_json(silent=True) or {}
        new_rules = data.get("rules")
        device_ip = data.get("device_ip")

        if device_ip:
            govee.set_ip(device_ip)

        if isinstance(new_rules, list):
            # Basic validation: ensure each rule has a time and action
            validated = []
            for r in new_rules:
                if not isinstance(r, dict):
                    continue
                t = r.get("time")
                a = r.get("action")
                if not t or not a:
                    continue
                validated.append(r)

            rules = validated
            save_rules_to_file()
            return jsonify({"status": "ok", "rules": rules})

        return jsonify({"status": "error", "message": "Invalid payload"}), 400
    except Exception as e:
        print(f"Error in set_rules: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


# Serve static files
@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(STATIC_DIR, path)


if __name__ == "__main__":
    load_rules_from_file()
    print("Starting Govee controller backend on http://localhost:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
