package org.readium.r2.navigator.pager.interfaces

import android.graphics.Rect
import org.readium.r2.navigator.model.DisplayUnit

interface EpubPropsGetter {
    fun getViewportRect(unit: DisplayUnit): Rect;
    fun getFilePath(): String;
    fun getEpubCFI(): String?;
}