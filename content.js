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
  const runtimeClientModule = globalScope.BraveSidebarRuntimeClient;
  const arcModelModule = globalScope.BraveSidebarArcModel;
  const contextMenuActionsModule = globalScope.BraveSidebarContextMenuActions;
  const layoutControllerModule = globalScope.BraveSidebarLayoutController;
  const interactionControllerModule = globalScope.BraveSidebarInteractionController;

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
    !quickSwitcherModule ||
    !runtimeClientModule ||
    !arcModelModule ||
    !contextMenuActionsModule ||
    !layoutControllerModule ||
    !interactionControllerModule
  ) {
    return;
  }

  const WINDOW_STATE_PREFIX = "bts_window_state_";
  const SIDEBAR_DATA_KEY = "bts_sidebar_data_v1";
  const MAX_FAVORITES = 12;
  const DEFAULT_SPACE = {
    id: "space-personal",
    name: "Personal",
    icon: "•"
  };
  const DEFAULT_WIDTH = 320;
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 480;
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
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const CONTENT_ICON_PATHS = Object.freeze({
    plus: [
      { tag: "path", attrs: { d: "M10 4.5v11" } },
      { tag: "path", attrs: { d: "M4.5 10h11" } }
    ],
    chevronLeft: [{ tag: "path", attrs: { d: "M12.75 4.75 7.5 10l5.25 5.25" } }],
    chevronRight: [{ tag: "path", attrs: { d: "M7.25 4.75 12.5 10l-5.25 5.25" } }],
    chevronDown: [{ tag: "path", attrs: { d: "M4.75 7.5 10 12.75 15.25 7.5" } }],
    sidebarPanel: [
      { tag: "rect", attrs: { x: "3.5", y: "4.5", width: "13", height: "11", rx: "2.5" } },
      { tag: "path", attrs: { d: "M8 4.5v11" } },
      { tag: "path", attrs: { d: "M11 7.75h2.5" } },
      { tag: "path", attrs: { d: "M11 10h2.5" } },
      { tag: "path", attrs: { d: "M11 12.25h2.5" } }
    ],
    pencil: [
      {
        tag: "path",
        attrs: {
          d: "M4.75 15.25 6.6 10.9 12.9 4.6a1.55 1.55 0 0 1 2.2 0l.3.3a1.55 1.55 0 0 1 0 2.2l-6.3 6.3-4.35 1.85Z"
        }
      },
      { tag: "path", attrs: { d: "M11.85 5.65 14.35 8.15" } }
    ],
    close: [
      { tag: "path", attrs: { d: "M5.5 5.5 14.5 14.5" } },
      { tag: "path", attrs: { d: "M14.5 5.5 5.5 14.5" } }
    ],
    search: [
      { tag: "circle", attrs: { cx: "8.5", cy: "8.5", r: "4.75" } },
      { tag: "path", attrs: { d: "M12.5 12.5 16 16" } }
    ],
    palette: [
      { tag: "circle", attrs: { cx: "10", cy: "10", r: "6.25" } },
      { tag: "circle", attrs: { cx: "8", cy: "8", r: "1.5", fill: "currentColor", stroke: "none" } },
      { tag: "circle", attrs: { cx: "12.2", cy: "8.4", r: "1.2", fill: "currentColor", stroke: "none" } },
      { tag: "circle", attrs: { cx: "10", cy: "12.4", r: "1.3", fill: "currentColor", stroke: "none" } }
    ]
  });

  function createIcon(name, className = "bts-icon") {
    const iconDef = CONTENT_ICON_PATHS[name];
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);

    if (!iconDef) {
      return svg;
    }

    for (const definition of iconDef) {
      const part = document.createElementNS(SVG_NAMESPACE, definition.tag);
      for (const [key, value] of Object.entries(definition.attrs || {})) {
        part.setAttribute(key, value);
      }
      svg.append(part);
    }

    return svg;
  }

  function setIconOnlyButton(button, iconName) {
    if (!button) {
      return;
    }

    button.replaceChildren(createIcon(iconName));
  }

  function setIconLabelButton(button, iconName, label) {
    if (!button) {
      return;
    }

    const labelEl = document.createElement("span");
    labelEl.className = "bts-button-label";
    labelEl.textContent = label;
    button.replaceChildren(createIcon(iconName), labelEl);
  }

  function getItemDisplayLabel(item) {
    const title = String(item?.title || "").trim();
    if (title) {
      return title;
    }

    const url = String(item?.url || "").trim();
    if (!url) {
      return "Untitled";
    }

    try {
      return new URL(url).hostname.replace(/^www\./i, "") || url;
    } catch {
      return url;
    }
  }

  function getItemMonogram(item) {
    const match = getItemDisplayLabel(item).match(/[A-Za-z0-9]/);
    return match ? match[0].toUpperCase() : "#";
  }

  const FAVORITE_TINT_PALETTE = [
    { bg: "rgba(235, 87, 87, 0.14)", border: "rgba(235, 87, 87, 0.22)" },
    { bg: "rgba(242, 153, 74, 0.14)", border: "rgba(242, 153, 74, 0.22)" },
    { bg: "rgba(242, 201, 76, 0.12)", border: "rgba(242, 201, 76, 0.20)" },
    { bg: "rgba(39, 174, 96, 0.12)", border: "rgba(39, 174, 96, 0.20)" },
    { bg: "rgba(47, 128, 237, 0.14)", border: "rgba(47, 128, 237, 0.22)" },
    { bg: "rgba(155, 81, 224, 0.14)", border: "rgba(155, 81, 224, 0.22)" },
    { bg: "rgba(235, 107, 148, 0.14)", border: "rgba(235, 107, 148, 0.22)" },
    { bg: "rgba(86, 204, 242, 0.12)", border: "rgba(86, 204, 242, 0.20)" },
    { bg: "rgba(111, 207, 151, 0.12)", border: "rgba(111, 207, 151, 0.20)" },
    { bg: "rgba(219, 170, 107, 0.14)", border: "rgba(219, 170, 107, 0.22)" },
    { bg: "rgba(126, 139, 168, 0.14)", border: "rgba(126, 139, 168, 0.22)" },
    { bg: "rgba(196, 113, 237, 0.14)", border: "rgba(196, 113, 237, 0.22)" }
  ];

  function getFavoriteTint(url) {
    const str = String(url || "");
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return FAVORITE_TINT_PALETTE[Math.abs(hash) % FAVORITE_TINT_PALETTE.length];
  }

  const runtimeClient = runtimeClientModule.createRuntimeClient({
    messagesModule,
    chromeApi: chrome
  });
  const { storageGet, storageSet, sendMessage } = runtimeClient;

  let windowId = null;
  let sidebarWidth = DEFAULT_WIDTH;
  let sidebarOpen = false;
  let animationState = "closed";
  let searchQuery = "";
  let collapsedGroupIds = new Set();
  let previousVisibleTabIds = new Set();
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
  sidebarEl.style.cssText = `position: fixed; inset: 0 auto 0 0; width: ${DEFAULT_WIDTH}px; height: 100vh; transform: translateX(-100%); transition: none; pointer-events: auto; z-index: 2147483647;`;
  sidebarEl.setAttribute("role", "complementary");
  sidebarEl.setAttribute("aria-label", "Brave tab sidebar");

  sidebarEl.innerHTML = `
    <div class="bts-toolbar">
      <button id="bts-toggle-btn" class="bts-icon-btn bts-toolbar-panel-btn" type="button" aria-label="Hide sidebar">Toggle</button>
      <button id="bts-theme-btn" class="bts-icon-btn" type="button" aria-label="Theme" title="Customize theme">Theme</button>
      <button id="bts-search-toggle-btn" class="bts-icon-btn bts-toolbar-search-btn" type="button" aria-label="Search tabs" title="Search tabs">Search</button>
      <button id="bts-new-tab-btn" class="bts-icon-btn" type="button" aria-label="New tab" title="New tab">New</button>
    </div>
    <div class="bts-search-wrap bts-search-collapsed">
      <input id="bts-search-input" class="bts-search-input" type="search" placeholder="Search tabs..." />
    </div>
    <div class="bts-favorites-wrap">
      <div id="bts-favorites-grid" class="bts-favorites-grid"></div>
    </div>
    <div class="bts-space-header">
      <span id="bts-space-icon" class="bts-space-icon">${DEFAULT_SPACE.icon}</span>
      <span id="bts-space-name" class="bts-space-name">${DEFAULT_SPACE.name}</span>
      <button id="bts-new-folder-btn" class="bts-folder-add-btn" type="button">New Folder</button>
    </div>
    <div id="bts-pinned-list" class="bts-pinned-list"></div>
    <button id="bts-new-tab-row" class="bts-new-tab-row" type="button">New Tab</button>
    <div class="bts-today-title">Today</div>
    <div id="bts-tab-list" class="bts-tab-list" aria-live="polite"></div>
    <div class="bts-spaces-dock">
      <div id="bts-spaces-list" class="bts-spaces-list"></div>
      <button id="bts-add-space-btn" class="bts-space-add-btn" type="button" aria-label="Add space" title="Add space">Add</button>
    </div>
    <div id="bts-resize-handle" class="bts-resize-handle" title="Resize sidebar" role="separator" aria-orientation="vertical"></div>
    <div id="bts-theme-editor" class="bts-theme-editor" aria-hidden="true">
      <div class="bts-theme-editor-header">
        <span class="bts-theme-editor-title">Theme</span>
        <button id="bts-theme-close" class="bts-icon-btn" type="button" aria-label="Close theme editor">Close</button>
      </div>
      <div class="bts-theme-presets" id="bts-theme-presets"></div>
      <div class="bts-theme-colors">
        <label class="bts-theme-color-label">Mesh Colors
          <div class="bts-theme-color-row" id="bts-theme-color-row"></div>
        </label>
      </div>
      <div class="bts-theme-sliders">
        <label class="bts-theme-slider-label">Grain
          <input id="bts-grain-slider" class="bts-theme-slider" type="range" min="0" max="100" value="52" />
        </label>
      </div>
    </div>
  `;

  shadowRoot.append(fallbackStyleEl, linkEl, overlayEl, sidebarEl, contextMenuEl, commandPaletteEl);
  document.documentElement.append(host);

  const toggleButton = sidebarEl.querySelector("#bts-toggle-btn");
  const themeButton = sidebarEl.querySelector("#bts-theme-btn");
  const searchToggleButton = sidebarEl.querySelector("#bts-search-toggle-btn");
  const newTabButton = sidebarEl.querySelector("#bts-new-tab-btn");
  const themeEditor = sidebarEl.querySelector("#bts-theme-editor");
  const themeCloseButton = sidebarEl.querySelector("#bts-theme-close");
  const themeColorRow = sidebarEl.querySelector("#bts-theme-color-row");
  const themePresetsContainer = sidebarEl.querySelector("#bts-theme-presets");
  const grainSlider = sidebarEl.querySelector("#bts-grain-slider");
  const newTabRowButton = sidebarEl.querySelector("#bts-new-tab-row");
  const searchInput = sidebarEl.querySelector("#bts-search-input");
  const searchWrap = sidebarEl.querySelector(".bts-search-wrap");
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

  setIconOnlyButton(toggleButton, "sidebarPanel");
  setIconOnlyButton(themeButton, "palette");
  setIconOnlyButton(searchToggleButton, "search");
  setIconOnlyButton(newTabButton, "plus");
  setIconOnlyButton(themeCloseButton, "close");
  setIconLabelButton(newFolderButton, "plus", "New Folder");
  setIconLabelButton(newTabRowButton, "plus", "New Tab");
  setIconOnlyButton(addSpaceButton, "plus");

  function syncLayoutState(nextState) {
    sidebarWidth = nextState?.sidebarWidth ?? sidebarWidth;
    sidebarOpen = Boolean(nextState?.sidebarOpen);
    animationState = String(nextState?.animationState || animationState);
  }

  let interactionController = null;
  const layoutController = layoutControllerModule.createSidebarLayoutController({
    globalScope,
    document,
    sidebarEl,
    overlayEl,
    toggleButton,
    commandPaletteEl,
    resizeHandle,
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    openTransition: OPEN_TRANSITION,
    closeTransition: CLOSE_TRANSITION,
    hostId: host.id,
    onStateChange: syncLayoutState,
    onPersistState: () => {
      void persistWindowState();
    },
    onBroadcastOpenState: () => {
      void broadcastOpenState();
    },
    onClose: () => {
      interactionController?.handleSidebarClosed();
    }
  });

  const THEME_STORAGE_KEY = "bts_theme_v1";
  const THEME_MESH_KEYS = ["a", "b", "c", "d", "e"];
  const THEME_PRESETS = [
    { name: "Sand", mesh: { a: "#c8bfb4", b: "#d9c4a0", c: "#c4a882", d: "#b8ac9e", e: "#ddd5c8" }, grain: 52 },
    { name: "Ocean", mesh: { a: "#7ba7c4", b: "#5b8fad", c: "#3d6e8e", d: "#9fc4d8", e: "#b5d4e3" }, grain: 48 },
    { name: "Forest", mesh: { a: "#8baa7a", b: "#6e9464", c: "#a3b88e", d: "#c4cdb4", e: "#d2dbc6" }, grain: 50 },
    { name: "Dusk", mesh: { a: "#b89aaf", b: "#9a7a96", c: "#d4a88c", d: "#c4b0c4", e: "#ddd0d8" }, grain: 45 },
    { name: "Ember", mesh: { a: "#d4926a", b: "#c47852", c: "#b86040", d: "#dbb090", e: "#e8cbb4" }, grain: 55 },
    { name: "Slate", mesh: { a: "#8e9aaa", b: "#6e7e90", c: "#a4b0be", d: "#bcc4d0", e: "#d0d6de" }, grain: 40 },
    { name: "Midnight", mesh: { a: "#2a2836", b: "#1e2230", c: "#342e40", d: "#22202c", e: "#1a1824" }, grain: 34 },
    { name: "Charcoal", mesh: { a: "#2e2c2a", b: "#383432", c: "#26221e", d: "#3a3634", e: "#1e1a18" }, grain: 30 }
  ];

  let currentTheme = {
    mesh: { ...THEME_PRESETS[0].mesh },
    grain: THEME_PRESETS[0].grain
  };

  function applyThemeToDOM(theme) {
    const s = sidebarEl.style;
    for (const key of THEME_MESH_KEYS) {
      s.setProperty("--bts-mesh-" + key, theme.mesh[key]);
    }
    s.setProperty("--bts-noise-opacity", String(theme.grain / 100));
  }

  function autoTextColors(theme) {
    const hex = theme.mesh.e || "#ddd5c8";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.45;
    const s = sidebarEl.style;
    if (isDark) {
      s.setProperty("--bts-sidebar-text", "#f5ede4");
      s.setProperty("--bts-sidebar-muted", "#b9a395");
      s.setProperty("--bts-sidebar-hover", "rgba(255,255,255,0.08)");
      s.setProperty("--bts-sidebar-active", "rgba(255,255,255,0.14)");
      s.setProperty("--bts-sidebar-surface", "rgba(255,255,255,0.06)");
      s.setProperty("--bts-sidebar-border", "rgba(255,230,215,0.06)");
    } else {
      s.setProperty("--bts-sidebar-text", "#2c211c");
      s.setProperty("--bts-sidebar-muted", "#7d695c");
      s.setProperty("--bts-sidebar-hover", "rgba(255,255,255,0.32)");
      s.setProperty("--bts-sidebar-active", "rgba(255,255,255,0.48)");
      s.setProperty("--bts-sidebar-surface", "rgba(255,255,255,0.22)");
      s.setProperty("--bts-sidebar-border", "rgba(134,105,88,0.14)");
    }
  }

  async function persistTheme(theme) {
    currentTheme = theme;
    applyThemeToDOM(theme);
    autoTextColors(theme);
    await storageSet(THEME_STORAGE_KEY, theme);
  }

  async function hydrateTheme() {
    const stored = await storageGet(THEME_STORAGE_KEY);
    if (stored && typeof stored === "object" && stored.mesh) {
      currentTheme = {
        mesh: { ...THEME_PRESETS[0].mesh, ...stored.mesh },
        grain: Number.isFinite(stored.grain) ? stored.grain : 52
      };
    }
    applyThemeToDOM(currentTheme);
    autoTextColors(currentTheme);
  }

  function buildThemeEditorUI() {
    themePresetsContainer.replaceChildren();
    for (const preset of THEME_PRESETS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bts-theme-preset-btn";
      btn.title = preset.name;

      const swatch = document.createElement("span");
      swatch.className = "bts-theme-preset-swatch";
      swatch.style.background = `linear-gradient(135deg, ${preset.mesh.a}, ${preset.mesh.b}, ${preset.mesh.c})`;

      const label = document.createElement("span");
      label.className = "bts-theme-preset-name";
      label.textContent = preset.name;

      btn.append(swatch, label);
      btn.addEventListener("click", () => {
        void persistTheme({ mesh: { ...preset.mesh }, grain: preset.grain });
        syncThemeEditorUI();
      });
      themePresetsContainer.append(btn);
    }

    themeColorRow.replaceChildren();
    for (const key of THEME_MESH_KEYS) {
      const input = document.createElement("input");
      input.type = "color";
      input.className = "bts-theme-color-input";
      input.dataset.meshKey = key;
      input.value = currentTheme.mesh[key];
      input.addEventListener("input", () => {
        currentTheme.mesh[key] = input.value;
        applyThemeToDOM(currentTheme);
        autoTextColors(currentTheme);
      });
      input.addEventListener("change", () => {
        void persistTheme({ ...currentTheme });
      });
      themeColorRow.append(input);
    }

    grainSlider.value = String(currentTheme.grain);
    grainSlider.addEventListener("input", () => {
      currentTheme.grain = Number(grainSlider.value);
      sidebarEl.style.setProperty("--bts-noise-opacity", String(currentTheme.grain / 100));
    });
    grainSlider.addEventListener("change", () => {
      void persistTheme({ ...currentTheme });
    });
  }

  function syncThemeEditorUI() {
    const colorInputs = themeColorRow.querySelectorAll(".bts-theme-color-input");
    for (const input of colorInputs) {
      const key = input.dataset.meshKey;
      if (key && currentTheme.mesh[key]) {
        input.value = currentTheme.mesh[key];
      }
    }
    grainSlider.value = String(currentTheme.grain);
  }

  function openThemeEditor() {
    syncThemeEditorUI();
    themeEditor.classList.add("is-open");
    themeEditor.setAttribute("aria-hidden", "false");
  }

  function closeThemeEditor() {
    themeEditor.classList.remove("is-open");
    themeEditor.setAttribute("aria-hidden", "true");
  }

  themeButton.addEventListener("click", () => {
    if (themeEditor.classList.contains("is-open")) {
      closeThemeEditor();
    } else {
      openThemeEditor();
    }
  });

  themeCloseButton.addEventListener("click", () => {
    closeThemeEditor();
  });

  buildThemeEditorUI();

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
    return arcModelModule.getActiveSpace(sidebarData, DEFAULT_SPACE);
  }

  function getActiveSpacePinnedNodes() {
    return arcModelModule.getActiveSpacePinnedNodes(sidebarData, DEFAULT_SPACE);
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

    const result = arcModelModule.addFavoriteItem(sidebarData, item, {
      normalizeUrlKey,
      maxFavorites: MAX_FAVORITES
    });

    if (!result.changed) {
      return;
    }

    sidebarData.favorites = result.favorites;
    await persistSidebarData();
  }

  async function removeFavoriteByUrl(url) {
    sidebarData.favorites = arcModelModule.removeFavoriteByUrl(
      sidebarData.favorites, url, normalizeUrlKey
    );
    await persistSidebarData();
  }

  async function pinTabInActiveSpace(tab) {
    const item = createSavedItemFromTab(tab);
    if (!item) {
      return;
    }

    const result = arcModelModule.pinSavedItemInActiveSpace(sidebarData, item, {
      normalizeUrlKey,
      defaultSpace: DEFAULT_SPACE,
      updatePinnedLinkByUrl,
      createPinnedLinkNodeFromSavedItem
    });

    sidebarData.pinnedBySpace[result.spaceId] = result.nodes;
    await persistSidebarData();
  }

  async function removePinnedLinkById(linkId) {
    const activeSpace = getActiveSpace();
    const currentItems = getActiveSpacePinnedNodes();
    const { next, removed } = arcModelModule.removePinnedLinkByIdFromNodes(currentItems, linkId);
    if (!removed) {
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = next;
    await persistSidebarData();
  }

  async function unpinUrlInActiveSpace(url) {
    const activeSpace = getActiveSpace();
    const nodes = getActiveSpacePinnedNodes();
    sidebarData.pinnedBySpace[activeSpace.id] = arcModelModule.unpinUrlFromNodes(
      nodes, url, normalizeUrlKey
    );
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
      const tint = getFavoriteTint(item.url);
      button.style.setProperty("--fav-tint-bg", tint.bg);
      button.style.setProperty("--fav-tint-border", tint.border);

      const media = document.createElement("span");
      media.className = "bts-favorite-media";

      const monogram = document.createElement("span");
      monogram.className = "bts-favorite-monogram";
      monogram.textContent = getItemMonogram(item);

      media.append(monogram, favicon);
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
      button.append(media);
      return button;
    }

    const title = document.createElement("span");
    title.className = "bts-pinned-title";
    title.textContent = item.title || item.url;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "bts-pinned-remove";
    removeButton.title = "Unpin";
    removeButton.setAttribute("aria-label", "Unpin");
    removeButton.append(createIcon("close"));
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
    const result = arcModelModule.pinItemToFolder(currentItems, item, folderId, {
      normalizeUrlKey,
      createPinnedLinkNodeFromSavedItem
    });

    if (!result.changed) {
      return;
    }

    sidebarData.pinnedBySpace[activeSpace.id] = result.nodes;
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
    toggle.append(createIcon(folder.collapsed ? "chevronRight" : "chevronDown"));
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
    rename.title = "Rename folder";
    rename.setAttribute("aria-label", "Rename folder");
    rename.append(createIcon("pencil"));
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
      button.setAttribute("aria-label", item.title || item.url || "Favorite");
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
    spaceIconEl.dataset.spaceIcon = String(activeSpace.icon || "•");

    for (const space of sidebarData.spaces) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bts-space-dot";
      button.dataset.spaceIcon = String(space.icon || "•");
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
    const result = arcModelModule.addSpace(sidebarData, newSpace);
    sidebarData.spaces = result.spaces;
    sidebarData.pinnedBySpace = result.pinnedBySpace;
    sidebarData.activeSpaceId = result.activeSpaceId;
    await persistSidebarData();
    renderTabList();
  }

  function getStateKey() {
    return Number.isInteger(windowId) ? `${WINDOW_STATE_PREFIX}${windowId}` : null;
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
    layoutController.setSidebarWidth(nextWidth, options);
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
    layoutController.setOpen(nextOpen, options);
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

  interactionController = interactionControllerModule.createSidebarInteractionController({
    globalScope,
    document,
    shadowRoot,
    searchInput,
    searchWrap,
    searchToggleButton,
    commandPaletteEl,
    commandBackdrop,
    commandInput,
    commandList,
    contextMenuEl,
    keyboardNavModule,
    commandPaletteDataModule,
    quickSwitcherModule,
    contextMenuModelModule,
    contextMenuActionsModule,
    maxFavorites: MAX_FAVORITES,
    MESSAGE_TYPES,
    getWindowId: () => windowId,
    getTabs: () => latestSnapshot.tabs,
    getGroups: () => latestSnapshot.groups,
    getFavorites: () => sidebarData.favorites,
    getPinnedNodes: () => getActiveSpacePinnedNodes(),
    getVisibleTabs,
    getActiveTabId: getActiveSnapshotTabId,
    getSidebarOpen: () => sidebarOpen,
    setOpen,
    renderTabList,
    focusRenderedTabRow,
    sendMessage,
    getSearchQuery: () => searchQuery,
    setSearchQuery: (nextQuery) => {
      searchQuery = nextQuery;
    },
    expandSearch,
    collapseSearch,
    openOrFocusUrl,
    resolveTabForStorage,
    addTabToFavorites,
    removeFavoriteByUrl,
    pinTabInActiveSpace,
    unpinUrlInActiveSpace,
    normalizeUrlKey,
    isHttpUrl,
    isUrlInFavorites,
    isUrlPinnedInActiveSpace,
    clearDragDropVisualState,
    resetDragDropState: () => {
      dragDropController.resetAll();
    }
  });

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
    const focusedTabId = interactionController.syncFocusedTabId({
      tabIds: visibleTabIdList,
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
          interactionController.setFocusedTabId(tabId);
          void sendMessage({
            type: MESSAGE_TYPES.ACTIVATE_TAB,
            payload: { tabId }
          });
        },
        onClose: (tabId) => {
          interactionController.setFocusedTabId(
            keyboardNavModule.getFocusAfterClose({
              tabIds: visibleTabIdList,
              closingTabId: tabId,
              currentFocusedTabId: interactionController.getFocusedTabId(),
              activeTabId
            })
          );

          interactionController.syncFocusedTabId({
            tabIds: keyboardNavModule.normalizeTabIds(
              visibleTabIdList.filter((visibleTabId) => visibleTabId !== tabId)
            ),
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
          interactionController.setFocusedTabId(tab?.id);
          interactionController.openContextMenuForTab(tab, x, y);
        },
        onFocus: (tabId) => {
          interactionController.setFocusedTabId(tabId);
        },
        onDragStart: (tabId) => {
          interactionController.setFocusedTabId(tabId);
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

    previousVisibleTabIds = visibleTabIds;
    interactionController.handlePostRender({
      hadTabRowFocus,
      tabs: latestSnapshot.tabs
    });
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
    layoutController.bindResizeHandle();
  }

  async function hydrateInitialState() {
    const stateResponse = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
    await hydrateTheme();
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
    layoutController.handleTransitionEnd(event);
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

  function expandSearch() {
    searchWrap.classList.remove("bts-search-collapsed");
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.select();
    });
  }

  function collapseSearch() {
    searchQuery = "";
    searchInput.value = "";
    searchWrap.classList.add("bts-search-collapsed");
    renderTabList();
  }

  handleResize();
  setupArcDropZones();
  interactionController.bind();

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

      interactionController.toggleCommandPalette();
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
      runtimeClient.markContextInvalidated();
      event.preventDefault();
    }
  });

  void hydrateInitialState();
})(globalThis);
