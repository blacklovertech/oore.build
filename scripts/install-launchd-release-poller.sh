#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/scripts/launchd/com.oore.release-poller.plist.template"
TARGET="$HOME/Library/LaunchAgents/com.oore.release-poller.plist"
LABEL="com.oore.release-poller"
RUNNER_PATH="$HOME/.cargo/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

log() {
  printf '[launchd-install] %s\n' "$*"
}

die() {
  printf '[launchd-install] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  if env PATH="$RUNNER_PATH" /bin/bash -c "command -v $cmd >/dev/null 2>&1"; then
    return 0
  fi
  die "Required command '$cmd' not found in PATH=$RUNNER_PATH"
}

[[ -f "$TEMPLATE" ]] || die "Template not found: $TEMPLATE"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

require_cmd git
require_cmd cargo
require_cmd bun
require_cmd wrangler
require_cmd curl
require_cmd unzip

sed \
  -e "s#__ROOT_DIR__#$ROOT_DIR#g" \
  -e "s#__HOME__#$HOME#g" \
  "$TEMPLATE" > "$TARGET"

chmod 644 "$TARGET"

if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
fi

launchctl bootstrap "gui/$UID" "$TARGET"
launchctl enable "gui/$UID/$LABEL"
launchctl kickstart -k "gui/$UID/$LABEL"

log "Installed and started $LABEL"
log "Logs: $HOME/Library/Logs/oore-release-poller.log"
