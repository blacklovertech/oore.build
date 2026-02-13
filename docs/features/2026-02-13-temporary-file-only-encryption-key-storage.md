# Temporary File-Only Encryption Key Storage

## Status

`ready`

## Problem

macOS keychain prompts during first-run onboarding were interrupting setup and creating trust friction for new operators. In remote-shell and unattended install scenarios, this also caused setup pauses at a critical first-use moment.

## User Impact

Instance encryption key storage is temporarily file-only for this release. Operators no longer encounter keychain permission prompts for daemon startup encryption-key handling.

## UI Changes

- Removed key-storage mode controls from **Settings → Preferences**.
- Preferences now focuses on artifact storage settings only.

## API Changes

- `PUT /v1/settings/preferences` now accepts only `key_storage_mode=file`.
- Requests with `key_storage_mode=keychain` return `400` with error code `unsupported_key_storage_mode`.
- `GET /v1/settings/preferences` reports `key_storage_mode=file` for this release.

## Security Considerations

- Encryption key remains stored locally at rest with strict file permissions (`0600`).
- This change removes keychain-mediated access control for encryption key retrieval until keychain UX is redesigned.

## Migration and Rollout

- No data migration required.
- Existing instances configured for keychain mode will operate in file mode after upgrade.
- Installer and troubleshooting docs now describe file-based key handling and permission recovery.

## Acceptance Criteria

- [x] Daemon startup no longer depends on keychain availability for runtime key loading.
- [x] Preferences UI no longer exposes keychain/file mode toggle.
- [x] Invalid keychain preference updates fail with deterministic API error.

## Owner

oore.build core team

## Last Updated

`2026-02-13`
