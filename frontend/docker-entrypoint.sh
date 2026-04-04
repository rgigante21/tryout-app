#!/bin/sh
set -e

# If node_modules is empty (fresh named volume), install dependencies.
# This handles: new machines, pruned volumes, architecture changes.
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[entrypoint] node_modules missing or empty — running npm install..."
  npm install
else
  # Check if package-lock.json is newer than the install marker.
  # This catches dependency changes without a full rebuild.
  if [ "package-lock.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
    echo "[entrypoint] package-lock.json changed — running npm install..."
    npm install
  fi
fi

exec "$@"
