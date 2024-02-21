import { Generator } from "./cfi";
import RangeFix from "./range";
import ePub, { EpubCFI } from "./epub/epub.js/src/index"
import { log, scrollToRange } from "./utils"
import $ from "jquery"


var DisplayUnit = Object.freeze({
    PX: "PX",
    DP: "DP",
    CSS_PX: "CSS_PX"
});

var viewportRect;

export async function computeLastReadCfi() {
    viewportRect = constructDOMRect(Android.getViewportRect(DisplayUnit.CSS_PX));

    let filepath = Android.getFilepath()
    let epub = ePub("https://readium/books/" + filepath)

    await epub.opened
    try {
        var spine = epub.spine.get(Android.getResourcePosition())
        let range = document.caretRangeFromPoint(viewportRect.x, viewportRect.y)
        let cfi = new EpubCFI(range, spine.cfiBase)
        log(cfi.toString())
        Android.storeLastReadCfi(cfi.toString());
        return cfi.toString()
    } catch (e) {
        log("Error while computing last read cfi: " + e.toString())
        return e.toString()
    }
}

export function computeCfiFromSelection(current_cfi) {
    let sel = window.getSelection();
    if (!sel) {
      return;
    }
    let range = sel.getRangeAt(0);
    // viewportRect = constructDOMRect(Android.getViewportRect(DisplayUnit.CSS_PX));
    //
    // let filepath = Android.getFilepath()
    // let epub = ePub("https://readium/books/" + filepath)
    //
    // await epub.opened
    
    let current_epubcfi = new EpubCFI(current_cfi)
    try {
        // var spine = epub.spine.get(Android.getResourcePosition())
        // let cfi = new EpubCFI(range, spine.cfiBase)
        let cfi = new EpubCFI(range, current_epubcfi.base)
        log(cfi.toString())
        return { cfi: cfi.toString() }
    } catch (e) {
        log("Error while computing selection cfi: " + e.toString())
        return { cfi: null }
    }
}


export function computeNodePosition(epubcfi) {
    try {
        let cfi = new EpubCFI(epubcfi)
        let range = cfi.toRange(document)
        scrollToRange(range)
    } catch (e) {
        log("Error while scrolling to range: " + e.toString())
    }
    return true
}

function constructDOMRect(rectJsonString) {
    var rectJson = JSON.parse(rectJsonString);
    return new DOMRect(rectJson.x, rectJson.y, rectJson.width, rectJson.height);
}

/**
 * Gets the first partially or completely visible node in viewportRect
 * @param {Node} node Accepts {@link Element} or {@link Text}
 * @returns {(Node|null)} Returns {@link Element} or {@link Text} or null
 */
function getFirstVisibleNode(node) {
    var range = document.createRange();
    range.selectNode(node);
    var rect = RangeFix.getBoundingClientRect(range);
    if (rect == null)
        return null;

    var intersects = rectIntersects(viewportRect, rect);
    var contains = rectContains(viewportRect, rect);

    if (contains) {
        // node's rect is completely inside viewportRect.
        return node;

    } else if (intersects) {

        var childNodes = node.childNodes;
        for (var i = 0; i < childNodes.length; i++) {

            // EPUB CFI ignores nodes other than ELEMENT_NODE and TEXT_NODE
            // http://www.idpf.org/epub/linking/cfi/epub-cfi.html#sec-path-child-ref

            if (childNodes[i].nodeType === Node.ELEMENT_NODE || childNodes[i].nodeType === Node.TEXT_NODE) {
                var childNode = getFirstVisibleNode(childNodes[i]);
                if (childNode) {
                    return childNode;
                }
            }
        }

        // No children found or no child's rect completely inside viewportRect,
        // so returning this node as it's rect intersected with viewportRect.
        return node;
    }
    return null;
}

/**
 * Returns true iff the two specified rectangles intersect. In no event are
 * either of the rectangles modified.
 *
 * @param {DOMRect} a The first rectangle being tested for intersection
 * @param {DOMRect} b The second rectangle being tested for intersection
 * @returns {boolean} returns true iff the two specified rectangles intersect.
 */
function rectIntersects(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Returns true iff the specified rectangle b is inside or equal to
 * rectangle b. An empty rectangle never contains another rectangle.
 *
 * @param {DOMRect} a The rectangle being tested whether rectangle b is inside this or not.
 * @param {DOMRect} b The rectangle being tested for containment.
 * @returns {boolean} returns true iff the specified rectangle r is inside or equal to this rectangle
 */
function rectContains(a, b) {
    // check for empty first
    return a.left < a.right && a.top < a.bottom
        // now check for containment
        && a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom;
}
