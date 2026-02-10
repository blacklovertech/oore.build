# Codemagic Signing Research Reference (Android -> iOS -> macOS)

Date: 2026-02-10
Owner: oore.build team

## Objective

Document the signing patterns Codemagic uses for Flutter CI so oore.build can implement a compatible, incremental rollout:

1. Android signing first
2. iOS ad-hoc signing second
3. macOS signing/notarization third

## Primary Sources

- Codemagic docs: [Code signing identities](https://docs.codemagic.io/yaml-code-signing/signing-identities/)
- Codemagic docs: [Android code signing](https://docs.codemagic.io/flutter-code-signing/android-code-signing/)
- Codemagic docs: [iOS code signing](https://docs.codemagic.io/flutter-code-signing/ios-code-signing/)
- Codemagic docs: [Automatic code signing](https://docs.codemagic.io/yaml-code-signing/setting-up-automatic-code-signing/)
- Flutter docs: [Build and release an Android app](https://docs.flutter.dev/deployment/android)
- Flutter docs: [Build and release an iOS app](https://docs.flutter.dev/deployment/ios)
- Apple docs: [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

## Codemagic Model Summary

### Android

Observed Codemagic pattern:

- Signing identity is a keystore reference in workflow config.
- Build environment exposes keystore variables to scripts.
- Android key configuration is materialized into `android/key.properties` during CI execution.

Practical implication for oore.build:

- A runner can produce identical behavior by generating `android/key.properties` in an ephemeral workspace, but should expose oore-owned names (`OORE_ANDROID_*`) rather than provider-specific env names.

### iOS

Observed Codemagic pattern:

- Workflow declares `ios_signing` with distribution type (for ad-hoc: `ad_hoc`) and bundle identifier mapping.
- Certificates/profiles are fetched or selected, imported into a temporary keychain, and applied to the Xcode project/workspace before archive/export.
- Codemagic documents use CLI tooling for profile fetch and keychain/profile application.

Practical implication for oore.build:

- iOS implementation needs a signing-assets plane (certificates + profiles), ephemeral keychain setup, profile mapping by bundle identifier, and explicit ad-hoc export behavior.

### macOS

Observed Codemagic pattern:

- Uses signing identities with macOS-specific distribution mode (Developer ID for external distribution).
- Signing flow follows the same certificate/profile management model, then distribution-specific steps.

Cross-check with Apple guidance:

- External macOS distribution requires notarization as a first-class step (`notarytool` flow, then stapling).

Practical implication for oore.build:

- macOS support must include both signing and notarization status in build outputs.

## Derived Requirements for oore.build

### Android phase (immediate)

- Support `OORE_ANDROID_*` env names in runner.
- Accept either keystore path or base64 keystore payload.
- Generate `android/key.properties` at runtime only.
- Never persist raw signing material in repo snapshot or logs.

### iOS phase

- Add encrypted storage and retrieval of certificate/profile assets.
- Create ephemeral keychain per build.
- Install profiles and apply profile mapping to project.
- Enforce ad-hoc export defaults and validation.

### macOS phase

- Reuse iOS asset/keychain mechanisms for signing certs.
- Add notarization submit/wait/staple steps.
- Report notarization result in build metadata/log UX.

## Rollout Recommendation

1. Android signing bootstrap (env-compatible, low-risk, no schema break)
2. iOS ad-hoc signing orchestration (cert/profile/keychain)
3. macOS signing + notarization

This sequence matches the current V1 product intent while minimizing first implementation risk.
