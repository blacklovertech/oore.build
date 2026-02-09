# Projects CRUD API

## Status

`ready`

## Problem

Prior to this phase, projects existed only as database schema with no API surface. Developers and admins had no self-serve way to create, view, update, or delete projects. Project setup required direct database manipulation or build-time parameter passing, making the platform inaccessible without backend access and blocking self-service project onboarding.

## User Impact

- **Developers and admins** can create projects linked to connected repositories, choosing a default branch and providing a description.
- **All authenticated roles** can view project lists and details. `qa_viewer` users have read-only access.
- **Owner and admin** users can delete projects, with a safeguard that blocks deletion when non-terminal builds exist.
- A full audit trail is maintained for project lifecycle actions (create, update, delete).
- Project list supports search and pagination for instances with many projects.

## UI Changes

- **Project list page** at `/projects` showing all projects with name and description. Includes a "New Project" action button (role-gated), skeleton loading states, and an empty state with a create prompt.
- **Project detail page** at `/projects/{id}` with project info (name, description, repository, default branch), a pipelines section with list and "Add Pipeline" button, and a recent builds section filtered to the project. Edit and Delete action buttons appear in the header.
- **Create project dialog** with fields for name, description, repository selector (from connected integrations), and default branch.
- **Edit project dialog** pre-filled with existing project data for updating details.
- **Delete project confirmation** using AlertDialog with warning about associated data.
- **Navigation** updated with "Projects" added to the sidebar between Dashboard and Builds.

## API Changes

New endpoints:

- `POST /v1/projects` -- Create a project. Request body includes `name` (string, required), `description` (string, optional), `repository_id` (string, optional, must reference a valid `integration_repositories` record if provided), and `default_branch` (string, optional). Returns the created project with `id`, timestamps, and linked repository info. RBAC: `projects:write`.
- `GET /v1/projects` -- List projects with optional query parameters: `search` (string, filters by name), `limit` (integer, default 50, max 200), `offset` (integer, default 0). Returns `{ "projects": [...], "total": <count> }`. RBAC: `projects:read`.
- `GET /v1/projects/{project_id}` -- Project detail including `pipeline_count` and `build_count` aggregates. RBAC: `projects:read`.
- `PATCH /v1/projects/{project_id}` -- Partial update of project fields (name, description, default_branch). Only provided fields are updated. RBAC: `projects:write`.
- `DELETE /v1/projects/{project_id}` -- Delete a project. Blocked with 409 Conflict if the project has any non-terminal builds (queued, scheduled, assigned, running). RBAC: `projects:delete`.

All endpoints require authentication. RBAC enforced per role:

- **owner/admin**: read, write, delete
- **developer**: read, write
- **qa_viewer**: read only

## Security Considerations

- RBAC enforcement via Casbin middleware on all project endpoints. Unauthorized requests receive 403 Forbidden.
- Audit logging for create, update, and delete operations with actor attribution.
- Delete protection: cannot delete a project with active (non-terminal) builds, preventing data loss from in-flight work.
- Repository validation: `repository_id` must reference a valid `integration_repositories` record. Invalid references are rejected with a 400 Bad Request and actionable error message.
- No sensitive data (credentials, tokens) is exposed in project responses. Repository info is limited to name, provider, and URL.

## Migration and Rollout

- No schema migration needed -- the `projects` table already exists from migration 005.
- New API endpoints are additive with no breaking changes to existing endpoints.
- Frontend routes are added as new navigation entries alongside existing build pages.
- No feature flags or gradual rollout required.

## Acceptance Criteria

- [x] Project create/list/detail/update/delete endpoints work for authorized roles
- [x] RBAC blocks unauthorized operations (qa_viewer cannot create or delete)
- [x] Audit log entries generated for create, update, and delete actions
- [x] Delete blocked when project has non-terminal builds
- [x] Invalid repository_id rejected with actionable error
- [x] Project list supports search and pagination
- [x] Project detail includes pipeline and build counts

## Owner

Phase 5 team

## Last Updated

`2026-02-08`
