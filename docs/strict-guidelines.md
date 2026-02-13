# Strict Guidelines

These rules are mandatory unless explicitly superseded by an ADR and contract update.

## Product and Scope

- V1 is Flutter-first with build targets: Android, iOS, macOS.
- V1 auth model is OIDC-only.
- Self-hosted backend is primary. Hosted offering at `ci.oore.build` is UI-only.
- Backend runtime support in V1 is macOS only.

## Bootstrap and Security

- Bootstrap setup token must be one-time and TTL-bound.
- Public setup endpoint must expose non-sensitive state only.
- Setup mutating endpoints must be disabled after `ready`.
- Break-glass recovery is opt-in runtime activation only.

## Commands and Runtime

- `oored` and `oore` command names are stable contract interfaces.
- `oored` is daemon/runtime surface.
- `oore` is operator setup/admin surface.

## Frontend Architecture

- Frontend and backend are strictly separated.
- TanStack Router file-based routing is mandatory.
- Next.js is not used in V1.
- TanStack Query handles server state.
- Zustand handles UI-local state only.
- Frontend must support multi-instance add/switch/remove with per-instance auth/session isolation.

## UI System

- shadcn must use Base UI primitives.
- Shared preset constraints must remain aligned between `apps/web` and `apps/docs-site`:
- `style: base-vega`
- `iconLibrary: hugeicons`
- `theme: amber`
- `baseColor: neutral`
- `menuAccent: subtle`
- `menuColor: default`
- `radius: none`
- `font: inter`

## API and OpenAPI Spec

- Every API endpoint must have a corresponding entry in the OpenAPI spec.
- When creating, updating, or removing endpoints in `crates/oored`, the OpenAPI export binary (`crates/oored/src/bin/openapi_export.rs`) must be updated in the same change.
- After updating the export binary, regenerate the spec with `make gen-openapi` and commit the updated `apps/docs-site/docs/public/openapi.json`.
- Request/response types in `crates/oore-contract/src/lib.rs` must derive `ToSchema`. New types require `#[derive(ToSchema)]`; fields using `serde_json::Value` require `#[schema(value_type = Object)]`.

## Documentation and Governance

- Every user-facing feature requires a doc in `docs/features/`.
- `docs/platform-contract.md` is the source of truth for finalized decisions.
- Static docs site framework is `VitePress` (`apps/docs-site/docs`).
- Changing finalized decisions requires:
- ADR entry
- contract update
- feature doc update
