#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SCRIPT="$ROOT_DIR/scripts/install.sh"
TARGET_SCRIPT="$ROOT_DIR/apps/site/public/install"

if [[ ! -f "$SOURCE_SCRIPT" ]]; then
  echo "[sync-install] ERROR: source script not found: $SOURCE_SCRIPT" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_SCRIPT")"
cp "$SOURCE_SCRIPT" "$TARGET_SCRIPT"
chmod +x "$TARGET_SCRIPT"

echo "[sync-install] synced $TARGET_SCRIPT"
