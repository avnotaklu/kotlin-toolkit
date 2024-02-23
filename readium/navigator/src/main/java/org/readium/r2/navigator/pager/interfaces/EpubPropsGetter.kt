package org.readium.r2.navigator.pager.interfaces

import android.graphics.Rect
import org.readium.r2.navigator.model.DisplayUnit

public interface EpubPropsGetter {
    public fun getViewportRect(unit: DisplayUnit): Rect;
    public fun getFilePath(): String;
    public fun getEpubCFI(): String?;
}