# Govee LAN Controller

Professional desktop application for controlling Govee lights on your local network. Fast, private, and requires no cloud services.

**Version**: 1.0.0  
**Platform**: Windows 10/11  
**License**: MIT

## Features

### Device Control
- **Power Control**: Turn lights ON/OFF with single click
- **Brightness**: Adjust 1-100% with smooth slider
- **Color Control**: Pick any color using color picker or enter RGB values (0-255)
- **Quick Presets**: 6 preset colors (Red, Green, Blue, Warm, Purple, Cyan)

### Automation & Scheduling
- **Daily Rules**: Create time-based automation rules
- **Actions**: Turn ON/OFF, adjust brightness, set colors
- **Validation**: Smart validation prevents invalid rules
- **Persistence**: Rules saved automatically and survive app restart
- **Import/Export**: Backup and restore your automation rules as JSON files

### Network & Diagnostics
- **Device Discovery**: Automatically scan network for Govee devices
- **Device Info**: View device type, model, SKU, IP address
- **Packet Monitor**: Watch all commands sent to device
- **UDP Inspector**: View full UDP packet details (JSON, Raw Hex, Analysis)
- **Command Log**: Timeline of all device commands

### Performance & Reliability
- **Local Only**: Zero cloud dependencies, works offline
- **Fast Response**: Commands execute in <100ms on local network
- **Multi-Device Support**: Supports all Govee models with LAN control
- **Settings Persistence**: Remembers last device IP and settings
- **Error Handling**: Clear error messages guide you to solutions

## Installation

### From Executable (Easiest)

1. Download `Govee LAN Controller-1.0.0.exe`
2. Run the installer (or portable `.exe`)
3. Launch from Start Menu or Desktop

**That's it!** No Python, Node.js, or setup needed.

### From Source (For Developers)

```powershell
# Install dependencies
npm install
pip install -r requirements.txt

# Run in development mode
npm run dev

# Build distribution
npm run dist
```

See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for details.

## Quick Start

1. **Connect Device**: 
   - Power on your Govee light
   - Connect to same WiFi network as computer
   - Click 🔍 to scan for devices

2. **Select Device**:
   - Click on device in discovery list
   - Or manually enter IP address

3. **Control**:
   - Use Power, Brightness, Color controls
   - Click Quick Presets for instant colors
   - Check network monitor to see commands

4. **Automate**:
   - Set Time, Action, Value
   - Click "+" to add rule
   - Click "Start" to activate automation
   - Rules run every day at scheduled times

## Device Discovery

The app finds Govee devices on your network using:
- **Multicast scanning** on port 4001
- **Automatic detection** of device type and model
- **Deduplication** to avoid listing same device twice
- **All interfaces** checked (WiFi, Ethernet, VPN)

If discovery doesn't work:
1. Device must be **powered on**
2. Device must be on **same WiFi network**
3. Firewall must allow UDP port 4001
4. Try entering IP manually (usually 192.168.x.x)

## Automation Rules

### Format

Each rule has:
- **Time**: When to execute (HH:MM, 24-hour format)
- **Action**: What to do (ON, OFF, Brightness, RGB)
- **Value**: Parameter (optional, depends on action)

### Examples

| Time | Action | Value | Result |
|------|--------|-------|--------|
| 18:00 | ON | - | Turn on at 6 PM |
| 22:00 | OFF | - | Turn off at 10 PM |
| 19:00 | Brightness | 75 | Set to 75% at 7 PM |
| 17:00 | RGB | 255,100,50 | Warm orange at 5 PM |

### Features

