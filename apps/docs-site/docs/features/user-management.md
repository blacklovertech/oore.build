# User Management

oore.build provides a built-in user management system that lets instance owners and admins invite team members, assign roles, and control access.

## Overview

After [setup is complete](/features/setup-wizard), the instance owner can invite additional users from the **Settings > Users** page. Invited users authenticate via the configured [OIDC provider](/features/oidc-authentication) on their first login, which activates their account.

::: info
User management requires the `owner` or `admin` role. See [Roles and Permissions](/features/rbac) for the full permission matrix.
:::

## User Lifecycle

```
                         ┌──────────────────────────────┐
                         │                              │
  Invite ──> invited ──[OIDC login]──> active ──[disable]──> disabled
                                         ^                      │
                                         │                      │
                                         └────[re-enable]───────┘
```

| Status | Description |
|--------|-------------|
| `invited` | User has been invited but has not yet logged in via OIDC |
| `active` | User has authenticated and can access the platform |
| `disabled` | User account is suspended; all sessions are revoked |

### Invite Flow

1. An owner or admin enters the user's email and selects a role on the Users page
2. The backend creates a user record with `status = 'invited'` and a placeholder OIDC subject
3. When the invited user logs in via OIDC for the first time, the backend matches them by email, sets their `oidc_subject`, and transitions them to `active`
4. If an unknown OIDC identity attempts to log in (no matching user record), the login is rejected with `403 Forbidden`

### Disabling a User

- Disabling a user sets their status to `disabled` and immediately revokes all active sessions
- Disabled users cannot log in until re-enabled
- The owner account cannot be disabled
- Only the owner can disable admin users
- A confirmation dialog is shown before disabling to prevent accidental actions

### Re-enabling a User

- Disabled users can be re-enabled by an owner or admin, restoring `active` status
- Re-enabling does not create a new session; the user must log in again via OIDC
- Only the owner can re-enable admin users

## Settings UI

The user management page is accessible at `/settings/users` for users with the `owner` or `admin` role. The header navigation shows a "Users" link for eligible roles.

### User Table

The table displays all users with their email, role, status, and available actions.

| Column | Description |
|--------|-------------|
| **Email** | User's email address. Shows "(you)" next to the current user. |
| **Role** | Dropdown to change role (disabled for: owner, self, disabled users) |
| **Status** | `active` (green), `invited` (blue), or `disabled` (muted) |
| **Actions** | Context-dependent: Disable, Enable, or none |

### Action Rules

| User status | User role | Is self? | Actions shown |
|-------------|-----------|----------|---------------|
| active/invited | owner | any | (none) |
| active/invited | non-owner | yes | (none) |
| active/invited | non-owner | no | Disable button |
| disabled | any non-owner | no | Enable button |
| disabled | any | yes | (none) |

### Confirmation Dialogs

Destructive or impactful actions require confirmation before executing:

- **Disable**: Shows a confirmation dialog explaining that all active sessions will be revoked. Uses a destructive (red) button style.
- **Role change**: Shows a confirmation dialog when the role dropdown selection changes. Uses a default button style.
- **Enable**: Fires immediately (non-destructive action, no confirmation needed).

### Feedback

After any action completes, a feedback alert appears above the user table:

- **Success** (green): "Role updated for user@example.com", "user@example.com has been disabled", "user@example.com has been re-enabled", "user@example.com invited"
- **Error** (red): Displays the error message from the API
- Alerts auto-dismiss after 5 seconds

## API Endpoints

See the [Users API reference](/api/users) for full endpoint documentation.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/users/me` | Current user profile |
| `GET` | `/v1/users` | List all users |
| `POST` | `/v1/users/invite` | Invite a new user |
| `PATCH` | `/v1/users/{user_id}/role` | Change a user's role |
| `DELETE` | `/v1/users/{user_id}` | Disable a user (soft-delete) |
| `POST` | `/v1/users/{user_id}/enable` | Re-enable a disabled user |

## Audit Logging

All user management actions are recorded in the audit log:

| Action | Trigger |
|--------|---------|
| `user_invited` | A new user is invited |
| `role_changed` | A user's role is changed |
| `user_disabled` | A user is disabled |
| `user_enabled` | A disabled user is re-enabled |
| `user_activated` | An invited user logs in for the first time |

Audit log entries include the acting user's ID, the target user, and relevant details (e.g., old and new roles).
