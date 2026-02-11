---
status: implemented
---

# Install oore.build

This page walks you through cloning the repository, installing dependencies, and verifying the build.

## What you need

- All [prerequisites](/getting-started/prerequisites) installed and verified
- A terminal with `git`, `cargo`, and `bun` available

## Clone the repository

```bash
git clone https://github.com/devaryakjha/oore.build.git
cd oore.build
```

## Install frontend dependencies

```bash
bun install
```

## Verify the build

Run the full build to confirm everything compiles and links correctly:

```bash
make build
```

This runs three targets in sequence:

| Target | What it checks |
|---|---|
| `make build-web` | Frontend production build (Vite) |
| `make build-docs` | Documentation site build (VitePress) |
| `make cargo-check` | Rust workspace compile check (all crates) |

If all three succeed, your environment is ready.

## Start the development servers

Verify the full stack by starting each component:

::: code-group

```bash [Daemon]
make run-daemon
# Starts oored on 127.0.0.1:8787
# Embedded runner starts automatically in default mode
```

```bash [Web UI]
make dev-web
# Starts Vite dev server on port 3000
```

:::

You should see daemon log output like:

```
INFO oored: using database path="/Users/you/Library/Application Support/oore/oore.db"
INFO oored: database ready instance_id="..." state=BootstrapPending
INFO oored: encryption key ready
INFO oored: starting oored daemon listen=127.0.0.1:8787
```

## Troubleshooting

### Rust compilation errors

If you see errors about missing crate features or edition 2024:

```bash
rustup update stable
```

Edition 2024 requires Rust 1.85 or later.

### Bun lockfile conflicts

If `bun install` fails with lockfile errors:

```bash
rm bun.lock
bun install
```

### SQLite connection errors

The daemon stores its database at `~/Library/Application Support/oore/oore.db` by default. Override with:

```bash
export OORE_SETUP_STATE_FILE=/path/to/custom.db
```

Or pass directly to the daemon:

```bash
cargo run -p oored -- run --state-file /path/to/custom.db
```

## Available make targets

| Target | Description |
|---|---|
| `make dev-web` | Web app dev server (port 3000) |
| `make dev-docs` | VitePress dev server (port 4173) |
| `make build-web` | Production build (web) |
| `make build-docs` | VitePress production build |
| `make test-web` | Run web app tests (Vitest) |
| `make lint-web` | ESLint |
| `make fix-web` | Prettier + ESLint auto-fix |
| `make cargo-check` | Compile check all Rust crates |
| `make run-daemon` | Run oored on 127.0.0.1:8787 |
| `make run-cli` | Run `oore setup open --ttl 15m` |
| `make doctor` | Check required tooling |
| `make build` | build-web + build-docs + cargo-check |
| `make check` | lint-web + cargo-check |
| `make validate` | Full pre-handoff validation |

## Next step

[Set up your instance](/getting-started/first-instance)
