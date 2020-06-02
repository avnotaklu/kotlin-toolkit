/*
 * Module: r2-shared-kotlin
 * Developers: Quentin Gliosca
 *
 * Copyright (c) 2020. Readium Foundation. All rights reserved.
 * Use of this source code is governed by a BSD-style license which is detailed in the
 * LICENSE file present in the project repository where this source code is maintained.
 */

package org.readium.r2.shared.publication.services

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Size
import org.readium.r2.shared.extensions.scaleToFit
import org.readium.r2.shared.extensions.size
import org.readium.r2.shared.extensions.toPng
import org.readium.r2.shared.fetcher.BytesResource
import org.readium.r2.shared.fetcher.FailureResource
import org.readium.r2.shared.fetcher.Fetcher
import org.readium.r2.shared.fetcher.Resource
import org.readium.r2.shared.publication.Link
import org.readium.r2.shared.publication.Publication
import org.readium.r2.shared.publication.ServiceFactory
import org.readium.r2.shared.publication.deepFlatFilter
import java.io.ByteArrayOutputStream

internal fun coverLink(size: Size) =
    Link(
        href = "/~readium/cover",
        type = "image/png",
        rels = setOf("cover"),
        height = size.height,
        width = size.width
    )

/**
 * Provides an easy access to a bitmap version of the publication cover.
 *
 * While at first glance, getting the cover could be seen as a helper,
 * the implementation actually depends on the publication format:

 * Some might allow vector images or even HTML pages, in which case they need to be converted to bitmaps.
 * Others require to render the cover from a specific file format, e.g. PDF.

 * Furthermore, a reading app might want to use a custom strategy to choose the cover image, for example by:
 * - iterating through the images collection for a publication parsed from an OPDS 2 feed
 * - generating a bitmap from scratch using the publication's title
 * - using a cover selected by the user.
 */
interface CoverService : Publication.Service {

    /**
     * Returns the publication cover as a [Bitmap] at its maximum size.
     *
     * If the cover is not a bitmap format (e.g. SVG), it should be scaled down to fit the screen.
     */
    val cover: Bitmap?

    /**
     *  Returns the publication cover as a [Bitmap], scaled down to fit the given [maxSize].
     */
    fun coverFitting(maxSize: Size): Bitmap? = cover?.scaleToFit(maxSize)

    override fun get(link: Link, parameters: Map<String, String>): Resource? {
        val stream = ByteArrayOutputStream()
        val png = cover?.toPng() ?: return FailureResource(links[0], Exception("Unable to convert cover to PNG."))
        return BytesResource(links[0]) { png }
    }
}

/**
 * Returns the publication cover as a [Bitmap] at its maximum size.
 */
val Publication.cover: Bitmap? get() = findService(CoverService::class.java)?.cover

/**
 * Returns the publication cover as a [Bitmap], scaled down to fit the given [maxSize].
 */
fun Publication.coverFitting(maxSize: Size): Bitmap? =
    findService(CoverService::class.java)?.coverFitting(maxSize)


/** Factory to build a [CoverService]. */
var Publication.ServicesBuilder.coverServiceFactory: ServiceFactory?
    get() = serviceFactories[CoverService::class.simpleName]
    set(value) {
        if (value == null)
            serviceFactories.remove(CoverService::class.simpleName!!)
        else
            serviceFactories[CoverService::class.simpleName!!] = value
    }


/**
 *  A [CoverService] which searches a [Link] with rel `cover` in the publication's manifest.
 */
class DefaultCoverService private constructor(val coverLinks: List<Link>, val fetcher: Fetcher) : CoverService {

    override val cover: Bitmap?
        get() {
            for (link in coverLinks) {
                val data = fetcher.get(link).read().successOrNull() ?: continue
                return BitmapFactory.decodeByteArray(data, 0, data.size)
            }
            return null
        }

    companion object {

        fun create(context: Publication.Service.Context) = DefaultCoverService(
            coverLinks = with(context.manifest) { listOf(readingOrder, resources, links) }
                .map { link -> link.deepFlatFilter { "cover" in it.rels } }
                .flatten(),
            fetcher = context.fetcher
        )

    }
}

/**
 * A [CoverService] which uses a provided in-memory bitmap.
 */
class InMemoryCoverService private constructor(override val cover: Bitmap) : CoverService {

    override val links: List<Link> = listOf(
        coverLink(cover.size)
    )

    companion object {
        fun create(cover: Bitmap?): ServiceFactory? = { cover?.let { InMemoryCoverService(it) } }
    }

}
