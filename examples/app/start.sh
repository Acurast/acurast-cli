#!/bin/sh

# This script is executed when the container starts. It sets up the environment and runs the main application.

# Set up environment variables and configurations - TODO: This should be part of the processor application and not be required in the future.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root

echo "nameserver 8.8.8.8" > /etc/resolv.conf

# Install necessary dependencies and run the main application
apt-get update
apt-get install -y python3-requests
python3 "$(dirname "$0")/hello.py"
