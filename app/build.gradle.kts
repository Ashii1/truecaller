import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.Exec

// Versioning: Set strictly above 402 build so Android package manager performs
// a clean in-place update over the existing installed app without requiring uninstallation.
val baseVersionCode = 403
val ciRunNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 0
val finalVersionCode = maxOf(baseVersionCode, 403 + ciRunNumber)
val finalVersionName = "1.5.3"

val envKeystorePath = System.getenv("VIGILSHIELD_KEYSTORE_FILE")
val envKeystorePassword = System.getenv("VIGILSHIELD_KEYSTORE_PASSWORD")
val envKeyAlias = System.getenv("VIGILSHIELD_KEY_ALIAS")
val envKeyPassword = System.getenv("VIGILSHIELD_KEY_PASSWORD")

// Locate persistent release keystore from environment, repository root, or android folder
val releaseKeystoreFile = envKeystorePath?.takeIf { it.isNotBlank() }?.let { file(it) }
    ?: file("../release-keystore.jks").takeIf { it.exists() }
    ?: file("release-keystore.jks").takeIf { it.exists() }
    ?: file("../android/release-keystore.jks").takeIf { it.exists() }

val releaseStorePassword = envKeystorePassword?.takeIf { it.isNotBlank() } ?: "vigilshield123"
val releaseKeyAlias = envKeyAlias?.takeIf { it.isNotBlank() } ?: "vigilshield-key"
val releaseKeyPassword = envKeyPassword?.takeIf { it.isNotBlank() } ?: "vigilshield123"

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
        create("ciRelease") {
            if (releaseKeystoreFile != null && releaseKeystoreFile.exists()) {
                storeFile = releaseKeystoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            // Sign debug with the exact same persistent keystore so test and debug APKs
            // update in-place over the installed 402 build without signature mismatch
            val ciConfig = signingConfigs.findByName("ciRelease")
            if (ciConfig?.storeFile != null && ciConfig.storeFile.exists()) {
                signingConfig = ciConfig
            }
        }
        release {
            isMinifyEnabled = false
            val ciConfig = signingConfigs.findByName("ciRelease")
            if (ciConfig?.storeFile != null && ciConfig.storeFile.exists()) {
                signingConfig = ciConfig
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
