# Local CLI and File Config Hardening

## Status

`implemented`

## Problem

Local alpha validation exposed four reliability gaps:

- `oore setup token --daemon-url ...` could silently operate on the wrong setup DB.
- `oore status` existed as a contract command but was still a placeholder.
- file-first repo config (`.oore.yaml`) still injected default Flutter commands even when explicit repo `commands.build` were defined.
- install script `--help` was not handled and could trigger a full install unexpectedly.

## User Impact

- Operators now get explicit daemon/state mismatch errors before generating unusable setup tokens.
- `oore status` is now usable for quick instance health/mode checks.
- Repo-authored pipeline build commands can run as-is without forced default Flutter build injection.
- `scripts/install.sh --help` is safe and predictable.

## UI Changes

- No new screens.
- Build failures caused by missing default tooling now include a clearer runner error when shell returns exit code `127` (command not found), which improves troubleshooting in existing build detail UI.

## API Changes

- No API surface changes in this increment.

## Security Considerations

- Setup token generation now validates daemon-instance alignment and prevents accidental token issuance against unrelated local state.
- No auth relaxation or secret handling changes were introduced.

## Migration and Rollout

1. Ship CLI/runtime changes with existing command names unchanged.
2. Keep fallback behavior additive (repo file command override affects file-first execution only).
3. No DB migration required.

## Acceptance Criteria

- [x] `oore status` returns parsed setup status from daemon endpoint.
- [x] `oore setup token` fails fast on daemon/state instance mismatch.
- [x] File-first repo config honors explicit `commands.build` without adding default platform build commands.
- [x] Targeted iOS signing integration test regression is fixed.
- [x] `scripts/install.sh --help` prints usage and exits without install side effects.

## Owner

Platform team

## Last Updated

`2026-02-14`
