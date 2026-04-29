#!/bin/sh
set -eu

echo "hello from cargo runtime"

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Hi from shell!\"}" \
  https://webhook.watch/api/res/ca65f4f1-da64-4c5e-8a95-0122173ccd2c
