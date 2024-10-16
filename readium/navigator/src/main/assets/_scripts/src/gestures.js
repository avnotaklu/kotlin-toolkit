/*
 * Copyright 2021 Readium Foundation. All rights reserved.
 * Use of this source code is governed by the BSD-style license
 * available in the top-level LICENSE file of the project.
 */

import { computeLastReadCfi } from "./bridge";
import { handleDecorationClickEvent } from "./decorator";
import { nearestInteractiveElement } from "./dom";

window.addEventListener("DOMContentLoaded", function () {
  document.addEventListener("click", onClick, false);
  bindDragGesture(document);
});

async function onClick(event) {
  if (!window.getSelection().isCollapsed) {
    // There's an on-going selection, the tap will dismiss it so we don't forward it.
    return;
  }

  var pixelRatio = window.devicePixelRatio;
  let clickEvent = {
    defaultPrevented: event.defaultPrevented,
    x: event.clientX * pixelRatio,
    y: event.clientY * pixelRatio,
    targetElement: event.target.outerHTML,
    interactiveElement: nearestInteractiveElement(event.target),
  };

  if (handleDecorationClickEvent(event, clickEvent)) {
    return;
  }

  // Send the tap data over the JS bridge even if it's been handled within the web view, so that
  // it can be preserved and used by the toolkit if needed.
  var shouldPreventDefault = Android.onTap(JSON.stringify(clickEvent));

  if (shouldPreventDefault) {
    event.stopPropagation();
    event.preventDefault();
  }
}

function bindDragGesture(element) {
  // passive: false is necessary to be able to prevent the default behavior.
  element.addEventListener("touchstart", onStart, { passive: false });
  element.addEventListener("touchend", onEnd, { passive: false });
  element.addEventListener("touchmove", onMove, { passive: false });

  var state = undefined;
  var isStartingDrag = false;
  const pixelRatio = window.devicePixelRatio;

  function onStart(event) {
    isStartingDrag = true;

    const startX = event.touches[0].clientX * pixelRatio;
    const startY = event.touches[0].clientY * pixelRatio;
    state = {
      defaultPrevented: event.defaultPrevented,
      startX: startX,
      startY: startY,
      currentX: startX,
      currentY: startY,
      offsetX: 0,
      offsetY: 0,
      interactiveElement: nearestInteractiveElement(event.target),
    };
  }

  function onMove(event) {
    if (!state) return;

    state.currentX = event.touches[0].clientX * pixelRatio;
    state.currentY = event.touches[0].clientY * pixelRatio;
    state.offsetX = state.currentX - state.startX;
    state.offsetY = state.currentY - state.startY;

    var shouldPreventDefault = false;
    // Wait for a movement of at least 6 pixels before reporting a drag.
    if (isStartingDrag) {
      if (Math.abs(state.offsetX) >= 6 || Math.abs(state.offsetY) >= 6) {
        isStartingDrag = false;
        shouldPreventDefault = Android.onDragStart(JSON.stringify(state));
      }
    } else {
      shouldPreventDefault = Android.onDragMove(JSON.stringify(state));
    }

    if (shouldPreventDefault) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  function onEnd(event) {
    if (!state) return;

    const shouldPreventDefault = Android.onDragEnd(JSON.stringify(state));
    if (shouldPreventDefault) {
      event.stopPropagation();
      event.preventDefault();
    }
    state = undefined;
  }
}
