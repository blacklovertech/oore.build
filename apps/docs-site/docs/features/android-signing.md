# Android Signing (oore.build)

oore.build supports Android signing in two modes:

1. **Primary**: pipeline-scoped signing profiles configured in UI (debug/release).
2. **Fallback**: runner host environment variables (`OORE_ANDROID_*`).

For both modes, your Gradle config must include a release signing config.

## Environment Contract

When signing is prepared, build steps receive:

- `CI=true` (if not already set by your pipeline env)
- `OORE_ANDROID_KEYSTORE_PATH`
- `OORE_ANDROID_KEYSTORE_PASSWORD`
- `OORE_ANDROID_KEY_ALIAS`
- `OORE_ANDROID_KEY_PASSWORD`
- `OORE_ANDROID_KEY_PROPERTIES_PATH`

`OORE_ANDROID_KEY_PROPERTIES_PATH` points to the generated `android/key.properties` file in the ephemeral workspace.

## Kotlin DSL (`build.gradle.kts`)

```kotlin
signingConfigs {
    create("release") {
        if (System.getenv("CI").toBoolean()) {
            storeFile = file(System.getenv("OORE_ANDROID_KEYSTORE_PATH"))
            storePassword = System.getenv("OORE_ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("OORE_ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("OORE_ANDROID_KEY_PASSWORD")
        } else {
            storeFile = file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }
}
```

## Groovy DSL (`build.gradle`)

```groovy
signingConfigs {
    release {
        if (System.getenv("CI")) {
            storeFile file(System.getenv("OORE_ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("OORE_ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("OORE_ANDROID_KEY_ALIAS")
            keyPassword System.getenv("OORE_ANDROID_KEY_PASSWORD")
        } else {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
}
```

## `key.properties` Location

oore.build writes `key.properties` at:

- `android/key.properties`

This matches common Flutter/Gradle patterns using:

```groovy
def keystorePropertiesFile = rootProject.file("key.properties")
```

## Troubleshooting

- If your logs do not show an `android_signing_prepared` marker, no signing profile/env was applied.
- If Gradle still fails signing, verify your `release` build type uses `signingConfig signingConfigs.release`.
