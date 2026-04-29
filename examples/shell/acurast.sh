#!/bin/sh
set -eu

echo "hello from cargo runtime"
echo "deployment id: ${DEPLOYMENT_ID:-unset}"
echo "bridge socket: ${BRIDGE_SOCKET:-unset}"
uname -a

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d "{\"deploymentId\":\"${DEPLOYMENT_ID:-unset}\"}" \
  https://webhook.watch/api/res/ca65f4f1-da64-4c5e-8a95-0122173ccd2c
