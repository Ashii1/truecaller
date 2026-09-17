import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.Exec

// Versioning configuration for seamless in-place updates:
// 1. Android strictly blocks APK updates if the new versionCode <= installed versionCode (INSTALL_FAILED_VERSION_DOWNGRADE).
// 2. Base version code is set to 200 so it comfortably supersedes all previous test/CI builds (1..6).
// 3. In CI, GITHUB_RUN_NUMBER is added to ensure every subsequent commit/action run is monotonically higher.
val baseVersionCode = 202
val ciRunNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 0
val finalVersionCode = baseVersionCode + ciRunNumber
val finalVersionName = "1.5.2"

// Signing configuration for seamless in-place updates:
// Android REQUIRES every update to be signed by the exact same cryptographic key as the installed version.
// We support custom CI environment variables, but fall back seamlessly to the project's bundled release-keystore.jks
// so local builds, CI builds, debug builds, and release builds all share the identical signing certificate.
val envKeystorePath = System.getenv("VIGILSHIELD_KEYSTORE_FILE")
val envKeystorePassword = System.getenv("VIGILSHIELD_KEYSTORE_PASSWORD")
val envKeyAlias = System.getenv("VIGILSHIELD_KEY_ALIAS")
val envKeyPassword = System.getenv("VIGILSHIELD_KEY_PASSWORD")

val bundledKeystoreFile = when {
    !envKeystorePath.isNullOrBlank() && file(envKeystorePath).exists() -> file(envKeystorePath)
    file("release-keystore.jks").exists() -> file("release-keystore.jks")
    rootProject.file("release-keystore.jks").exists() -> rootProject.file("release-keystore.jks")
    rootProject.file("android/release-keystore.jks").exists() -> rootProject.file("android/release-keystore.jks")
    else -> null
}

val finalStorePassword = envKeystorePassword?.takeIf { it.isNotBlank() } ?: "vigilshield123"
val finalKeyAlias = envKeyAlias?.takeIf { it.isNotBlank() } ?: "vigilshield-key"
val finalKeyPassword = envKeyPassword?.takeIf { it.isNotBlank() } ?: "vigilshield123"

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.vigilshield.telecom"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.vigilshield.telecom"
        minSdk = 29
        targetSdk = 35
        versionCode = finalVersionCode
        versionName = finalVersionName
    }

    signingConfigs {
        create("unifiedSigning") {
            if (bundledKeystoreFile != null && bundledKeystoreFile.exists()) {
                storeFile = bundledKeystoreFile
                storePassword = finalStorePassword
                keyAlias = finalKeyAlias
                keyPassword = finalKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            // CRITICAL: Use the unified signing key for debug builds as well.
            // This prevents "INSTALL_FAILED_UPDATE_INCOMPATIBLE" errors when updating
            // between debug testing APKs and release distribution APKs.
            if (bundledKeystoreFile != null && bundledKeystoreFile.exists()) {
                signingConfig = signingConfigs.getByName("unifiedSigning")
            }
        }
        release {
            isMinifyEnabled = false
            if (bundledKeystoreFile != null && bundledKeystoreFile.exists()) {
                signingConfig = signingConfigs.getByName("unifiedSigning")
            } else {
                throw GradleException("Release keystore file not found. Ensure release-keystore.jks is present in project root.")
            }
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}

tasks.register<Exec>("buildWebAssets") {
    workingDir(rootProject.projectDir)
    commandLine("npm", "run", "build")
}

tasks.register<Copy>("syncWebAssets") {
    dependsOn("buildWebAssets")
    from(rootProject.file("dist"))
    into(layout.projectDirectory.dir("src/main/assets"))
}

tasks.named("preBuild") {
    dependsOn("syncWebAssets")
}
