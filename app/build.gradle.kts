import org.gradle.api.GradleException
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
val isCiBuild = System.getenv("CI")?.equals("true", ignoreCase = true) == true

if (isCiBuild && !hasPersistentReleaseKey) {
    throw GradleException("Persistent VigilShield release signing is required in CI. Configure VIGILSHIELD_KEYSTORE_BASE64, VIGILSHIELD_KEYSTORE_PASSWORD, VIGILSHIELD_KEY_ALIAS and VIGILSHIELD_KEY_PASSWORD GitHub Actions secrets before producing an installable release.")
}

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
        versionCode = 5
        versionName = "1.4"
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
            signingConfig = if (hasPersistentReleaseKey) {
                signingConfigs.getByName("persistentRelease")
            } else {
                signingConfigs.getByName("debug")
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
