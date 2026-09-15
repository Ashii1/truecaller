import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.Exec

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
        // Version 3 follows the 1.1 build. Future builds must always increase this value.
        versionCode = 3
        versionName = "1.2"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // Temporary sideload signing. A persistent protected release keystore is required
            // for seamless updates across CI runs; see the release notes for the one-time key migration.
            signingConfig = signingConfigs.getByName("debug")
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
