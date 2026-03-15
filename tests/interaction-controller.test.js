const test = require("node:test");
const assert = require("node:assert/strict");

const keyboardNav = require("../sidebar/keyboard-nav.js");
const {
  createSidebarInteractionController
} = require("../sidebar/interaction-controller.js");

function createClassList() {
  const values = new Set();

  return {
    add(...names) {
      for (const name of names) {
        if (name) {
          values.add(name);
        }
      }
    },
    remove(...names) {
      for (const name of names) {
        values.delete(name);
      }
    },
    toggle(name, force) {
      if (force === true) {
        values.add(name);
        return true;
      }
      if (force === false) {
        values.delete(name);
        return false;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    },
    contains(name) {
      return values.has(name);
    },
    reset(value) {
      values.clear();
      for (const part of String(value || "").split(/\s+/)) {
        if (part) {
          values.add(part);
        }
      }
    },
    toArray() {
      return Array.from(values);
    }
  };
}

function createStyleTarget() {
  return {
    setProperty(name, value) {
      this[name] = value;
    },
    removeProperty(name) {
      delete this[name];
    }
  };
}

function createEventTarget() {
  const listeners = new Map();

  return {
    listeners,
    addEventListener(type, listener, options = {}) {
      const current = listeners.get(type) || [];
      current.push({
        listener,
        once: Boolean(options?.once)
      });
      listeners.set(type, current);
    },
    removeEventListener(type, listener) {
      const current = listeners.get(type) || [];
      listeners.set(
        type,
        current.filter((entry) => entry.listener !== listener)
      );
    },
    dispatchEvent(type, event = {}) {
      const current = (listeners.get(type) || []).slice();
      for (const entry of current) {
        entry.listener(event);
        if (entry.once) {
          this.removeEventListener(type, entry.listener);
        }
      }
    }
  };
}

function createElementStub(tagName) {
  const eventTarget = createEventTarget();
  const classList = createClassList();
  const element = {
    ...eventTarget,
    tagName: String(tagName || "").toUpperCase(),
    attributes: {},
    children: [],
    dataset: {},
    disabled: false,
    focused: false,
    selected: false,
    offsetWidth: 220,
    offsetHeight: 320,
    style: createStyleTarget(),
    classList,
    textContent: "",
    value: "",
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
      if (name === "class") {
        classList.reset(value);
      }
    },
    focus() {
      this.focused = true;
    },
    select() {
      this.selected = true;
    },
    scrollIntoView() {
      this.scrolled = true;
    },
    querySelectorAll(selector) {
      if (selector === ".bts-command-item") {
        return this.children.filter((child) =>
          child?.classList?.contains?.("bts-command-item")
        );
      }
      return [];
    },
    querySelector(selector) {
      if (selector === ".bts-context-menu-item:not(.is-disabled)") {
        return (
          this.children.find(
            (child) =>
              child?.classList?.contains?.("bts-context-menu-item") &&
              !child.classList.contains("is-disabled")
          ) || null
        );
      }
      return null;
    }
  };

  Object.defineProperty(element, "className", {
    get() {
      return classList.toArray().join(" ");
    },
    set(value) {
      classList.reset(value);
    }
  });

  return element;
}

function createDocumentStub() {
  const eventTarget = createEventTarget();
  return {
    ...eventTarget,
    createElement(tagName) {
      return createElementStub(tagName);
    }
  };
}

