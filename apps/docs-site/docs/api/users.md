# Users API

The Users API handles user management operations: listing users, inviting new users, updating roles, disabling accounts, and re-enabling disabled accounts.

All endpoints require a valid user session token and appropriate [RBAC permissions](/features/rbac).

For the feature overview, see the [User Management](/features/user-management) documentation.

## Current User Profile {#get-me}

Retrieve the authenticated user's profile.

```
GET /v1/users/me
```

**Authentication**: User session token (Bearer)

**Permission**: Any authenticated user

### Response `200 OK`

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "display_name": "User Name",
    "role": "developer",
    "status": "active",
    "created_at": 1738800000,
    "updated_at": 1738800000
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user.id` | `string` | User UUID |
| `user.email` | `string` | Email address |
| `user.display_name` | `string \| null` | Display name (may be null) |
| `user.role` | `string` | One of: `owner`, `admin`, `developer`, `qa_viewer` |
| `user.status` | `string` | One of: `active`, `disabled`, `invited` |
| `user.created_at` | `integer` | Unix timestamp |
| `user.updated_at` | `integer` | Unix timestamp |

### Example

::: code-group
```bash [curl]
curl http://127.0.0.1:8787/v1/users/me \
  -H "Authorization: Bearer <session_token>"
```
:::

---

## List Users {#list-users}

List all users in the instance. Ordered by creation time (ascending).

```
GET /v1/users
```

**Authentication**: User session token (Bearer)

**Permission**: `users:read` (owner, admin)

### Response `200 OK`

```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "owner@example.com",
      "display_name": "Owner",
      "role": "owner",
      "status": "active",
      "created_at": 1738800000,
      "updated_at": 1738800000
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "email": "dev@example.com",
      "display_name": null,
      "role": "developer",
      "status": "invited",
      "created_at": 1738886400,
      "updated_at": 1738886400
    }
  ]
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `missing_auth` | Authorization header not provided |
| 401 | `invalid_session` | Invalid or expired session token |
| 403 | `forbidden` | Insufficient permissions |

### Example

::: code-group
```bash [curl]
curl http://127.0.0.1:8787/v1/users \
  -H "Authorization: Bearer <session_token>"
```
:::

---

## Invite User {#invite-user}

Invite a new user by email. The user is created with `status = 'invited'` and must authenticate via OIDC to activate their account.

```
POST /v1/users/invite
```

**Authentication**: User session token (Bearer)

**Permission**: `users:invite` (owner, admin)

### Request Body

```json
{
  "email": "newuser@example.com",
  "role": "developer"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | `string` | Yes | Email address (must contain `@`, max 256 chars) |
| `role` | `string` | Yes | One of: `admin`, `developer`, `qa_viewer`. Cannot invite as `owner`. |

### Response `200 OK`

```json
{
  "user": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "email": "newuser@example.com",
    "display_name": null,
    "role": "developer",
    "status": "invited",
    "created_at": 1738886400,
    "updated_at": 1738886400
  }
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_email` | Email is empty, missing `@`, or exceeds 256 characters |
| 400 | `invalid_role` | Role is not one of `admin`, `developer`, `qa_viewer` |
| 401 | `missing_auth` | Authorization header not provided |
| 401 | `invalid_session` | Invalid or expired session token |
| 403 | `forbidden` | Insufficient permissions |
| 409 | `email_exists` | A user with this email already exists |

### Example

::: code-group
```bash [curl]
curl -X POST http://127.0.0.1:8787/v1/users/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session_token>" \
  -d '{"email": "newuser@example.com", "role": "developer"}'
```
:::

---

## Update User Role {#update-user-role}

Change a user's role. Cannot change the owner's role. Only the owner can promote to or demote from `admin`.

```
PATCH /v1/users/{user_id}/role
```

**Authentication**: User session token (Bearer)

**Permission**: `users:write` (owner, admin)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | `string` | UUID of the target user |

### Request Body

```json
{
  "role": "admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | `string` | Yes | New role: `admin`, `developer`, or `qa_viewer` |

### Response `200 OK`

```json
{
  "user": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "dev@example.com",
    "display_name": "Developer",
    "role": "admin",
    "status": "active",
    "created_at": 1738886400,
    "updated_at": 1738890000
  }
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_role` | Role is not one of `admin`, `developer`, `qa_viewer` |
| 401 | `missing_auth` | Authorization header not provided |
| 401 | `invalid_session` | Invalid or expired session token |
| 403 | `forbidden` | Insufficient permissions (e.g., non-owner trying to promote to admin) |
| 403 | `cannot_change_owner` | The owner role cannot be changed |
| 404 | `user_not_found` | User does not exist |

### Example

::: code-group
```bash [curl]
curl -X PATCH http://127.0.0.1:8787/v1/users/660e8400-.../role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session_token>" \
  -d '{"role": "admin"}'
```
:::

---

## Disable User {#disable-user}

Soft-delete (disable) a user. Sets their status to `disabled` and revokes all active sessions. The user cannot log in until re-enabled.

```
DELETE /v1/users/{user_id}
```

**Authentication**: User session token (Bearer)

**Permission**: `users:delete` (owner, admin)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | `string` | UUID of the target user |

### Guards

- Cannot disable yourself
- Cannot disable the owner
- Only the owner can disable admin users

### Response `200 OK`

```json
{
  "ok": true
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `cannot_delete_self` | You cannot disable your own account |
| 401 | `missing_auth` | Authorization header not provided |
| 401 | `invalid_session` | Invalid or expired session token |
| 403 | `forbidden` | Insufficient permissions |
| 403 | `cannot_delete_owner` | The owner account cannot be disabled |
| 404 | `user_not_found` | User does not exist |

### Example

::: code-group
```bash [curl]
curl -X DELETE http://127.0.0.1:8787/v1/users/660e8400-... \
  -H "Authorization: Bearer <session_token>"
```
:::

---

## Re-enable User {#re-enable-user}

Re-enable a disabled user. Sets their status back to `active`. The user must log in again via OIDC (no session is created automatically).

```
POST /v1/users/{user_id}/enable
```

**Authentication**: User session token (Bearer)

**Permission**: `users:enable` (owner, admin)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | `string` | UUID of the target user |

### Guards

- Cannot enable yourself
- Cannot enable the owner (owner is always active)
- Only the owner can re-enable admin users
- Target user must be in `disabled` status (returns 409 if not)

### Response `200 OK`

```json
{
  "user": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "dev@example.com",
    "display_name": "Developer",
    "role": "developer",
    "status": "active",
    "created_at": 1738886400,
    "updated_at": 1738890000
  }
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `cannot_enable_self` | You cannot re-enable your own account |
| 401 | `missing_auth` | Authorization header not provided |
| 401 | `invalid_session` | Invalid or expired session token |
| 403 | `forbidden` | Insufficient permissions |
| 403 | `cannot_enable_owner` | The owner account cannot be re-enabled this way |
| 404 | `user_not_found` | User does not exist |
| 409 | `not_disabled` | User is not currently disabled |

### Example

::: code-group
```bash [curl]
curl -X POST http://127.0.0.1:8787/v1/users/660e8400-.../enable \
  -H "Authorization: Bearer <session_token>"
```
:::
