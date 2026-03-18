---
status: implemented
description: "Automate Oore CI releases using GitHub Actions and GitHub Releases."
---

# Release Automation

CI/CD is driven by GitHub Actions. Validation runs on Linux (frontend) and macOS (Rust) in parallel. Release builds run on macOS runners for cross-compilation.

## Workflow

- PR/push validation:
  - Frontend & docs job (Linux): `make docs-check lint-web lint-docs test-web test-docs build-web build-docs build-site`
  - Rust job (macOS): `cargo fmt --check`, `cargo test --workspace`, `cargo clippy`, `cargo check`
- Merge to `alpha`:
  - CI auto-cuts prerelease tags `vX.Y.Z-alpha.N`.
- Merge to `beta`:
  - CI auto-cuts prerelease tags `vX.Y.Z-beta.N`.
- Merge to `stable`:
  - CI auto-cuts stable tags `vX.Y.Z`.
- Tag push (`v*`):
  - CI builds release artifacts for `aarch64-apple-darwin` and `x86_64-apple-darwin`.
  - CI builds the web UI (`apps/web/dist`) and compiles `oore-web` for both macOS architectures.
  - CI deploys Pages sites (site + docs + web in parallel, then demo) using `wrangler pages deploy`.
  - CI creates/updates a GitHub Release and uploads artifacts + checksums + release notes.

## Required Secrets

Set these in GitHub repo settings (Settings > Secrets and variables > Actions):

- `RELEASE_PAT`:
  - Fine-grained PAT with `contents: write` on this repo.
  - Used by the autotag workflow to push tags that trigger the release workflow.
  - (Tags pushed by the automatic `GITHUB_TOKEN` do not trigger downstream workflows.)
- `CLOUDFLARE_API_TOKEN`:
  - Used by `wrangler pages deploy`.

`GITHUB_TOKEN` is automatic and used for GitHub Releases and general CI operations.

## Before Promoting to Stable

```bash
make validate
make release-smoke
```
