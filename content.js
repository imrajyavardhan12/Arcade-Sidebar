(function bootstrapSidebarContent(globalScope) {
  if (globalScope.top !== globalScope.self) {
    return;
  }

  if (globalScope.__BRAVE_TAB_SIDEBAR_LOADED__) {
    return;
  }
  globalScope.__BRAVE_TAB_SIDEBAR_LOADED__ = true;

  const searchModule = globalScope.BraveSidebarSearch;
  const groupsModule = globalScope.BraveSidebarGroups;
  const tabsModule = globalScope.BraveSidebarTabs;
  const sidebarDataModule = globalScope.BraveSidebarData;
  const dragStateModule = globalScope.BraveSidebarDragState;
  const dragDropControllerModule = globalScope.BraveSidebarDragDropController;
  const keyboardNavModule = globalScope.BraveSidebarKeyboardNav;
  const renderPerfModule = globalScope.BraveSidebarRenderPerf;
  const contextMenuModelModule = globalScope.BraveSidebarContextMenuModel;
  const commandPaletteDataModule = globalScope.BraveSidebarCommandPaletteData;
  const quickSwitcherModule = globalScope.BraveSidebarQuickSwitcher;
  const messagesModule = globalScope.BraveSidebarMessages;

  if (
    !searchModule ||
    !groupsModule ||
    !tabsModule ||
    !sidebarDataModule ||
    !dragStateModule ||
    !dragDropControllerModule ||
    !keyboardNavModule ||
    !renderPerfModule ||
    !contextMenuModelModule ||
    !commandPaletteDataModule ||
    !quickSwitcherModule
  ) {
    return;
  }

  const WINDOW_STATE_PREFIX = "bts_window_state_";
  const SIDEBAR_DATA_KEY = "bts_sidebar_data_v1";
  const MAX_FAVORITES = 12;
  const DEFAULT_SPACE = {
    id: "space-personal",
    name: "Personal",
    icon: "🪼"
  };
  const DEFAULT_WIDTH = 280;
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 400;
  const OPEN_TRANSITION = "transform 250ms cubic-bezier(0.0, 0.0, 0.2, 1.0)";
  const CLOSE_TRANSITION = "transform 220ms cubic-bezier(0.4, 0.0, 1.0, 1.0)";
  const MESSAGE_TYPES = messagesModule?.MESSAGE_TYPES || {
    GET_STATE: "sidebar:getState",
    GET_TAB: "sidebar:getTab",
    SET_WINDOW_OPEN: "sidebar:setWindowOpen",
    ACTIVATE_TAB: "sidebar:activateTab",
    CLOSE_TAB: "sidebar:closeTab",
    CREATE_TAB: "sidebar:createTab",
    MOVE_TAB: "sidebar:moveTab",
    UPDATE_TAB: "sidebar:updateTab",
    DUPLICATE_TAB: "sidebar:duplicateTab",
    CLOSE_OTHER_TABS: "sidebar:closeOtherTabs",
    SET_TAB_GROUP: "sidebar:setTabGroup",
    PING: "sidebar:ping",
    STATE: "sidebar:state",
    SET_OPEN: "sidebar:setOpen",
    TOGGLE_COMMAND_PALETTE: "sidebar:toggleCommandPalette"
  };

  let windowId = null;
  let sidebarWidth = DEFAULT_WIDTH;
  let sidebarOpen = false;
  let animationState = "closed";
  let searchQuery = "";
  let collapsedGroupIds = new Set();
  let previousVisibleTabIds = new Set();
  let focusedTabId = null;
  let contextMenuTabId = null;
  let commandPaletteOpen = false;
  let commandPaletteQuery = "";
  let commandPaletteItems = [];
  let commandPaletteFocusedIndex = -1;
  let suppressPointerUntil = 0;
  let runtimeContextAlive = true;
  let sidebarData = {
    spaces: [DEFAULT_SPACE],
    activeSpaceId: DEFAULT_SPACE.id,
    favorites: [],
    pinnedBySpace: {
      [DEFAULT_SPACE.id]: []
    }
  };
  let sidebarDataVersion = 0;
  let renderedArcDataVersion = -1;
  let sidebarDataSignature = "";
  let latestSnapshot = {
    windowId: null,
    tabs: [],
    groups: []
  };

  const renderCoalescer = renderPerfModule.createRenderCoalescer(
    (run) => globalScope.requestAnimationFrame(run),
    (frameHandle) => globalScope.cancelAnimationFrame(frameHandle)
  );
  const dragDropController = dragDropControllerModule.createDragDropController({
    dragStateModule,
    maxFavorites: MAX_FAVORITES
  });
  sidebarDataSignature = getSidebarDataSignature(sidebarData);

  const host = document.createElement("div");
  host.id = "brave-tab-sidebar-host";
  host.style.cssText = "position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";

  const shadowRoot = host.attachShadow({ mode: "open" });

  const fallbackStyleEl = document.createElement("style");
  fallbackStyleEl.textContent = `
    .bts-overlay {
      position: fixed;
      inset: 0;
      border: 0;
      margin: 0;
      padding: 0;
      opacity: 0;
      pointer-events: none;
      background: rgba(15, 23, 42, 0.14);
    }
    .bts-sidebar {
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
    }
    .bts-context-menu {
      position: fixed;
      display: none;
      min-width: 220px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
      z-index: 3;
      padding: 6px;
    }
    .bts-context-menu.is-open {
      display: block;
    }
    .bts-context-menu-item {
      display: block;
      width: 100%;
      height: 30px;
      border: 0;
      background: transparent;
      text-align: left;
      border-radius: 8px;
      padding: 0 10px;
    }
  `;

  const linkEl = document.createElement("link");
  linkEl.rel = "stylesheet";
  linkEl.href = chrome.runtime.getURL("sidebar/styles.css");

  const overlayEl = document.createElement("button");
  overlayEl.type = "button";
  overlayEl.className = "bts-overlay";
  overlayEl.setAttribute("aria-label", "Close sidebar");

  const contextMenuEl = document.createElement("div");
  contextMenuEl.className = "bts-context-menu";
  contextMenuEl.setAttribute("role", "menu");
  contextMenuEl.setAttribute("aria-hidden", "true");

  const commandPaletteEl = document.createElement("div");
  commandPaletteEl.className = "bts-command-palette";
  commandPaletteEl.setAttribute("aria-hidden", "true");
  commandPaletteEl.innerHTML = `
    <div class="bts-command-backdrop"></div>
    <section class="bts-command-panel" role="dialog" aria-label="Command palette">
      <input id="bts-command-input" class="bts-command-input" type="search" placeholder="Search tabs, pinned, favorites, actions" autocomplete="off" />
      <div id="bts-command-list" class="bts-command-list" role="listbox" aria-label="Command results"></div>
    </section>
  `;

  const sidebarEl = document.createElement("aside");
  sidebarEl.className = "bts-sidebar";
  sidebarEl.style.cssText = `position: fixed; inset: 0 auto 0 0; width: ${DEFAULT_WIDTH}px; height: 100vh; transform: translateX(-100%); transition: none; pointer-events: auto;`;
  sidebarEl.setAttribute("role", "complementary");
  sidebarEl.setAttribute("aria-label", "Brave tab sidebar");

  sidebarEl.innerHTML = `
    <div class="bts-toolbar">
      <button id="bts-toggle-btn" class="bts-icon-btn" type="button" aria-label="Hide sidebar">❮</button>
      <button id="bts-new-tab-btn" class="bts-icon-btn" type="button" aria-label="New tab" title="New tab">＋</button>
    </div>
    <div class="bts-search-wrap">
      <input id="bts-search-input" class="bts-search-input" type="search" placeholder="Search tabs by title or URL" />
    </div>
    <div class="bts-favorites-wrap">
      <div id="bts-favorites-grid" class="bts-favorites-grid"></div>
    </div>
    <div class="bts-space-header">
      <span id="bts-space-icon" class="bts-space-icon">${DEFAULT_SPACE.icon}</span>
      <span id="bts-space-name" class="bts-space-name">${DEFAULT_SPACE.name}</span>
      <button id="bts-new-folder-btn" class="bts-folder-add-btn" type="button">＋ Folder</button>
    </div>
    <div id="bts-pinned-list" class="bts-pinned-list"></div>
    <button id="bts-new-tab-row" class="bts-new-tab-row" type="button">＋ New Tab</button>
    <div class="bts-today-title">Today</div>
    <div id="bts-tab-list" class="bts-tab-list" aria-live="polite"></div>
    <div class="bts-spaces-dock">
      <div id="bts-spaces-list" class="bts-spaces-list"></div>
      <button id="bts-add-space-btn" class="bts-space-add-btn" type="button" aria-label="Add space" title="Add space">＋</button>
    </div>
    <div id="bts-resize-handle" class="bts-resize-handle" title="Resize sidebar" role="separator" aria-orientation="vertical"></div>
  `;

  shadowRoot.append(fallbackStyleEl, linkEl, overlayEl, sidebarEl, contextMenuEl, commandPaletteEl);
  document.documentElement.append(host);

  const toggleButton = sidebarEl.querySelector("#bts-toggle-btn");
  const newTabButton = sidebarEl.querySelector("#bts-new-tab-btn");
  const newTabRowButton = sidebarEl.querySelector("#bts-new-tab-row");
  const searchInput = sidebarEl.querySelector("#bts-search-input");
  const favoritesGrid = sidebarEl.querySelector("#bts-favorites-grid");
  const spaceIconEl = sidebarEl.querySelector("#bts-space-icon");
  const spaceNameEl = sidebarEl.querySelector("#bts-space-name");
  const newFolderButton = sidebarEl.querySelector("#bts-new-folder-btn");
  const pinnedList = sidebarEl.querySelector("#bts-pinned-list");
  const spacesList = sidebarEl.querySelector("#bts-spaces-list");
  const addSpaceButton = sidebarEl.querySelector("#bts-add-space-btn");
  const tabList = sidebarEl.querySelector("#bts-tab-list");
  const resizeHandle = sidebarEl.querySelector("#bts-resize-handle");
  const commandBackdrop = commandPaletteEl.querySelector(".bts-command-backdrop");
  const commandInput = commandPaletteEl.querySelector("#bts-command-input");
  const commandList = commandPaletteEl.querySelector("#bts-command-list");

  function storageGet(key) {
    if (!runtimeContextAlive) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve()
      .then(
        () =>
          new Promise((resolve, reject) => {
            if (!chrome?.storage?.local?.get) {
              reject(new Error("STORAGE_GET_UNAVAILABLE"));
              return;
            }
            chrome.storage.local.get([key], (result) => {
              const error = chrome.runtime?.lastError;
              if (error) {
                reject(new Error(error.message));
                return;
              }
              resolve(result?.[key]);
            });
          })
      )
      .catch((error) => {
        if (String(error?.message || "").includes("Extension context invalidated")) {
          runtimeContextAlive = false;
        }
        return undefined;
      });
  }

  function storageSet(key, value) {
    if (!runtimeContextAlive) {
      return Promise.resolve();
    }

    return Promise.resolve()
      .then(
        () =>
          new Promise((resolve, reject) => {
            if (!chrome?.storage?.local?.set) {
              reject(new Error("STORAGE_SET_UNAVAILABLE"));
              return;
            }
            chrome.storage.local.set({ [key]: value }, () => {
              const error = chrome.runtime?.lastError;
              if (error) {
                reject(new Error(error.message));
                return;
              }
              resolve();
            });
          })
      )
      .catch((error) => {
        if (String(error?.message || "").includes("Extension context invalidated")) {
          runtimeContextAlive = false;
        }
      });
  }

  function validateSidebarMessage(message) {
    if (!message || typeof message !== "object") {
      return { ok: false, error: "INVALID_MESSAGE" };
    }

    if (typeof message.type !== "string") {
      return { ok: false, error: "INVALID_MESSAGE_TYPE" };
    }

    const isKnownMessageType = messagesModule?.isKnownMessageType;
    if (typeof isKnownMessageType === "function" && !isKnownMessageType(message.type)) {
      return { ok: false, error: "UNKNOWN_MESSAGE_TYPE" };
    }

    const validatePayload = messagesModule?.validatePayload;
    if (typeof validatePayload !== "function") {
      return { ok: true };
    }

    return validatePayload(message.type, message.payload);
  }

  function sendMessage(message) {
    if (!runtimeContextAlive) {
      return Promise.resolve({ ok: false, error: "EXTENSION_CONTEXT_INVALIDATED" });
    }

    const validation = validateSidebarMessage(message);
    if (!validation.ok) {
      return Promise.resolve({ ok: false, error: validation.error });
    }

    return Promise.resolve()
      .then(
        () =>
          new Promise((resolve, reject) => {
            if (!chrome?.runtime?.sendMessage) {
              reject(new Error("RUNTIME_SEND_UNAVAILABLE"));
              return;
            }
            chrome.runtime.sendMessage(message, (response) => {
              const error = chrome.runtime?.lastError;
              if (error) {
                reject(new Error(error.message));
                return;
              }
              resolve(response || { ok: false, error: "NO_RESPONSE" });
            });
          })
      )
      .catch((error) => {
        const messageText = String(error?.message || "SEND_FAILED");
        if (messageText.includes("Extension context invalidated")) {
          runtimeContextAlive = false;
        }
        return { ok: false, error: messageText };
      });
  }

  function getSidebarDataSignature(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  function markSidebarDataChanged() {
    sidebarDataVersion += 1;
    sidebarDataSignature = getSidebarDataSignature(sidebarData);
  }

  function createDefaultSidebarData() {
    return sidebarDataModule.createDefaultSidebarData(DEFAULT_SPACE);
  }

  function isHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function isSafeImageSource(src) {
    const value = String(src || "").trim();
    if (!value) {
      return false;
    }
    return /^(data:|blob:|chrome-extension:)/i.test(value);
  }

  function normalizeUrlKey(url) {
    return dragStateModule.normalizeUrlKey(url);
  }

  function sanitizeSavedItem(item) {
    return sidebarDataModule.sanitizeSavedItem(item, {
      normalizeUrlKey,
      isHttpUrl
    });
  }

  function sanitizePinnedLinkNode(node) {
    return sidebarDataModule.sanitizePinnedLinkNode(node, {
      normalizeUrlKey,
      isHttpUrl
    });
  }

  function sanitizePinnedFolderNode(node) {
    return sidebarDataModule.sanitizePinnedFolderNode(node, {
      normalizeUrlKey,
      isHttpUrl
    });
  }

  function sanitizePinnedNode(node) {
    return sidebarDataModule.sanitizePinnedNode(node, {
      normalizeUrlKey,
      isHttpUrl
    });
  }

  function sanitizeSidebarData(rawValue) {
    return sidebarDataModule.sanitizeSidebarData(rawValue, {
      defaultSpace: DEFAULT_SPACE,
      maxFavorites: MAX_FAVORITES,
      normalizeUrlKey,
      isHttpUrl
    });
  }

  function getActiveSpace() {
    const active = sidebarData.spaces.find((space) => space.id === sidebarData.activeSpaceId);
    return active || sidebarData.spaces[0] || DEFAULT_SPACE;
  }

  function getActiveSpacePinnedNodes() {
    const activeSpace = getActiveSpace();
    const items = sidebarData.pinnedBySpace[activeSpace.id];
    return Array.isArray(items) ? items : [];
  }

  function isUrlInFavorites(url) {
    return dragStateModule.isUrlInFavorites(sidebarData.favorites, url);
  }

  function isUrlPinnedInActiveSpace(url) {
    return dragStateModule.isUrlPinnedInNodes(getActiveSpacePinnedNodes(), url);
  }

  async function persistSidebarData() {
    markSidebarDataChanged();
    await storageSet(SIDEBAR_DATA_KEY, sidebarData);
  }

  async function hydrateSidebarData() {
    const stored = await storageGet(SIDEBAR_DATA_KEY);
    sidebarData = sanitizeSidebarData(stored);
    markSidebarDataChanged();
  }

  function createSavedItemFromTab(tab) {
    return sidebarDataModule.createSavedItemFromTab(tab, {
      normalizeUrlKey,
      isHttpUrl
    });
  }

  function createPinnedLinkNodeFromSavedItem(item) {
    return sidebarDataModule.createPinnedLinkNodeFromSavedItem(item);
  }

  function updatePinnedLinkByUrl(nodes, urlKey, updateLink) {
    return dragStateModule.updatePinnedLinkByUrl(nodes, urlKey, updateLink);
  }

  async function addTabToFavorites(tab) {
    const item = createSavedItemFromTab(tab);
    if (!item) {
      return;
    }

    const key = normalizeUrlKey(item.url);
    const existingIndex = sidebarData.favorites.findIndex(
      (entry) => normalizeUrlKey(entry.url) === key
    );

    if (existingIndex >= 0) {
      sidebarData.favorites[existingIndex] = {
        ...sidebarData.favorites[existingIndex],
        title: item.title,
        favIconUrl: item.favIconUrl || sidebarData.favorites[existingIndex].favIconUrl
      };
    } else {
      if (sidebarData.favorites.length >= MAX_FAVORITES) {
        return;
      }
      sidebarData.favorites.push(item);
    }

    await persistSidebarData();
  }

  async function removeFavoriteByUrl(url) {
    const key = normalizeUrlKey(url);
    sidebarData.favorites = sidebarData.favorites.filter(
      (item) => normalizeUrlKey(item.url) !== key
    );
    await persistSidebarData();
  }

  async function pinTabInActiveSpace(tab) {
    const item = createSavedItemFromTab(tab);
    if (!item) {
      return;
    }

    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes().slice();
    const key = normalizeUrlKey(item.url);

    const updated = updatePinnedLinkByUrl(currentItems, key, (existing) => {
      existing.title = item.title;
      existing.favIconUrl = item.favIconUrl || existing.favIconUrl;
    });

    if (!updated) {
      currentItems.push(createPinnedLinkNodeFromSavedItem(item));
    }

    sidebarData.pinnedBySpace[activeSpace.id] = currentItems;
    await persistSidebarData();
  }

  function removePinnedLinkByIdFromNodes(nodes, linkId) {
    let removed = false;
    const next = [];

    for (const node of nodes) {
      if (node?.type === "link") {
        if (node.id === linkId) {
          removed = true;
          continue;
        }
        next.push(node);
        continue;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        const children = node.children.filter((child) => {
          if (child.id === linkId) {
            removed = true;
            return false;
          }
          return true;
        });

        next.push({
          ...node,
          children
        });
        continue;
      }

      next.push(node);
    }

    return { next, removed };
  }

  async function removePinnedLinkById(linkId) {
    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes();
    const { next, removed } = removePinnedLinkByIdFromNodes(currentItems, linkId);
    if (!removed) {
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = next;
    await persistSidebarData();
  }

  async function unpinUrlInActiveSpace(url) {
    const activeSpace = getActiveSpace();
    const key = normalizeUrlKey(url);
    const currentItems = getActiveSpacePinnedNodes()
      .map((node) => {
        if (node?.type === "link") {
          return normalizeUrlKey(node.url) === key ? null : node;
        }

        if (node?.type === "folder" && Array.isArray(node.children)) {
          return {
            ...node,
            children: node.children.filter((child) => normalizeUrlKey(child.url) !== key)
          };
        }

        return node;
      })
      .filter(Boolean);

    sidebarData.pinnedBySpace[activeSpace.id] = currentItems;
    await persistSidebarData();
  }

  async function openOrFocusUrl(url) {
    const key = normalizeUrlKey(url);
    if (!key) {
      return;
    }

    const existingTab = latestSnapshot.tabs.find((tab) => normalizeUrlKey(tab.url) === key);
    if (existingTab?.id) {
      await sendMessage({
        type: MESSAGE_TYPES.ACTIVATE_TAB,
        payload: { tabId: existingTab.id }
      });
      return;
    }

    await sendMessage({
      type: MESSAGE_TYPES.CREATE_TAB,
      payload: {
        windowId,
        url: key
      }
    });
  }

  async function resolveTabForStorage(tab) {
    if (!tab || typeof tab !== "object") {
      return tab;
    }

    if (isHttpUrl(tab.url)) {
      return tab;
    }

    if (!Number.isInteger(tab.id)) {
      return tab;
    }

    const response = await sendMessage({
      type: MESSAGE_TYPES.GET_TAB,
      payload: {
        tabId: tab.id
      }
    });

    if (response?.ok && response.tab) {
      return response.tab;
    }

    return tab;
  }

  function createSavedItemButton(item, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.favorite ? "bts-favorite-btn" : "bts-pinned-row";
    button.title = item.title || item.url;

    const favicon = document.createElement("img");
    favicon.className = options.favorite ? "bts-favorite-favicon" : "bts-pinned-favicon";
    favicon.alt = "";
    favicon.decoding = "async";
    favicon.loading = "lazy";
    if (isSafeImageSource(item.favIconUrl)) {
      favicon.src = item.favIconUrl;
    } else {
      favicon.classList.add("is-fallback");
    }
    favicon.addEventListener("error", () => {
      favicon.removeAttribute("src");
      favicon.classList.add("is-fallback");
    });

    button.addEventListener("click", () => {
      void openOrFocusUrl(item.url);
    });

    if (options.favorite) {
      button.draggable = true;
      button.addEventListener("dragstart", (event) => {
        dragDropController.beginFavoriteDrag(item.id);
        button.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", item.url || item.id);
        }
      });
      button.addEventListener("dragend", () => {
        dragDropController.endFavoriteDrag();
        button.classList.remove("is-dragging");
        clearDragDropVisualState();
      });
      button.append(favicon);
      return button;
    }

    const title = document.createElement("span");
    title.className = "bts-pinned-title";
    title.textContent = item.title || item.url;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "bts-pinned-remove";
    removeButton.textContent = "×";
    removeButton.title = "Unpin";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (typeof options.onRemove === "function") {
        void options.onRemove();
        return;
      }

      void unpinUrlInActiveSpace(item.url).then(() => {
        renderTabList();
      });
    });

    button.append(favicon, title, removeButton);
    return button;
  }

  function createPinnedLinkRow(node, options = {}) {
    const button = createSavedItemButton(node, {
      favorite: false,
      onRemove: async () => {
        await removePinnedLinkById(node.id);
        renderTabList();
      }
    });
    button.dataset.pinnedLinkId = String(node.id);
    button.draggable = true;

    if (options.inFolder) {
      button.classList.add("is-folder-child");
    }

    button.addEventListener("dragstart", (event) => {
      dragDropController.beginPinnedDrag(node.id, options.folderId || null);
      button.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.url || node.id);
      }
    });

    button.addEventListener("dragend", () => {
      dragDropController.endPinnedDrag();
      button.classList.remove("is-dragging");
      clearDragDropVisualState();
    });

    return button;
  }

  async function togglePinnedFolderCollapsed(folderId) {
    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes().slice();
    const folder = currentItems.find((node) => node?.type === "folder" && node.id === folderId);
    if (!folder) {
      return;
    }

    folder.collapsed = !folder.collapsed;
    sidebarData.pinnedBySpace[activeSpace.id] = currentItems;
    await persistSidebarData();
  }

  async function renamePinnedFolder(folderId) {
    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes().slice();
    const folder = currentItems.find((node) => node?.type === "folder" && node.id === folderId);
    if (!folder) {
      return;
    }

    const nextName = globalScope.prompt?.("Folder name", folder.title || "New Folder");
    if (typeof nextName !== "string") {
      return;
    }

    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    folder.title = trimmed;
    sidebarData.pinnedBySpace[activeSpace.id] = currentItems;
    await persistSidebarData();
  }

  async function createPinnedFolder() {
    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes().slice();
    const defaultName = `Folder ${currentItems.filter((node) => node?.type === "folder").length + 1}`;
    const nextName = globalScope.prompt?.("Folder name", defaultName);
    if (typeof nextName !== "string") {
      return;
    }

    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    currentItems.push({
      type: "folder",
      id: `pfolder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title: trimmed,
      collapsed: false,
      children: []
    });

    sidebarData.pinnedBySpace[activeSpace.id] = currentItems;
    await persistSidebarData();
  }

  async function movePinnedLinkToFolder(targetFolderId) {
    const activeSpace = getActiveSpace();
    const transition = dragDropController.movePinnedLinkToFolder({
      nodes: getActiveSpacePinnedNodes().slice(),
      targetFolderId
    });

    if (!transition.moved) {
      if (transition.reason === "duplicateInTarget") {
        clearDragDropVisualState();
      }
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = transition.nodes;
    await persistSidebarData();
    clearDragDropVisualState();
    renderTabList();
  }

  async function movePinnedLinkToTopLevel() {
    const activeSpace = getActiveSpace();
    const transition = dragDropController.movePinnedLinkToTopLevel({
      nodes: getActiveSpacePinnedNodes().slice()
    });

    if (!transition.moved) {
      if (
        transition.reason === "noFromFolder" ||
        transition.reason === "noSourceFolder" ||
        transition.reason === "noSourceLink"
      ) {
        clearDragDropVisualState();
      }
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = transition.nodes;
    await persistSidebarData();
    clearDragDropVisualState();
    renderTabList();
  }

  async function moveFavoriteToPinnedTopLevel() {
    const activeSpace = getActiveSpace();
    const transition = dragDropController.moveFavoriteToPinnedTopLevel({
      nodes: getActiveSpacePinnedNodes().slice(),
      favorites: sidebarData.favorites,
      createPinnedId: () => `plink-${Date.now()}-${Math.random().toString(16).slice(2)}`
    });

    if (!transition.moved) {
      if (transition.reason === "noFavorite") {
        clearDragDropVisualState();
      }
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = transition.nodes;
    sidebarData.favorites = transition.favorites;
    await persistSidebarData();
    clearDragDropVisualState();
    renderTabList();
  }

  async function moveFavoriteToFolder(targetFolderId) {
    const activeSpace = getActiveSpace();
    const transition = dragDropController.moveFavoriteToFolder({
      nodes: getActiveSpacePinnedNodes().slice(),
      favorites: sidebarData.favorites,
      targetFolderId,
      createPinnedId: () => `plink-${Date.now()}-${Math.random().toString(16).slice(2)}`
    });

    if (!transition.moved) {
      if (transition.reason === "noFavorite") {
        clearDragDropVisualState();
      }
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = transition.nodes;
    sidebarData.favorites = transition.favorites;
    await persistSidebarData();
    clearDragDropVisualState();
    renderTabList();
  }

  async function movePinnedLinkToFavorites() {
    const activeSpace = getActiveSpace();
    const transition = dragDropController.movePinnedLinkToFavorites({
      nodes: getActiveSpacePinnedNodes(),
      favorites: sidebarData.favorites,
      createFavoriteId: () => `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
    });

    if (!transition.moved) {
      clearDragDropVisualState();
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = transition.nodes;
    sidebarData.favorites = transition.favorites;
    await persistSidebarData();
    clearDragDropVisualState();
    renderTabList();
  }

  async function movePinnedLinkToToday() {
    const activeSpace = getActiveSpace();
    const transition = dragDropController.movePinnedLinkToToday({
      nodes: getActiveSpacePinnedNodes(),
    });

    if (transition.moved) {
      sidebarData.pinnedBySpace[activeSpace.id] = transition.nodes;
      await persistSidebarData();
    }

    clearDragDropVisualState();
    renderTabList();
  }

  async function moveFavoriteToToday() {
    const transition = dragDropController.moveFavoriteToToday({
      favorites: sidebarData.favorites,
    });

    if (transition.moved) {
      sidebarData.favorites = transition.favorites;
      await persistSidebarData();
    }

    clearDragDropVisualState();
    renderTabList();
  }

  function getSnapshotTabById(tabId) {
    return latestSnapshot.tabs.find((tab) => tab.id === tabId) || null;
  }

  async function pinSnapshotTabToSidebar(tabId) {
    const tab = getSnapshotTabById(tabId);
    if (!tab) {
      return;
    }

    const resolvedTab = await resolveTabForStorage(tab);
    await pinTabInActiveSpace(resolvedTab);
    renderTabList();
  }

  async function favoriteSnapshotTab(tabId) {
    const tab = getSnapshotTabById(tabId);
    if (!tab) {
      return;
    }

    const resolvedTab = await resolveTabForStorage(tab);
    await addTabToFavorites(resolvedTab);
    renderTabList();
  }

  function extractPinnedLinkByUrl(nodes, urlKey, targetFolderId) {
    let extracted = null;

    const nextNodes = nodes
      .map((node) => {
        if (node?.type === "link") {
          if (normalizeUrlKey(node.url) === urlKey) {
            extracted = node;
            return null;
          }
          return node;
        }

        if (node?.type === "folder" && Array.isArray(node.children)) {
          const children = node.children.filter((child) => {
            const isMatch = normalizeUrlKey(child.url) === urlKey;
            if (isMatch && node.id !== targetFolderId) {
              extracted = child;
              return false;
            }
            return true;
          });

          return {
            ...node,
            children
          };
        }

        return node;
      })
      .filter(Boolean);

    return {
      nextNodes,
      extracted
    };
  }

  async function pinSnapshotTabToFolder(tabId, folderId) {
    const tab = getSnapshotTabById(tabId);
    if (!tab) {
      return;
    }

    const resolvedTab = await resolveTabForStorage(tab);
    const item = createSavedItemFromTab(resolvedTab);
    if (!item) {
      return;
    }

    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes().slice();
    const targetFolder = currentItems.find(
      (node) => node?.type === "folder" && node.id === folderId
    );

    if (!targetFolder) {
      return;
    }

    const key = normalizeUrlKey(item.url);
    const { nextNodes, extracted } = extractPinnedLinkByUrl(currentItems, key, folderId);
    const folderInNext = nextNodes.find((node) => node?.type === "folder" && node.id === folderId);
    if (!folderInNext) {
      return;
    }

    const existingChild = folderInNext.children.find(
      (child) => normalizeUrlKey(child.url) === key
    );

    if (existingChild) {
      existingChild.title = item.title;
      existingChild.favIconUrl = item.favIconUrl || existingChild.favIconUrl;
    } else {
      const nodeToInsert = extracted
        ? {
            ...extracted,
            title: item.title,
            favIconUrl: item.favIconUrl || extracted.favIconUrl,
            type: "link"
          }
        : createPinnedLinkNodeFromSavedItem(item);

      folderInNext.children.push(nodeToInsert);
    }

    sidebarData.pinnedBySpace[activeSpace.id] = nextNodes;
    await persistSidebarData();
    renderTabList();
  }

  function createPinnedFolderSection(folder) {
    const section = document.createElement("section");
    section.className = "bts-pinned-folder";
    if (folder.collapsed) {
      section.classList.add("is-collapsed");
    }

    const header = document.createElement("div");
    header.className = "bts-pinned-folder-header";
    header.title = "Drop pinned tabs here";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bts-folder-toggle";
    toggle.textContent = folder.collapsed ? "▸" : "▾";
    toggle.addEventListener("click", async () => {
      await togglePinnedFolderCollapsed(folder.id);
      renderArcSections();
    });

    const name = document.createElement("span");
    name.className = "bts-folder-name";
    name.textContent = folder.title || "Folder";

    const count = document.createElement("span");
    count.className = "bts-folder-count";
    count.textContent = String(folder.children.length);

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "bts-folder-rename";
    rename.textContent = "✎";
    rename.title = "Rename folder";
    rename.addEventListener("click", async (event) => {
      event.stopPropagation();
      await renamePinnedFolder(folder.id);
      renderArcSections();
    });

    const handleDrop = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDragDropVisualState();

      if (dragDropController.hasPinnedDrag()) {
        await movePinnedLinkToFolder(folder.id);
        return;
      }

      if (dragDropController.hasFavoriteDrag()) {
        await moveFavoriteToFolder(folder.id);
        return;
      }

      if (dragDropController.hasTabDrag()) {
        const droppedTabId = dragDropController.consumeDraggingTabId();
        await pinSnapshotTabToFolder(droppedTabId, folder.id);
      }
    };

    header.addEventListener("dragover", (event) => {
      if (
        !dragDropController.hasPinnedDrag() &&
        !dragDropController.hasFavoriteDrag() &&
        !dragDropController.hasTabDrag()
      ) {
        return;
      }
      event.preventDefault();
      pinnedList.classList.remove("is-tab-drop-target");
      section.classList.add("is-drop-target");
    });

    header.addEventListener("dragleave", () => {
      section.classList.remove("is-drop-target");
    });

    header.addEventListener("drop", handleDrop);

    header.append(toggle, name, count, rename);

    const body = document.createElement("div");
    body.className = "bts-pinned-folder-body";

    body.addEventListener("dragover", (event) => {
      if (
        !dragDropController.hasPinnedDrag() &&
        !dragDropController.hasFavoriteDrag() &&
        !dragDropController.hasTabDrag()
      ) {
        return;
      }
      event.preventDefault();
      pinnedList.classList.remove("is-tab-drop-target");
      section.classList.add("is-drop-target");
    });

    body.addEventListener("dragleave", () => {
      section.classList.remove("is-drop-target");
    });

    body.addEventListener("drop", handleDrop);

    if (folder.children.length === 0) {
      const hint = document.createElement("div");
      hint.className = "bts-folder-empty";
      hint.textContent = "Drop pinned tabs here";
      body.append(hint);
    } else {
      for (const child of folder.children) {
        const childRow = createPinnedLinkRow(child, { inFolder: true, folderId: folder.id });
        body.append(childRow);
      }
    }

    section.append(header, body);
    return section;
  }

  function renderFavorites() {
    favoritesGrid.replaceChildren();

    for (const item of sidebarData.favorites) {
      const button = createSavedItemButton(item, { favorite: true });
      favoritesGrid.append(button);
    }

    const slotsToFill = Math.max(0, MAX_FAVORITES - sidebarData.favorites.length);
    for (let index = 0; index < slotsToFill; index += 1) {
      const placeholder = document.createElement("div");
      placeholder.className = "bts-favorite-slot";
      favoritesGrid.append(placeholder);
    }
  }

  function renderPinnedList() {
    pinnedList.replaceChildren();
    const items = getActiveSpacePinnedNodes();

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "bts-pinned-empty";
      empty.textContent = "No pinned tabs in this Space";
      pinnedList.append(empty);
      return;
    }

    for (const item of items) {
      if (item?.type === "folder") {
        const folder = createPinnedFolderSection(item);
        pinnedList.append(folder);
      } else {
        const row = createPinnedLinkRow(item, { inFolder: false });
        pinnedList.append(row);
      }
    }
  }

  function renderSpacesDock() {
    spacesList.replaceChildren();
    const activeSpace = getActiveSpace();
    spaceNameEl.textContent = activeSpace.name;
    spaceIconEl.textContent = activeSpace.icon || "•";

    for (const space of sidebarData.spaces) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bts-space-dot";
      if (space.id === activeSpace.id) {
        button.classList.add("is-active");
      }
      button.textContent = space.icon || "•";
      button.title = space.name;
      button.addEventListener("click", () => {
        sidebarData.activeSpaceId = space.id;
        void persistSidebarData().then(() => {
          renderTabList();
        });
      });
      spacesList.append(button);
    }
  }

  function renderArcSections() {
    renderFavorites();
    renderPinnedList();
    renderSpacesDock();
    renderedArcDataVersion = sidebarDataVersion;
  }

  function clearDragDropVisualState() {
    favoritesGrid.classList.remove("is-tab-drop-target");
    pinnedList.classList.remove("is-tab-drop-target");
    tabList.classList.remove("is-pin-drop-target");
    const highlightedFolders = pinnedList.querySelectorAll(".bts-pinned-folder.is-drop-target");
    for (const folderEl of highlightedFolders) {
      folderEl.classList.remove("is-drop-target");
    }
  }

  function setupArcDropZones() {
    favoritesGrid.addEventListener("dragover", (event) => {
      if (!dragDropController.hasTabDrag() && !dragDropController.hasPinnedDrag()) {
        return;
      }
      event.preventDefault();
      favoritesGrid.classList.add("is-tab-drop-target");
    });

    favoritesGrid.addEventListener("dragleave", () => {
      favoritesGrid.classList.remove("is-tab-drop-target");
    });

    favoritesGrid.addEventListener("drop", async (event) => {
      const draggingLiveTab = dragDropController.hasTabDrag();
      const draggingPinnedLink = dragDropController.hasPinnedDrag();
      if (!draggingLiveTab && !draggingPinnedLink) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      clearDragDropVisualState();

      if (draggingPinnedLink) {
        await movePinnedLinkToFavorites();
        return;
      }

      const droppedTabId = dragDropController.consumeDraggingTabId();
      await favoriteSnapshotTab(droppedTabId);
    });

    pinnedList.addEventListener("dragover", (event) => {
      const draggingLiveTab = dragDropController.hasTabDrag();
      const draggingPinnedLink = dragDropController.hasPinnedDrag();
      const draggingFavorite = dragDropController.hasFavoriteDrag();
      if (!draggingLiveTab && !draggingPinnedLink && !draggingFavorite) {
        return;
      }

      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const overFolder = path.some((node) => node?.classList?.contains?.("bts-pinned-folder"));
      if (overFolder) {
        return;
      }

      event.preventDefault();
      pinnedList.classList.add("is-tab-drop-target");
    });

    pinnedList.addEventListener("dragleave", () => {
      pinnedList.classList.remove("is-tab-drop-target");
    });

    pinnedList.addEventListener("drop", async (event) => {
      const draggingLiveTab = dragDropController.hasTabDrag();
      const draggingPinnedLink = dragDropController.hasPinnedDrag();
      const draggingFavorite = dragDropController.hasFavoriteDrag();
      if (!draggingLiveTab && !draggingPinnedLink && !draggingFavorite) {
        return;
      }

      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const overFolder = path.some((node) => node?.classList?.contains?.("bts-pinned-folder"));
      if (overFolder) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearDragDropVisualState();
      if (draggingPinnedLink) {
        await movePinnedLinkToTopLevel();
        return;
      }

      if (draggingFavorite) {
        await moveFavoriteToPinnedTopLevel();
        return;
      }

      const droppedTabId = dragDropController.consumeDraggingTabId();
      await pinSnapshotTabToSidebar(droppedTabId);
    });

    tabList.addEventListener("dragover", (event) => {
      if (!dragDropController.hasPinnedDrag() && !dragDropController.hasFavoriteDrag()) {
        return;
      }
      event.preventDefault();
      tabList.classList.add("is-pin-drop-target");
    });

    tabList.addEventListener("dragleave", () => {
      tabList.classList.remove("is-pin-drop-target");
    });

    tabList.addEventListener("drop", async (event) => {
      if (!dragDropController.hasPinnedDrag() && !dragDropController.hasFavoriteDrag()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (dragDropController.hasPinnedDrag()) {
        await movePinnedLinkToToday();
        return;
      }
      await moveFavoriteToToday();
    });
  }

  async function addSpace() {
    const index = sidebarData.spaces.length + 1;
    const newSpace = {
      id: `space-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: `Space ${index}`,
      icon: "•"
    };
    sidebarData.spaces.push(newSpace);
    sidebarData.pinnedBySpace[newSpace.id] = [];
    sidebarData.activeSpaceId = newSpace.id;
    await persistSidebarData();
    renderTabList();
  }

  function getStateKey() {
    return Number.isInteger(windowId) ? `${WINDOW_STATE_PREFIX}${windowId}` : null;
  }

  function clampWidth(value) {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
  }

  function updateToggleButton() {
    toggleButton.textContent = sidebarOpen ? "❮" : "❯";
    toggleButton.title = sidebarOpen ? "Hide sidebar" : "Show sidebar";
    toggleButton.setAttribute("aria-label", sidebarOpen ? "Hide sidebar" : "Show sidebar");
  }

  function syncOpenClasses() {
    sidebarEl.classList.toggle("is-open", sidebarOpen);
    overlayEl.classList.toggle("is-open", sidebarOpen);
  }

  function closeContextMenu() {
    contextMenuTabId = null;
    contextMenuEl.replaceChildren();
    contextMenuEl.classList.remove("is-open");
    contextMenuEl.setAttribute("aria-hidden", "true");
  }

  function createCommandPaletteCandidates() {
    return commandPaletteDataModule.createCommandPaletteCandidates({
      tabs: latestSnapshot.tabs,
      favorites: sidebarData.favorites,
      pinnedNodes: getActiveSpacePinnedNodes(),
      sidebarOpen
    });
  }

  function setCommandPaletteFocusedIndex(nextIndex) {
    if (commandPaletteItems.length === 0) {
      commandPaletteFocusedIndex = -1;
      return;
    }

    const clamped = Math.max(0, Math.min(commandPaletteItems.length - 1, nextIndex));
    commandPaletteFocusedIndex = clamped;

    const rows = commandList.querySelectorAll(".bts-command-item");
    for (const row of rows) {
      const rowIndex = Number(row.dataset.commandIndex);
      const isActive = rowIndex === commandPaletteFocusedIndex;
      row.classList.toggle("is-active", isActive);
      row.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) {
        row.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function renderCommandPaletteList() {
    commandList.replaceChildren();

    if (!commandPaletteItems.length) {
      const empty = document.createElement("div");
      empty.className = "bts-command-empty";
      empty.textContent = "No results";
      commandList.append(empty);
      return;
    }

    for (let index = 0; index < commandPaletteItems.length; index += 1) {
      const item = commandPaletteItems[index];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bts-command-item";
      row.dataset.commandIndex = String(index);
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", index === commandPaletteFocusedIndex ? "true" : "false");
      if (index === commandPaletteFocusedIndex) {
        row.classList.add("is-active");
      }

      const label = document.createElement("span");
      label.className = "bts-command-label";
      label.textContent = item.label;

      const subtitle = document.createElement("span");
      subtitle.className = "bts-command-subtitle";
      subtitle.textContent = item.subtitle || "";

      row.append(label, subtitle);

      row.addEventListener("mouseenter", () => {
        setCommandPaletteFocusedIndex(index);
      });

      row.addEventListener("click", () => {
        void executeCommandPaletteItem(item);
      });

      commandList.append(row);
    }
  }

  function refreshCommandPaletteItems(options = {}) {
    const { preserveSelection = false } = options;
    const previousSelectedId =
      preserveSelection && commandPaletteFocusedIndex >= 0
        ? commandPaletteItems[commandPaletteFocusedIndex]?.id
        : null;

    const candidates = createCommandPaletteCandidates();
    commandPaletteItems = quickSwitcherModule.rankItems(candidates, commandPaletteQuery, 60);

    if (!commandPaletteItems.length) {
      commandPaletteFocusedIndex = -1;
    } else if (previousSelectedId) {
      const nextIndex = commandPaletteItems.findIndex((item) => item.id === previousSelectedId);
      commandPaletteFocusedIndex = nextIndex >= 0 ? nextIndex : 0;
    } else if (commandPaletteFocusedIndex < 0 || commandPaletteFocusedIndex >= commandPaletteItems.length) {
      commandPaletteFocusedIndex = 0;
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
          windowId
        }
      });
      return;
    }

    if (item.command === "focus-search") {
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (item.command === "toggle-sidebar") {
      setOpen(!sidebarOpen, { persist: true, broadcast: true, animate: true });
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
      focusedTabId = item.tabId;
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
    if (commandPaletteOpen) {
      return;
    }

    closeContextMenu();

    commandPaletteOpen = true;
    commandPaletteQuery = "";
    commandInput.value = "";

    commandPaletteEl.classList.add("is-open");
    commandPaletteEl.setAttribute("aria-hidden", "false");
    refreshCommandPaletteItems({ preserveSelection: false });

    requestAnimationFrame(() => {
      commandInput.focus();
      commandInput.select();
    });
  }

  function closeCommandPalette(options = {}) {
    const { restoreTabFocus = true } = options;
    if (!commandPaletteOpen) {
      return;
    }

    commandPaletteOpen = false;
    commandPaletteQuery = "";
    commandPaletteItems = [];
    commandPaletteFocusedIndex = -1;

    commandPaletteEl.classList.remove("is-open");
    commandPaletteEl.setAttribute("aria-hidden", "true");
    commandInput.value = "";
    commandList.replaceChildren();

    if (restoreTabFocus) {
      focusRenderedTabRow(focusedTabId, { preventScroll: true });
    }
  }

  function toggleCommandPalette() {
    if (commandPaletteOpen) {
      closeCommandPalette({ restoreTabFocus: true });
      return;
    }

    if (!sidebarOpen) {
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

    if (!commandPaletteOpen && isEditableTarget(event.target)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleCommandPalette();
    return true;
  }

  function armInteractionSuppression(durationMs = 260) {
    suppressPointerUntil = Math.max(suppressPointerUntil, performance.now() + durationMs);
  }

  function shouldSuppressInteraction(event) {
    if (performance.now() >= suppressPointerUntil) {
      return false;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    return !path.includes(contextMenuEl);
  }

  function createContextMenuItem(label, onSelect, options = {}) {
    const item = document.createElement("button");
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
      event.preventDefault();
      event.stopPropagation();
    });

    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
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
    const separator = document.createElement("div");
    separator.className = "bts-context-menu-separator";
    separator.setAttribute("role", "separator");
    return separator;
  }

  function positionContextMenu(x, y) {
    const width = contextMenuEl.offsetWidth || 220;
    const height = contextMenuEl.offsetHeight || 320;
    const maxX = Math.max(8, globalScope.innerWidth - width - 8);
    const maxY = Math.max(8, globalScope.innerHeight - height - 8);
    const left = Math.min(Math.max(8, x), maxX);
    const top = Math.min(Math.max(8, y), maxY);

    contextMenuEl.style.left = `${left}px`;
    contextMenuEl.style.top = `${top}px`;
  }

  async function executeContextMenuAction(actionId, tab, options = {}) {
    const tabUrl = options.tabUrl;
    const groupId = options.groupId;

    if (actionId === "remove-from-favorites") {
      await removeFavoriteByUrl(tabUrl);
      renderTabList();
      return;
    }

    if (actionId === "add-to-favorites") {
      const resolvedTab = await resolveTabForStorage(tab);
      await addTabToFavorites(resolvedTab);
      renderTabList();
      return;
    }

    if (actionId === "unpin-from-sidebar") {
      await unpinUrlInActiveSpace(tabUrl);
      renderTabList();
      return;
    }

    if (actionId === "pin-to-sidebar") {
      const resolvedTab = await resolveTabForStorage(tab);
      await pinTabInActiveSpace(resolvedTab);
      renderTabList();
      return;
    }

    if (actionId === "toggle-tab-pin") {
      await sendMessage({
        type: MESSAGE_TYPES.UPDATE_TAB,
        payload: {
          tabId: tab.id,
          update: { pinned: !tab.pinned }
        }
      });
      return;
    }

    if (actionId === "toggle-tab-mute") {
      await sendMessage({
        type: MESSAGE_TYPES.UPDATE_TAB,
        payload: {
          tabId: tab.id,
          update: { muted: !tab.muted }
        }
      });
      return;
    }

    if (actionId === "duplicate-tab") {
      await sendMessage({
        type: MESSAGE_TYPES.DUPLICATE_TAB,
        payload: { tabId: tab.id }
      });
      return;
    }

    if (actionId === "close-other-tabs") {
      await sendMessage({
        type: MESSAGE_TYPES.CLOSE_OTHER_TABS,
        payload: { tabId: tab.id }
      });
      return;
    }

    if (actionId === "close-tab") {
      await sendMessage({
        type: MESSAGE_TYPES.CLOSE_TAB,
        payload: { tabId: tab.id }
      });
      return;
    }

    if (actionId === "move-to-new-group") {
      await sendMessage({
        type: MESSAGE_TYPES.SET_TAB_GROUP,
        payload: {
          tabId: tab.id,
          createNew: true,
          title: "New Group"
        }
      });
      return;
    }

    if (actionId === "remove-from-group") {
      await sendMessage({
        type: MESSAGE_TYPES.SET_TAB_GROUP,
        payload: {
          tabId: tab.id,
          groupId: -1
        }
      });
      return;
    }

    if (actionId === "move-to-group" && Number.isInteger(groupId)) {
      await sendMessage({
        type: MESSAGE_TYPES.SET_TAB_GROUP,
        payload: {
          tabId: tab.id,
          groupId
        }
      });
    }
  }

  function openContextMenuForTab(tab, x, y) {
    closeCommandPalette({ restoreTabFocus: false });

    if (!tab) {
      closeContextMenu();
      return;
    }

    contextMenuTabId = tab.id;
    const tabUrl = normalizeUrlKey(tab.url);
    const canStoreUrl = isHttpUrl(tabUrl);
    const model = contextMenuModelModule.buildTabContextMenuModel({
      tab,
      groups: latestSnapshot.groups,
      canStoreUrl,
      isFavorite: isUrlInFavorites(tabUrl),
      favoritesCount: sidebarData.favorites.length,
      maxFavorites: MAX_FAVORITES,
      isPinnedInActiveSpace: isUrlPinnedInActiveSpace(tabUrl)
    });

    const items = model.map((entry) => {
      if (entry.kind === "separator") {
        return createContextMenuSeparator();
      }

      return createContextMenuItem(
        entry.label,
        () => executeContextMenuAction(entry.id, tab, { tabUrl, groupId: entry.groupId }),
        {
          destructive: entry.destructive,
          secondary: entry.secondary,
          disabled: entry.disabled
        }
      );
    });

    contextMenuEl.replaceChildren(...items);
    contextMenuEl.classList.add("is-open");
    contextMenuEl.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      positionContextMenu(x, y);
      const firstMenuItem = contextMenuEl.querySelector(".bts-context-menu-item:not(.is-disabled)");
      if (firstMenuItem && typeof firstMenuItem.focus === "function") {
        firstMenuItem.focus();
      }
    });
  }

  async function persistWindowState() {
    const key = getStateKey();
    if (!key) {
      return;
    }
    await storageSet(key, {
      open: sidebarOpen,
      width: sidebarWidth,
      collapsedGroupIds: Array.from(collapsedGroupIds)
    });
  }

  function setSidebarWidth(nextWidth, options = {}) {
    const { persist = true } = options;
    sidebarWidth = clampWidth(nextWidth);
    sidebarEl.style.setProperty("--bts-sidebar-width", `${sidebarWidth}px`);
    commandPaletteEl.style.setProperty("--bts-sidebar-width", `${sidebarWidth}px`);
    if (persist) {
      void persistWindowState();
    }
  }

  function freezeMidAnimationTransform() {
    if (animationState !== "opening" && animationState !== "closing") {
      return;
    }

    const currentTransform = getComputedStyle(sidebarEl).transform;
    if (!currentTransform || currentTransform === "none") {
      return;
    }

    sidebarEl.style.transition = "none";
    sidebarEl.style.transform = currentTransform;
    sidebarEl.getBoundingClientRect();
  }

  async function broadcastOpenState() {
    if (!Number.isInteger(windowId)) {
      return;
    }

    await sendMessage({
      type: MESSAGE_TYPES.SET_WINDOW_OPEN,
      payload: {
        windowId,
        open: sidebarOpen
      }
    });
  }

  function setOpen(nextOpen, options = {}) {
    const { persist = true, broadcast = false, animate = true } = options;
    const normalized = Boolean(nextOpen);

    if (normalized === sidebarOpen) {
      return;
    }

    freezeMidAnimationTransform();

    sidebarOpen = normalized;
    animationState = sidebarOpen ? "opening" : "closing";

    if (!animate) {
      sidebarEl.style.transition = "none";
      syncOpenClasses();
      sidebarEl.style.transform = sidebarOpen ? "translateX(0)" : "translateX(-100%)";
      if (!sidebarOpen) {
        closeContextMenu();
        closeCommandPalette({ restoreTabFocus: false });
      }
      animationState = sidebarOpen ? "open" : "closed";
      updateToggleButton();
      if (persist) {
        void persistWindowState();
      }
      if (broadcast) {
        void broadcastOpenState();
      }
      return;
    }

    sidebarEl.style.willChange = "transform";
    sidebarEl.style.transition = sidebarOpen ? OPEN_TRANSITION : CLOSE_TRANSITION;

    requestAnimationFrame(() => {
      syncOpenClasses();
      sidebarEl.style.transform = sidebarOpen ? "translateX(0)" : "translateX(-100%)";
    });

    if (!sidebarOpen) {
      closeContextMenu();
      closeCommandPalette({ restoreTabFocus: false });
    }

    updateToggleButton();

    if (persist) {
      void persistWindowState();
    }

    if (broadcast) {
      void broadcastOpenState();
    }
  }

  function getVisibleTabs() {
    const tabsForToday = dragStateModule.filterTodayTabs({
      tabs: latestSnapshot.tabs,
      pinnedNodes: getActiveSpacePinnedNodes(),
      favorites: sidebarData.favorites
    });
    return searchModule.filterTabs(tabsForToday, searchQuery);
  }

  function getVisibleTabIds(visibleTabs) {
    return keyboardNavModule.normalizeTabIds(
      (Array.isArray(visibleTabs) ? visibleTabs : []).map((tab) => tab?.id)
    );
  }

  function getActiveSnapshotTabId() {
    return latestSnapshot.tabs.find((tab) => tab.active)?.id;
  }

  function focusRenderedTabRow(tabId, options = {}) {
    if (!Number.isInteger(tabId)) {
      return;
    }

    const { preventScroll = true } = options;
    requestAnimationFrame(() => {
      const row = tabList.querySelector(`.bts-tab-row[data-tab-id="${tabId}"]`);
      if (!row || typeof row.focus !== "function") {
        return;
      }

      row.focus({ preventScroll });
    });
  }

  function moveFocusedTabByDirection(direction) {
    const visibleTabs = getVisibleTabs();
    const tabIds = getVisibleTabIds(visibleTabs);
    const nextFocusedTabId = keyboardNavModule.getNextFocusTabId({
      tabIds,
      currentFocusedTabId: focusedTabId,
      activeTabId: getActiveSnapshotTabId(),
      direction
    });

    if (!Number.isInteger(nextFocusedTabId)) {
      return;
    }

    focusedTabId = nextFocusedTabId;
    renderTabList();
    focusRenderedTabRow(nextFocusedTabId);
  }

  async function activateFocusedTab() {
    const visibleTabs = getVisibleTabs();
    const tabIds = getVisibleTabIds(visibleTabs);
    const tabId = keyboardNavModule.resolveFocusTabId({
      tabIds,
      currentFocusedTabId: focusedTabId,
      activeTabId: getActiveSnapshotTabId()
    });

    if (!Number.isInteger(tabId)) {
      return;
    }

    focusedTabId = tabId;
    await sendMessage({
      type: MESSAGE_TYPES.ACTIVATE_TAB,
      payload: { tabId }
    });
  }

  async function closeFocusedTab() {
    const visibleTabs = getVisibleTabs();
    const tabIds = getVisibleTabIds(visibleTabs);
    const tabId = keyboardNavModule.resolveFocusTabId({
      tabIds,
      currentFocusedTabId: focusedTabId,
      activeTabId: getActiveSnapshotTabId()
    });

    if (!Number.isInteger(tabId)) {
      return;
    }

    focusedTabId = keyboardNavModule.getFocusAfterClose({
      tabIds,
      closingTabId: tabId,
      currentFocusedTabId: focusedTabId,
      activeTabId: getActiveSnapshotTabId()
    });

    await sendMessage({
      type: MESSAGE_TYPES.CLOSE_TAB,
      payload: { tabId }
    });
  }

  function isEditableTarget(target) {
    if (!target || typeof target !== "object") {
      return false;
    }

    const tagName = String(target.tagName || "").toUpperCase();
    return tagName === "INPUT" || tagName === "TEXTAREA" || Boolean(target.isContentEditable);
  }

  async function activateFirstVisibleTab() {
    const tabs = getVisibleTabs();
    const first = tabs[0];
    if (!first) {
      return;
    }

    focusedTabId = first.id;
    await sendMessage({
      type: MESSAGE_TYPES.ACTIVATE_TAB,
      payload: { tabId: first.id }
    });
  }

  async function moveTabByDropSource(dragTabId, targetTabId) {
    if (!Number.isInteger(dragTabId) || !Number.isInteger(targetTabId)) {
      return;
    }

    if (dragTabId === targetTabId) {
      return;
    }

    const dragTab = latestSnapshot.tabs.find((tab) => tab.id === dragTabId);
    const targetTab = latestSnapshot.tabs.find((tab) => tab.id === targetTabId);
    if (!dragTab || !targetTab) {
      return;
    }

    let targetIndex = targetTab.index;
    if (dragTab.index < targetTab.index) {
      targetIndex = Math.max(0, targetIndex - 1);
    }

    await sendMessage({
      type: MESSAGE_TYPES.MOVE_TAB,
      payload: {
        tabId: dragTabId,
        index: targetIndex
      }
    });
  }

  function performRenderTabList() {
    const visibleTabs = getVisibleTabs();
    const hadTabRowFocus = shadowRoot.activeElement?.classList?.contains?.("bts-tab-row");

    if (renderPerfModule.shouldRenderArcSections(sidebarDataVersion, renderedArcDataVersion)) {
      renderArcSections();
    }

    const visibleTabIdList = getVisibleTabIds(visibleTabs);
    const visibleTabIds = new Set(visibleTabIdList);

    const enteringTabIds = new Set();
    for (const tabId of visibleTabIdList) {
      if (!previousVisibleTabIds.has(tabId)) {
        enteringTabIds.add(tabId);
      }
    }

    const activeTabId = getActiveSnapshotTabId();
    focusedTabId = keyboardNavModule.resolveFocusTabId({
      tabIds: visibleTabIdList,
      currentFocusedTabId: focusedTabId,
      activeTabId
    });

    tabsModule.renderTabList({
      container: tabList,
      tabs: visibleTabs,
      groups: latestSnapshot.groups,
      activeTabId,
      focusedTabId,
      collapsedGroupIds,
      isSearching: Boolean(searchQuery.trim()),
      enteringTabIds,
      handlers: {
        onActivate: (tabId) => {
          focusedTabId = tabId;
          void sendMessage({
            type: MESSAGE_TYPES.ACTIVATE_TAB,
            payload: { tabId }
          });
        },
        onClose: (tabId) => {
          focusedTabId = keyboardNavModule.getFocusAfterClose({
            tabIds: visibleTabIdList,
            closingTabId: tabId,
            currentFocusedTabId: focusedTabId,
            activeTabId
          });

          void sendMessage({
            type: MESSAGE_TYPES.CLOSE_TAB,
            payload: { tabId }
          });
        },
        onToggleGroup: (groupId, nextCollapsed) => {
          if (nextCollapsed) {
            collapsedGroupIds.add(groupId);
          } else {
            collapsedGroupIds.delete(groupId);
          }
          void persistWindowState();
        },
        onContextMenu: ({ tab, x, y }) => {
          focusedTabId = tab?.id;
          openContextMenuForTab(tab, x, y);
        },
        onFocus: (tabId) => {
          focusedTabId = tabId;
        },
        onDragStart: (tabId) => {
          focusedTabId = tabId;
          dragDropController.beginTabDrag(tabId);
        },
        getDraggingTabId: () => dragDropController.getDraggingTabId(),
        onDrop: (sourceTabId, targetTabId) => {
          void moveTabByDropSource(sourceTabId, targetTabId);
        },
        onDragEnd: () => {
          dragDropController.endTabDrag();
          clearDragDropVisualState();
        }
      },
      groupUtils: groupsModule
    });

    if (hadTabRowFocus && Number.isInteger(focusedTabId)) {
      focusRenderedTabRow(focusedTabId, { preventScroll: true });
    }

    previousVisibleTabIds = visibleTabIds;

    if (Number.isInteger(contextMenuTabId)) {
      const tabStillVisible = latestSnapshot.tabs.some((tab) => tab.id === contextMenuTabId);
      if (!tabStillVisible) {
        closeContextMenu();
      }
    }

    if (commandPaletteOpen) {
      refreshCommandPaletteItems({ preserveSelection: true });
    }
  }

  function renderTabList() {
    renderCoalescer.flush(() => {
      performRenderTabList();
    });
  }

  function scheduleRenderTabList() {
    renderCoalescer.schedule(() => {
      performRenderTabList();
    });
  }

  function syncSnapshot(payload) {
    latestSnapshot = {
      windowId: payload?.windowId,
      tabs: Array.isArray(payload?.tabs) ? payload.tabs : [],
      groups: Array.isArray(payload?.groups) ? payload.groups : []
    };

    if (Number.isInteger(latestSnapshot.windowId)) {
      windowId = latestSnapshot.windowId;
    }
  }

  function handleResize() {
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
      document.removeEventListener("pointermove", onPointerMove);
      const snappedWidth = Math.round(sidebarWidth / 10) * 10;
      sidebarEl.classList.add("is-snapping-width");
      setSidebarWidth(snappedWidth, { persist: true });
      setTimeout(() => {
        sidebarEl.classList.remove("is-snapping-width");
      }, 180);
    }

    resizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      dragContext = {
        startX: event.clientX,
        startWidth: sidebarWidth
      };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp, { once: true });
    });
  }

  async function hydrateInitialState() {
    const stateResponse = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
    await hydrateSidebarData();

    if (!stateResponse?.ok) {
      renderArcSections();
      return;
    }

    syncSnapshot(stateResponse.snapshot);

    const stateFromBackground = stateResponse.windowState || {};
    const key = getStateKey();
    const localState = key ? await storageGet(key) : null;
    const state =
      localState && typeof localState === "object" ? localState : stateFromBackground;

    const persistedWidth = Number.isFinite(state?.width) ? state.width : DEFAULT_WIDTH;
    setSidebarWidth(persistedWidth, { persist: false });

    const persistedGroupIds = Array.isArray(state?.collapsedGroupIds)
      ? state.collapsedGroupIds.filter((value) => Number.isInteger(value))
      : [];

    collapsedGroupIds = new Set(persistedGroupIds);
    setOpen(Boolean(state?.open), { persist: false, broadcast: false, animate: false });
    renderTabList();
  }

  sidebarEl.addEventListener("transitionend", (event) => {
    if (event.propertyName !== "transform") {
      return;
    }
    animationState = sidebarOpen ? "open" : "closed";
    sidebarEl.style.willChange = "auto";
  });

  toggleButton.addEventListener("click", () => {
    setOpen(!sidebarOpen, { persist: true, broadcast: true, animate: true });
  });

  overlayEl.addEventListener("click", () => {
    setOpen(false, { persist: true, broadcast: true, animate: true });
  });

  newTabButton.addEventListener("click", () => {
    void sendMessage({
      type: MESSAGE_TYPES.CREATE_TAB,
      payload: {
        windowId
      }
    });
  });

  newTabRowButton.addEventListener("click", () => {
    void sendMessage({
      type: MESSAGE_TYPES.CREATE_TAB,
      payload: {
        windowId
      }
    });
  });

  newFolderButton.addEventListener("click", () => {
    void createPinnedFolder().then(() => {
      renderArcSections();
    });
  });

  addSpaceButton.addEventListener("click", () => {
    void addSpace();
  });

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value || "";
    closeContextMenu();
    renderTabList();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void activateFirstVisibleTab();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveFocusedTabByDirection(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (searchQuery) {
        searchQuery = "";
        searchInput.value = "";
        renderTabList();
      } else {
        setOpen(false, { persist: true, broadcast: true, animate: true });
      }
    }
  });

  commandBackdrop.addEventListener("click", () => {
    closeCommandPalette({ restoreTabFocus: true });
  });

  commandInput.addEventListener("input", () => {
    commandPaletteQuery = commandInput.value || "";
    refreshCommandPaletteItems({ preserveSelection: false });
  });

  commandInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = commandPaletteFocusedIndex < 0 ? 0 : commandPaletteFocusedIndex + delta;
      setCommandPaletteFocusedIndex(nextIndex);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = commandPaletteItems[commandPaletteFocusedIndex];
      if (selected) {
        void executeCommandPaletteItem(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette({ restoreTabFocus: true });
    }
  });

  commandList.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented) {
        return;
      }
      handleCommandPaletteShortcut(event);
    },
    true
  );

  shadowRoot.addEventListener(
    "pointerup",
    (event) => {
      if (!shouldSuppressInteraction(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  shadowRoot.addEventListener(
    "click",
    (event) => {
      if (!shouldSuppressInteraction(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  shadowRoot.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
      return;
    }

    if (handleCommandPaletteShortcut(event)) {
      return;
    }

    const metaOrCtrl = event.metaKey || event.ctrlKey;
    const normalizedKey = String(event.key).toLowerCase();

    if (commandPaletteOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette({ restoreTabFocus: true });
        return;
      }

      if (event.target !== commandInput && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = commandPaletteFocusedIndex < 0 ? 0 : commandPaletteFocusedIndex + delta;
        setCommandPaletteFocusedIndex(nextIndex);
        return;
      }

      if (event.target !== commandInput && event.key === "Enter") {
        event.preventDefault();
        const selected = commandPaletteItems[commandPaletteFocusedIndex];
        if (selected) {
          void executeCommandPaletteItem(selected);
        }
      }

      return;
    }

    if (event.key === "Escape" && contextMenuTabId !== null) {
      event.preventDefault();
      closeContextMenu();
      focusRenderedTabRow(focusedTabId, { preventScroll: true });
      return;
    }

    if (metaOrCtrl && normalizedKey === "f") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (searchQuery) {
        searchQuery = "";
        searchInput.value = "";
        renderTabList();
        return;
      }

      if (sidebarOpen) {
        setOpen(false, { persist: true, broadcast: true, animate: true });
      }
      return;
    }

    if (!sidebarOpen || contextMenuTabId !== null) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusedTabByDirection(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void activateFocusedTab();
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      void closeFocusedTab();
    }
  });

  shadowRoot.addEventListener("pointerdown", (event) => {
    if (shouldSuppressInteraction(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (contextMenuTabId === null) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (!path.includes(contextMenuEl)) {
      closeContextMenu();
    }
  });

  shadowRoot.addEventListener("contextmenu", (event) => {
    if (contextMenuTabId === null) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (!path.some((node) => node?.classList?.contains?.("bts-tab-row"))) {
      closeContextMenu();
    }
  });

  shadowRoot.addEventListener("dragend", () => {
    dragDropController.resetAll();
    clearDragDropVisualState();
  });

  handleResize();
  setupArcDropZones();
  updateToggleButton();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return;
    }

    const isKnownMessageType = messagesModule?.isKnownMessageType;
    if (typeof isKnownMessageType === "function" && !isKnownMessageType(message.type)) {
      return;
    }

    const validatePayload = messagesModule?.validatePayload;
    if (typeof validatePayload === "function") {
      const validation = validatePayload(message.type, message.payload);
      if (!validation.ok) {
        sendResponse({ ok: false, error: validation.error });
        return;
      }
    }

    if (message.type === MESSAGE_TYPES.PING) {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.STATE) {
      const payload = message.payload;
      if (
        Number.isInteger(windowId) &&
        Number.isInteger(payload?.windowId) &&
        payload.windowId !== windowId
      ) {
        return;
      }

      syncSnapshot(payload);
      scheduleRenderTabList();
      return;
    }

    if (message.type === MESSAGE_TYPES.SET_OPEN) {
      const targetWindowId = message.payload?.windowId;
      if (
        Number.isInteger(windowId) &&
        Number.isInteger(targetWindowId) &&
        targetWindowId !== windowId
      ) {
        return;
      }

      setOpen(Boolean(message.payload?.open), {
        persist: false,
        broadcast: false,
        animate: true
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.TOGGLE_COMMAND_PALETTE) {
      const targetWindowId = message.payload?.windowId;
      if (
        Number.isInteger(windowId) &&
        Number.isInteger(targetWindowId) &&
        targetWindowId !== windowId
      ) {
        sendResponse({ ok: false, error: "WINDOW_MISMATCH" });
        return;
      }

      toggleCommandPalette();
      sendResponse({ ok: true });
    }
  });

  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (!changes[SIDEBAR_DATA_KEY]) {
        return;
      }

      const nextSidebarData = sanitizeSidebarData(changes[SIDEBAR_DATA_KEY].newValue);
      const nextSignature = getSidebarDataSignature(nextSidebarData);
      if (nextSignature === sidebarDataSignature) {
        return;
      }

      sidebarData = nextSidebarData;
      markSidebarDataChanged();
      scheduleRenderTabList();
    });
  }

  globalScope.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = String(reason?.message || reason || "");
    if (message.includes("Extension context invalidated")) {
      runtimeContextAlive = false;
      event.preventDefault();
    }
  });

  void hydrateInitialState();
})(globalThis);
