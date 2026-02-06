# Roles and Permissions

oore.build uses role-based access control (RBAC) to govern what each user can do within an instance. Permissions are enforced on every authenticated API request using [Casbin](https://casbin.org/).

## Roles

Every user has exactly one role. Roles cannot be combined.

| Role | Description |
|------|-------------|
| `owner` | Full instance control. Created during [setup](/features/setup-wizard). Exactly one per instance. |
| `admin` | Manages users, projects, pipelines, builds, artifacts, and runners. Cannot modify the owner. |
| `developer` | Creates and manages projects, pipelines, and builds. Read-only access to runners. |
| `qa_viewer` | Read-only access to projects, pipelines, builds, and artifacts. |

### Owner Restrictions

- There is exactly one owner per instance (set during setup)
- The owner role cannot be changed or removed
- The owner account cannot be disabled
- Only the owner can promote/demote admin users

## Permission Matrix

Permissions follow a `resource:action` model. Each cell shows which roles have access.

| Resource | Action | Owner | Admin | Developer | QA Viewer |
|----------|--------|:-----:|:-----:|:---------:|:---------:|
| `instance_settings` | `read` | Y | Y | | |
| `instance_settings` | `write` | Y | | | |
| `users` | `read` | Y | Y | | |
| `users` | `write` | Y | Y | | |
| `users` | `invite` | Y | Y | | |
| `users` | `delete` | Y | Y | | |
| `users` | `enable` | Y | Y | | |
| `projects` | `read` | Y | Y | Y | Y |
| `projects` | `write` | Y | Y | Y | |
| `projects` | `delete` | Y | Y | | |
| `pipelines` | `read` | Y | Y | Y | Y |
| `pipelines` | `write` | Y | Y | Y | |
| `pipelines` | `delete` | Y | Y | | |
| `builds` | `read` | Y | Y | Y | Y |
| `builds` | `write` | Y | Y | Y | |
| `builds` | `cancel` | Y | Y | Y | |
| `artifacts` | `read` | Y | Y | Y | Y |
| `artifacts` | `write` | Y | Y | Y | |
| `artifacts` | `delete` | Y | Y | | |
| `runners` | `read` | Y | Y | Y | |
| `runners` | `write` | Y | Y | | |
| `runners` | `delete` | Y | Y | | |

## Enforcement

### Backend

Every authenticated endpoint extracts the caller's role from their session (via the `AuthUser` extractor) and checks it against the Casbin policy before processing the request. Unauthorized requests receive `403 Forbidden`:

```json
{
  "error": "You do not have permission to perform this action",
  "code": "forbidden"
}
```

### Frontend

The frontend uses the authenticated user's role to control UI visibility:

- The "Users" navigation link is only shown to `owner` and `admin` roles
- The `/settings/users` route redirects non-admin users to the dashboard
- Role change dropdowns and action buttons are conditionally rendered based on the caller's role and the target user's role

::: warning
Frontend role checks are for UX convenience only. The backend enforces all permissions regardless of what the frontend shows.
:::

## Role Assignment

- The **owner** role is automatically assigned to the first user created during [setup](/features/setup-wizard)
- New users are assigned a role at invite time by an owner or admin
- Roles can be changed after invite via the [Users page](/features/user-management) or the [API](/api/users#update-user-role)
- Users cannot change their own role
- Only the owner can assign or revoke the `admin` role

## Casbin Integration

The RBAC engine uses Casbin with a standard RBAC model:

- **Model**: Defines the request format `(sub, obj, act)` — subject (role), object (resource), action
- **Policy**: A CSV file mapping each role to its allowed resource/action pairs
- The enforcer is initialized once at startup and used for all permission checks
- Policy changes require a daemon restart in V1
