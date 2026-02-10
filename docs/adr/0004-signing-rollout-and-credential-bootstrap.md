# ADR-0004: Signing Rollout and Credential Strategy

## Status

Accepted

## Date

2026-02-10

## Context

The platform contract already defines signing support as a V1 goal and requires ephemeral signing material handling in isolated workspaces.

However, the implementation roadmap did not provide an explicit, ordered plan for Android, iOS, and macOS signing delivery. This created a delivery gap for the core value proposition (internal distribution of signed mobile artifacts).

Codemagic's documented model shows a practical phased implementation path:

- Android: keystore-based signing bootstrap via build-time environment variables and generated `key.properties`
- iOS: certificate/profile orchestration with temporary keychain and profile mapping
- macOS: signing plus notarization workflow for distribution trust

## Decision

1. Lock signing rollout order for V1 as:
   - Android signing
   - iOS ad-hoc signing
   - macOS signing/notarization
2. Android signing for V1 is pipeline-scoped and UI-controlled:
   - operators upload signing assets (JKS) per pipeline and per build type (`debug`, `release`)
   - operators configure alias and passwords in UI/API
   - credentials are encrypted at rest and only exposed to assigned runners at execution time
<<<<<<< ours
3. Keep Codemagic-compatible `CM_*` env variables as a compatibility fallback when no pipeline signing profile is configured.
=======
3. Use `OORE_ANDROID_*` variables for environment-driven Android signing fallback when no pipeline signing profile is configured.
>>>>>>> theirs
4. Materialize Android signing files only inside the ephemeral build workspace (`android/key.properties` and keystore file under `android/app/`), never in repository state.
5. Treat iOS/macOS signing as next phases that require encrypted signing-asset management and ephemeral keychain/notarization flows.

## Rationale

### Operator-first product behavior

Signing is a core product capability. Pipeline-scoped UI management is the intended control plane, not host-level environment plumbing.

### Migration compatibility without sacrificing UX

<<<<<<< ours
Codemagic-compatible env names remain useful for migration and temporary setups, but do not replace managed signing profiles.
=======
`OORE_ANDROID_*` names provide a clear, product-owned contract for migration and temporary setups without coupling to another CI provider's variable namespace.
>>>>>>> theirs

### Security alignment

Encrypted-at-rest pipeline profiles plus workspace-scoped materialization match contract requirements for secret handling and avoid persisting signing files in SCM snapshots.

### Controlled complexity

iOS/macOS signing requires significantly more state and tooling (cert/profile lifecycle, keychain operations, notarization). Sequencing these after Android lowers delivery risk.

## Consequences

- Android signed build support is available through encrypted pipeline-scoped profiles managed in UI/API.
<<<<<<< ours
- Android `CM_*` env support remains available as fallback compatibility behavior.
=======
- Android `OORE_ANDROID_*` env support remains available as fallback behavior.
>>>>>>> theirs
- iOS/macOS phases remain explicit roadmap work with higher implementation scope.
- Roadmap and journey docs must reflect this ordering and gate criteria.

## Contract References

- `docs/platform-contract.md` section 2 (V1 goals: signing and artifact publishing)
- `docs/platform-contract.md` section 16 (build isolation: ephemeral signing/keychain material)

No `MUST` rule is changed by this ADR; this ADR defines implementation sequence and execution strategy.
