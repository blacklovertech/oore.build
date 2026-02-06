# RBAC and User Management

## Status

`ready`

## Problem

The platform had no user management or role-based access control. Only the owner could interact with the system, and there was no way to invite team members or restrict access to resources.

## User Impact

Owners and admins can now invite users, assign roles, and disable accounts. Four roles are defined: **owner** (full control), **admin** (manage users and all resources), **developer** (manage projects, pipelines, builds, artifacts; read runners), and **qa_viewer** (read-only access to projects, pipelines, builds, artifacts).

## UI Changes

- **Login page** (`/login`) — initiates OIDC flow for post-setup authentication.
- **Auth callback** (`/auth/callback`) — handles OIDC redirect, stores session token.
- **User management page** (`/settings/users`) — visible to owner/admin only. Lists all users, allows inviting by email + role, changing roles, and disabling accounts.
- **Header** — shows current user email and sign-out button. Adds "Users" nav link for admin roles.
- **Dashboard** — redirects to `/login` when instance is configured but user is not authenticated.

## API Changes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/v1/users/me` | any authenticated | Current user profile |
| GET | `/v1/users` | owner, admin | List all users |
| POST | `/v1/users/invite` | owner, admin | Invite user (email + role) |
| PATCH | `/v1/users/{user_id}/role` | owner, admin | Change role (owner immutable) |
| DELETE | `/v1/users/{user_id}` | owner, admin | Soft-delete (status=disabled, cascade sessions) |

All endpoints use the `AuthUser` Axum extractor and Casbin RBAC checks.

## Security Considerations

- RBAC enforced via Casbin with embedded model and policy files.
- `AuthUser` extractor validates bearer tokens on every request.
- Owner role cannot be changed or disabled.
- Users cannot disable their own account.
- Invited users have a placeholder `oidc_subject` until first OIDC login, at which point they are activated.
- Unknown OIDC identities (no matching user record) are rejected with 403.
- All security-relevant actions (invite, role change, disable, activation) are written to the `audit_logs` table.

## Migration and Rollout

- Migration `002_users_sessions_audit.sql` creates `users`, `sessions`, and `audit_logs` tables.
- Owner user is inserted into `users` table during `complete_setup`.
- `ensure_owner_user()` backfills for existing instances on startup.
- Casbin model and policy are embedded in the binary via `include_str!()`.

## Acceptance Criteria

- [x] Users table with role and status constraints
- [x] Owner created on setup completion
- [x] Casbin RBAC with V1 permission matrix
- [x] AuthUser extractor for Axum handlers
- [x] User management endpoints (CRUD + invite)
- [x] Audit logging for all user management actions
- [x] Frontend login flow with OIDC
- [x] User management UI for admins
- [x] Auth store with per-instance isolation

## Owner

Core platform team

## Last Updated

`2026-02-06`
