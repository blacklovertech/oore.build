# Command-Center UI Redesign

## Status

`ready`

## Problem

Main app pages had inconsistent visual rhythm, card-heavy stacking, and uneven spacing patterns that slowed scan speed for operators. Multiple routes used list-as-card layouts where table/inventory patterns were better suited for CI operations.

## User Impact

- **Operators (owner/admin/developer/qa_viewer by role scope)** can scan Projects, Builds, Pipelines, Integrations, Users, and Runners faster with denser inventory surfaces.
- **Owners/Admins** keep the same management capabilities (users, runners, integrations) with improved layout consistency.
- **All authenticated users** get clearer metadata hierarchy on detail pages (builds, projects, pipelines, integrations) without behavior changes.

## UI Changes

- Refined shared shell/layout primitives:
  - `PageLayout` now enforces a denser, consistent spacing rhythm.
  - `PageHeader` now standardizes back link, title/description, action rail, and metadata row.
  - Sidebar navigation groups now use clear `Operations` and `Settings` sections.
- Reworked main app pages to command-center composition:
  - Dashboard (`/`) now provides operational overview and quick actions.
  - Projects and Builds list pages now use table-first inventory layouts.
  - Project and Pipeline detail pages now use structured sections/tables instead of nested card stacks.
  - Build detail page now presents metadata, logs, artifacts, and event timeline in a consistent panel model.
  - Integrations list/detail/setup pages now use structured management surfaces.
  - Users and Runners settings pages now align with the same density and section hierarchy.
- Removed route-level uneven card spacing anti-patterns (no ad-hoc vertical `CardContent` padding overrides in redesigned routes).

## API Changes

- None.
- Route paths and backend contracts are unchanged.

## Security Considerations

- No auth, RBAC, token, or backend behavior changes.
- Existing role gates remain enforced (admin-only settings routes unchanged).
- No new sensitive data exposure surfaces introduced.

## Migration and Rollout

- No schema migration required.
- No backend rollout coordination required.
- Frontend-only rollout; existing saved sessions, instance switching, and route URLs remain compatible.

## Acceptance Criteria

- [x] Main app operational routes use consistent command-center composition.
- [x] Table/list-heavy pages replace random card stacks for inventories.
- [x] Existing route behavior, role gating, and actions continue to work.
- [x] Shared layout/header components provide consistent rhythm across redesigned pages.
- [x] `apps/web` tests/build and full `make validate` pass.

## Owner

oore.build team

## Last Updated

`2026-02-09`
