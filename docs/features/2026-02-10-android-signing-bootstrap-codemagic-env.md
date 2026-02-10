<<<<<<< ours
# Android Signing Bootstrap (Codemagic-Compatible Env Fallback)
=======
# Android Signing Bootstrap (`OORE_ANDROID_*` Env Fallback)
>>>>>>> theirs

## Status

`superseded-by-ui-managed-profiles`

## Problem

<<<<<<< ours
The build runner could produce Android artifacts, but initially had no signing path. This bootstrap added Codemagic-compatible environment support as a migration bridge.

## User Impact

Operators can still inject Android signing material via environment variables using Codemagic-compatible names. Primary signing management now lives in pipeline-scoped UI/API profiles (`2026-02-10-pipeline-scoped-android-signing-ui.md`).
=======
The build runner could produce Android artifacts, but initially had no signing path. This bootstrap added environment-driven signing support as a migration bridge.

## User Impact

Operators can still inject Android signing material via environment variables using `OORE_ANDROID_*` names. Primary signing management now lives in pipeline-scoped UI/API profiles (`2026-02-10-pipeline-scoped-android-signing-ui.md`).
>>>>>>> theirs

## UI Changes

No direct UI change in this increment. This feature is now fallback-only.

## API Changes

No endpoint shape changes in this increment.

Runtime behavior changes in `oore-runner`:

- Detects Flutter Android build commands (`flutter build apk` / `flutter build appbundle`, including `fvm flutter` variants).
- Resolves signing input from environment:
<<<<<<< ours
  - `CM_KEYSTORE_PATH` or `CM_KEYSTORE` (base64)
  - `CM_KEYSTORE_PASSWORD`
  - `CM_KEY_ALIAS`
  - `CM_KEY_PASSWORD`
=======
  - `OORE_ANDROID_KEYSTORE_PATH` or `OORE_ANDROID_KEYSTORE_BASE64`
  - `OORE_ANDROID_KEYSTORE_PASSWORD`
  - `OORE_ANDROID_KEY_ALIAS`
  - `OORE_ANDROID_KEY_PASSWORD`
>>>>>>> theirs
- Materializes keystore + `android/key.properties` in the ephemeral workspace before build steps execute.
- Fails fast with actionable errors when Android signing is partially configured.

## Security Considerations

- Signing material is written only inside the per-build ephemeral workspace and removed during workspace cleanup.
- Secrets are not persisted in pipeline snapshots or written to source control.
- Partial/misconfigured signing input causes hard failure instead of silent unsigned output.

## Migration and Rollout

- No database migration required.
- Existing pipelines continue to run unchanged when signing env vars are absent.
- Preferred rollout is pipeline-scoped UI signing profiles.
<<<<<<< ours
- `CM_*` env values remain available only for compatibility/migration cases.

## Acceptance Criteria

- [x] Android signing env parsing supports Codemagic-compatible variables.
=======
- `OORE_ANDROID_*` env values are the fallback contract when UI-managed profiles are not configured.

## Acceptance Criteria

- [x] Android signing env parsing supports `OORE_ANDROID_*` variables.
>>>>>>> theirs
- [x] Runner generates `android/key.properties` + keystore file before Android build commands.
- [x] Missing required env values return clear errors.
- [x] Unit tests cover env parsing, command detection, and file materialization.

## Owner

Core backend

## Last Updated

`2026-02-10`
