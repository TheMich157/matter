import traceback

try:
    import app_backend
    app = app_backend.app
    client = app.test_client()
    resp = client.post('/api/device/status', json={'ip': '192.168.1.66'})
    print('STATUS', resp.status_code)
    print(resp.get_data(as_text=True))
except Exception:
    traceback.print_exc()
