if (typeof importScripts === "function") {
  try {
    importScripts("sidebar/messages.js");
  } catch {}
}

const WINDOW_STATE_PREFIX = "bts_window_state_";
const TOGGLE_COMMAND = "toggle-sidebar";
const TOGGLE_COMMAND_PALETTE = "toggle-command-palette";
const messageContract = globalThis.BraveSidebarMessages;
const MESSAGE_TYPES = messageContract?.MESSAGE_TYPES || {
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

const INJECT_FILES = [
  "sidebar/messages.js",
  "sidebar/search.js",
  "sidebar/groups.js",
  "sidebar/tabs.js",
  "sidebar/sidebar-data.js",
  "sidebar/drag-state.js",
  "sidebar/drag-drop-controller.js",
  "sidebar/keyboard-nav.js",
  "sidebar/render-perf.js",
  "sidebar/context-menu-model.js",
  "sidebar/command-palette-data.js",
  "sidebar/quick-switcher.js",
  "content.js"
];
const broadcastTimers = new Map();
const injectionTasks = new Map();
const faviconCache = new Map();
const faviconInflight = new Map();
const MAX_FAVICON_CACHE_ENTRIES = 512;
const FAVICON_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAVICON_FAILURE_TTL_MS = 2 * 60 * 1000;

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result?.[key]);
    });
  });
}

function storageSet(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      resolve(tabs || []);
    });
  });
}

function validateIncomingMessage(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, error: "INVALID_MESSAGE" };
  }

  const isKnownMessageType = messageContract?.isKnownMessageType;
  if (typeof isKnownMessageType === "function" && !isKnownMessageType(message.type)) {
    return { ok: true };
  }

  const validatePayload = messageContract?.validatePayload;
  if (typeof validatePayload !== "function") {
    return { ok: true };
  }

  return validatePayload(message.type, message.payload);
}