function createHarness(options = {}) {
  const document = createDocumentStub();
  const shadowRoot = createEventTarget();
  shadowRoot.activeElement = null;

  const searchInput = createElementStub("input");
  const searchWrap = createElementStub("div");
  const searchToggleButton = createElementStub("button");
  const commandPaletteEl = createElementStub("div");
  const commandBackdrop = createElementStub("div");
  const commandInput = createElementStub("input");
  const commandList = createElementStub("div");
  const contextMenuEl = createElementStub("div");
  const renderCalls = [];
  const focusCalls = [];
  const setOpenCalls = [];
  const sendMessages = [];
  const contextActions = [];

  searchWrap.classList.add("bts-search-collapsed");

  let now = 100;
  let searchQuery = "";
  let sidebarOpen = Boolean(options.sidebarOpen);
  const visibleTabs = Array.isArray(options.visibleTabs)
    ? options.visibleTabs
    : [
        { id: 1, title: "Inbox", url: "https://mail.example.com", active: true },
        { id: 2, title: "Docs", url: "https://docs.example.com", active: false }
      ];
  const tabs = Array.isArray(options.tabs) ? options.tabs : visibleTabs;
  const groups = Array.isArray(options.groups) ? options.groups : [];
  const favorites = Array.isArray(options.favorites) ? options.favorites : [];
  const pinnedNodes = Array.isArray(options.pinnedNodes) ? options.pinnedNodes : [];

  const controller = createSidebarInteractionController({
    globalScope: {
      document,
      innerWidth: 1280,
      innerHeight: 900,
      performance: {
        now() {
          return now;
        }
      },
      requestAnimationFrame(callback) {
        callback();
        return 1;
      }
    },
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
    keyboardNavModule: keyboardNav,
    commandPaletteDataModule: {
      createCommandPaletteCandidates() {
        return [
          { id: "action:new-tab", type: "action", label: "New Tab", command: "new-tab" },
          { id: "tab:docs", type: "tab", label: "Docs", command: "activate-tab", tabId: 2 }
        ];
      }
    },
    quickSwitcherModule: {
      rankItems(items, query) {
        const normalized = String(query || "").toLowerCase();
        if (!normalized) {
          return items.slice();
        }
        return items.filter((item) =>
          String(item.label || "").toLowerCase().includes(normalized)
        );
      }
    },
    contextMenuModelModule: {
      buildTabContextMenuModel() {
        return [{ id: "pin-to-sidebar", label: "Pin to Sidebar" }];
      }
    },
    contextMenuActionsModule: {
      async executeTabAction(actionId, args) {
        contextActions.push({ actionId, args });
        return { shouldRender: true };
      }
    },
    maxFavorites: 12,
    MESSAGE_TYPES: {
      ACTIVATE_TAB: "sidebar:activateTab",
      CLOSE_TAB: "sidebar:closeTab",
      CREATE_TAB: "sidebar:createTab",
      UPDATE_TAB: "sidebar:updateTab"
    },
    getWindowId: () => 7,
    getTabs: () => tabs,
    getGroups: () => groups,
    getFavorites: () => favorites,
    getPinnedNodes: () => pinnedNodes,
    getVisibleTabs: () => visibleTabs,
    getActiveTabId: () => visibleTabs.find((tab) => tab.active)?.id ?? null,
    getSidebarOpen: () => sidebarOpen,
    setOpen(nextOpen, optionsArg) {
      sidebarOpen = Boolean(nextOpen);
      setOpenCalls.push({ open: sidebarOpen, options: optionsArg });
    },
    renderTabList() {
      renderCalls.push("render");
    },
    focusRenderedTabRow(tabId, focusOptions) {
      focusCalls.push({ tabId, options: focusOptions });
    },
    sendMessage(message) {
      sendMessages.push(message);
      return Promise.resolve({ ok: true });
    },
    getSearchQuery: () => searchQuery,
    setSearchQuery(nextQuery) {
      searchQuery = String(nextQuery || "");
    },
    expandSearch() {
      searchWrap.classList.remove("bts-search-collapsed");
      searchInput.focus();
      searchInput.select();
    },
    collapseSearch() {
      searchQuery = "";
      searchInput.value = "";
      searchWrap.classList.add("bts-search-collapsed");
    },
    openOrFocusUrl: async () => {},
    resolveTabForStorage: async (tab) => tab,
    addTabToFavorites: async () => {},
    removeFavoriteByUrl: async () => {},
    pinTabInActiveSpace: async () => {},
    unpinUrlInActiveSpace: async () => {},
    normalizeUrlKey: (url) => String(url || ""),
    isHttpUrl: (url) => /^https?:\/\//i.test(String(url || "")),
    isUrlInFavorites: () => false,
    isUrlPinnedInActiveSpace: () => false,
    clearDragDropVisualState() {},
    resetDragDropState() {}
  });

  return {
    commandInput,
    commandList,
    commandPaletteEl,
    contextActions,
    contextMenuEl,
    controller,
    document,
    focusCalls,
    renderCalls,
    searchInput,
    searchWrap,
    sendMessages,
    setOpenCalls,
    shadowRoot,
    advanceTime(ms) {
      now += ms;
    }
  };
}

