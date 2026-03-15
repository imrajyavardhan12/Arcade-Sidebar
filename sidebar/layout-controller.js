(function defineSidebarLayoutController(globalScope) {
  "use strict";

  const DEFAULT_FIXED_SHIFT_STYLE_ID = "bts-fixed-shift";
  const DEFAULT_PAGE_OFFSET_CSS_VAR = "--bts-page-offset";
  const DEFAULT_LAYOUT_ADAPTER_ATTRIBUTE = "data-bts-layout-adapter";
  const YOUTUBE_HOSTNAME_PATTERN = /(^|\.)youtube\.com$/i;

  function createSidebarLayoutController(options = {}) {
    const globalScopeRef = options.globalScope || globalScope;
    const documentRef = options.document || globalScopeRef.document;
    const sidebarEl = options.sidebarEl || null;
    const overlayEl = options.overlayEl || null;
    const toggleButton = options.toggleButton || null;
    const commandPaletteEl = options.commandPaletteEl || null;
    const resizeHandle = options.resizeHandle || null;
    const defaultWidth = Number.isFinite(options.defaultWidth) ? options.defaultWidth : 320;
    const minWidth = Number.isFinite(options.minWidth) ? options.minWidth : 240;
    const maxWidth = Number.isFinite(options.maxWidth) ? options.maxWidth : 480;
    const openTransition =
      typeof options.openTransition === "string"
        ? options.openTransition
        : "transform 250ms cubic-bezier(0.0, 0.0, 0.2, 1.0)";
    const closeTransition =
      typeof options.closeTransition === "string"
        ? options.closeTransition
        : "transform 220ms cubic-bezier(0.4, 0.0, 1.0, 1.0)";
    const hostId = String(options.hostId || "brave-tab-sidebar-host");
    const fixedShiftStyleId = String(
      options.fixedShiftStyleId || DEFAULT_FIXED_SHIFT_STYLE_ID
    );
    const pageOffsetCssVar = String(
      options.pageOffsetCssVar || DEFAULT_PAGE_OFFSET_CSS_VAR
    );
    const layoutAdapterAttribute = String(
      options.layoutAdapterAttribute || DEFAULT_LAYOUT_ADAPTER_ATTRIBUTE
    );
    const onStateChange =
      typeof options.onStateChange === "function" ? options.onStateChange : null;
    const onPersistState =
      typeof options.onPersistState === "function" ? options.onPersistState : null;
    const onBroadcastOpenState =
      typeof options.onBroadcastOpenState === "function"
        ? options.onBroadcastOpenState
        : null;
    const onClose = typeof options.onClose === "function" ? options.onClose : null;

    const state = {
      sidebarWidth: clampWidth(defaultWidth),
      sidebarOpen: Boolean(options.initialOpen),
      animationState: options.initialOpen ? "open" : "closed"
    };
    let resizeBound = false;

    function notifyStateChange() {
      onStateChange?.({ ...state });
    }

    function clampWidth(value) {
      return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
    }

    function ensureFixedShiftStyle() {
      const existing = documentRef?.getElementById?.(fixedShiftStyleId);
      if (existing) {
        return existing;
      }

      const style = documentRef?.createElement?.("style");
      if (!style) {
        return null;
      }

      style.id = fixedShiftStyleId;
      const parent = documentRef.head || documentRef.documentElement;
      parent?.appendChild?.(style);
      return style;
    }

    function getLayoutAdapterOverride() {
      return String(
        documentRef?.documentElement?.getAttribute?.(layoutAdapterAttribute) || ""
      )
        .trim()
        .toLowerCase();
    }

    function isYouTubePage() {
      if (getLayoutAdapterOverride() === "youtube") {
        return true;
      }

      return YOUTUBE_HOSTNAME_PATTERN.test(
        String(globalScopeRef.location?.hostname || "")
      );
    }

    function getGenericFixedShiftStyles(width) {
      return `
        [style*="position: fixed"]:not(#${hostId}),
        [style*="position:fixed"]:not(#${hostId}) {
          margin-left: ${width}px !important;
          max-width: calc(100% - ${width}px) !important;
        }
      `;
    }

    function getYouTubeShiftStyles() {
      return `
        ytd-app {
          margin-left: var(${pageOffsetCssVar}) !important;
          width: calc(100% - var(${pageOffsetCssVar})) !important;
          max-width: calc(100vw - var(${pageOffsetCssVar})) !important;
          box-sizing: border-box !important;
        }

        #masthead-container,
        #guide,
        #mini-guide,
        ytd-mini-guide-renderer,
        tp-yt-app-header,
        #contentContainer.tp-yt-app-header-layout,
        tp-yt-app-header-layout > #contentContainer {
          margin-left: var(${pageOffsetCssVar}) !important;
          max-width: calc(100vw - var(${pageOffsetCssVar})) !important;
          box-sizing: border-box !important;
        }

        ${getGenericFixedShiftStyles(`var(${pageOffsetCssVar})`)}
      `;
    }

    function pushPageContent(open, width, animate) {
      const rootStyle = documentRef?.documentElement?.style;
      if (!rootStyle) {
        return;
      }

      const marginLeft = open ? `${width}px` : "0px";
      rootStyle.transition = animate
        ? "margin-left 250ms cubic-bezier(0.0, 0.0, 0.2, 1.0)"
        : "none";

      const youTubePage = isYouTubePage();
      rootStyle.marginLeft = youTubePage ? "0px" : marginLeft;
      if (open) {
        rootStyle.setProperty(pageOffsetCssVar, marginLeft);
      } else {
        rootStyle.removeProperty(pageOffsetCssVar);
      }

      const style = ensureFixedShiftStyle();
      if (!style) {
        return;
      }

      style.textContent = open
        ? youTubePage
          ? getYouTubeShiftStyles()
          : getGenericFixedShiftStyles(width)
        : "";
    }

    function syncOpenClasses() {
      sidebarEl?.classList?.toggle("is-open", state.sidebarOpen);
      overlayEl?.classList?.toggle("is-open", state.sidebarOpen);
    }

    function updateToggleButton() {
      if (!toggleButton) {
        return;
      }

      toggleButton.title = state.sidebarOpen ? "Hide sidebar" : "Show sidebar";
      toggleButton.setAttribute(
        "aria-label",
        state.sidebarOpen ? "Hide sidebar" : "Show sidebar"
      );
    }

    function applyWidthToDOM() {
      const width = `${state.sidebarWidth}px`;
      sidebarEl?.style?.setProperty?.("--bts-sidebar-width", width);
      if (sidebarEl?.style) {
        sidebarEl.style.width = width;
      }
      commandPaletteEl?.style?.setProperty?.("--bts-sidebar-width", width);
    }

    function freezeMidAnimationTransform() {
      if (
        state.animationState !== "opening" &&
        state.animationState !== "closing"
      ) {
        return;
      }

      const computedStyle = globalScopeRef.getComputedStyle?.(sidebarEl);
      const currentTransform = computedStyle?.transform;
      if (!currentTransform || currentTransform === "none") {
        return;
      }

      if (sidebarEl?.style) {
        sidebarEl.style.transition = "none";
        sidebarEl.style.transform = currentTransform;
      }
      sidebarEl?.getBoundingClientRect?.();
    }

    function setSidebarWidth(nextWidth, options = {}) {
      const { persist = true } = options;
      state.sidebarWidth = clampWidth(nextWidth);
      applyWidthToDOM();

      if (state.sidebarOpen) {
        pushPageContent(true, state.sidebarWidth, false);
      }

      notifyStateChange();

      if (persist) {
        onPersistState?.();
      }
    }

    function setOpen(nextOpen, options = {}) {
      const { persist = true, broadcast = false, animate = true } = options;
      const normalized = Boolean(nextOpen);

      if (normalized === state.sidebarOpen) {
        return;
      }

      freezeMidAnimationTransform();

      state.sidebarOpen = normalized;
      state.animationState = normalized ? "opening" : "closing";
      notifyStateChange();

      if (!animate) {
        if (sidebarEl?.style) {
          sidebarEl.style.transition = "none";
          sidebarEl.style.transform = state.sidebarOpen
            ? "translateX(0)"
            : "translateX(-100%)";
        }
        syncOpenClasses();
        pushPageContent(state.sidebarOpen, state.sidebarWidth, false);
        if (!state.sidebarOpen) {
          onClose?.();
        }
        state.animationState = state.sidebarOpen ? "open" : "closed";
        notifyStateChange();
        updateToggleButton();
        if (persist) {
          onPersistState?.();
        }
        if (broadcast) {
          onBroadcastOpenState?.();
        }
        return;
      }

      if (sidebarEl?.style) {
        sidebarEl.style.willChange = "transform";
        sidebarEl.style.transition = state.sidebarOpen
          ? openTransition
          : closeTransition;
      }
      pushPageContent(state.sidebarOpen, state.sidebarWidth, true);

      globalScopeRef.requestAnimationFrame?.(() => {
        syncOpenClasses();
        if (sidebarEl?.style) {
          sidebarEl.style.transform = state.sidebarOpen
            ? "translateX(0)"
            : "translateX(-100%)";
        }
      });

      if (!state.sidebarOpen) {
        onClose?.();
      }

      updateToggleButton();

      if (persist) {
        onPersistState?.();
      }

      if (broadcast) {
        onBroadcastOpenState?.();
      }
    }

    function handleTransitionEnd(event) {
      if (event?.propertyName !== "transform") {
        return;
      }

      state.animationState = state.sidebarOpen ? "open" : "closed";
      if (sidebarEl?.style) {
        sidebarEl.style.willChange = "auto";
      }
      notifyStateChange();
    }

    function bindResizeHandle() {
      if (resizeBound || !resizeHandle) {
        return;
      }

      resizeBound = true;
      let dragContext = null;

      function onPointerMove(event) {
        if (!dragContext) {
          return;
        }

        const delta = event.clientX - dragContext.startX;
        setSidebarWidth(dragContext.startWidth + delta, { persist: false });
      }

      function onPointerUp() {
        if (!dragContext) {
          return;
        }

        dragContext = null;
        resizeHandle.classList.remove("is-dragging");
        documentRef.removeEventListener?.("pointermove", onPointerMove);
        setSidebarWidth(state.sidebarWidth, { persist: true });
      }

      resizeHandle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        resizeHandle.setPointerCapture?.(event.pointerId);
        resizeHandle.classList.add("is-dragging");
        dragContext = {
          startX: event.clientX,
          startWidth: state.sidebarWidth
        };
        documentRef.addEventListener?.("pointermove", onPointerMove);
        documentRef.addEventListener?.("pointerup", onPointerUp, { once: true });
      });
    }

    applyWidthToDOM();
    updateToggleButton();
    notifyStateChange();

    return {
      bindResizeHandle,
      clampWidth,
      getAnimationState() {
        return state.animationState;
      },
      getSidebarWidth() {
        return state.sidebarWidth;
      },
      getState() {
        return { ...state };
      },
      handleTransitionEnd,
      isOpen() {
        return state.sidebarOpen;
      },
      isYouTubePage,
      pushPageContent,
      setOpen,
      setSidebarWidth
    };
  }

  const api = {
    createSidebarLayoutController
  };

  globalScope.BraveSidebarLayoutController = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
