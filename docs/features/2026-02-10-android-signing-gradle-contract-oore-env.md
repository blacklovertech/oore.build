# Android Signing Gradle Contract (`OORE_ANDROID_*`)

## Status

`ready`

## Problem

Android signing behavior was not explicit enough for operators and app teams. Existing guidance did not clearly document a product-owned env contract or how oore.build signals CI signing context to Gradle.

## User Impact

Teams now have a single oore.build-native contract for Android signing variables and copy-paste Gradle examples for both Groovy and Kotlin DSL builds.

## UI Changes

No UI surface changes.

## API Changes

No API shape changes.

Runner execution behavior now guarantees:

- `OORE_ANDROID_*` variable names for Android signing environment context.
- `CI=true` default injection when `CI` is not already defined by pipeline env.
- structured signing-preparation log marker (`android_signing_prepared`) with source, variant, file paths, and overwrite flags.

## Security Considerations

- Secrets are still materialized only inside ephemeral build workspaces.
- `render_step_env_preview` masks sensitive values (`*PASSWORD*`, `*TOKEN*`, etc.) in logs.
- Signing-preparation log marker excludes secret values and reports only non-secret metadata (paths/booleans/source/variant).

## Migration and Rollout

- Removed third-party env naming fallback from runner env resolution in favor of `OORE_ANDROID_*`.
- Standardized docs and roadmap references to `OORE_ANDROID_*`.
- Added docs-site page: `apps/docs-site/docs/features/android-signing.md`.

## Acceptance Criteria

- [x] Runner resolves Android env signing via `OORE_ANDROID_*` only.
- [x] Build env includes `CI=true` when unset by pipeline env.
- [x] Build logs include explicit signing-preparation marker when signing is applied.
- [x] Docs site includes Groovy and Kotlin DSL signing config examples using `OORE_ANDROID_*`.

## Owner

Core backend + docs

## Last Updated

`2026-02-10`