test("document shortcut opens command palette but skips editable targets", () => {
  const harness = createHarness();
  harness.controller.bind();

  const shortcutEvent = {
    key: "k",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: createElementStub("div"),
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    }
  };

  harness.document.dispatchEvent("keydown", shortcutEvent);

  assert.equal(harness.commandPaletteEl.classList.contains("is-open"), true);
  assert.equal(harness.commandInput.focused, true);
  assert.equal(harness.commandInput.selected, true);
  assert.equal(harness.commandList.children.length, 2);
  assert.equal(harness.setOpenCalls.length, 1);
  assert.equal(shortcutEvent.prevented, true);

  const editableHarness = createHarness();
  editableHarness.controller.bind();
  const editableEvent = {
    key: "k",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: createElementStub("input"),
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    }
  };

  editableHarness.document.dispatchEvent("keydown", editableEvent);

  assert.equal(editableHarness.commandPaletteEl.classList.contains("is-open"), false);
  assert.equal(editableEvent.prevented, undefined);
});

test("shadow keydown moves focused tab and requests focus restoration", () => {
  const harness = createHarness({ sidebarOpen: true });
  harness.controller.bind();
  harness.controller.setFocusedTabId(1);

  const arrowEvent = {
    key: "ArrowDown",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: createElementStub("div"),
    preventDefault() {
      this.prevented = true;
    }
  };

  harness.shadowRoot.dispatchEvent("keydown", arrowEvent);

  assert.equal(harness.controller.getFocusedTabId(), 2);
  assert.equal(harness.renderCalls.length, 1);
  assert.deepEqual(harness.focusCalls[0], {
    tabId: 2,
    options: {}
  });
  assert.equal(arrowEvent.prevented, true);
});

test("context menu action click closes menu and suppresses immediate outside pointerdown", async () => {
  const harness = createHarness({ sidebarOpen: true });
  harness.controller.bind();

  harness.controller.openContextMenuForTab(
    { id: 9, title: "Docs", url: "https://docs.example.com" },
    40,
    24
  );

  assert.equal(harness.contextMenuEl.classList.contains("is-open"), true);
  assert.equal(harness.contextMenuEl.children.length, 1);

  const menuItem = harness.contextMenuEl.children[0];
  menuItem.dispatchEvent("click", {
    preventDefault() {},
    stopPropagation() {}
  });

  await Promise.resolve();

  assert.equal(harness.contextMenuEl.classList.contains("is-open"), false);
  assert.equal(harness.contextActions.length, 1);
  assert.equal(harness.renderCalls.length, 1);

  let suppressed = false;
  harness.shadowRoot.dispatchEvent("pointerdown", {
    composedPath() {
      return [];
    },
    preventDefault() {
      suppressed = true;
    },
    stopPropagation() {}
  });

  assert.equal(suppressed, true);

  suppressed = false;
  harness.advanceTime(400);
  harness.shadowRoot.dispatchEvent("pointerdown", {
    composedPath() {
      return [];
    },
    preventDefault() {
      suppressed = true;
    },
    stopPropagation() {}
  });

  assert.equal(suppressed, false);
});
