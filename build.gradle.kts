/*
 * Copyright 2021 Readium Foundation. All rights reserved.
 * Use of this source code is governed by the BSD-style license
 * available in the top-level LICENSE file of the project.
 */

import com.github.javaparser.utils.Utils.set
import org.jetbrains.dokka.gradle.DokkaTaskPartial

plugins {
    id("com.android.application") apply false
    id("com.android.library") apply false
    id("io.github.gradle-nexus.publish-plugin") version "2.0.0-rc-1" apply false
    id("org.jetbrains.dokka")  version "1.9.10" apply true
    id("org.jetbrains.kotlin.android") apply false
    id("org.jlleitschuh.gradle.ktlint")  version "12.1.0" apply true
}

if (project == rootProject) {
    apply(plugin = "io.github.gradle-nexus.publish-plugin")
    apply(from = "$rootDir/scripts/publish-root.gradle")
}

ext {
    set("publish.groupId", "org.readium.kotlin-toolkit")
    set("publish.version", "2.3.0")
}

// subprojects {
//     apply(plugin = "org.jlleitschuh.gradle.ktlint")
//
//     ktlint {
//         android.set(true)
//         disabledRules.add("no-wildcard-imports")
//         disabledRules.add("max-line-length")
//     }
// }
//
// tasks.register("clean", Delete::class).configure {
//     delete(rootProject.buildDir)
// }
//
// tasks.register("cleanDocs", Delete::class).configure {
//     delete("${project.rootDir}/docs/readium", "${project.rootDir}/docs/index.md", "${project.rootDir}/site")
// }
//
// tasks.withType<DokkaTaskPartial>().configureEach {
//     dokkaSourceSets {
//         configureEach {
//             reportUndocumented.set(false)
//             skipEmptyPackages.set(false)
//             skipDeprecated.set(true)
//         }
//     }
// }
//
// tasks.named<org.jetbrains.dokka.gradle.DokkaMultiModuleTask>("dokkaGfmMultiModule").configure {
//     outputDirectory.set(file("${projectDir.path}/docs"))
// }
