import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.Exec

val releaseKeystorePath = System.getenv("VIGILSHIELD_KEYSTORE_FILE")
val releaseKeystorePassword = System.getenv("VIGILSHIELD_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("VIGILSHIELD_KEY_ALIAS")
val releaseKeyPassword = System.getenv("VIGILSHIELD_KEY_PASSWORD")
val hasPersistentReleaseKey = !releaseKeystorePath.isNullOrBlank() &&
    !releaseKeystorePassword.isNullOrBlank() &&
    !releaseKeyAlias.isNullOrBlank() &&
    !releaseKeyPassword.isNullOrBlank()
val ciVersionCode = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull()

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
        // GitHub Actions run numbers monotonically increase, so every CI release
        // gets a higher versionCode and can update the previous installation.
        versionCode = ciVersionCode ?: 6
        versionName = "1.5"
    }

    if (hasPersistentReleaseKey) {
        signingConfigs.create("persistentRelease") {
            storeFile = file(releaseKeystorePath!!)
            storePassword = releaseKeystorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Never silently fall back to the runner's debug key: a different
            // signing key makes Android reject an in-place update.
            if (!hasPersistentReleaseKey) {
                throw GradleException("Persistent release signing is required for updateable APKs. Configure VIGILSHIELD_KEYSTORE_FILE, VIGILSHIELD_KEYSTORE_PASSWORD, VIGILSHIELD_KEY_ALIAS and VIGILSHIELD_KEY_PASSWORD.")
            }
            signingConfig = signingConfigs.getByName("persistentRelease")
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