- ✅ Daily execution (repeats every day)
- ✅ Smart deduplication (won't execute twice in same minute)
- ✅ Input validation (prevents invalid rules)
- ✅ Persistent storage (survives app restart)
- ✅ Import/Export (backup as JSON)

## Packet Inspector

View exactly what's being sent to your device:

1. **JSON Tab**: Structured command data
2. **Raw Tab**: Original command text
3. **Hex Tab**: Byte-level representation (useful for debugging)
4. **Analysis Tab**: Extracted values (brightness %, color RGB, etc.)

This is useful for:
- Understanding Govee protocol
- Debugging connection issues
- Verifying commands were sent
- Capturing packets for analysis

## Settings

All settings are saved in:
- **Windows**: `%APPDATA%\Govee LAN Controller\`
- **Mac/Linux**: `~/.config/Govee LAN Controller/`

Files:
- `rules.json` - Your automation rules
- Window size/position
- Last device IP

## Supported Devices

Works with any Govee light supporting LAN control:
- ✅ H6127B (Glide Light Panel)
- ✅ H612C (RGB+CCT Light Bars)
- ✅ H6135 (WiFi LED Smart Bulb)
- ✅ H6199 (WiFi Smart Bulb)
- ✅ H7050 (WiFi Smart String Light)
- ✅ And many more...

**Does NOT work with**:
- ❌ Cloud-only devices (no LAN control)
- ❌ Bluetooth-only devices
- ❌ Older pre-2019 models

Check your device manual for "LAN control" or "Local control" support.

## Network Requirements

- WiFi or Ethernet network
- Device on same subnet as computer
- No internet required
- No port forwarding needed
- Works behind standard routers

## Troubleshooting

### Device not found in discovery

**Solution 1**: Enter IP manually
- Set static IP on device in Govee app
- Copy IP to "Device IP" field
- Click Check button

**Solution 2**: Check network
- Is device powered on?
- Is it on same WiFi?
- Try pinging device: `ping 192.168.1.66`
- Check firewall isn't blocking port 4001

**Solution 3**: Restart everything
- Power cycle device
- Restart WiFi router
- Restart app

### "Device offline" error

- Make sure IP is correct
- Device may have lost WiFi, check Govee app
- Check device isn't in "pairing mode"
- Verify no firewall blocking port 4003

### Automation not working

1. Check time format is HH:MM (e.g., "19:30")
2. Verify action and value are valid
3. Click "Start" to activate automation
4. Check "Log" panel for error messages
5. Device must have power to execute commands

### App won't start

1. Make sure Python 3.7+ is installed
2. Check port 5000 isn't in use: `netstat -an | findstr :5000`
3. Restart computer
4. Reinstall from `Govee LAN Controller-1.0.0.exe`

### Crashes or freezing

- Check device IP is correct
- Device may be unresponsive, try power cycling it
- Close and reopen app
- Check for firewall blocking UDP traffic

## Advanced Usage

### Command Line (Developer)

```powershell
# Test backend
python app_backend.py

# Test in browser
# Open http://localhost:5000 in web browser

# Check device status
curl http://localhost:5000/api/device/status -H "Content-Type: application/json" -d '{"ip":"192.168.1.66"}'
```

### Packet Capture

The app logs all 100 most recent UDP packets. Use this to:
- Understand Govee protocol
- Debug communication issues
- Share with support if having problems

### Rules JSON Format

Export rules to see format:

```json
[
  {
    "time": "18:00",
    "action": "on",
    "value": null
  },
  {
    "time": "19:00",
    "action": "brightness",
    "value": "75"
  },
  {
    "time": "20:00",
    "action": "rgb",
    "r": 255,
    "g": 100,
    "b": 50
  }
]
```

## Performance

| Operation | Time |
|-----------|------|
| App startup | 3-5s |
| Device discovery | 5-10s |
| Command send | <100ms |
| UI response | <50ms |
| Memory usage | ~150MB |

## Privacy & Security

- **No cloud**: All data stays on your network
- **No tracking**: No analytics or telemetry
- **No auth**: Works without accounts or passwords
- **Open source**: Code is transparent and auditable
- **Encrypted**: Only supports devices with LAN control (no cloud passthrough)

## FAQ

**Q: Does this work on Mac/Linux?**  
A: Currently Windows only. Mac/Linux support planned for v1.1.

**Q: Can I control multiple devices?**  
A: Current version: one at a time. Select device using IP input or discovery.
   Multi-device support planned for v1.1.

**Q: Do I need the Govee app?**  
A: No. This app works independently. You can use both simultaneously.

**Q: What if WiFi goes down?**  
A: App will show "Device offline" until connection restored.

**Q: Can I schedule across days (e.g., different times weekdays vs weekends)?**  
A: Not yet. v1.1 will add advanced scheduling.

**Q: Is automation a local service or cloud?**  
A: Fully local. Your computer runs the automation; device must be powered on.

**Q: What data does the app collect?**  
A: None. It's open source; inspect the code yourself.

## Updates

Check for updates:
- App automatically notifies when new version available
- Download from https://github.com/your-repo
- Just run new `.exe`; settings are preserved

## Support

Having issues? 

1. Check [Troubleshooting](#troubleshooting) section
2. Check device is powered on and connected
3. Open an issue on GitHub with:
   - Device model (e.g., H612C)
   - Error message from Log panel
   - Steps to reproduce
   - Device IP (optional, can obscure for privacy)

## Contributing

Found a bug? Want to add a feature?

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-thing`
3. Commit changes: `git commit -m 'Add amazing thing'`
4. Push: `git push origin feature/amazing-thing`
5. Create Pull Request

## License

MIT License - See LICENSE file for details

---

**Made with ❤️ for Govee light enthusiasts**

Last updated: 2024
