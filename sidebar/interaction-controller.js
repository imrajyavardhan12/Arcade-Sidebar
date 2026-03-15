(function defineSidebarInteractionController(globalScope) {
  "use strict";

  function createSidebarInteractionController(options = {}) {
    const globalScopeRef = options.globalScope || globalScope;
    const documentRef = options.document || globalScopeRef.document || null;
    const shadowRoot = options.shadowRoot || null;
    const searchInput = options.searchInput || null;
    const searchWrap = options.searchWrap || null;
    const searchToggleButton = options.searchToggleButton || null;
    const commandPaletteEl = options.commandPaletteEl || null;
    const commandBackdrop = options.commandBackdrop || null;
    const commandInput = options.commandInput || null;
    const commandList = options.commandList || null;
    const contextMenuEl = options.contextMenuEl || null;
    const keyboardNavModule = options.keyboardNavModule || null;
    const commandPaletteDataModule = options.commandPaletteDataModule || null;
    const quickSwitcherModule = options.quickSwitcherModule || null;
    const contextMenuModelModule = options.contextMenuModelModule || null;
    const contextMenuActionsModule = options.contextMenuActionsModule || null;
    const MAX_FAVORITES = Number.isInteger(options.maxFavorites) ? options.maxFavorites : 12;
    const MESSAGE_TYPES = options.MESSAGE_TYPES || {};
    const getWindowId =
      typeof options.getWindowId === "function" ? options.getWindowId : () => null;
    const getTabs = typeof options.getTabs === "function" ? options.getTabs : () => [];
    const getGroups = typeof options.getGroups === "function" ? options.getGroups : () => [];
    const getFavorites =
      typeof options.getFavorites === "function" ? options.getFavorites : () => [];
    const getPinnedNodes =
      typeof options.getPinnedNodes === "function" ? options.getPinnedNodes : () => [];
    const getVisibleTabs =
      typeof options.getVisibleTabs === "function" ? options.getVisibleTabs : () => [];
    const getActiveTabId =
      typeof options.getActiveTabId === "function" ? options.getActiveTabId : () => null;
    const getSidebarOpen =
      typeof options.getSidebarOpen === "function" ? options.getSidebarOpen : () => false;
    const setOpen = typeof options.setOpen === "function" ? options.setOpen : () => {};
    const renderTabList =
      typeof options.renderTabList === "function" ? options.renderTabList : () => {};
    const focusRenderedTabRow =
      typeof options.focusRenderedTabRow === "function"
        ? options.focusRenderedTabRow
        : () => {};
    const sendMessage =
      typeof options.sendMessage === "function" ? options.sendMessage : async () => ({ ok: false });
    const getSearchQuery =
      typeof options.getSearchQuery === "function" ? options.getSearchQuery : () => "";
    const setSearchQuery =
      typeof options.setSearchQuery === "function" ? options.setSearchQuery : () => {};
    const expandSearch =
      typeof options.expandSearch === "function" ? options.expandSearch : () => {};
    const collapseSearch =
      typeof options.collapseSearch === "function" ? options.collapseSearch : () => {};
    const openOrFocusUrl =
      typeof options.openOrFocusUrl === "function" ? options.openOrFocusUrl : async () => {};
    const resolveTabForStorage =
      typeof options.resolveTabForStorage === "function"
        ? options.resolveTabForStorage
        : async (value) => value;
    const addTabToFavorites =
      typeof options.addTabToFavorites === "function"
        ? options.addTabToFavorites
        : async () => {};
    const removeFavoriteByUrl =
      typeof options.removeFavoriteByUrl === "function"
        ? options.removeFavoriteByUrl
        : async () => {};
    const pinTabInActiveSpace =
      typeof options.pinTabInActiveSpace === "function"
        ? options.pinTabInActiveSpace
        : async () => {};
    const unpinUrlInActiveSpace =
      typeof options.unpinUrlInActiveSpace === "function"
        ? options.unpinUrlInActiveSpace
        : async () => {};
    const normalizeUrlKey =
      typeof options.normalizeUrlKey === "function" ? options.normalizeUrlKey : (value) => value;
    const isHttpUrl =
      typeof options.isHttpUrl === "function" ? options.isHttpUrl : () => false;
    const isUrlInFavorites =
      typeof options.isUrlInFavorites === "function" ? options.isUrlInFavorites : () => false;
    const isUrlPinnedInActiveSpace =
      typeof options.isUrlPinnedInActiveSpace === "function"
        ? options.isUrlPinnedInActiveSpace
        : () => false;
    const clearDragDropVisualState =
      typeof options.clearDragDropVisualState === "function"
        ? options.clearDragDropVisualState
        : () => {};
    const resetDragDropState =
      typeof options.resetDragDropState === "function" ? options.resetDragDropState : () => {};

    const state = {
      focusedTabId: Number.isInteger(options.initialFocusedTabId)
        ? options.initialFocusedTabId
        : null,
      contextMenuTabId: null,
      commandPaletteOpen: false,
      commandPaletteQuery: "",
      commandPaletteItems: [],
      commandPaletteFocusedIndex: -1,
      suppressPointerUntil: 0
    };
    let bound = false;

    function requestFrame(callback) {
      if (typeof globalScopeRef.requestAnimationFrame === "function") {
        return globalScopeRef.requestAnimationFrame(callback);
      }

      callback();
      return 0;
    }

    function now() {
      const performanceRef = globalScopeRef.performance;
      if (performanceRef && typeof performanceRef.now === "function") {
        return performanceRef.now();
      }
      return Date.now();
    }

    function getComposedPath(event) {
      return typeof event?.composedPath === "function" ? event.composedPath() : [];
    }

    function isEditableTarget(target) {
      if (!target || typeof target !== "object") {
        return false;
      }

      const tagName = String(target.tagName || "").toUpperCase();
      return tagName === "INPUT" || tagName === "TEXTAREA" || Boolean(target.isContentEditable);
    }

    function getVisibleTabIds() {
      return keyboardNavModule.normalizeTabIds(
        getVisibleTabs().map((tab) => tab?.id)
      );
    }

    function restoreFocusedTabRow(options = {}) {
      focusRenderedTabRow(state.focusedTabId, options);
    }

    function closeContextMenu() {
      state.contextMenuTabId = null;
      contextMenuEl?.replaceChildren?.();
      contextMenuEl?.classList?.remove?.("is-open");
      contextMenuEl?.setAttribute?.("aria-hidden", "true");
    }

    function createCommandPaletteCandidates() {
      return commandPaletteDataModule.createCommandPaletteCandidates({
        tabs: getTabs(),
        favorites: getFavorites(),
        pinnedNodes: getPinnedNodes(),
        sidebarOpen: getSidebarOpen()
      });
    }

    function setCommandPaletteFocusedIndex(nextIndex) {
      if (state.commandPaletteItems.length === 0) {
        state.commandPaletteFocusedIndex = -1;
        return;
      }

      const clamped = Math.max(
        0,
        Math.min(state.commandPaletteItems.length - 1, Number(nextIndex) || 0)
      );
      state.commandPaletteFocusedIndex = clamped;

      const rows = commandList?.querySelectorAll?.(".bts-command-item") || [];
      for (const row of rows) {
        const rowIndex = Number(row?.dataset?.commandIndex);
        const isActive = rowIndex === state.commandPaletteFocusedIndex;
        row.classList?.toggle?.("is-active", isActive);
        row.setAttribute?.("aria-selected", isActive ? "true" : "false");
        if (isActive) {
          row.scrollIntoView?.({ block: "nearest" });
        }
      }
    }

    function renderCommandPaletteList() {
      commandList?.replaceChildren?.();

      if (!state.commandPaletteItems.length) {
        const empty = documentRef?.createElement?.("div");
        if (!empty) {
          return;
        }
        empty.className = "bts-command-empty";
        empty.textContent = "No results";
        commandList?.append?.(empty);
        return;
      }

      for (let index = 0; index < state.commandPaletteItems.length; index += 1) {
        const item = state.commandPaletteItems[index];
        const row = documentRef?.createElement?.("button");
        const label = documentRef?.createElement?.("span");
        const subtitle = documentRef?.createElement?.("span");
        if (!row || !label || !subtitle) {
          continue;
        }

        row.type = "button";
        row.className = "bts-command-item";
        row.dataset.commandIndex = String(index);
        row.dataset.commandType = String(item.type || "action");
        row.setAttribute("role", "option");
        row.setAttribute(
          "aria-selected",
          index === state.commandPaletteFocusedIndex ? "true" : "false"
        );
        if (index === state.commandPaletteFocusedIndex) {
          row.classList.add("is-active");
        }

        label.className = "bts-command-label";
        label.textContent = item.label;

        subtitle.className = "bts-command-subtitle";
        subtitle.textContent = item.subtitle || "";

        row.append(label, subtitle);
        row.addEventListener("mouseenter", () => {
          setCommandPaletteFocusedIndex(index);
        });
        row.addEventListener("click", () => {
          void executeCommandPaletteItem(item);
        });

        commandList?.append?.(row);
      }
    }

    function refreshCommandPaletteItems(options = {}) {
      const { preserveSelection = false } = options;
      const previousSelectedId =
        preserveSelection && state.commandPaletteFocusedIndex >= 0
          ? state.commandPaletteItems[state.commandPaletteFocusedIndex]?.id
          : null;

      const candidates = createCommandPaletteCandidates();
      state.commandPaletteItems = quickSwitcherModule.rankItems(
        candidates,
        state.commandPaletteQuery,
        60
      );

      if (!state.commandPaletteItems.length) {
        state.commandPaletteFocusedIndex = -1;
      } else if (previousSelectedId) {
        const nextIndex = state.commandPaletteItems.findIndex(
          (item) => item.id === previousSelectedId
        );
        state.commandPaletteFocusedIndex = nextIndex >= 0 ? nextIndex : 0;
      } else if (
        state.commandPaletteFocusedIndex < 0 ||
        state.commandPaletteFocusedIndex >= state.commandPaletteItems.length
      ) {
        state.commandPaletteFocusedIndex = 0;
      }

      renderCommandPaletteList();
    }

    async function executeCommandPaletteItem(item) {
      if (!item || typeof item !== "object") {
        return;
      }

      closeCommandPalette({ restoreTabFocus: false });

      if (item.command === "new-tab") {
        await sendMessage({
          type: MESSAGE_TYPES.CREATE_TAB,
          payload: {
            windowId: getWindowId()
          }
        });
        return;
      }

      if (item.command === "focus-search") {
        expandSearch();
        return;
      }

      if (item.command === "toggle-sidebar") {
        setOpen(!getSidebarOpen(), { persist: true, broadcast: true, animate: true });
        return;
      }

      if (item.command === "close-active-tab" && Number.isInteger(item.tabId)) {
        await sendMessage({
          type: MESSAGE_TYPES.CLOSE_TAB,
          payload: { tabId: item.tabId }
        });
        return;
      }

      if (item.command === "toggle-pin-active-tab" && Number.isInteger(item.tabId)) {
        await sendMessage({
          type: MESSAGE_TYPES.UPDATE_TAB,
          payload: {
            tabId: item.tabId,
            update: { pinned: Boolean(item.nextPinned) }
          }
        });
        return;
      }

      if (item.command === "activate-tab" && Number.isInteger(item.tabId)) {
        state.focusedTabId = item.tabId;
        await sendMessage({
          type: MESSAGE_TYPES.ACTIVATE_TAB,
          payload: { tabId: item.tabId }
        });
        return;
      }

      if (item.command === "open-url" && typeof item.url === "string") {
        await openOrFocusUrl(item.url);
      }
    }

    function openCommandPalette() {
      if (state.commandPaletteOpen) {
        return;
      }

      closeContextMenu();

      state.commandPaletteOpen = true;
      state.commandPaletteQuery = "";
      if (commandInput) {
        commandInput.value = "";
      }

      commandPaletteEl?.classList?.add?.("is-open");
      commandPaletteEl?.setAttribute?.("aria-hidden", "false");
      refreshCommandPaletteItems({ preserveSelection: false });

      requestFrame(() => {
        commandInput?.focus?.();
        commandInput?.select?.();
      });
    }

    function closeCommandPalette(options = {}) {
      const { restoreTabFocus = true } = options;
      if (!state.commandPaletteOpen) {
        return;
      }

      state.commandPaletteOpen = false;
      state.commandPaletteQuery = "";
      state.commandPaletteItems = [];
      state.commandPaletteFocusedIndex = -1;

      commandPaletteEl?.classList?.remove?.("is-open");
      commandPaletteEl?.setAttribute?.("aria-hidden", "true");
      if (commandInput) {
        commandInput.value = "";
      }
      commandList?.replaceChildren?.();

      if (restoreTabFocus) {
        restoreFocusedTabRow({ preventScroll: true });
      }
    }

    function toggleCommandPalette() {
      if (state.commandPaletteOpen) {
        closeCommandPalette({ restoreTabFocus: true });
        return;
      }

      if (!getSidebarOpen()) {
        setOpen(true, { persist: true, broadcast: true, animate: true });
      }

      openCommandPalette();
    }

    function isCommandPaletteShortcut(event) {
      if (!event || typeof event !== "object") {
        return false;
      }

      if (event.altKey || event.shiftKey) {
        return false;
      }

      if (!event.metaKey && !event.ctrlKey) {
        return false;
      }

      return String(event.key || "").toLowerCase() === "k";
    }

    function handleCommandPaletteShortcut(event) {
      if (!isCommandPaletteShortcut(event)) {
        return false;
      }

      if (!state.commandPaletteOpen && isEditableTarget(event.target)) {
        return false;
      }

      event.preventDefault?.();
      event.stopPropagation?.();
      toggleCommandPalette();
      return true;
    }

    function armInteractionSuppression(durationMs = 260) {
      state.suppressPointerUntil = Math.max(
        state.suppressPointerUntil,
        now() + Math.max(0, Number(durationMs) || 0)
      );
    }

    function shouldSuppressInteraction(event) {
      if (now() >= state.suppressPointerUntil) {
        return false;
      }

      return !getComposedPath(event).includes(contextMenuEl);
    }

    function createContextMenuItem(label, onSelect, options = {}) {
      const item = documentRef?.createElement?.("button");
      if (!item) {
        return null;
      }

      item.type = "button";
      item.className = "bts-context-menu-item";
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      const isDisabled = Boolean(options.disabled);

      if (options.destructive) {
        item.classList.add("is-destructive");
      }

      if (options.secondary) {
        item.classList.add("is-secondary");
      }

      if (isDisabled) {
        item.classList.add("is-disabled");
        item.disabled = true;
      }

      item.addEventListener("pointerdown", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
      });

      item.addEventListener("mousedown", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
      });

      item.addEventListener("click", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (isDisabled) {
          return;
        }

        armInteractionSuppression();
        closeContextMenu();
        void Promise.resolve(onSelect()).catch(() => {});
      });

      return item;
    }

    function createContextMenuSeparator() {
      const separator = documentRef?.createElement?.("div");
      if (!separator) {
        return null;
      }

      separator.className = "bts-context-menu-separator";
      separator.setAttribute("role", "separator");
      return separator;
    }

    function positionContextMenu(x, y) {
      const width = contextMenuEl?.offsetWidth || 220;
      const height = contextMenuEl?.offsetHeight || 320;
      const maxX = Math.max(8, (globalScopeRef.innerWidth || 0) - width - 8);
      const maxY = Math.max(8, (globalScopeRef.innerHeight || 0) - height - 8);
      const left = Math.min(Math.max(8, x), maxX);
      const top = Math.min(Math.max(8, y), maxY);

      if (contextMenuEl?.style) {
        contextMenuEl.style.left = `${left}px`;
        contextMenuEl.style.top = `${top}px`;
      }
    }

    async function executeContextMenuAction(actionId, tab, entry = {}) {
      const tabUrl = normalizeUrlKey(tab?.url);
      const result = await contextMenuActionsModule.executeTabAction(actionId, {
        tab,
        tabUrl,
        groupId: entry.groupId,
        sendMessage,
        resolveTabForStorage,
        addTabToFavorites,
        removeFavoriteByUrl,
        pinTabInActiveSpace,
        unpinUrlInActiveSpace,
        MESSAGE_TYPES
      });

      if (result?.shouldRender) {
        renderTabList();
      }
    }

    function openContextMenuForTab(tab, x, y) {
      closeCommandPalette({ restoreTabFocus: false });

      if (!tab) {
        closeContextMenu();
        return;
      }

      state.contextMenuTabId = tab.id;
      const tabUrl = normalizeUrlKey(tab.url);
      const canStoreUrl = isHttpUrl(tabUrl);
      const model = contextMenuModelModule.buildTabContextMenuModel({
        tab,
        groups: getGroups(),
        canStoreUrl,
        isFavorite: isUrlInFavorites(tabUrl),
        favoritesCount: getFavorites().length,
        maxFavorites: MAX_FAVORITES,
        isPinnedInActiveSpace: isUrlPinnedInActiveSpace(tabUrl)
      });

      const items = model
        .map((entry) => {
          if (entry.kind === "separator") {
            return createContextMenuSeparator();
          }

          return createContextMenuItem(
            entry.label,
            () => executeContextMenuAction(entry.id, tab, entry),
            {
              destructive: entry.destructive,
              secondary: entry.secondary,
              disabled: entry.disabled
            }
          );
        })
        .filter(Boolean);

      contextMenuEl?.replaceChildren?.(...items);
      contextMenuEl?.classList?.add?.("is-open");
      contextMenuEl?.setAttribute?.("aria-hidden", "false");

      requestFrame(() => {
        positionContextMenu(x, y);
        const firstMenuItem = contextMenuEl?.querySelector?.(
          ".bts-context-menu-item:not(.is-disabled)"
        );
        if (firstMenuItem && typeof firstMenuItem.focus === "function") {
          firstMenuItem.focus();
        }
      });
    }

    function syncFocusedTabId(params = {}) {
      state.focusedTabId = keyboardNavModule.resolveFocusTabId({
        tabIds: params.tabIds,
        currentFocusedTabId: state.focusedTabId,
        activeTabId: params.activeTabId
      });
      return state.focusedTabId;
    }

    function moveFocusedTabByDirection(direction) {
      const tabIds = getVisibleTabIds();
      const nextFocusedTabId = keyboardNavModule.getNextFocusTabId({
        tabIds,
        currentFocusedTabId: state.focusedTabId,
        activeTabId: getActiveTabId(),
        direction
      });

      if (!Number.isInteger(nextFocusedTabId)) {
        return;
      }

      state.focusedTabId = nextFocusedTabId;
      renderTabList();
      restoreFocusedTabRow();
    }

    async function activateFocusedTab() {
      const tabIds = getVisibleTabIds();
      const tabId = keyboardNavModule.resolveFocusTabId({
        tabIds,
        currentFocusedTabId: state.focusedTabId,
        activeTabId: getActiveTabId()
      });

      if (!Number.isInteger(tabId)) {
        return;
      }

      state.focusedTabId = tabId;
      await sendMessage({
        type: MESSAGE_TYPES.ACTIVATE_TAB,
        payload: { tabId }
      });
    }

    async function closeFocusedTab() {
      const tabIds = getVisibleTabIds();
      const tabId = keyboardNavModule.resolveFocusTabId({
        tabIds,
        currentFocusedTabId: state.focusedTabId,
        activeTabId: getActiveTabId()
      });

      if (!Number.isInteger(tabId)) {
        return;
      }

      state.focusedTabId = keyboardNavModule.getFocusAfterClose({
        tabIds,
        closingTabId: tabId,
        currentFocusedTabId: state.focusedTabId,
        activeTabId: getActiveTabId()
      });

      await sendMessage({
        type: MESSAGE_TYPES.CLOSE_TAB,
        payload: { tabId }
      });
    }

    async function activateFirstVisibleTab() {
      const tabs = getVisibleTabs();
      const first = tabs[0];
      if (!first) {
        return;
      }

      state.focusedTabId = first.id;
      await sendMessage({
        type: MESSAGE_TYPES.ACTIVATE_TAB,
        payload: { tabId: first.id }
      });
    }

    function handleSearchToggleClick() {
      if (searchWrap?.classList?.contains?.("bts-search-collapsed")) {
        expandSearch();
        return;
      }

      collapseSearch();
    }

    function handleSearchInput() {
      setSearchQuery(searchInput?.value || "");
      closeContextMenu();
      renderTabList();
    }

    function handleSearchBlur() {
      if (!String(getSearchQuery() || "").trim()) {
        collapseSearch();
      }
    }

    function handleSearchKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault?.();
        event.stopPropagation?.();
        void activateFirstVisibleTab();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault?.();
        event.stopPropagation?.();
        moveFocusedTabByDirection(event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault?.();
        event.stopPropagation?.();
        collapseSearch();
        if (!getSearchQuery()) {
          setOpen(false, { persist: true, broadcast: true, animate: true });
        }
      }
    }

    function handleCommandInput() {
      state.commandPaletteQuery = commandInput?.value || "";
      refreshCommandPaletteItems({ preserveSelection: false });
    }

    function handleCommandInputKeydown(event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault?.();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          state.commandPaletteFocusedIndex < 0
            ? 0
            : state.commandPaletteFocusedIndex + delta;
        setCommandPaletteFocusedIndex(nextIndex);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault?.();
        const selected = state.commandPaletteItems[state.commandPaletteFocusedIndex];
        if (selected) {
          void executeCommandPaletteItem(selected);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault?.();
        closeCommandPalette({ restoreTabFocus: true });
      }
    }

    function handleShadowKeydown(event) {
      if (event.defaultPrevented) {
        return;
      }

      if (handleCommandPaletteShortcut(event)) {
        return;
      }

      const metaOrCtrl = event.metaKey || event.ctrlKey;
      const normalizedKey = String(event.key || "").toLowerCase();

      if (state.commandPaletteOpen) {
        if (event.key === "Escape") {
          event.preventDefault?.();
          closeCommandPalette({ restoreTabFocus: true });
          return;
        }

        if (
          event.target !== commandInput &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          event.preventDefault?.();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex =
            state.commandPaletteFocusedIndex < 0
              ? 0
              : state.commandPaletteFocusedIndex + delta;
          setCommandPaletteFocusedIndex(nextIndex);
          return;
        }

        if (event.target !== commandInput && event.key === "Enter") {
          event.preventDefault?.();
          const selected = state.commandPaletteItems[state.commandPaletteFocusedIndex];
          if (selected) {
            void executeCommandPaletteItem(selected);
          }
        }

        return;
      }

      if (event.key === "Escape" && state.contextMenuTabId !== null) {
        event.preventDefault?.();
        closeContextMenu();
        restoreFocusedTabRow({ preventScroll: true });
        return;
      }

      if (metaOrCtrl && normalizedKey === "f") {
        event.preventDefault?.();
        expandSearch();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault?.();
        if (getSearchQuery() || !searchWrap?.classList?.contains?.("bts-search-collapsed")) {
          collapseSearch();
          return;
        }

        if (getSidebarOpen()) {
          setOpen(false, { persist: true, broadcast: true, animate: true });
        }
        return;
      }

      if (!getSidebarOpen() || state.contextMenuTabId !== null) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault?.();
        moveFocusedTabByDirection(event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault?.();
        void activateFocusedTab();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault?.();
        void closeFocusedTab();
      }
    }

    function bind() {
      if (bound) {
        return;
      }

      bound = true;

      searchToggleButton?.addEventListener?.("click", handleSearchToggleClick);
      searchInput?.addEventListener?.("input", handleSearchInput);
      searchInput?.addEventListener?.("blur", handleSearchBlur);
      searchInput?.addEventListener?.("keydown", handleSearchKeydown);

      commandBackdrop?.addEventListener?.("click", () => {
        closeCommandPalette({ restoreTabFocus: true });
      });

      commandInput?.addEventListener?.("input", handleCommandInput);
      commandInput?.addEventListener?.("keydown", handleCommandInputKeydown);

      commandList?.addEventListener?.("mousedown", (event) => {
        event.preventDefault?.();
      });

      documentRef?.addEventListener?.(
        "keydown",
        (event) => {
          if (event.defaultPrevented) {
            return;
          }
          handleCommandPaletteShortcut(event);
        },
        true
      );

      shadowRoot?.addEventListener?.(
        "pointerup",
        (event) => {
          if (!shouldSuppressInteraction(event)) {
            return;
          }
          event.preventDefault?.();
          event.stopPropagation?.();
        },
        true
      );

      shadowRoot?.addEventListener?.(
        "click",
        (event) => {
          if (!shouldSuppressInteraction(event)) {
            return;
          }
          event.preventDefault?.();
          event.stopPropagation?.();
        },
        true
      );

      shadowRoot?.addEventListener?.("keydown", handleShadowKeydown);

      shadowRoot?.addEventListener?.("pointerdown", (event) => {
        if (shouldSuppressInteraction(event)) {
          event.preventDefault?.();
          event.stopPropagation?.();
          return;
        }

        if (state.contextMenuTabId === null) {
          return;
        }

        const path = getComposedPath(event);
        if (!path.includes(contextMenuEl)) {
          closeContextMenu();
        }
      });

      shadowRoot?.addEventListener?.("contextmenu", (event) => {
        if (state.contextMenuTabId === null) {
          return;
        }

        const path = getComposedPath(event);
        if (!path.some((node) => node?.classList?.contains?.("bts-tab-row"))) {
          closeContextMenu();
        }
      });

      shadowRoot?.addEventListener?.("dragend", () => {
        resetDragDropState();
        clearDragDropVisualState();
      });
    }

    function handlePostRender(options = {}) {
      if (options.hadTabRowFocus && Number.isInteger(state.focusedTabId)) {
        restoreFocusedTabRow({ preventScroll: true });
      }

      if (Number.isInteger(state.contextMenuTabId)) {
        const tabStillVisible = (Array.isArray(options.tabs) ? options.tabs : []).some(
          (tab) => tab.id === state.contextMenuTabId
        );
        if (!tabStillVisible) {
          closeContextMenu();
        }
      }

      if (state.commandPaletteOpen) {
        refreshCommandPaletteItems({ preserveSelection: true });
      }
    }

    function handleSidebarClosed() {
      closeContextMenu();
      closeCommandPalette({ restoreTabFocus: false });
    }

    return {
      bind,
      closeCommandPalette,
      closeContextMenu,
      getContextMenuTabId() {
        return state.contextMenuTabId;
      },
      getFocusedTabId() {
        return state.focusedTabId;
      },
      getState() {
        return {
          focusedTabId: state.focusedTabId,
          contextMenuTabId: state.contextMenuTabId,
          commandPaletteOpen: state.commandPaletteOpen,
          commandPaletteQuery: state.commandPaletteQuery,
          commandPaletteFocusedIndex: state.commandPaletteFocusedIndex,
          commandPaletteItems: state.commandPaletteItems.slice()
        };
      },
      handlePostRender,
      handleSidebarClosed,
      isCommandPaletteOpen() {
        return state.commandPaletteOpen;
      },
      openContextMenuForTab,
      setFocusedTabId(tabId) {
        state.focusedTabId = Number.isInteger(tabId) ? tabId : null;
      },
      syncFocusedTabId,
      toggleCommandPalette
    };
  }

  const api = {
    createSidebarInteractionController
  };

  globalScope.BraveSidebarInteractionController = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
