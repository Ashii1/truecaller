import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.Exec

// Fixed release versionCode requested for the current installable build.
val finalVersionCode = 402
val finalVersionName = "1.5.2"

val envKeystorePath = System.getenv("VIGILSHIELD_KEYSTORE_FILE")
val envKeystorePassword = System.getenv("VIGILSHIELD_KEYSTORE_PASSWORD")
val envKeyAlias = System.getenv("VIGILSHIELD_KEY_ALIAS")
val envKeyPassword = System.getenv("VIGILSHIELD_KEY_PASSWORD")

val releaseKeystoreFile = envKeystorePath?.takeIf { it.isNotBlank() }?.let { file(it) }
val releaseStorePassword = envKeystorePassword?.takeIf { it.isNotBlank() }
val releaseKeyAlias = envKeyAlias?.takeIf { it.isNotBlank() }
val releaseKeyPassword = envKeyPassword?.takeIf { it.isNotBlank() }

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
            if (releaseKeystoreFile != null && releaseStorePassword != null && releaseKeyAlias != null && releaseKeyPassword != null) {
                storeFile = releaseKeystoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            // Debug builds use the standard Android debug signing key.
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (releaseKeystoreFile != null && releaseStorePassword != null && releaseKeyAlias != null && releaseKeyPassword != null && releaseKeystoreFile.exists()) {
                signingConfig = signingConfigs.getByName("ciRelease")
            } else {
                throw GradleException("Release signing credentials are missing. Configure the VIGILSHIELD_* GitHub Actions secrets.")
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
