#!/bin/sh
set -e

echo "[entrypoint] running npm install..."
npm install

exec "$@"
