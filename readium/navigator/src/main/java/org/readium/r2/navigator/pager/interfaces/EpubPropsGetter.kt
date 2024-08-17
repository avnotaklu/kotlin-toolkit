package org.readium.r2.navigator.pager.interfaces

import android.graphics.Rect
import android.net.Uri
import org.readium.r2.navigator.model.DisplayUnit

public interface EpubPropsGetter {
    public fun getViewportRect(unit: DisplayUnit): Rect;
    public fun getReaderResourcePath(): Uri;
    public fun getBookName(): String;
    public fun getEpubCFI(): String?;
}