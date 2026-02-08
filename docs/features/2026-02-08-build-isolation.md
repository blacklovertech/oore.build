# Build Isolation

## Status

`ready`

## Problem

Build execution must be isolated to prevent interference between concurrent builds and ensure deterministic cleanup. Without isolation, concurrent builds on the same runner can corrupt each other's state through shared directories, environment variables, or leftover files. Orphaned workspaces from crashed builds waste disk space and can leak sensitive material such as signing keys. The platform contract (section 16) mandates process-level isolation with ephemeral workspaces and deterministic cleanup.

## User Impact

- **Developers** benefit from deterministic builds. Each build executes in a clean, dedicated workspace with no residual state from previous builds. Build results are reproducible regardless of runner history.
- **Operators** do not need to manually clean build directories. Workspaces are automatically destroyed after completion, whether the build succeeds, fails, times out, or the runner crashes.
- **Admins** can trust the single-tenant isolation model: one organization per backend instance, with process-level separation between concurrent builds on the same host.

## UI Changes

No direct UI changes in this phase. Build detail views (from Phase 2) already display build status and step-level results. Future phases may surface workspace path and per-step timing in the build detail UI.

## API Changes

Step results are reported via `POST /v1/runners/{runner_id}/jobs/{job_id}/status` and include per-step execution details:

```json
{
  "status": "succeeded",
  "steps": [
    {
      "name": "checkout",
      "status": "succeeded",
      "exit_code": 0,
      "started_at": "2026-02-08T10:00:00Z",
      "finished_at": "2026-02-08T10:00:12Z",
      "duration_ms": 12000
    },
    {
      "name": "build",
      "status": "succeeded",
      "exit_code": 0,
      "started_at": "2026-02-08T10:00:12Z",
      "finished_at": "2026-02-08T10:03:45Z",
      "duration_ms": 213000
    }
  ]
}
```

StepResult schema fields: `name` (string), `status` (succeeded | failed | skipped), `exit_code` (integer, nullable for skipped steps), `started_at` (Unix timestamp, integer), `finished_at` (Unix timestamp, integer), `duration_ms` (integer).

Config snapshot (immutable JSON captured at build creation time in Phase 2) drives execution. The runner reads the snapshot to determine `config_path`, `repo_url`, `commit_sha`, `branch`, and `trigger_type`. The snapshot is never modified during execution.

Between build steps, the runner polls `GET /v1/runners/{runner_id}/jobs/{job_id}` to check if the build has been canceled or timed out. If the build status is terminal, execution is aborted immediately.

## Security Considerations

- **Process-level isolation** (V1): each build runs as a child process under the runner's OS user. Per the platform contract section 16, VM/container isolation is deferred post-V1.
- **Dedicated workspace directory**: each build gets a unique directory at `/tmp/oore-builds/{build_id}/`. No two builds share a workspace.
- **No shared state**: concurrent builds on the same runner use separate workspace directories, separate process trees, and separate environment variable sets.
- **Deterministic cleanup**: workspace is destroyed after build completion via RAII-style cleanup (Rust `Drop` or `scopeguard`). Cleanup executes even on build failure, runner panic, or cancellation.
- **Single-tenant trust model**: V1 assumes one organization per backend instance. All builds on a runner belong to the same trust boundary. Cross-tenant isolation is not required.
- **Git credentials**: the runner performs `git clone` using the integration's stored credentials (GitHub App installation token or GitLab access token). Credentials are passed via environment variable or CLI argument, not persisted in the workspace. Future phases will use ephemeral SSH keys.
- **Signing material**: ephemeral keychain material (for iOS/macOS code signing) is scoped to the build workspace and destroyed with it. This prevents signing key leakage between builds.

## Migration and Rollout

- No daemon-side schema changes or migrations required. Build isolation is entirely runner-side behavior.
- Runner execution engine is implemented in the `oore runner start` CLI command. The runner binary handles workspace creation, git checkout, step execution, result reporting, and cleanup.
- Workspace uses the `/tmp/oore-builds/` prefix by default. A configurable workspace root may be added in future phases.
- The step executor runs build steps sequentially with fail-fast behavior: if any step exits with a non-zero code, subsequent steps are skipped and the build transitions to `failed`.

## Acceptance Criteria

- [ ] Each build gets a unique ephemeral workspace directory under /tmp/oore-builds/{build_id}/
- [ ] Git checkout (shallow clone) works with the branch and commit SHA from the config snapshot
- [ ] Build steps execute sequentially with fail-fast behavior (non-zero exit skips remaining steps)
- [ ] Step-level timing (started_at, finished_at, duration_ms) and exit codes are captured and reported
- [ ] Workspace is always cleaned up, even on build failure or runner crash
- [ ] No file leakage between concurrent builds on the same runner
- [ ] Config snapshot drives execution (immutable, captured at trigger time)
- [ ] Step results are reported to the daemon via POST /v1/runners/{id}/jobs/{job_id}/status

## Owner

oore.build team

## Last Updated

`2026-02-08`
