# Session Persistence

## Status

`ready`

## Problem

Sessions were stored in an in-memory HashMap and lost on every daemon restart, forcing users to re-authenticate after any process restart, deploy, or crash.

## User Impact

All authenticated users benefit. Sessions now survive daemon restarts, so users stay logged in across process boundaries. Session tokens are stored alongside user records in SQLite, with automatic expiry cleanup.

## UI Changes

No visible UI changes. The frontend auth store now uses `localStorage` (instead of `sessionStorage`) for auth tokens so they survive tab close. Per-instance isolation is maintained via `oore_auth_token_{instanceId}` keys.

## API Changes

- `POST /v1/auth/logout` — unchanged contract, now backed by SQLite delete instead of HashMap remove.
- `GET /v1/auth/oidc/callback` — response now includes `user_id` and `role` in the `user` object.
- `SessionStore` is now `SQLitePool`-backed; concurrency is handled by the pool rather than a `Mutex`.

## Security Considerations

- Session tokens are SHA-256 hashed before storage (same as before).
- Sessions are scoped to a `user_id` (FK with ON DELETE CASCADE) — disabling a user cascades to session revocation.
- `validate_session` joins with `users` and checks `status = 'active'`, so disabled users are immediately locked out.
- Expired sessions are periodically cleaned up via `cleanup_expired`.

## Migration and Rollout

- Migration `002_users_sessions_audit.sql` adds the `sessions` table.
- On startup, `ensure_owner_user()` backfills the owner row for pre-migration instances.
- No backward-compatibility concerns — in-memory sessions were transient by nature.

## Acceptance Criteria

- [x] Sessions table created by migration 002
- [x] `SessionStore` backed by SQLite with `create_session`, `validate_session`, `revoke_session`, `cleanup_expired`
- [x] `validate_session` joins with users for role + status check
- [x] `revoke_user_sessions` cascades session cleanup on user disable
- [x] Frontend auth store uses localStorage with per-instance isolation

## Owner

Core platform team

## Last Updated

`2026-02-06`
