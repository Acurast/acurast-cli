#!/bin/sh

echo "=== Setting up environment ==="

apt-get update

if ! command -v curl >/dev/null 2>&1; then
    apt-get install -y curl
fi

SCRIPT_DIR="$(dirname "$0")"
GETIFADDRS_OVERRIDE_SO=/usr/local/lib/libgetifaddrs_override.so

. "$SCRIPT_DIR/callback.sh"

send_log "Setting up environment"

if ! command -v dropbear >/dev/null 2>&1; then
    apt-get install -y dropbear
fi

if ! python3 -c "import cryptography" >/dev/null 2>&1; then
    apt-get install -y python3 python3-cryptography
fi

if [ ! -f "$GETIFADDRS_OVERRIDE_SO" ]; then
    echo "=== Building getifaddrs override shim ==="
    apt-get install -y gcc libc6-dev
    mkdir -p "$(dirname "$GETIFADDRS_OVERRIDE_SO")"
    gcc -shared -fPIC -o "$GETIFADDRS_OVERRIDE_SO" "$SCRIPT_DIR/getifaddrs_override.c"
    echo "=== Shim built ==="
fi

mkdir -p /etc/profile.d
echo "export LD_PRELOAD=$GETIFADDRS_OVERRIDE_SO" > /etc/profile.d/ifaddrs-shim.sh

env | sed 's/^/export /' > /etc/profile.d/acurast-env.sh

echo "root:${SSH_PASSWORD:-password}" | chpasswd

# Install the authorized SSH public key, if provided. Password auth stays
# enabled so either method works.
if [ -n "$SSH_AUTHORIZED_KEY" ]; then
    mkdir -p /root/.ssh
    chmod 700 /root/.ssh
    echo "$SSH_AUTHORIZED_KEY" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    send_log "Authorized SSH key installed"
fi

mkdir -p /etc/dropbear
dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key 2>/dev/null || true
dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key 2>/dev/null || true

echo "=== SSH server starting on port 2222 ==="
send_log "Local SSH server starting on port 2222"

dropbear -F -E -p 2222 -R &
DROPBEAR_PID=$!

echo "=== Web server starting on port 8080 ==="
send_log "Local web server starting on port 8080"

# Static web page served over the PRIMARY (ACME) tunnel. The tunnel terminates
# user-facing TLS and forwards plaintext HTTP here, so a plain http.server is fine.
python3 -m http.server 8080 --bind 127.0.0.1 --directory "$SCRIPT_DIR/www" &
WEB_PID=$!

trap 'kill $DROPBEAR_PID $WEB_PID $TUNNEL_PID 2>/dev/null' INT TERM EXIT

send_log "Local services ready (web on 8080, SSH on 2222), starting Acurast reverse tunnel"

python3 "$SCRIPT_DIR/tunnel.py" &
TUNNEL_PID=$!

wait $TUNNEL_PID
TUNNEL_EXIT=$?

if [ $TUNNEL_EXIT -ne 0 ]; then
    echo "ERROR: tunnel exited with status $TUNNEL_EXIT"
    report_error "tunnel exited with status $TUNNEL_EXIT"
    exit $TUNNEL_EXIT
fi

wait $DROPBEAR_PID
