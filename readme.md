# 🔆 Govee LAN Controller (Windows EXE)

A **local-only** controller for Govee LAN lights.  
Fast, private, no cloud needed.

### New in 2.0.0
- LAN API console for sending any raw `cmd`/`data` or full `msg` payload (with optional device + SKU).
- Native color temperature control using the official `colorTemInKelvin` field.
- Scene sender that accepts any Govee app `sceneId` (official scenes).
- Version bump to **2.0.0** to align with the expanded LAN API surface.

---

## ✅ What you need

- **Windows 10/11**
- Your PC must be on the **same Wi-Fi/LAN** as the Govee device
- A Govee device that supports **LAN / UDP control** (port **4003**)

---

## 📦 Downloads

You may see 2 Windows builds on the Releases page:

### 1) Installer (Recommended)
**`Govee LAN Controller Setup x.x.x.exe`**
- Installs to Program Files
- Creates Start Menu + Desktop shortcut
- Supports updates better (recommended)

### 2) Portable
**`Govee LAN Controller-x.x.x.exe`**
- No install needed
- Runs from anywhere (USB etc.)
- Updates still work, but installer is more reliable

---

## 🚀 How to use

1. Run the app (Installer or Portable)
2. In the top bar, enter your device IP (example: `192.168.1.66`)
3. Click **Check**  
   - If the dot turns **green**, you’re connected ✅
4. Use:
   - **ON / OFF**
   - **Brightness slider**
   - **Color picker / RGB**
   - **Presets**
   - **Automation rules**

---

## 🔍 Finding your device IP

### Option A: Built-in scan
Click the **🔍 scan button** and start the scan.  
If devices are found, click one to auto-fill the IP.

### Option B: Router list
Open your router page and look for “Connected devices”.

### Option C: Windows commands
Open **CMD** and try:
```bat
arp -a

Then look for new LAN IPs.

⸻

🎛️ Automation (Daily)

Create daily rules like:
	•	18:00 → ON
	•	22:30 → OFF
	•	20:00 → Brightness 35
	•	19:00 → RGB 255,80,10

Rule value formats
	•	ON / OFF: value can be empty
	•	Brightness: 1-100
	•	RGB: R,G,B (0-255 each)
Example: 255,120,0

Use Save / Load / Export / Import to keep your schedules.

⸻

🎵 Music Mode (Reactive)

Music Mode makes lights react in real-time (color + brightness).
If it asks for microphone permission, allow it.

Note: Some systems need mic access to get audio level data.
A true “capture PC audio (Spotify/YouTube)” mode requires system audio loopback support.

⸻

📡 Network Monitor + UDP Packets
	•	Network Monitor shows what commands the app sends
	•	UDP Packets shows captured UDP payloads:
	•	JSON view
	•	Raw text
	•	Hex dump
	•	Analysis (turn / brightness / colorwc etc.)

Great for debugging and testing.

⸻

🔄 Updates
	•	The app can check for updates in Help → Check for Updates
	•	When an update is found, download it and install when prompted

If updates fail:
	•	Make sure you downloaded from GitHub Releases
	•	Try the Installer build instead of Portable
	•	Verify your internet connection

⸻

🧯 Troubleshooting

Dot stays red / device offline
	•	Your device IP is wrong
	•	Device is not on the same network
	•	Device doesn’t support LAN control
	•	Firewall/VPN is blocking local UDP

Device responds slowly
	•	Try wired LAN for PC/router
	•	Avoid guest Wi-Fi networks (they block local traffic)

Scan finds nothing
	•	Device might not support discovery
	•	Enter IP manually
	•	Make sure the device is powered on

App doesn’t open / closes instantly
	•	Re-download from Releases
	•	Try running as Administrator once
	•	If Windows SmartScreen shows warning → “More info” → “Run anyway”

⸻

🔒 Privacy

This app is designed to be local.
It controls devices over LAN (UDP) and does not require cloud login.

⸻

Credits

Built by TheMich157
Project: Govee LAN Controller
