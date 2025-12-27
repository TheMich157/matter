import json
import time
import threading
import tkinter as tk
from tkinter import ttk, messagebox, colorchooser

from govee_lan import GoveeLAN  # <-- uses your library

DEFAULT_IP = "192.168.1.66"

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Govee LAN Controller (H612C)")
        self.geometry("720x520")
        self.minsize(680, 480)

        self.govee = GoveeLAN(DEFAULT_IP)  # <-- library instance
        self.last_color = (255, 0, 0)
        self._brightness_job = None

        self._build_ui()

    def log(self, text: str):
        ts = time.strftime("%H:%M:%S")
        self.log_box.configure(state="normal")
        self.log_box.insert("end", f"[{ts}] {text}\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _build_ui(self):
        pad = {"padx": 10, "pady": 8}

        header = ttk.Frame(self)
        header.pack(fill="x", **pad)

        ttk.Label(header, text="Device IP:").pack(side="left")
        self.ip_var = tk.StringVar(value=DEFAULT_IP)
        ttk.Entry(header, textvariable=self.ip_var, width=18).pack(side="left", padx=(6, 10))

        ttk.Button(header, text="Connect / Status", command=self.on_status).pack(side="left", padx=6)
        ttk.Button(header, text="ON", command=self.on_on).pack(side="left", padx=6)
        ttk.Button(header, text="OFF", command=self.on_off).pack(side="left", padx=6)

        self.status_var = tk.StringVar(value="Status: (unknown)")
        ttk.Label(header, textvariable=self.status_var).pack(side="right")

        main = ttk.Frame(self)
        main.pack(fill="both", expand=True, **pad)

        left = ttk.LabelFrame(main, text="Controls")
        left.pack(side="left", fill="both", expand=True, padx=(0, 10))

        right = ttk.LabelFrame(main, text="Presets")
        right.pack(side="right", fill="both", expand=False)

        # Brightness
        b_frame = ttk.Frame(left)
        b_frame.pack(fill="x", padx=10, pady=(10, 6))

        ttk.Label(b_frame, text="Brightness").pack(side="left")

        self.brightness_slider = ttk.Scale(
            b_frame, from_=1, to=100, orient="horizontal",
            command=self._on_brightness_drag
        )
        self.brightness_slider.set(50)
        self.brightness_slider.pack(side="left", fill="x", expand=True, padx=10)

        self.brightness_label = ttk.Label(b_frame, text="50%")
        self.brightness_label.pack(side="right")

        # Color controls
        c_frame = ttk.Frame(left)
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

        rgb_frame = ttk.Frame(left)
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
        log_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        self.log_box = tk.Text(log_frame, height=10, state="disabled", wrap="word")
        self.log_box.pack(fill="both", expand=True, padx=8, pady=8)

        presets = [
            ("Red", (255, 0, 0)),
            ("Green", (0, 255, 0)),
            ("Blue", (0, 0, 255)),
            ("Warm White-ish", (255, 180, 120)),
            ("Purple", (160, 60, 255)),
            ("Cyan", (0, 220, 255)),
        ]

        ttk.Label(right, text="Quick Colors").pack(anchor="w", padx=10, pady=(10, 6))
        for name, rgb in presets:
            ttk.Button(right, text=name, command=lambda c=rgb: self.apply_color(c)).pack(fill="x", padx=10, pady=4)

        ttk.Separator(right).pack(fill="x", padx=10, pady=10)
        ttk.Button(right, text="Set 100% Brightness", command=lambda: self.set_brightness(100)).pack(fill="x", padx=10, pady=4)
        ttk.Button(right, text="Set 10% Brightness", command=lambda: self.set_brightness(10)).pack(fill="x", padx=10, pady=4)

        ttk.Label(right, text="Device: H612C  •  UDP 4003").pack(anchor="w", padx=10, pady=(12, 10))

    def _apply_ip(self):
        self.govee.set_ip(self.ip_var.get())

    def _set_preview(self, rgb):
        r, g, b = rgb
        self.color_preview.delete("all")
        self.color_preview.create_rectangle(0, 0, 28, 18, fill=f"#{r:02X}{g:02X}{b:02X}", outline="")

    def on_on(self):
        self._apply_ip()
        self.govee.on()
        self.log("Sent ON")

    def on_off(self):
        self._apply_ip()
        self.govee.off()
        self.log("Sent OFF")

    def on_status(self):
        self._apply_ip()
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
        self.log("Status reply: " + json.dumps(resp))

    def _on_brightness_drag(self, value):
        v = int(float(value))
        self.brightness_label.config(text=f"{v}%")

        if self._brightness_job:
            self.after_cancel(self._brightness_job)
        self._brightness_job = self.after(120, lambda: self.set_brightness(v))

    def set_brightness(self, v: int):
        self._apply_ip()
        self.brightness_slider.set(v)
        self.govee.brightness(v)
        self.log(f"Set brightness -> {v}%")

    def apply_color(self, rgb):
        self._apply_ip()
        r, g, b = rgb
        self.govee.rgb(r, g, b)

        self.last_color = rgb
        self.r_var.set(r); self.g_var.set(g); self.b_var.set(b)
        self.hex_var.set(f"#{r:02X}{g:02X}{b:02X}")
        self._set_preview(rgb)
        self.log(f"Set color -> #{r:02X}{g:02X}{b:02X}")

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

if __name__ == "__main__":
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

    app = App()
    app.mainloop()
