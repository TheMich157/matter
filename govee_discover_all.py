import json, socket, struct, time

MCAST_GRP = "239.255.255.250"
SCAN_PORT = 4001
RECV_PORT = 4002

def local_ipv4s():
    ips = set()
    host = socket.gethostname()
    for info in socket.getaddrinfo(host, None, socket.AF_INET):
        ip = info[4][0]
        if not ip.startswith("127."):
            ips.add(ip)
    # also include any IPs discovered via UDP trick
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    return sorted(ips)

def try_iface(local_ip: str, timeout=4.0):
    print(f"\n=== Trying interface {local_ip} ===")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

    # listen for replies on 4002
    sock.bind(("0.0.0.0", RECV_PORT))
    sock.settimeout(0.4)

    # join multicast on THIS interface
    mreq = socket.inet_aton(MCAST_GRP) + socket.inet_aton(local_ip)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

    scan_msg = {"msg": {"cmd": "scan", "data": {"account_topic": "reserve"}}}
    data = json.dumps(scan_msg).encode("utf-8")

    # force multicast out of this interface
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(local_ip))
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)

    # send scan
    sock.sendto(data, (MCAST_GRP, SCAN_PORT))
    sock.sendto(data, ("255.255.255.255", SCAN_PORT))  # broadcast fallback

    found = []
    end = time.time() + timeout
    while time.time() < end:
        try:
            pkt, addr = sock.recvfrom(65535)
        except socket.timeout:
            continue

        ip = addr[0]
        txt = pkt.decode("utf-8", errors="ignore")
        try:
            obj = json.loads(txt)
        except Exception:
            obj = {"raw": txt}

        print(f"Reply from {ip}:{addr[1]}\n{json.dumps(obj, indent=2, ensure_ascii=False)}\n")
        found.append(obj)

    sock.close()
    return found

if __name__ == "__main__":
    ips = local_ipv4s()
    print("Local IPv4s detected:", ips)

    any_found = False
    for ip in ips:
        res = try_iface(ip)
        if res:
            any_found = True

    if not any_found:
        print("\nNo replies on UDP 4002.")
        print("Most common causes: Windows firewall, AP isolation/guest Wi-Fi, or router blocks multicast.")
