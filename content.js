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

  if (!searchModule || !groupsModule || !tabsModule) {
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

  let windowId = null;
  let sidebarWidth = DEFAULT_WIDTH;
  let sidebarOpen = false;
  let animationState = "closed";
  let searchQuery = "";
  let collapsedGroupIds = new Set();
  let previousVisibleTabIds = new Set();
  let contextMenuTabId = null;
  let pinnedDragContext = null;
  let draggingTabId = null;
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
  let latestSnapshot = {
    windowId: null,
    tabs: [],
    groups: []
  };

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

  shadowRoot.append(fallbackStyleEl, linkEl, overlayEl, sidebarEl, contextMenuEl);
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

  function sendMessage(message) {
    if (!runtimeContextAlive) {
      return Promise.resolve({ ok: false, error: "EXTENSION_CONTEXT_INVALIDATED" });
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

  function createDefaultSidebarData() {
    return {
      spaces: [
        {
          id: DEFAULT_SPACE.id,
          name: DEFAULT_SPACE.name,
          icon: DEFAULT_SPACE.icon
        }
      ],
      activeSpaceId: DEFAULT_SPACE.id,
      favorites: [],
      pinnedBySpace: {
        [DEFAULT_SPACE.id]: []
      }
    };
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
    const raw = String(url || "").trim();
    if (!raw) {
      return "";
    }

    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return raw;
    }
  }

  function sanitizeSavedItem(item) {
    const normalizedUrl = normalizeUrlKey(item?.url);
    if (!normalizedUrl || !isHttpUrl(normalizedUrl)) {
      return null;
    }

    return {
      id: String(item?.id || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      title: String(item?.title || normalizedUrl),
      url: normalizedUrl,
      favIconUrl: typeof item?.favIconUrl === "string" ? item.favIconUrl : ""
    };
  }

  function sanitizePinnedLinkNode(node) {
    const item = sanitizeSavedItem(node);
    if (!item) {
      return null;
    }

    return {
      type: "link",
      id: String(node?.id || item.id || `plink-${Date.now()}`),
      title: item.title,
      url: item.url,
      favIconUrl: item.favIconUrl
    };
  }

  function sanitizePinnedFolderNode(node) {
    const id = String(node?.id || `pfolder-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const title = String(node?.title || "New Folder").trim() || "New Folder";
    const children = [];
    const seen = new Set();
    const rawChildren = Array.isArray(node?.children) ? node.children : [];

    for (const child of rawChildren) {
      const linkNode = sanitizePinnedLinkNode(child);
      if (!linkNode) {
        continue;
      }
      const key = normalizeUrlKey(linkNode.url);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      children.push(linkNode);
    }

    return {
      type: "folder",
      id,
      title,
      collapsed: Boolean(node?.collapsed),
      children
    };
  }

  function sanitizePinnedNode(node) {
    if (node?.type === "folder") {
      return sanitizePinnedFolderNode(node);
    }

    return sanitizePinnedLinkNode(node);
  }

  function sanitizeSidebarData(rawValue) {
    const fallback = createDefaultSidebarData();
    if (!rawValue || typeof rawValue !== "object") {
      return fallback;
    }

    const spaces = Array.isArray(rawValue.spaces)
      ? rawValue.spaces
          .map((space) => {
            const id = String(space?.id || "").trim();
            if (!id) {
              return null;
            }
            return {
              id,
              name: String(space?.name || "Untitled Space"),
              icon: String(space?.icon || "•")
            };
          })
          .filter(Boolean)
      : [];

    const normalizedSpaces = spaces.length > 0 ? spaces : fallback.spaces;
    const validSpaceIds = new Set(normalizedSpaces.map((space) => space.id));

    const activeSpaceId = validSpaceIds.has(rawValue.activeSpaceId)
      ? rawValue.activeSpaceId
      : normalizedSpaces[0].id;

    const favorites = [];
    const favoriteSeen = new Set();
    const rawFavorites = Array.isArray(rawValue.favorites) ? rawValue.favorites : [];
    for (const item of rawFavorites) {
      const sanitized = sanitizeSavedItem(item);
      if (!sanitized) {
        continue;
      }
      const key = normalizeUrlKey(sanitized.url);
      if (favoriteSeen.has(key)) {
        continue;
      }
      favoriteSeen.add(key);
      favorites.push(sanitized);
      if (favorites.length >= MAX_FAVORITES) {
        break;
      }
    }

    const pinnedBySpace = {};
    const rawPinnedBySpace =
      rawValue.pinnedBySpace && typeof rawValue.pinnedBySpace === "object"
        ? rawValue.pinnedBySpace
        : {};

    for (const space of normalizedSpaces) {
      const spaceItems = Array.isArray(rawPinnedBySpace[space.id])
        ? rawPinnedBySpace[space.id]
        : [];
      const deduped = [];
      const seen = new Set();
      for (const item of spaceItems) {
        const sanitized = sanitizePinnedNode(item);
        if (!sanitized) {
          continue;
        }

        if (sanitized.type === "folder") {
          deduped.push(sanitized);
          continue;
        }

        const key = normalizeUrlKey(sanitized.url);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push(sanitized);
      }
      pinnedBySpace[space.id] = deduped;
    }

    return {
      spaces: normalizedSpaces,
      activeSpaceId,
      favorites,
      pinnedBySpace
    };
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
    const key = normalizeUrlKey(url);
    return sidebarData.favorites.some((item) => normalizeUrlKey(item.url) === key);
  }

  function isUrlPinnedInActiveSpace(url) {
    const key = normalizeUrlKey(url);
    for (const node of getActiveSpacePinnedNodes()) {
      if (node?.type === "link" && normalizeUrlKey(node.url) === key) {
        return true;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        if (node.children.some((child) => normalizeUrlKey(child.url) === key)) {
          return true;
        }
      }
    }

    return false;
  }

  async function persistSidebarData() {
    await storageSet(SIDEBAR_DATA_KEY, sidebarData);
  }

  async function hydrateSidebarData() {
    const stored = await storageGet(SIDEBAR_DATA_KEY);
    sidebarData = sanitizeSidebarData(stored);
  }

  function createSavedItemFromTab(tab) {
    const normalizedUrl = normalizeUrlKey(tab?.url);
    if (!normalizedUrl || !isHttpUrl(normalizedUrl)) {
      return null;
    }

    return {
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: tab?.title || normalizedUrl,
      url: normalizedUrl,
      favIconUrl: tab?.favIconUrl || ""
    };
  }

  function createPinnedLinkNodeFromSavedItem(item) {
    return {
      type: "link",
      id: `plink-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: item.title,
      url: item.url,
      favIconUrl: item.favIconUrl || ""
    };
  }

  function updatePinnedLinkByUrl(nodes, urlKey, updateLink) {
    for (const node of nodes) {
      if (node?.type === "link" && normalizeUrlKey(node.url) === urlKey) {
        updateLink(node);
        return true;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        const match = node.children.find((child) => normalizeUrlKey(child.url) === urlKey);
        if (match) {
          updateLink(match);
          return true;
        }
      }
    }

    return false;
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
        type: "sidebar:activateTab",
        payload: { tabId: existingTab.id }
      });
      return;
    }

    await sendMessage({
      type: "sidebar:createTab",
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
      type: "sidebar:getTab",
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
        renderArcSections();
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
        renderArcSections();
      }
    });
    button.dataset.pinnedLinkId = String(node.id);
    button.draggable = true;

    if (options.inFolder) {
      button.classList.add("is-folder-child");
    }

    button.addEventListener("dragstart", (event) => {
      pinnedDragContext = {
        linkId: node.id,
        fromFolderId: options.folderId || null
      };
      button.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.url || node.id);
      }
    });

    button.addEventListener("dragend", () => {
      pinnedDragContext = null;
      button.classList.remove("is-dragging");
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
    if (!pinnedDragContext?.linkId) {
      return;
    }

    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes().slice();
    const targetFolder = currentItems.find(
      (node) => node?.type === "folder" && node.id === targetFolderId
    );

    if (!targetFolder || pinnedDragContext.fromFolderId === targetFolderId) {
      return;
    }

    let movedNode = null;

    if (pinnedDragContext.fromFolderId) {
      const sourceFolder = currentItems.find(
        (node) => node?.type === "folder" && node.id === pinnedDragContext.fromFolderId
      );

      if (sourceFolder) {
        const childIndex = sourceFolder.children.findIndex(
          (child) => child.id === pinnedDragContext.linkId
        );
        if (childIndex >= 0) {
          movedNode = sourceFolder.children.splice(childIndex, 1)[0];
        }
      }
    } else {
      const linkIndex = currentItems.findIndex(
        (node) => node?.type === "link" && node.id === pinnedDragContext.linkId
      );
      if (linkIndex >= 0) {
        movedNode = currentItems.splice(linkIndex, 1)[0];
      }
    }

    if (!movedNode) {
      return;
    }

    const alreadyInFolder = targetFolder.children.some(
      (child) => normalizeUrlKey(child.url) === normalizeUrlKey(movedNode.url)
    );

    if (!alreadyInFolder) {
      targetFolder.children.push({
        ...movedNode,
        type: "link"
      });
    }

    sidebarData.pinnedBySpace[activeSpace.id] = currentItems;
    await persistSidebarData();
    pinnedDragContext = null;
    renderArcSections();
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
    renderArcSections();
  }

  async function favoriteSnapshotTab(tabId) {
    const tab = getSnapshotTabById(tabId);
    if (!tab) {
      return;
    }

    const resolvedTab = await resolveTabForStorage(tab);
    await addTabToFavorites(resolvedTab);
    renderArcSections();
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
    renderArcSections();
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
      section.classList.remove("is-drop-target");

      if (pinnedDragContext?.linkId) {
        await movePinnedLinkToFolder(folder.id);
        return;
      }

      if (Number.isInteger(draggingTabId)) {
        const droppedTabId = draggingTabId;
        draggingTabId = null;
        await pinSnapshotTabToFolder(droppedTabId, folder.id);
      }
    };

    header.addEventListener("dragover", (event) => {
      if (!pinnedDragContext?.linkId && !Number.isInteger(draggingTabId)) {
        return;
      }
      event.preventDefault();
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
      if (!pinnedDragContext?.linkId && !Number.isInteger(draggingTabId)) {
        return;
      }
      event.preventDefault();
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
          renderArcSections();
        });
      });
      spacesList.append(button);
    }
  }

  function renderArcSections() {
    renderFavorites();
    renderPinnedList();
    renderSpacesDock();
  }

  function setupArcDropZones() {
    favoritesGrid.addEventListener("dragover", (event) => {
      if (!Number.isInteger(draggingTabId)) {
        return;
      }
      event.preventDefault();
      favoritesGrid.classList.add("is-tab-drop-target");
    });

    favoritesGrid.addEventListener("dragleave", () => {
      favoritesGrid.classList.remove("is-tab-drop-target");
    });

    favoritesGrid.addEventListener("drop", async (event) => {
      if (!Number.isInteger(draggingTabId)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      favoritesGrid.classList.remove("is-tab-drop-target");
      const droppedTabId = draggingTabId;
      draggingTabId = null;
      await favoriteSnapshotTab(droppedTabId);
    });

    pinnedList.addEventListener("dragover", (event) => {
      if (!Number.isInteger(draggingTabId)) {
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
      if (!Number.isInteger(draggingTabId)) {
        return;
      }

      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const overFolder = path.some((node) => node?.classList?.contains?.("bts-pinned-folder"));
      if (overFolder) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pinnedList.classList.remove("is-tab-drop-target");
      const droppedTabId = draggingTabId;
      draggingTabId = null;
      await pinSnapshotTabToSidebar(droppedTabId);
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
    renderArcSections();
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
    item.textContent = label;

    if (options.destructive) {
      item.classList.add("is-destructive");
    }

    if (options.secondary) {
      item.classList.add("is-secondary");
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

  function openContextMenuForTab(tab, x, y) {
    if (!tab) {
      closeContextMenu();
      return;
    }

    contextMenuTabId = tab.id;
    const items = [];
    const groups = (latestSnapshot.groups || []).slice().sort((a, b) => {
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    const canStoreUrl = isHttpUrl(tab.url) || Number.isInteger(tab.id);
    if (canStoreUrl) {
      const tabUrl = normalizeUrlKey(tab.url);

      if (tabUrl && isUrlInFavorites(tabUrl)) {
        items.push(
          createContextMenuItem("Remove from favorites", async () => {
            await removeFavoriteByUrl(tabUrl);
            renderArcSections();
          })
        );
      } else {
        if (sidebarData.favorites.length >= MAX_FAVORITES) {
          items.push(
            createContextMenuItem(`Favorites full (${MAX_FAVORITES})`, async () => {}, {
              secondary: true
            })
          );
        } else {
          items.push(
            createContextMenuItem("Add to favorites", async () => {
              const resolvedTab = await resolveTabForStorage(tab);
              await addTabToFavorites(resolvedTab);
              renderArcSections();
            })
          );
        }
      }

      if (tabUrl && isUrlPinnedInActiveSpace(tabUrl)) {
        items.push(
          createContextMenuItem("Unpin from sidebar", async () => {
            await unpinUrlInActiveSpace(tabUrl);
            renderArcSections();
          })
        );
      } else {
        items.push(
          createContextMenuItem("Pin to sidebar", async () => {
            const resolvedTab = await resolveTabForStorage(tab);
            await pinTabInActiveSpace(resolvedTab);
            renderArcSections();
          })
        );
      }

      items.push(createContextMenuSeparator());
    }

    items.push(
      createContextMenuItem(tab.pinned ? "Unpin tab" : "Pin tab", () => {
        return sendMessage({
          type: "sidebar:updateTab",
          payload: {
            tabId: tab.id,
            update: { pinned: !tab.pinned }
          }
        });
      })
    );

    items.push(
      createContextMenuItem(tab.muted ? "Unmute tab" : "Mute tab", () => {
        return sendMessage({
          type: "sidebar:updateTab",
          payload: {
            tabId: tab.id,
            update: { muted: !tab.muted }
          }
        });
      })
    );

    items.push(createContextMenuSeparator());

    items.push(
      createContextMenuItem("Duplicate tab", () => {
        return sendMessage({
          type: "sidebar:duplicateTab",
          payload: { tabId: tab.id }
        });
      })
    );

    items.push(
      createContextMenuItem("Close other tabs", () => {
        return sendMessage({
          type: "sidebar:closeOtherTabs",
          payload: { tabId: tab.id }
        });
      })
    );

    items.push(
      createContextMenuItem(
        "Close tab",
        () => {
          return sendMessage({
            type: "sidebar:closeTab",
            payload: { tabId: tab.id }
          });
        },
        { destructive: true }
      )
    );

    items.push(createContextMenuSeparator());

    items.push(
      createContextMenuItem("Move to new group", () => {
        return sendMessage({
          type: "sidebar:setTabGroup",
          payload: {
            tabId: tab.id,
            createNew: true,
            title: "New Group"
          }
        });
      }, { secondary: true })
    );

    if (tab.groupId >= 0) {
      items.push(
        createContextMenuItem("Remove from group", () => {
          return sendMessage({
            type: "sidebar:setTabGroup",
            payload: {
              tabId: tab.id,
              groupId: -1
            }
          });
        }, { secondary: true })
      );
    }

    for (const group of groups) {
      if (!Number.isInteger(group?.id) || group.id === tab.groupId) {
        continue;
      }

      const groupName = group.title || "Unnamed group";
      items.push(
        createContextMenuItem(`Move to group: ${groupName}`, () => {
          return sendMessage({
            type: "sidebar:setTabGroup",
            payload: {
              tabId: tab.id,
              groupId: group.id
            }
          });
        }, { secondary: true })
      );
    }

    contextMenuEl.replaceChildren(...items);
    contextMenuEl.classList.add("is-open");
    contextMenuEl.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      positionContextMenu(x, y);
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
      type: "sidebar:setWindowOpen",
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
    return searchModule.filterTabs(latestSnapshot.tabs, searchQuery);
  }

  async function activateFirstVisibleTab() {
    const tabs = getVisibleTabs();
    const first = tabs[0];
    if (!first) {
      return;
    }
    await sendMessage({
      type: "sidebar:activateTab",
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
      type: "sidebar:moveTab",
      payload: {
        tabId: dragTabId,
        index: targetIndex
      }
    });
  }

  function renderTabList() {
    const visibleTabs = getVisibleTabs();
    renderArcSections();

    const visibleTabIds = new Set(
      visibleTabs
        .map((tab) => tab?.id)
        .filter((tabId) => Number.isInteger(tabId))
    );

    const enteringTabIds = new Set();
    for (const tabId of visibleTabIds) {
      if (!previousVisibleTabIds.has(tabId)) {
        enteringTabIds.add(tabId);
      }
    }

    const activeTabId = latestSnapshot.tabs.find((tab) => tab.active)?.id;
    tabsModule.renderTabList({
      container: tabList,
      tabs: visibleTabs,
      groups: latestSnapshot.groups,
      activeTabId,
      collapsedGroupIds,
      isSearching: Boolean(searchQuery.trim()),
      enteringTabIds,
      handlers: {
        onActivate: (tabId) => {
          void sendMessage({
            type: "sidebar:activateTab",
            payload: { tabId }
          });
        },
        onClose: (tabId) => {
          void sendMessage({
            type: "sidebar:closeTab",
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
          openContextMenuForTab(tab, x, y);
        },
        onDragStart: (tabId) => {
          draggingTabId = tabId;
        },
        getDraggingTabId: () => draggingTabId,
        onDrop: (sourceTabId, targetTabId) => {
          void moveTabByDropSource(sourceTabId, targetTabId);
        },
        onDragEnd: () => {
          draggingTabId = null;
        }
      },
      groupUtils: groupsModule
    });

    previousVisibleTabIds = visibleTabIds;

    if (Number.isInteger(contextMenuTabId)) {
      const tabStillVisible = latestSnapshot.tabs.some((tab) => tab.id === contextMenuTabId);
      if (!tabStillVisible) {
        closeContextMenu();
      }
    }
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
    const stateResponse = await sendMessage({ type: "sidebar:getState" });
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
    const initialOpen = state && typeof state.open === "boolean" ? state.open : true;
    setOpen(initialOpen, { persist: true, broadcast: true, animate: false });
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
      type: "sidebar:createTab",
      payload: {
        windowId
      }
    });
  });

  newTabRowButton.addEventListener("click", () => {
    void sendMessage({
      type: "sidebar:createTab",
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
      void activateFirstVisibleTab();
      return;
    }

    if (event.key === "Escape") {
      if (searchQuery) {
        searchQuery = "";
        searchInput.value = "";
        renderTabList();
      } else {
        setOpen(false, { persist: true, broadcast: true, animate: true });
      }
    }
  });

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
    if (event.key === "Escape" && contextMenuTabId !== null) {
      event.preventDefault();
      closeContextMenu();
      return;
    }

    const metaOrCtrl = event.metaKey || event.ctrlKey;
    if (metaOrCtrl && String(event.key).toLowerCase() === "f") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key === "Escape" && sidebarOpen && !searchQuery) {
      event.preventDefault();
      setOpen(false, { persist: true, broadcast: true, animate: true });
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

  handleResize();
  setupArcDropZones();
  updateToggleButton();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "sidebar:ping") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "sidebar:state") {
      const payload = message.payload;
      if (
        Number.isInteger(windowId) &&
        Number.isInteger(payload?.windowId) &&
        payload.windowId !== windowId
      ) {
        return;
      }

      syncSnapshot(payload);
      renderTabList();
      return;
    }

    if (message.type === "sidebar:setOpen") {
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

      sidebarData = sanitizeSidebarData(changes[SIDEBAR_DATA_KEY].newValue);
      renderArcSections();
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
