import json
import socket
import sys

PORT = 4003

def send(ip: str, payload: dict, expect_reply: bool = False, timeout: float = 1.0):
    data = json.dumps(payload).encode("utf-8")
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)

    try:
        s.sendto(data, (ip, PORT))

        if expect_reply:
            pkt, _ = s.recvfrom(65535)
            return pkt.decode("utf-8", errors="ignore")
        return None

    except ConnectionResetError:
        # Windows may throw WinError 10054 on UDP; for Govee this can happen even if command works
        return None
    finally:
        s.close()

def cmd_turn(value: int):
    return {"msg": {"cmd": "turn", "data": {"value": int(value)}}}

def cmd_brightness(value: int):
    v = max(1, min(100, int(value)))
    return {"msg": {"cmd": "brightness", "data": {"value": v}}}

def cmd_rgb(r: int, g: int, b: int):
    r = max(0, min(255, int(r)))
    g = max(0, min(255, int(g)))
    b = max(0, min(255, int(b)))
    # most H61xx accept this "colorwc" format
    return {"msg": {"cmd": "colorwc", "data": {"color": {"r": r, "g": g, "b": b}}}}

def cmd_status():
    return {"msg": {"cmd": "devStatus", "data": {}}}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage:")
        print("  py govee_h612c.py <ip> on")
        print("  py govee_h612c.py <ip> off")
        print("  py govee_h612c.py <ip> brightness <1-100>")
        print("  py govee_h612c.py <ip> rgb <r> <g> <b>")
        print("  py govee_h612c.py <ip> status")
        sys.exit(1)

    ip = sys.argv[1]
    action = sys.argv[2].lower()

    if action == "on":
        send(ip, cmd_turn(1))
        print("Sent: ON")
    elif action == "off":
        send(ip, cmd_turn(0))
        print("Sent: OFF")
    elif action == "brightness" and len(sys.argv) >= 4:
        send(ip, cmd_brightness(int(sys.argv[3])))
        print("Sent: brightness")
    elif action == "rgb" and len(sys.argv) >= 6:
        send(ip, cmd_rgb(int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])))
        print("Sent: rgb")
    elif action == "status":
        reply = send(ip, cmd_status(), expect_reply=True)
        print("Reply:", reply if reply else "(no reply)")
    else:
        print("Invalid command.")
        sys.exit(1)
