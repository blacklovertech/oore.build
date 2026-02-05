# Frontend File-Router Foundation

## Status

`ready`

## Problem

The frontend needed a clear, repeatable foundation using TanStack file-based routing instead of ad hoc setup.

## User Impact

Developers get a predictable app baseline for both product UI and docs site, aligned with routing and toolchain decisions.

## UI Changes

Introduced base app shells for `apps/web` and `apps/docs-site` generated from TanStack file-router template.

## API Changes

No API changes in this feature.

## Security Considerations

No auth or token behavior changes. This is project scaffolding only.

## Migration and Rollout

No migration required. New repository baseline.

## Acceptance Criteria

- [x] `apps/web` is generated with file-based routing.
- [x] `apps/docs-site` is generated with file-based routing.
- [x] Root scripts can run dev/build for both apps.

## Owner

Core platform

## Last Updated

`2026-02-06`
