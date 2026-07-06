#!/bin/sh

send_callback() {
    if [ -z "$CALLBACK_URL" ]; then
        return
    fi
    curl -s -X POST "$CALLBACK_URL" \
        -H "Content-Type: application/json" \
        -d "$1"
}

report_error() {
    send_callback "{\"event\":\"error\",\"message\":\"${1}\"}"
}

send_log() {
    send_callback "{\"event\":\"log\",\"message\":\"${1}\"}"
}
