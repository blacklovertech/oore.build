# Pipeline-Scoped Android Signing Profiles (UI + API)

## Status

`ready`

## Problem

Environment-variable signing bootstrap was useful for quick setup but did not satisfy long-term operator needs. Teams need UI-managed Android signing profiles per pipeline, with support for separate debug/release signing assets.

## User Impact

Owners/admins can now configure Android signing directly from pipeline create/edit flows. Each pipeline can maintain separate debug and release signing profiles, including uploaded JKS files and key credentials.

## UI Changes

- Pipeline create dialog now includes Android signing profile configuration.
- Pipeline edit dialog now loads existing signing profile metadata and supports updating keystores/passwords.
- Pipeline detail page now shows signing status summary for debug/release profiles.

## API Changes

Added endpoints:

- `GET /v1/pipelines/{pipeline_id}/android-signing`
- `PUT /v1/pipelines/{pipeline_id}/android-signing`
- `GET /v1/runners/{runner_id}/jobs/{job_id}/android-signing` (runner-auth only)

Contract additions include:

- `UpdatePipelineAndroidSigningRequest`
- `PipelineAndroidSigningResponse`
- `RunnerAndroidSigningResponse`

Runner behavior:

- Runner resolves Android build variant (debug/release) from build commands.
- Runner fetches pipeline signing profile for assigned job and materializes `android/key.properties` + keystore file in ephemeral workspace.
<<<<<<< ours
- Existing env-based `CM_*` signing remains as fallback when no pipeline profile is configured.
=======
- Existing env-based `OORE_ANDROID_*` signing remains as fallback when no pipeline profile is configured.
>>>>>>> theirs

## Security Considerations

- JKS payload and signing credentials are encrypted at rest in SQLite (`pipeline_android_signing_profiles`).
- Secrets are only decrypted for authorized UI reads (non-secret metadata) or runner-assigned job retrieval.
- Runner job signing endpoint enforces runner-token ownership of the assigned build.
- Signing assets are materialized only in ephemeral job workspaces and removed during cleanup.

## Migration and Rollout

- Added migration `013_pipeline_android_signing.sql`.
- No breaking API changes to existing pipeline endpoints.
- Existing pipelines continue working without signing profiles.
- Pipeline UI can incrementally add signing per pipeline without infrastructure-level env changes.

## Acceptance Criteria

- [x] UI supports per-pipeline debug/release Android signing configuration.
- [x] Backend stores keystore/password materials encrypted at rest.
- [x] Runner fetches signing profiles via authenticated runner endpoint for assigned jobs.
- [x] Integration tests cover API CRUD and runner retrieval behavior.

## Owner

Core backend + frontend

## Last Updated

`2026-02-10`
