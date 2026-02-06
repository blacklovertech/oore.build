# V1 Implementation Roadmap

Status: Active — tracks remaining work to V1 completion.
Last assessed: 2026-02-06

## Foundation (Complete)

These are done and passing `make validate`:

- [x] Setup bootstrap state machine (backend + CLI)
- [x] Setup wizard UI (4-step frontend)
- [x] OIDC auth with PKCE + session management
- [x] Multi-instance frontend with setup session isolation
- [x] SQLite store with embedded migrations (setup tables)
- [x] AES-256 secrets-at-rest encryption
- [x] OpenTelemetry tracing + Prometheus metrics
- [x] shadcn/Base UI component system
- [x] TanStack Router file-based routing
- [x] VitePress documentation site
- [x] Governance docs (contract, guidelines, policy, agents)
- [x] 14 feature docs, 3 ADRs
- [x] Makefile targets and `make validate` gate

### Implemented API Endpoints (9/25)

- `GET /v1/public/setup-status`
- `POST /v1/setup/bootstrap-token/verify`
- `POST /v1/setup/oidc/configure`
- `POST /v1/setup/owner/start-oidc`
- `POST /v1/setup/owner/verify-oidc`
- `POST /v1/setup/complete`
- `GET /v1/auth/oidc/start`
- `GET /v1/auth/oidc/callback`
- `POST /v1/auth/logout`

---

## Phase 1: Data Model + RBAC

Dependency: everything else builds on this.

- [ ] **1.1 Expand SQLite schema** — Add tables: `users`, `roles`, `projects`, `pipelines`, `builds`, `jobs`, `runners`, `artifacts`, `audit_logs`
- [ ] **1.2 Wire RBAC middleware** — Integrate casbin-rs policy engine into Axum; per-route role guards for owner/admin/developer/qa_viewer
- [ ] **1.3 User management endpoints** — CRUD for users with role assignment (owner-only create, admin role changes)
- [ ] **1.4 Persistent sessions** — Move session store from in-memory HashMap to SQLite (survives daemon restart)
- [ ] **1.5 Multi-instance auth token isolation** — Namespace user auth tokens per instance in frontend (currently deferred, setup-only isolation exists)

Feature docs required: Data Model, RBAC Policy, User Management

## Phase 2: Project + Pipeline CRUD

Dependency: Phase 1 (schema + RBAC)

- [ ] **2.1 Project endpoints** — `GET|POST /v1/projects`, `GET|PATCH|DELETE /v1/projects/{project_id}` with RBAC
- [ ] **2.2 Pipeline endpoints** — `GET|POST /v1/projects/{project_id}/pipelines` with build config validation
- [ ] **2.3 Project list + detail UI** — Dashboard page, project cards, create/edit forms
- [ ] **2.4 Pipeline editor UI** — YAML editor for pipeline definitions (keep simple for V1)

Feature docs required: Projects API, Pipelines API, Project UI

## Phase 3: Build Execution Engine

Dependency: Phase 2 (projects + pipelines exist to trigger builds from)

- [ ] **3.1 In-process job queue** — Tokio channel-based dispatch per ADR-0003; job state machine (pending → claimed → running → succeeded/failed)
- [ ] **3.2 Build trigger endpoint** — `POST /v1/projects/{project_id}/builds` creates build record + enqueues job
- [ ] **3.3 Build list + detail endpoints** — `GET /v1/builds`, `GET /v1/builds/{build_id}`, `POST /v1/builds/{build_id}/cancel`
- [ ] **3.4 Build detail UI** — Status, duration, metadata, cancel button

Feature docs required: Job Queue, Build Lifecycle

## Phase 4: Runner Protocol

Dependency: Phase 3 (job queue exists for runners to pull from)

- [ ] **4.1 Runner registration** — `POST /v1/runners/register` with auth token issuance
- [ ] **4.2 Runner heartbeat** — `POST /v1/runners/{runner_id}/heartbeat` with capacity reporting
- [ ] **4.3 Pull-based job claiming** — `POST /v1/runners/{runner_id}/claim` returns next pending job
- [ ] **4.4 Job status reporting** — `POST /v1/runners/{runner_id}/jobs/{job_id}/status` updates build state
- [ ] **4.5 Build workspace management** — Ephemeral per-job directories, cleanup on completion
- [ ] **4.6 Runner management UI** — List runners, health status, job history

Feature docs required: Runner Registration, Job Scheduling, Build Isolation

## Phase 5: Logs + Artifacts

Dependency: Phase 4 (runners produce logs and artifacts)

- [ ] **5.1 Log upload from runner** — `POST /v1/runners/{runner_id}/jobs/{job_id}/logs`
- [ ] **5.2 Live log streaming** — `GET /v1/builds/{build_id}/logs/stream` via SSE
- [ ] **5.3 Log viewer UI** — Real-time build output in build detail page
- [ ] **5.4 Artifact upload** — Runner pushes artifact metadata after build
- [ ] **5.5 Artifact storage (S3)** — `aws-sdk-s3` integration with signed upload/download URLs
- [ ] **5.6 Artifact browser UI** — List artifacts, download links per build
- [ ] **5.7 Artifact download endpoint** — `POST /v1/artifacts/{artifact_id}/download-link`

Feature docs required: Live Build Logs, Artifact Storage

## Phase 6: CLI Completeness

Dependency: Phases 1-5 (endpoints exist for CLI to call)

- [ ] **6.1 `oore login`** — OIDC flow from terminal (browser redirect + callback)
- [ ] **6.2 `oore status`** — Instance health, runner count, recent builds
- [ ] **6.3 `oore runner register`** — Register current host as runner
- [ ] **6.4 `oore config set/get`** — Read/write instance configuration
- [ ] **6.5 `oore doctor`** — System diagnostics (Xcode, signing, connectivity)

Feature docs required: CLI Completeness

## Phase 7: Polish + Release Readiness

Dependency: Phases 1-6 functional

- [ ] **7.1 E2E test suite** — Playwright tests for setup flow, build trigger, log streaming, artifact download
- [ ] **7.2 Security hardening** — Input validation audit, path traversal checks, signed URL TTL enforcement
- [ ] **7.3 Admin panel UI** — User/role management, instance settings
- [ ] **7.4 Operator documentation** — Deployment guide, runner setup guide, OIDC provider config guide
- [ ] **7.5 Final `make validate`** — All docs, builds, and checks green

Feature docs required: E2E Tests, Security Hardening, Admin Panel, Deployment Guide

---

## Gap Summary

| Area | Built | Remaining | Blocked By |
|------|-------|-----------|------------|
| API endpoints | 9/25 | 16 | — |
| SQLite tables | setup only | 8+ tables | — |
| RBAC | casbin-rs dep added | zero enforcement | schema |
| Frontend pages | setup + stub dashboard | 6+ pages | API endpoints |
| CLI commands | setup + version | 5 commands | API endpoints |
| Tests | unit (API, stores) | E2E suite | features to test |

## Notes

- Each phase produces feature docs per `docs/documentation-policy.md`
- Each phase ends with `make validate` passing
- ADRs required only when changing locked contract decisions
- This roadmap does NOT change any platform-contract decisions; it sequences existing commitments
