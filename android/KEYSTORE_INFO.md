# Android Signing Keystore (`release-keystore.jks`)

A production-ready release Java KeyStore (PKCS#12 compatible) has been generated for signing the VigilShield Android application.

## Keystore Configuration

| Parameter | Value |
| :--- | :--- |
| **File Name** | `release-keystore.jks` |
| **Location** | `/android/release-keystore.jks` and `/release-keystore.jks` |
| **Keystore Password** | `vigilshield123` |
| **Key Alias** | `vigilshield-key` |
| **Key Password** | `vigilshield123` |
| **Store Type** | `PKCS12` (Standard Java KeyStore format) |
| **Validity** | 10,000 days (~27 years) |

## Certificate Fingerprints

- **SHA-256**: `F1:C7:85:A0:09:F6:34:31:26:B8:03:C7:FA:37:9F:D4:59:8A:ED:48:12:C9:B6:B4:88:B7:3E:C8:E3:11:7D:6C`
- **SHA-1**: `6A:B0:33:26:2C:CF:19:5D:F4:17:A3:A9:3B:B5:C6:12:0A:E0:02:4C`

---

## How to use in Gradle (`build.gradle.kts` / `build.gradle`)

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("release-keystore.jks")
            storePassword = "vigilshield123"
            keyAlias = "vigilshield-key"
            keyPassword = "vigilshield123"
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
```

---

## How to Generate a New Keystore using `keytool` (Optional)

If you prefer to generate your own personal credentials using standard JDK `keytool`:

```bash
keytool -genkey -v \
  -keystore my-release-key.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias my-key-alias
```
