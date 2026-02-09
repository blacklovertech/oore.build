# Project and Pipeline Management UI

## Status

`ready`

## Problem

No web UI existed for project and pipeline lifecycle management. Operators had to use API calls or direct database access to configure projects and pipelines, making the platform inaccessible to non-technical team members and error-prone for all users. Without a visual interface, pipeline trigger and concurrency configurations were especially difficult to get right, leading to misconfiguration and wasted build cycles.

## User Impact

- **Developers and admins** can fully manage projects and pipelines through the web UI without API or database access.
- **Self-serve project creation** from connected repositories allows teams to onboard new projects independently.
- **Visual pipeline configuration** with trigger event checkboxes, branch pattern inputs, and concurrency settings reduces misconfiguration risk.
- **Form validation feedback** (including dry-run validation for pipeline configs) prevents invalid configurations before submission.
- **Role-appropriate actions** are enforced in the UI: `qa_viewer` users see read-only views, while `developer` and above get full CRUD controls.

## UI Changes

### Project List (`/projects`)

- Card-based list displaying project name, description, default branch, and relative update time.
- "New Project" action button (hidden for `qa_viewer` role).
- Empty state with a prompt to create the first project.
- Skeleton loading states while data is being fetched.

### Project Detail (`/projects/{id}`)

- Project info card showing name, description, default branch, created-by, and timestamps.
- Pipelines section with a list of associated pipelines and an "Add Pipeline" button.
- Recent builds section filtered to the project.
- Edit and Delete action buttons in the page header (role-gated).
- Delete confirmation with AlertDialog warning about the action.

### Pipeline Detail (`/projects/{pid}/pipelines/{id}`)

- Pipeline info card with enabled/disabled status badge.
- Trigger configuration card showing selected events and branch patterns.
- Concurrency policy card showing `cancel_previous` status and `max_concurrent` value.
- Recent builds section filtered to the pipeline.
- Enable/disable toggle, Edit, and Delete action buttons (role-gated).

### Create/Edit Dialogs

- **Project dialog**: name, description, repository selector (populated from connected integrations), and default branch.
- **Pipeline dialog**: name, config path, trigger event checkboxes (push, pull_request, tag_push), branch pattern input, concurrency settings (cancel_previous toggle, max_concurrent number).
- Form validation powered by react-hook-form and zod schemas.
- Pipeline config forms use the dry-run validation endpoint for server-side validation before submission.
- Toast notifications on success and error for all create/edit/delete operations.

### Navigation

- "Projects" entry added to the sidebar between Dashboard and Builds, visible to all authenticated roles.

## API Changes

None. This feature consumes the APIs defined in the Projects CRUD API and Pipelines CRUD API features.

## Security Considerations

- Role-gated navigation and action buttons: destructive actions (delete) and write actions (create, edit) are hidden from unauthorized roles.
- Delete confirmations via AlertDialog for all destructive actions, requiring explicit user confirmation.
- Form validation prevents submission of invalid data to the backend.
- Error messages displayed in the UI do not leak sensitive information (internal IDs, stack traces, or database details).

## Migration and Rollout

- New frontend routes added as navigation entries alongside existing pages.
- Sidebar navigation updated with the "Projects" entry.
- No backend changes required -- the UI consumes existing Phase 5 API endpoints.
- No feature flags or gradual rollout required.

## Acceptance Criteria

- [x] Project list, detail, create, edit, and delete flows work end-to-end
- [x] Pipeline list, detail, create, edit, and delete flows work end-to-end
- [x] Trigger configuration UI shows and edits events and branch patterns
- [x] Concurrency settings (cancel_previous, max_concurrent) are configurable in the UI
- [x] Pipeline enable/disable toggle works
- [x] Form validation shows inline errors for invalid inputs
- [x] Dark mode supported across all new pages and dialogs
- [x] Loading and error states handled with skeletons and error boundaries
- [x] Navigation updated with Projects entry in sidebar

## Owner

Phase 5 team

## Last Updated

`2026-02-08`
