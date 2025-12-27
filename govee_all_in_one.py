import json
import socket
import threading
import time
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox, colorchooser

DEFAULT_IP = "192.168.1.66"
CONTROL_PORT = 4003

# -------------------------
# LAN LIB (embedded)
# -------------------------
class GoveeLAN:
    def __init__(self, ip: str, port: int = CONTROL_PORT):
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


# -------------------------
# APP
# -------------------------
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Govee H612C — LAN Controller + Automation")
        self.geometry("860x560")
        self.minsize(820, 520)

        self.govee = GoveeLAN(DEFAULT_IP)
        self.last_color = (255, 0, 0)

        self._brightness_job = None

        # automation
        self.automation_running = False
        self.automation_thread = None
        self.automation_last_fired = set()  # (rule_index, YYYY-MM-DD, HH:MM)

        self._build_ui()

    # ---------- Helpers ----------
    def log(self, text: str):
        ts = time.strftime("%H:%M:%S")
        self.log_box.configure(state="normal")
        self.log_box.insert("end", f"[{ts}] {text}\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _apply_ip(self):
        ip = self.ip_var.get().strip()
        if not ip:
            raise ValueError("Empty IP")
        self.govee.set_ip(ip)

    def _set_preview(self, rgb):
        r, g, b = rgb
        self.color_preview.delete("all")
        self.color_preview.create_rectangle(0, 0, 28, 18, fill=f"#{r:02X}{g:02X}{b:02X}", outline="")

    # ---------- UI ----------
    def _build_ui(self):
        pad = {"padx": 10, "pady": 8}

        header = ttk.Frame(self)
        header.pack(fill="x", **pad)

        ttk.Label(header, text="Device IP:").pack(side="left")
        self.ip_var = tk.StringVar(value=DEFAULT_IP)
        ttk.Entry(header, textvariable=self.ip_var, width=18).pack(side="left", padx=(6, 10))

        ttk.Button(header, text="Status", command=self.on_status).pack(side="left", padx=6)
        ttk.Button(header, text="ON", command=self.on_on).pack(side="left", padx=6)
        ttk.Button(header, text="OFF", command=self.on_off).pack(side="left", padx=6)

        self.status_var = tk.StringVar(value="Status: (unknown)")
        ttk.Label(header, textvariable=self.status_var).pack(side="right")

        main = ttk.Frame(self)
        main.pack(fill="both", expand=True, **pad)

        left = ttk.Frame(main)
        left.pack(side="left", fill="both", expand=True, padx=(0, 10))

        right = ttk.Frame(main)
        right.pack(side="right", fill="y")

        # Controls group
        controls = ttk.LabelFrame(left, text="Controls")
        controls.pack(fill="x", padx=0, pady=(0, 10))

        # Brightness
        b_frame = ttk.Frame(controls)
        b_frame.pack(fill="x", padx=10, pady=(10, 6))

        ttk.Label(b_frame, text="Brightness").pack(side="left")

        self.brightness_slider = ttk.Scale(
            b_frame, from_=1, to=100, orient="horizontal",
             command=lambda val: self._on_brightness_drag(val)
        )
        self.brightness_slider.set(50)
        self.brightness_slider.pack(side="left", fill="x", expand=True, padx=10)

        # ✅ FIX: must be self.brightness_label, not local variable
        self.brightness_label = ttk.Label(b_frame, text="50%")
        self.brightness_label.pack(side="right")

        # Color row
        c_frame = ttk.Frame(controls)
        c_frame.pack(fill="x", padx=10, pady=(6, 10))

        ttk.Label(c_frame, text="Color").pack(side="left")

        self.color_preview = tk.Canvas(c_frame, width=28, height=18, highlightthickness=1, highlightbackground="#999")
        self.color_preview.pack(side="left", padx=10)
        self._set_preview(self.last_color)

        ttk.Button(c_frame, text="Pick…", command=self.on_pick_color).pack(side="left", padx=6)

        ttk.Label(c_frame, text="Hex").pack(side="left", padx=(14, 4))
        self.hex_var = tk.StringVar(value="#FF0000")
        ttk.Entry(c_frame, textvariable=self.hex_var, width=10).pack(side="left")

        ttk.Button(c_frame, text="Apply Hex", command=self.on_apply_hex).pack(side="left", padx=6)

        # RGB manual
        rgb_frame = ttk.Frame(controls)
        rgb_frame.pack(fill="x", padx=10, pady=(0, 10))

        ttk.Label(rgb_frame, text="R").pack(side="left")
        self.r_var = tk.IntVar(value=255)
        ttk.Spinbox(rgb_frame, from_=0, to=255, width=5, textvariable=self.r_var).pack(side="left", padx=(4, 10))

        ttk.Label(rgb_frame, text="G").pack(side="left")
        self.g_var = tk.IntVar(value=0)
        ttk.Spinbox(rgb_frame, from_=0, to=255, width=5, textvariable=self.g_var).pack(side="left", padx=(4, 10))

        ttk.Label(rgb_frame, text="B").pack(side="left")
        self.b_var = tk.IntVar(value=0)
        ttk.Spinbox(rgb_frame, from_=0, to=255, width=5, textvariable=self.b_var).pack(side="left", padx=(4, 10))

        ttk.Button(rgb_frame, text="Apply RGB", command=self.on_apply_rgb).pack(side="left", padx=10)

        # Log
        log_frame = ttk.LabelFrame(left, text="Log")
        log_frame.pack(fill="both", expand=True, padx=0, pady=0)

        self.log_box = tk.Text(log_frame, height=10, state="disabled", wrap="word")
        self.log_box.pack(fill="both", expand=True, padx=8, pady=8)

        # Presets
        presets_frame = ttk.LabelFrame(right, text="Presets")
        presets_frame.pack(fill="x", padx=0, pady=(0, 10))

        presets = [
            ("Red", (255, 0, 0)),
            ("Green", (0, 255, 0)),
            ("Blue", (0, 0, 255)),
            ("Warm", (255, 180, 120)),
            ("Purple", (160, 60, 255)),
            ("Cyan", (0, 220, 255)),
        ]

        for name, rgb in presets:
            ttk.Button(presets_frame, text=name, command=lambda c=rgb: self.apply_color(c)).pack(fill="x", padx=10, pady=4)

        ttk.Separator(right).pack(fill="x", pady=10)

        # Automation
        auto = ttk.LabelFrame(right, text="Automation (Daily)")
        auto.pack(fill="x")

        ttk.Label(auto, text="Add rule:").pack(anchor="w", padx=10, pady=(10, 4))

        row = ttk.Frame(auto)
        row.pack(fill="x", padx=10, pady=(0, 8))

        self.time_var = tk.StringVar(value="18:00")
        ttk.Entry(row, textvariable=self.time_var, width=7).pack(side="left")

        self.action_var = tk.StringVar(value="on")
        ttk.Combobox(row, textvariable=self.action_var, values=["on", "off", "brightness", "rgb"], width=10, state="readonly").pack(side="left", padx=6)

        self.value_var = tk.StringVar(value="35")
        ttk.Entry(row, textvariable=self.value_var, width=10).pack(side="left", padx=6)

        ttk.Button(auto, text="Add", command=self.add_rule).pack(fill="x", padx=10, pady=(0, 6))
        ttk.Button(auto, text="Remove selected", command=self.remove_rule).pack(fill="x", padx=10, pady=(0, 10))

        self.rules = []  # list of dict rules
        self.rules_list = tk.Listbox(auto, height=7)
        self.rules_list.pack(fill="both", padx=10, pady=(0, 10), expand=False)

        btns = ttk.Frame(auto)
        btns.pack(fill="x", padx=10, pady=(0, 10))

        self.auto_btn = ttk.Button(btns, text="Start", command=self.toggle_automation)
        self.auto_btn.pack(side="left", fill="x", expand=True)

        ttk.Button(btns, text="Save", command=self.save_rules).pack(side="left", padx=6, fill="x", expand=True)
        ttk.Button(btns, text="Load", command=self.load_rules).pack(side="left", fill="x", expand=True)

        ttk.Label(right, text="H612C • UDP 4003").pack(anchor="w", pady=(10, 0))

    # ---------- Control actions ----------
    def on_on(self):
        try:
            self._apply_ip()
            self.govee.on()
            self.log("Sent ON")
        except Exception as e:
            self.log(f"ON failed: {e}")

    def on_off(self):
        try:
            self._apply_ip()
            self.govee.off()
            self.log("Sent OFF")
        except Exception as e:
            self.log(f"OFF failed: {e}")

    def on_status(self):
        try:
            self._apply_ip()
        except Exception as e:
            self.log(f"Status failed: {e}")
            return

        self.log("Requesting status...")

        def worker():
            resp = self.govee.status()
            self.after(0, lambda: self._handle_status(resp))

        threading.Thread(target=worker, daemon=True).start()

    def _handle_status(self, resp):
        if not resp:
            self.status_var.set("Status: (no reply)")
            self.log("No status reply (firewall/network can block replies).")
            return
        self.status_var.set("Status: OK")
        self.log("Status: " + json.dumps(resp))

    def _on_brightness_drag(self, value):
        v = int(float(value))
        
        self.brightness_label.config(text=f"{v}%")  # ✅ now exists

        if self._brightness_job:
            self.after_cancel(self._brightness_job)
        self._brightness_job = self.after(120, lambda: self.set_brightness(v))

    def set_brightness(self, v: int):
        try:
            self._apply_ip()
            self.brightness_slider.set(v)
            self.govee.brightness(v)
            self.log(f"Brightness -> {v}%")
        except Exception as e:
            self.log(f"Brightness failed: {e}")

    def apply_color(self, rgb):
        try:
            self._apply_ip()
            r, g, b = rgb
            self.govee.rgb(r, g, b)

            self.last_color = rgb
            self.r_var.set(r); self.g_var.set(g); self.b_var.set(b)
            self.hex_var.set(f"#{r:02X}{g:02X}{b:02X}")
            self._set_preview(rgb)
            self.log(f"Color -> #{r:02X}{g:02X}{b:02X}")
        except Exception as e:
            self.log(f"Color failed: {e}")

    def on_pick_color(self):
        c = colorchooser.askcolor()
        if not c or not c[0]:
            return
        r, g, b = map(int, c[0])
        self.apply_color((r, g, b))

    def on_apply_hex(self):
        hx = self.hex_var.get().strip().lstrip("#")
        if len(hx) != 6:
            messagebox.showerror("Invalid Hex", "Hex must be 6 characters, e.g. #FF0000")
            return
        try:
            r = int(hx[0:2], 16)
            g = int(hx[2:4], 16)
            b = int(hx[4:6], 16)
        except ValueError:
            messagebox.showerror("Invalid Hex", "Hex contains invalid characters.")
            return
        self.apply_color((r, g, b))

    def on_apply_rgb(self):
        self.apply_color((self.r_var.get(), self.g_var.get(), self.b_var.get()))

    # ---------- Automation ----------
    def add_rule(self):
        t = self.time_var.get().strip()
        act = self.action_var.get().strip()
        val = self.value_var.get().strip()

        # very basic HH:MM check
        if len(t) != 5 or t[2] != ":":
            messagebox.showerror("Bad time", "Use HH:MM e.g. 18:00")
            return

        rule = {"time": t, "action": act}
        if act == "brightness":
            rule["value"] = int(val or "50")
        elif act == "rgb":
            # accept "r,g,b" or "r g b"
            parts = val.replace(" ", ",").split(",")
            if len(parts) != 3:
                messagebox.showerror("Bad RGB", "For rgb use value: r,g,b (e.g. 255,0,0)")
                return
            rule["r"], rule["g"], rule["b"] = map(int, parts)

        self.rules.append(rule)
        self.rules_list.insert("end", self._rule_to_text(rule))
        self.log(f"Added rule: {rule}")

    def remove_rule(self):
        sel = list(self.rules_list.curselection())
        if not sel:
            return
        for idx in reversed(sel):
            self.rules_list.delete(idx)
            self.rules.pop(idx)
        self.log("Removed selected rule(s)")

    def _rule_to_text(self, rule):
        if rule["action"] == "brightness":
            return f'{rule["time"]}  brightness {rule["value"]}%'
        if rule["action"] == "rgb":
            return f'{rule["time"]}  rgb {rule["r"]},{rule["g"]},{rule["b"]}'
        return f'{rule["time"]}  {rule["action"]}'

    def toggle_automation(self):
        if self.automation_running:
            self.automation_running = False
            self.auto_btn.config(text="Start")
            self.log("Automation stopped.")
            return

        try:
            self._apply_ip()
        except Exception as e:
            self.log(f"Automation start failed: {e}")
            return

        self.automation_running = True
        self.auto_btn.config(text="Stop")
        self.log("Automation started.")

        def worker():
            while self.automation_running:
                now = datetime.now()
                hm = now.strftime("%H:%M")
                day = now.strftime("%Y-%m-%d")

                for idx, rule in enumerate(self.rules):
                    if rule.get("time") != hm:
                        continue

                    key = (idx, day, hm)
                    if key in self.automation_last_fired:
                        continue

                    # fire rule
                    try:
                        act = rule["action"]
                        if act == "on":
                            self.govee.on()
                        elif act == "off":
                            self.govee.off()
                        elif act == "brightness":
                            self.govee.brightness(int(rule["value"]))
                        elif act == "rgb":
                            self.govee.rgb(int(rule["r"]), int(rule["g"]), int(rule["b"]))
                        else:
                            raise ValueError("Unknown action")

                        self.after(0, lambda r=rule: self.log(f"Automation fired: {r}"))
                    except Exception as e:
                        self.after(0, lambda e=e: self.log(f"Automation error: {e}"))

                    self.automation_last_fired.add(key)

                time.sleep(1.0)

        self.automation_thread = threading.Thread(target=worker, daemon=True)
        self.automation_thread.start()

    def save_rules(self):
        try:
            cfg = {"device_ip": self.ip_var.get().strip(), "rules": self.rules}
            with open("rules.json", "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
            self.log("Saved rules.json")
        except Exception as e:
            self.log(f"Save failed: {e}")

    def load_rules(self):
        try:
            with open("rules.json", "r", encoding="utf-8") as f:
                cfg = json.load(f)

            ip = cfg.get("device_ip", DEFAULT_IP)
            self.ip_var.set(ip)
            self.govee.set_ip(ip)

            self.rules = cfg.get("rules", [])
            self.rules_list.delete(0, "end")
            for r in self.rules:
                self.rules_list.insert("end", self._rule_to_text(r))

            self.log("Loaded rules.json")
        except FileNotFoundError:
            self.log("rules.json not found (save first).")
        except Exception as e:
            self.log(f"Load failed: {e}")

if __name__ == "__main__":
    # better DPI on Windows
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

    App().mainloop()
