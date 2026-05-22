import json
import os
import socket
import time

import requests

BRIDGE_SOCKET = os.environ["BRIDGE_SOCKET"]
WEBHOOK_URL = os.environ["WEBHOOK_URL"]


def get_public_key() -> str:
    request = json.dumps({
        "jsonrpc": "2.0",
        "method": "signer_publicKey",
        "params": [{"curve": "p256"}],
        "id": "1",
    }) + "\n"

    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.connect("\0" + BRIDGE_SOCKET)
        sock.sendall(request.encode())
        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk
            if b"\n" in chunk:
                break

    return json.loads(response)["result"]["publicKey"]


def main():

    time.sleep(3600)  # Wait for the bridge to be ready

    public_key = get_public_key()
    url = WEBHOOK_URL.rstrip("/") + "/hello"
    resp = requests.post(url, json={"publicKey": public_key})
    print(resp.status_code, resp.text)


if __name__ == "__main__":
    main()