function isSafeInlineImageUrl(url) {
  return /^(data:|blob:|chrome-extension:)/i.test(String(url || ""));
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function readCachedFavicon(url) {
  if (!faviconCache.has(url)) {
    return undefined;
  }

  const entry = faviconCache.get(url);
  if (!entry || Date.now() > entry.expiresAt) {
    faviconCache.delete(url);
    return undefined;
  }

  faviconCache.delete(url);
  faviconCache.set(url, entry);
  return entry.dataUrl;
}

function writeCachedFavicon(url, dataUrl, ttlMs) {
  if (faviconCache.has(url)) {
    faviconCache.delete(url);
  }

  faviconCache.set(url, {
    dataUrl,
    expiresAt: Date.now() + Math.max(1, ttlMs)
  });

  if (faviconCache.size > MAX_FAVICON_CACHE_ENTRIES) {
    const oldestKey = faviconCache.keys().next().value;
    if (oldestKey) {
      faviconCache.delete(oldestKey);
    }
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, {
    cache: "force-cache",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`FAVICON_FETCH_FAILED_${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error("FAVICON_EMPTY");
  }

  const base64 = arrayBufferToBase64(buffer);
  return `data:${contentType};base64,${base64}`;
}

async function resolveFaviconUrl(rawUrl, windowId) {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return "";
  }

  if (isSafeInlineImageUrl(url)) {
    return url;
  }

  if (!isHttpUrl(url)) {
    return "";
  }

  const cached = readCachedFavicon(url);
  if (cached !== undefined) {
    return cached;
  }

  if (faviconInflight.has(url)) {
    return faviconInflight.get(url);
  }

  const task = (async () => {
    try {
      const dataUrl = await fetchImageAsDataUrl(url);
      writeCachedFavicon(url, dataUrl, FAVICON_SUCCESS_TTL_MS);
      if (Number.isInteger(windowId)) {
        scheduleWindowBroadcast(windowId);
      }
      return dataUrl;
    } catch {
      writeCachedFavicon(url, "", FAVICON_FAILURE_TTL_MS);
      return "";
    } finally {
      faviconInflight.delete(url);
    }
  })();

  faviconInflight.set(url, task);
  return task;
}

function getImmediateFaviconUrl(rawUrl, windowId) {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return "";
  }

  if (isSafeInlineImageUrl(url)) {
    return url;
  }

  if (!isHttpUrl(url)) {
    return "";
  }

  const cached = readCachedFavicon(url);
  if (cached !== undefined) {
    return cached;
  }

  void resolveFaviconUrl(url, windowId);
  return "";
}

async function serializeTabWithResolvedFavicon(tab) {
  const serialized = serializeTab(tab);
  serialized.favIconUrl = await resolveFaviconUrl(tab?.favIconUrl, tab?.windowId);
  return serialized;
}

function serializeTabForSnapshot(tab, windowId) {
  const serialized = serializeTab(tab);
  serialized.favIconUrl = getImmediateFaviconUrl(tab?.favIconUrl, windowId);
  return serialized;
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function removeTabs(tabIds) {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabIds, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function moveTab(tabId, moveProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, moveProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function duplicateTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.duplicate(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function groupTabs(groupOptions) {
  return new Promise((resolve, reject) => {
    chrome.tabs.group(groupOptions, (groupId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(groupId);
    });
  });
}

function ungroupTabs(tabIds) {
  return new Promise((resolve, reject) => {
    chrome.tabs.ungroup(tabIds, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function updateTabGroup(groupId, updateProperties) {
  if (!chrome.tabGroups?.update) {
    return Promise.reject(new Error("TAB_GROUPS_UNSUPPORTED"));
  }

  return new Promise((resolve, reject) => {
    chrome.tabGroups.update(groupId, updateProperties, (group) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(group);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ ok: true, response });
    });
  });
}

function executeScript(details) {
  if (!chrome.scripting?.executeScript) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(details, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result || null);
    });
  });
}

function isInjectableUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }
  return /^https?:\/\//i.test(url);
}

async function ensureTabInjected(tab) {
  if (!tab || !Number.isInteger(tab.id)) {
    return false;
  }

  if (injectionTasks.has(tab.id)) {
    return injectionTasks.get(tab.id);
  }

  const task = (async () => {
    const ping = await sendMessageToTab(tab.id, { type: MESSAGE_TYPES.PING });
    if (ping.ok) {
      return true;
    }

    if (!isInjectableUrl(tab.url)) {
      return false;
    }

    try {
      await executeScript({
        target: { tabId: tab.id },
        files: INJECT_FILES
      });

      const secondPing = await sendMessageToTab(tab.id, { type: MESSAGE_TYPES.PING });
      return secondPing.ok;
    } catch {
      return false;
    }
  })();

  injectionTasks.set(tab.id, task);

  try {
    return await task;
  } finally {
    injectionTasks.delete(tab.id);
  }
}

async function ensureWindowInjected(windowId) {
  const tabs = await queryTabs({ windowId });
  await Promise.all(tabs.map((tab) => ensureTabInjected(tab)));
}

function queryGroups(windowId) {
  if (!chrome.tabGroups?.query) {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    chrome.tabGroups.query({ windowId }, (groups) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(groups || []);
    });
  });
}

function getWindowStateKey(windowId) {
  return `${WINDOW_STATE_PREFIX}${windowId}`;
}

async function readWindowState(windowId) {
  const key = getWindowStateKey(windowId);
  const existing = await storageGet(key);
  return existing && typeof existing === "object" ? existing : {};
}

async function writeWindowState(windowId, partial) {
  const key = getWindowStateKey(windowId);
  const previous = await readWindowState(windowId);
  const next = { ...previous, ...partial };
  await storageSet(key, next);
  return next;
}

function serializeTab(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    title: tab.title || "Untitled",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl || "",
    active: Boolean(tab.active),
    pinned: Boolean(tab.pinned),
    audible: Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo?.muted),
    status: tab.status || "complete",
    attention: Boolean(tab.attention),
    groupId: Number.isInteger(tab.groupId) ? tab.groupId : -1
  };
}

function serializeGroup(group) {
  return {
    id: group.id,
    windowId: group.windowId,
    title: group.title || "Unnamed group",
    color: group.color || "grey",
    collapsed: Boolean(group.collapsed)
  };
}

async function buildWindowSnapshot(windowId) {
  const [tabs, groups] = await Promise.all([
    queryTabs({ windowId }),
    queryGroups(windowId)
  ]);

  return {
    windowId,
    tabs: tabs
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((tab) => serializeTabForSnapshot(tab, windowId)),
    groups: groups.map(serializeGroup)
  };
}

function safeSendToTab(tabId, message) {
  void sendMessageToTab(tabId, message);
}

async function sendMessageToWindow(windowId, message) {
  const tabs = await queryTabs({ windowId });
  for (const tab of tabs) {
    if (Number.isInteger(tab.id)) {
      safeSendToTab(tab.id, message);
    }
  }
}

async function broadcastWindowSnapshot(windowId) {
  const snapshot = await buildWindowSnapshot(windowId);
  await sendMessageToWindow(windowId, {
    type: MESSAGE_TYPES.STATE,
    payload: snapshot
  });
}

function scheduleWindowBroadcast(windowId) {
  if (!Number.isInteger(windowId) || windowId < 0) {
    return;
  }
  if (broadcastTimers.has(windowId)) {
    clearTimeout(broadcastTimers.get(windowId));
  }

  const timer = setTimeout(async () => {
    broadcastTimers.delete(windowId);
    await broadcastWindowSnapshot(windowId);
  }, 30);

  broadcastTimers.set(windowId, timer);
}

async function toggleWindowOpen(windowId, activeTabId) {
  await ensureWindowInjected(windowId);

  if (Number.isInteger(activeTabId)) {
    const tabs = await queryTabs({ windowId });
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab) {
      await ensureTabInjected(activeTab);
    }
  }

  const state = await readWindowState(windowId);
  const nextOpen = !Boolean(state.open);
  await writeWindowState(windowId, { open: nextOpen });
  await sendMessageToWindow(windowId, {
    type: MESSAGE_TYPES.SET_OPEN,
    payload: { windowId, open: nextOpen }
  });
}

async function toggleLastFocusedWindow() {
  const activeTab = await getLastFocusedActiveTab();
  if (!activeTab || !Number.isInteger(activeTab.windowId)) {
    return;
  }
  await toggleWindowOpen(activeTab.windowId, activeTab.id);
}

async function getLastFocusedActiveTab() {
  const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

async function toggleLastFocusedWindowCommandPalette() {
  const activeTab = await getLastFocusedActiveTab();
  if (
    !activeTab ||
    !Number.isInteger(activeTab.id) ||
    !Number.isInteger(activeTab.windowId)
  ) {
    return;
  }

  const injected = await ensureTabInjected(activeTab);
  if (!injected) {
    return;
  }

  await sendMessageToTab(activeTab.id, {
    type: MESSAGE_TYPES.TOGGLE_COMMAND_PALETTE,
    payload: { windowId: activeTab.windowId }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await queryTabs({});
  await Promise.all(tabs.map((tab) => ensureTabInjected(tab)));
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!Number.isInteger(tab.windowId)) {
    return;
  }
  await toggleWindowOpen(tab.windowId, tab.id);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === TOGGLE_COMMAND) {
    await toggleLastFocusedWindow();
    return;
  }

  if (command === TOGGLE_COMMAND_PALETTE) {
    await toggleLastFocusedWindowCommandPalette();
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  void ensureTabInjected(tab);
  scheduleWindowBroadcast(tab.windowId);
});

chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  scheduleWindowBroadcast(removeInfo.windowId);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    void ensureTabInjected(tab);
  }
  scheduleWindowBroadcast(tab.windowId);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (Number.isInteger(activeInfo.tabId)) {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        return;
      }
      void ensureTabInjected(tab);
    });
  }
  scheduleWindowBroadcast(activeInfo.windowId);
});

chrome.tabs.onMoved.addListener((_tabId, moveInfo) => {
  scheduleWindowBroadcast(moveInfo.windowId);
});

chrome.tabs.onAttached.addListener((_tabId, attachInfo) => {
  scheduleWindowBroadcast(attachInfo.newWindowId);
});

chrome.tabs.onDetached.addListener((_tabId, detachInfo) => {
  scheduleWindowBroadcast(detachInfo.oldWindowId);
});

if (chrome.tabGroups?.onCreated) {
  chrome.tabGroups.onCreated.addListener((group) => {
    scheduleWindowBroadcast(group.windowId);
  });
}

if (chrome.tabGroups?.onUpdated) {
  chrome.tabGroups.onUpdated.addListener((group) => {
    scheduleWindowBroadcast(group.windowId);
  });
}

if (chrome.tabGroups?.onRemoved) {
  chrome.tabGroups.onRemoved.addListener((group) => {
    scheduleWindowBroadcast(group.windowId);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  const validation = validateIncomingMessage(message);
  if (!validation.ok) {
    sendResponse({ ok: false, error: validation.error });
    return false;
  }

  (async () => {
    const senderWindowId = sender.tab?.windowId;

    if (message.type === MESSAGE_TYPES.GET_STATE) {
      const windowId = Number.isInteger(message.payload?.windowId)
        ? message.payload.windowId
        : senderWindowId;

      if (!Number.isInteger(windowId)) {
        sendResponse({ ok: false, error: "NO_WINDOW" });
        return;
      }

      const [snapshot, windowState] = await Promise.all([
        buildWindowSnapshot(windowId),
        readWindowState(windowId)
      ]);

      sendResponse({ ok: true, snapshot, windowState });
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_TAB) {
      const tabId = message.payload?.tabId;
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false, error: "INVALID_TAB_ID" });
        return;
      }

      const tab = await getTab(tabId);
      const serializedTab = await serializeTabWithResolvedFavicon(tab);
      sendResponse({ ok: true, tab: serializedTab });
      return;
    }

    if (message.type === MESSAGE_TYPES.SET_WINDOW_OPEN) {
      const windowId = Number.isInteger(message.payload?.windowId)
        ? message.payload.windowId
        : senderWindowId;

      if (!Number.isInteger(windowId)) {
        sendResponse({ ok: false, error: "NO_WINDOW" });
        return;
      }

      const nextOpen = Boolean(message.payload?.open);
      await writeWindowState(windowId, { open: nextOpen });
      await sendMessageToWindow(windowId, {
        type: MESSAGE_TYPES.SET_OPEN,
        payload: { windowId, open: nextOpen }
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.ACTIVATE_TAB) {
      const tabId = message.payload?.tabId;
      if (Number.isInteger(tabId)) {
        await updateTab(tabId, { active: true });
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.CLOSE_TAB) {
      const tabId = message.payload?.tabId;
      if (Number.isInteger(tabId)) {
        await removeTabs(tabId);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.CREATE_TAB) {
      const windowId = Number.isInteger(message.payload?.windowId)
        ? message.payload.windowId
        : senderWindowId;
      if (Number.isInteger(windowId)) {
        const url =
          typeof message.payload?.url === "string" ? message.payload.url.trim() : "";
        const createProperties = {
          windowId,
          active: true
        };
        if (url) {
          createProperties.url = url;
        }
        await createTab(createProperties);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.MOVE_TAB) {
      const tabId = message.payload?.tabId;
      const index = message.payload?.index;
      if (Number.isInteger(tabId) && Number.isInteger(index)) {
        await moveTab(tabId, { index });
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.UPDATE_TAB) {
      const tabId = message.payload?.tabId;
      const update = message.payload?.update;
      if (Number.isInteger(tabId) && update && typeof update === "object") {
        const tab = await updateTab(tabId, update);
        scheduleWindowBroadcast(tab.windowId);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.DUPLICATE_TAB) {
      const tabId = message.payload?.tabId;
      if (Number.isInteger(tabId)) {
        const duplicated = await duplicateTab(tabId);
        if (Number.isInteger(duplicated?.windowId)) {
          scheduleWindowBroadcast(duplicated.windowId);
        }
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.CLOSE_OTHER_TABS) {
      const tabId = message.payload?.tabId;
      if (Number.isInteger(tabId)) {
        const tab = await getTab(tabId);
        const tabs = await queryTabs({ windowId: tab.windowId });
        const tabIdsToClose = tabs
          .map((item) => item?.id)
          .filter((id) => Number.isInteger(id) && id !== tabId);

        if (tabIdsToClose.length > 0) {
          await removeTabs(tabIdsToClose);
        }

        scheduleWindowBroadcast(tab.windowId);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.SET_TAB_GROUP) {
      const tabId = message.payload?.tabId;
      const groupId = message.payload?.groupId;
      const createNew = Boolean(message.payload?.createNew);
      const title = typeof message.payload?.title === "string" ? message.payload.title : "";

      if (Number.isInteger(tabId)) {
        const tab = await getTab(tabId);

        if (createNew) {
          const newGroupId = await groupTabs({ tabIds: [tabId] });
          await updateTabGroup(newGroupId, {
            title: title || "New Group"
          });
        } else if (groupId === -1 || groupId === null) {
          await ungroupTabs([tabId]);
        } else if (Number.isInteger(groupId) && groupId >= 0) {
          await groupTabs({ groupId, tabIds: [tabId] });
        }

        scheduleWindowBroadcast(tab.windowId);
      }
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "UNKNOWN_MESSAGE" });
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || "UNEXPECTED_ERROR" });
  });

  return true;
});
