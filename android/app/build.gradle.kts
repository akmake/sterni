plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    kotlin("kapt")
}

android {
    namespace = "com.sterni.dailystudy"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.sterni.dailystudy"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "BASE_URL", "\"https://sterni.co.il/api/\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            buildConfigField("String", "BASE_URL", "\"https://sterni.co.il/api/\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.okhttp.logging)

    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.hilt.android)
    kapt(libs.hilt.android.compiler)
    implementation(libs.hilt.navigation.compose)

    // WorkManager
    implementation(libs.work.runtime.ktx)

    // Google Maps + Location
    implementation(libs.play.services.location)
    implementation(libs.play.services.maps)
    implementation(libs.maps.compose)

    // KosherJava (Hebrew calendar + zmanim)
    implementation(libs.kosherjava)

    debugImplementation(libs.androidx.ui.tooling)
}

kapt {
    correctErrorTypes = true
}
