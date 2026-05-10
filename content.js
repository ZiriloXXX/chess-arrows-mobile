(function () {
  "use strict";

  const BOARD_SELECTORS = [
    "wc-chess-board",
    "chess-board",
    ".board",
    "#board-single",
    "[class*='board']"
  ];

  let enabled = false;
  let drawing = false;
  let pointerId = 7721;
  let nativePointerId = null;
  let startPoint = null;
  let lastPoint = null;
  let button = null;
  let status = null;
  let style = null;
  let placementObserver = null;

  function install() {
    if (document.getElementById("chess-arrows-toggle")) return;

    style = document.createElement("style");
    style.textContent = `
      #chess-arrows-toggle {
        border: 0;
        cursor: pointer;
        touch-action: manipulation;
      }

      #chess-arrows-toggle.chess-arrows-native {
        align-items: center;
        background: transparent;
        border-radius: .5rem;
        color: var(--color-neutrals-white, #fff);
        display: inline-flex;
        justify-content: center;
        line-height: 1;
        margin: 0;
        min-height: 0;
        min-width: 0;
        padding: 0;
        position: absolute;
        right: -3rem;
        top: 50%;
        transform: translateY(-50%);
        vertical-align: middle;
        z-index: 2;
      }

      #chess-arrows-toggle.chess-arrows-native:hover,
      #chess-arrows-toggle.chess-arrows-native:active {
        background: rgba(255, 255, 255, .08);
      }

      #chess-arrows-toggle.chess-arrows-native[data-enabled="true"] {
        background: #81b64c;
        color: #fff;
      }

      #chess-arrows-toggle.chess-arrows-fallback {
        align-items: center;
        background: #262421;
        border-radius: 999px;
        bottom: 92px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .28);
        color: #bababa;
        display: inline-flex;
        height: 44px;
        justify-content: center;
        padding: 0;
        position: fixed;
        right: 12px;
        width: 44px;
        z-index: 2147483647;
      }

      #chess-arrows-toggle.chess-arrows-fallback[data-enabled="true"] {
        background: #81b64c;
        color: #fff;
      }

      #chess-arrows-toggle svg {
        display: block;
        height: 22px;
        pointer-events: none;
        width: 22px;
      }

      .chess-arrows-native-host {
        position: relative !important;
      }

      #chess-arrows-status {
        position: fixed;
        left: 50%;
        bottom: 24px;
        z-index: 2147483647;
        transform: translateX(-50%);
        max-width: min(92vw, 420px);
        border-radius: 12px;
        padding: 10px 12px;
        background: rgba(17, 24, 39, .92);
        color: #fff;
        font: 500 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity .15s ease;
      }

      #chess-arrows-status[data-visible="true"] {
        opacity: 1;
      }

      html[data-chess-arrows-enabled="true"] wc-chess-board,
      html[data-chess-arrows-enabled="true"] chess-board,
      html[data-chess-arrows-enabled="true"] .board,
      html[data-chess-arrows-enabled="true"] #board-single {
        touch-action: none !important;
      }
    `;
    document.documentElement.appendChild(style);

    button = document.createElement("button");
    button.id = "chess-arrows-toggle";
    button.type = "button";
    button.className = "chess-arrows-native";
    button.setAttribute("aria-label", "Arrow mode");
    button.title = "Arrow mode";
    button.innerHTML = getMouseIconSvg();
    button.dataset.enabled = "false";
    button.addEventListener("click", toggleEnabled);

    status = document.createElement("div");
    status.id = "chess-arrows-status";
    document.documentElement.appendChild(status);

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    document.addEventListener("touchcancel", onTouchCancel, { capture: true, passive: false });
    document.addEventListener("pointerdown", onNativePointerDown, { capture: true, passive: false });
    document.addEventListener("pointermove", onNativePointerMove, { capture: true, passive: false });
    document.addEventListener("pointerup", onNativePointerUp, { capture: true, passive: false });
    document.addEventListener("pointercancel", onNativePointerCancel, { capture: true, passive: false });
    document.addEventListener("mousedown", blockTrustedBoardInput, { capture: true });
    document.addEventListener("mousemove", blockTrustedBoardInput, { capture: true });
    document.addEventListener("mouseup", blockTrustedBoardInput, { capture: true });
    document.addEventListener("click", blockTrustedBoardInput, { capture: true });
    document.addEventListener("contextmenu", onContextMenu, { capture: true });

    placeButton();
    placementObserver = new MutationObserver(placeButton);
    placementObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function toggleEnabled() {
    enabled = !enabled;
    document.documentElement.dataset.chessArrowsEnabled = String(enabled);
    button.dataset.enabled = String(enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.title = enabled ? "Arrow mode enabled" : "Arrow mode";
    showStatus(enabled ? "Arrow mode enabled: drag from one square to another." : "Arrow mode disabled.");
  }

  function placeButton() {
    if (!button || !document.documentElement.contains(button)) {
      const target = findIntegratedButtonTarget();
      if (target) {
        button.classList.remove("chess-arrows-fallback");
        button.classList.add("chess-arrows-native");
        target.classList.add("chess-arrows-native-host");
        target.appendChild(button);
        return;
      }

      button.classList.remove("chess-arrows-native");
      button.classList.add("chess-arrows-fallback");
      document.documentElement.appendChild(button);
      return;
    }

    if (button.classList.contains("chess-arrows-fallback")) {
      const target = findIntegratedButtonTarget();
      if (target) {
        button.classList.remove("chess-arrows-fallback");
        button.classList.add("chess-arrows-native");
        target.classList.add("chess-arrows-native-host");
        target.appendChild(button);
      }
    }
  }

  function findIntegratedButtonTarget() {
    const mobileLeft = document.querySelector("#mobile-toolbar .mobile-toolbar-menu-area-left");
    if (mobileLeft) return mobileLeft;

    const mobileWrapper = document.querySelector("#mobile-toolbar .mobile-toolbar-wrapper");
    if (mobileWrapper) return mobileWrapper;

    const sidebarTabs = document.querySelector("#favorited-tabs");
    if (sidebarTabs) return sidebarTabs;

    return null;
  }

  function getMouseIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2.25c-3.05 0-5.5 2.45-5.5 5.5v8.5c0 3.05 2.45 5.5 5.5 5.5s5.5-2.45 5.5-5.5v-8.5c0-3.05-2.45-5.5-5.5-5.5Zm.75 1.58a4.01 4.01 0 0 1 3.25 3.92v1.5h-3.25V3.83Zm-1.5 0v5.42H8v-1.5a4.01 4.01 0 0 1 3.25-3.92ZM8 10.75h8v5.5a4 4 0 0 1-8 0v-5.5Z"/>
      </svg>
    `;
  }

  function showStatus(message) {
    status.textContent = message;
    status.dataset.visible = "true";
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => {
      status.dataset.visible = "false";
    }, 2200);
  }

  function onTouchStart(event) {
    if (!enabled || event.touches.length !== 1) return;
    if (drawing) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const touch = event.touches[0];
    if (beginDrawing(touch.clientX, touch.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onTouchMove(event) {
    if (!drawing || event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (moveDrawing(touch.clientX, touch.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onTouchEnd(event) {
    if (!drawing) return;

    event.preventDefault();
    event.stopPropagation();

    finishDrawing();
  }

  function onTouchCancel(event) {
    if (!drawing) return;
    event.preventDefault();
    event.stopPropagation();
    cancelDrawing();
  }

  function onNativePointerDown(event) {
    if (!shouldHandleTrustedPointer(event)) return;

    if (beginDrawing(event.clientX, event.clientY)) {
      nativePointerId = event.pointerId;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onNativePointerMove(event) {
    if (!shouldHandleTrustedPointer(event) || event.pointerId !== nativePointerId) return;

    if (moveDrawing(event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onNativePointerUp(event) {
    if (!shouldHandleTrustedPointer(event) || event.pointerId !== nativePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrawing();
  }

  function onNativePointerCancel(event) {
    if (!shouldHandleTrustedPointer(event) || event.pointerId !== nativePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    cancelDrawing();
  }

  function onContextMenu(event) {
    if (!enabled) return;
    if (!event.isTrusted) return;
    const board = findBoardAt(event.clientX, event.clientY);
    if (!board) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function blockTrustedBoardInput(event) {
    if (!enabled || !event.isTrusted) return;
    if (event.type.startsWith("pointer") && event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.type.startsWith("mouse") || event.type === "click") && event.button !== 0) return;

    const board = findBoardAt(event.clientX, event.clientY);
    if (!board) return;

    event.preventDefault();
    event.stopPropagation();
  }

  function shouldHandleTrustedPointer(event) {
    if (!enabled || !event.isTrusted) return false;
    if (event.pointerType === "mouse") return false;
    return Boolean(findBoardAt(event.clientX, event.clientY)) || drawing;
  }

  function beginDrawing(clientX, clientY) {
    const board = findBoardAt(clientX, clientY);
    if (!board) return false;

    drawing = true;
    pointerId += 1;
    startPoint = snapToSquare(board, clientX, clientY);
    lastPoint = startPoint;

    dispatchRightButtonSequence(board, "down", startPoint);
    return true;
  }

  function moveDrawing(clientX, clientY) {
    const board = findBoardAt(clientX, clientY) || findLargestBoard();
    if (!board) return false;

    lastPoint = snapToSquare(board, clientX, clientY);
    dispatchRightButtonSequence(board, "move", lastPoint);
    return true;
  }

  function finishDrawing() {
    const board = findBoardAt(lastPoint.clientX, lastPoint.clientY) || findLargestBoard();
    if (board) {
      dispatchRightButtonSequence(board, "up", lastPoint);
    }
    cancelDrawing();
  }

  function cancelDrawing() {
    drawing = false;
    nativePointerId = null;
    startPoint = null;
    lastPoint = null;
  }

  function findBoardAt(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const element of elements) {
      const board = closestBoard(element);
      if (board) return board;
    }
    return null;
  }

  function closestBoard(element) {
    if (!(element instanceof Element)) return null;

    for (const selector of BOARD_SELECTORS) {
      const board = element.matches(selector) ? element : element.closest(selector);
      if (board && isUsableBoard(board)) return board;
    }

    return null;
  }

  function findLargestBoard() {
    let best = null;
    let bestArea = 0;

    for (const selector of BOARD_SELECTORS) {
      for (const board of document.querySelectorAll(selector)) {
        if (!isUsableBoard(board)) continue;
        const rect = board.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          best = board;
          bestArea = area;
        }
      }
    }

    return best;
  }

  function isUsableBoard(board) {
    const rect = board.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 160) return false;
    const ratio = rect.width / rect.height;
    return ratio > 0.85 && ratio < 1.15;
  }

  function snapToSquare(board, clientX, clientY) {
    const rect = board.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const left = rect.left + (rect.width - size) / 2;
    const top = rect.top + (rect.height - size) / 2;
    const file = clamp(Math.floor((clientX - left) / (size / 8)), 0, 7);
    const rank = clamp(Math.floor((clientY - top) / (size / 8)), 0, 7);
    const squareSize = size / 8;

    return {
      clientX: left + file * squareSize + squareSize / 2,
      clientY: top + rank * squareSize + squareSize / 2
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dispatchRightButtonSequence(board, phase, point) {
    const target = document.elementFromPoint(point.clientX, point.clientY) || board;
    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: point.clientX,
      clientY: point.clientY,
      screenX: window.screenX + point.clientX,
      screenY: window.screenY + point.clientY,
      buttons: phase === "up" ? 0 : 2,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false
    };

    if (window.PointerEvent) {
      const pointerType = phase === "down" ? "pointerdown" : phase === "move" ? "pointermove" : "pointerup";
      target.dispatchEvent(new PointerEvent(pointerType, {
        ...common,
        button: phase === "move" ? -1 : 2,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        width: 1,
        height: 1,
        pressure: phase === "up" ? 0 : 0.5
      }));
    }

    const mouseType = phase === "down" ? "mousedown" : phase === "move" ? "mousemove" : "mouseup";
    target.dispatchEvent(new MouseEvent(mouseType, {
      ...common,
      button: phase === "move" ? 0 : 2
    }));

    if (phase === "up" && startPoint && isSameSquarePoint(startPoint, point)) {
      target.dispatchEvent(new MouseEvent("contextmenu", {
        ...common,
        button: 2
      }));
    }
  }

  function isSameSquarePoint(first, second) {
    return Math.abs(first.clientX - second.clientX) < 1 && Math.abs(first.clientY - second.clientY) < 1;
  }

  install();
})();
