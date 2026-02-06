# ADR-0002: RBAC Implementation Strategy

## Status

Accepted

## Date

2026-02-06

## Context

The platform contract (section 8) defines four V1 roles:

- `owner`: complete instance control and security settings.
- `admin`: full org/project control except owner-only actions.
- `developer`: manage repos/pipelines and trigger builds.
- `qa_viewer`: read builds and download/install allowed artifacts.

The contract (section 10) specifies `casbin-rs` as the RBAC policy layer. No resource endpoints (projects, pipelines, builds, artifacts, runners) exist yet — the backend currently only implements setup state machine endpoints which are gated by setup tokens and auto-disabled after `ready`.

This ADR documents two decisions: (1) the permission matrix for V1, and (2) when to wire `casbin-rs` into the codebase.

## Decision

### 1. V1 Permission Matrix

The following matrix governs role access to V1 resources:

| Resource | owner | admin | developer | qa_viewer |
|---|---|---|---|---|
| Instance settings (OIDC, security) | full | — | — | — |
| Users / role assignment | manage all | manage non-owner | — | — |
| Projects | CRUD | CRUD | read | read |
| Pipelines | CRUD | CRUD | CRUD | — |
| Builds | all | all | trigger, read, cancel | read |
| Artifacts | all | all | download | download (allowed only) |
| Runners | register, manage | register, manage | — | — |

"Allowed only" for `qa_viewer` artifacts means access is scoped to artifacts on builds/projects the viewer has been granted visibility to.

### 2. Implementation Timing: Alongside First Protected Resource

`casbin-rs` integration is deferred until the first resource CRUD endpoints are built (starting with `POST /v1/projects` and user management).

**Why not wire it now:**

- The only current auth enforcement is setup-token gating, which is owner-only by definition and auto-disables after `ready`. Casbin adds nothing here.
- Casbin policies are difficult to validate in the abstract — they need real endpoints and real request flows to test against.
- Writing enforcement middleware for endpoints that don't exist yet creates untested code and risks policy drift when the actual endpoints land.

**Why not defer it further (e.g., after all endpoints exist):**

- RBAC enforcement should be built into each endpoint from the start, not bolted on after the fact.
- Retrofitting authorization into existing endpoints risks security gaps during the window between "endpoint exists" and "RBAC enforced."

**Concrete trigger:** when work begins on any of the following, `casbin-rs` must be integrated first:

- `GET|POST /v1/projects`
- User/role management endpoints
- Any endpoint from contract section 16 (API baseline) beyond setup

### 3. Casbin Model Design (guidance for implementation)

Use an RBAC model with resource-level permissions:

```ini
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
```

Roles are assigned per-user at instance level (V1 is single-tenant). The policy CSV maps each role to its permitted `(resource, action)` pairs from the matrix above.

## Consequences

- No `casbin-rs` dependency is added until the first resource endpoint is built.
- The permission matrix above is the reference for all RBAC policy definitions.
- Every new resource endpoint must include casbin enforcement from its initial implementation — never add an unprotected endpoint with a plan to "add auth later."
- Setup endpoints remain gated by setup tokens (not casbin) since they operate outside the normal RBAC model.

## Contract References

- Section 8 (Roles and Permissions): defines the four roles — unchanged.
- Section 10 (Backend Technology Contract): `casbin-rs` — unchanged.
- Section 14 (Security Principles): "Least privilege by role and operation" — this ADR operationalizes that principle.
- Section 16 (API baseline): lists the endpoints that will trigger casbin integration.
