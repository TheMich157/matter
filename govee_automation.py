import json
import time
from datetime import datetime, date
from govee_lan import GoveeLAN

RULES_FILE = "rules.json"
POLL_SECONDS = 1.0

def load_rules():
    with open(RULES_FILE, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    return cfg["device_ip"], cfg.get("rules", [])

def run_action(dev: GoveeLAN, rule: dict):
    action = rule["action"]

    if action == "on":
        dev.on()
    elif action == "off":
        dev.off()
    elif action == "brightness":
        dev.brightness(int(rule["value"]))
    elif action == "rgb":
        dev.rgb(int(rule["r"]), int(rule["g"]), int(rule["b"]))
    else:
        raise ValueError(f"Unknown action: {action}")

def main():
    ip, rules = load_rules()
    dev = GoveeLAN(ip)

    # aby sa to nespúšťalo 60x počas tej istej minúty
    last_run = {}  # key=(rule_index, yyyy-mm-dd) -> "HH:MM"

    print(f"[Automation] Running for device {ip} (UDP 4003)")
    print(f"[Automation] Loaded {len(rules)} rules from {RULES_FILE}")

    while True:
        now = datetime.now()
        hm = now.strftime("%H:%M")
        today = date.today().isoformat()

        # hot-reload rules každých pár sekúnd (jednoduché)
        try:
            ip_new, rules = load_rules()
            if ip_new != dev.ip:
                dev.set_ip(ip_new)
        except Exception:
            pass

        for idx, rule in enumerate(rules):
            if rule.get("type") != "daily":
                continue

            if rule.get("time") == hm:
                key = (idx, today)
                if last_run.get(key) == hm:
                    continue

                try:
                    run_action(dev, rule)
                    print(f"[{now.strftime('%H:%M:%S')}] OK -> {rule}")
                except Exception as e:
                    print(f"[{now.strftime('%H:%M:%S')}] FAIL -> {rule} | {e}")

                last_run[key] = hm

        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()
