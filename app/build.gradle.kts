plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.vigilshield.telecom"
    compileSdk = 35
    defaultConfig { applicationId = "com.vigilshield.telecom"; minSdk = 29; targetSdk = 35; versionCode = 1; versionName = "1.0" }
    buildTypes { release { isMinifyEnabled = false; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") } }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}

// Build the real React UI and bundle it into the APK. The Android app never loads localhost.
tasks.register("syncWebAssets") {
    doLast {
        val root = project.rootDir
        val dist = root.resolve("dist")
        val index = dist.resolve("index.html")
        if (!index.exists()) {
            exec { workingDir(root); commandLine("npm", "install", "--no-audit", "--no-fund") }
            exec { workingDir(root); commandLine("npm", "run", "build") }
        }
        if (!index.exists()) throw GradleException("Web build did not create dist/index.html")
        val assets = project.file("src/main/assets")
        delete(assets)
        copy { from(dist); into(assets) }
    }
}
tasks.named("preBuild").configure { dependsOn("syncWebAssets") }
