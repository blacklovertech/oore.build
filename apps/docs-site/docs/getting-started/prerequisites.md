---
status: implemented
---

# Prerequisites

Before installing oore.build, verify that your system meets these requirements.

## System requirements

| Requirement | Details |
|---|---|
| **Operating system** | macOS (required for the daemon and CLI in V1) |
| **Xcode Command Line Tools** | Required for iOS/macOS builds. Run `xcode-select --install` if not present. |
| **Internet access** | Required during setup for OIDC provider discovery and Git operations |

## Required tools

Install these before proceeding. Each tool includes a verification command — run it to confirm the tool is available.

### Rust toolchain

oore.build is written in Rust (edition 2024, requires Rust 1.85+).

Install via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify:

```bash
rustc --version
# Expected: rustc 1.85.0 or later
```

### Bun

The web UI uses [Bun](https://bun.sh/docs/installation) as its package manager and runtime.

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify:

```bash
bun --version
# Expected: 1.0 or later
```

### FVM (Flutter Version Manager)

oore.build uses [FVM](https://fvm.app/documentation/getting-started/installation) to manage Flutter versions per project.

```bash
brew tap leoafarias/fvm
brew install fvm
```

Verify:

```bash
fvm --version
```

### SQLite

The daemon uses SQLite for persistent state. macOS ships with SQLite pre-installed. Optionally install a newer version:

```bash
brew install sqlite
```

## OIDC provider account

oore.build uses OIDC for all authentication — there are no local passwords. You need an account with an OIDC-compatible identity provider. During setup, you will need:

- **Issuer URL** — the provider's OpenID Connect discovery endpoint (e.g., `https://accounts.google.com`)
- **Client ID** — obtained by creating an OAuth 2.0 application in your provider
- **Client secret** (optional) — some providers require this for the authorization code flow

If you don't have an OIDC provider yet, see [Configure OIDC](/guides/oidc/) for provider-specific setup instructions.

## Quick check

Run the built-in diagnostic tool after installing the required tools:

```bash
make doctor
```

This checks for `git`, `rustc`, `cargo`, `bun`, `fvm`, `flutter`, and `xcodebuild`.

## Next step

[Install oore.build](/getting-started/install)
