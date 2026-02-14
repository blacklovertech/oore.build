# Local-First Alpha Delivery Plan (Top-to-Bottom)

Date: 2026-02-13
Status: execution checklist
Owner: platform

## Goal

Deliver a fully local-first alpha where a user can:

1. install and start locally
2. finish setup without OIDC
3. connect a local git repository
4. run first successful build

Remote/internet exposure and GitHub/GitLab integrations move behind explicit remote-mode enablement.

## Non-Goals for this increment

- GitHub/GitLab polling automation
- remote-mode UX polish beyond required enable flow
- broad CLI expansion beyond what is required for local-first onboarding

## Phase 0: Contract + Governance

### 0.1 Decisions captured

- ADR accepted: `docs/adr/0005-local-first-mode-and-auth-split.md`
- Contract updated: `docs/platform-contract.md`
- Strict rules updated: `docs/strict-guidelines.md`
- Feature scope doc: `docs/features/2026-02-13-local-first-mode-and-local-git-alpha-reset.md`

### 0.2 Follow-up docs to keep in sync during implementation

- `docs/v1-roadmap.md`
- `docs/v1-user-journey.md`
- `docs/scm-integration-v1.md`

## Phase 1: Installer and Runtime Defaults

### 1.1 Installer behavior (`scripts/install.sh`)

- make local path the primary path:
- start `oored` loopback
- start `oore-web`
- open local setup UI
- remove early hosted/tunnel decision prompts from first-run flow
- add explicit “Enable Remote Mode” guidance after successful local startup

### 1.2 Daemon defaults (`crates/oored/src/main.rs`)

- keep default listen on loopback
- add explicit guardrails for non-loopback exposure unless remote mode is enabled

### 1.3 Origin defaults (`crates/oored/src/lib.rs`)

- local-only default origins in local mode
- hosted origin allowance enabled only for remote mode

## Phase 2: Mode Primitive and Enforcement

### 2.1 Data model

- migration:
- add instance mode state (`local`/`remote`) in preferences table or dedicated settings table
- default value `local`

### 2.2 Contract types

- update `crates/oore-contract/src/lib.rs`:
- add mode enums and API request/response models
- add local integration provider enum values

### 2.3 Backend enforcement

- centralized helper for mode checks in `crates/oored/src/lib.rs` and feature modules
- return deterministic API errors for mode violations

## Phase 3: Local Auth (No OIDC Required in Local Mode)

### 3.1 Setup flow

- add local owner creation step for local mode:
- endpoint: `POST /v1/setup/local-owner/create`
- preserve existing setup token/session protections

### 3.2 Auth endpoints

- add local login endpoint:
- `POST /v1/auth/local/login`
- keep `POST /v1/auth/logout`
- retain OIDC endpoints for remote mode

### 3.3 UI routing and copy (`apps/web/src/routes/setup/*`, `apps/web/src/routes/login.tsx`)

- branch setup and login flows by mode
- remove OIDC-first messaging in local mode
- preserve OIDC flow in remote mode

## Phase 4: Local Git Integration (`local_git`)

### 4.1 Schema

- migration:
- extend integrations provider check to include `local_git`
- add integration fields for local repo path and metadata
- ensure credential requirements differ by provider mode

### 4.2 Backend API (`crates/oored/src/integrations/*`)

- add handlers:
- `POST /v1/integrations/local-git`
- `GET /v1/integrations/local-git`
- `DELETE /v1/integrations/local-git/{id}`
- validate:
- path exists
- git repository present
- allowed-root/path traversal safety

### 4.3 Project/source linkage (`crates/oored/src/projects.rs`, `crates/oored/src/builds.rs`)

- ensure project creation can link to `local_git` repository records
- ensure build snapshot always receives a valid source URL/path for local repos

### 4.4 Runner checkout (`crates/oore-runner/src/lib.rs`)

- support local repository source mode in checkout stage
- avoid current empty `repo_url` failure path

## Phase 5: Mode-Gated Provider Integrations

### 5.1 Backend gating

- GitHub/GitLab start/sync/webhook endpoints blocked in local mode with clear error codes

### 5.2 UI gating (`apps/web/src/routes/settings/integrations/*`)

- local mode:
- show `local_git` integration actions
- hide/disable GitHub/GitLab cards with “Enable Remote Mode” messaging
- remote mode:
- restore existing GitHub/GitLab flows

## Phase 6: Remote Mode Enable Flow

### 6.1 API

- add explicit remote enable endpoint:
- `POST /v1/mode/enable-remote`
- include preflight checks:
- OIDC config available
- callback/origin validation
- operator confirmation semantics

### 6.2 UI

- add explicit remote enable action in settings
- display irreversible/impact copy and diagnostics

## Phase 7: Hard Reliability Gates

### 7.1 Prevent source-missing build creation

- disallow project/pipeline/build combinations that cannot produce checkout-able source.
- remove mismatch where UI says repository optional but runner requires source.

### 7.2 Test matrix

- local mode happy path:
- install -> setup -> local login -> local_git -> first build
- remote mode happy path:
- remote enable -> OIDC login -> GitHub/GitLab connect -> webhook/manual build
- local mode rejection paths:
- provider integrations blocked
- remote-mode-only endpoints blocked

## File-Level Implementation Map

- installer/runtime:
- `scripts/install.sh`
- `crates/oored/src/main.rs`
- `crates/oored/src/lib.rs`
- auth/setup:
- `crates/oored/src/lib.rs`
- `crates/oored/src/auth.rs`
- `apps/web/src/routes/setup.tsx`
- `apps/web/src/routes/setup/index.tsx`
- `apps/web/src/routes/setup/oidc.tsx`
- `apps/web/src/routes/setup/owner.tsx`
- `apps/web/src/routes/login.tsx`
- integrations:
- `crates/oored/src/integrations/mod.rs`
- `crates/oored/src/integrations/github.rs`
- `crates/oored/src/integrations/gitlab.rs`
- new local-git module under `crates/oored/src/integrations/`
- `apps/web/src/routes/settings/integrations/index.tsx`
- `apps/web/src/routes/settings/integrations/github.tsx`
- `apps/web/src/routes/settings/integrations/gitlab.tsx`
- contract + API types:
- `crates/oore-contract/src/lib.rs`
- migrations/openapi/docs:
- `crates/oored/migrations/*.sql` (new migration)
- `crates/oored/src/bin/openapi_export.rs`
- `apps/docs-site/docs/public/openapi.json`

## Definition of Done

- local-first onboarding is the default and successful on a fresh machine
- local mode requires no OIDC
- local mode supports local git source and successful build execution
- GitHub/GitLab are disabled in local mode
- remote mode is explicit and functional when enabled
- docs and OpenAPI are updated and docs gate passes
