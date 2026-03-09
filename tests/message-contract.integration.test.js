const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const messages = require("../sidebar/messages.js");

const { MESSAGE_TYPES } = messages;

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    }
  };
}

function cloneTab(tab) {
  const base = {
    id: 0,
    windowId: 1,
    index: 0,
    title: "",
    url: "",
    favIconUrl: "",
    active: false,
    pinned: false,
    audible: false,
    mutedInfo: { muted: false },
    status: "complete",
    attention: false,
    groupId: -1
  };

  const merged = {
    ...base,
    ...(tab || {})
  };

  merged.mutedInfo = {
    muted: Boolean(tab?.mutedInfo?.muted ?? tab?.muted ?? false)
  };

  merged.groupId = Number.isInteger(tab?.groupId) ? tab.groupId : -1;
  return merged;
}

function createBackgroundHarness(options = {}) {
  const storage = {
    ...(options.storage || {})
  };

  const tabs = (Array.isArray(options.tabs) ? options.tabs : []).map(cloneTab);
  const groups = new Map(
    (Array.isArray(options.groups) ? options.groups : [])
      .filter((group) => Number.isInteger(group?.id))
      .map((group) => [
        group.id,
        {
          id: group.id,
          windowId: Number.isInteger(group.windowId) ? group.windowId : 1,
          title: String(group.title || ""),
          color: String(group.color || "grey"),
          collapsed: Boolean(group.collapsed)
        }
      ])
  );

  let nextTabId = tabs.reduce((max, tab) => Math.max(max, tab.id), 0) + 1;
  let nextGroupId = Array.from(groups.keys()).reduce((max, id) => Math.max(max, id), -1) + 1;
  const sentTabMessages = [];

  const runtime = {
    lastError: null,
    onInstalled: createEvent(),
    onMessage: createEvent()
  };

  function setRuntimeError(message) {
    runtime.lastError = message ? { message } : null;
  }

  function normalizeIndexes(windowId) {
    const inWindow = tabs
      .filter((tab) => tab.windowId === windowId)
      .slice()
      .sort((a, b) => a.index - b.index);

    inWindow.forEach((tab, index) => {
      tab.index = index;
    });
  }

  function findTab(tabId) {
    return tabs.find((tab) => tab.id === tabId) || null;
  }

  const chrome = {
    runtime,
    storage: {
      local: {
        get(keys, callback) {
          setRuntimeError(null);

          if (Array.isArray(keys)) {
            const result = {};
            for (const key of keys) {
              result[key] = storage[key];
            }
            callback(result);
            return;
          }

          if (typeof keys === "string") {
            callback({ [keys]: storage[keys] });
            return;
          }

          callback({ ...storage });
        },
        set(items, callback) {
          setRuntimeError(null);
          Object.assign(storage, items || {});
          callback();
        }
      }
    },
    tabs: {
      onCreated: createEvent(),
      onRemoved: createEvent(),
      onUpdated: createEvent(),
      onActivated: createEvent(),
      onMoved: createEvent(),
      onAttached: createEvent(),
      onDetached: createEvent(),
      query(queryInfo, callback) {
        setRuntimeError(null);
        const q = queryInfo || {};

        const result = tabs.filter((tab) => {
          if (Number.isInteger(q.windowId) && tab.windowId !== q.windowId) {
            return false;
          }

          if (q.active === true && !tab.active) {
            return false;
          }

          return true;
        });

        callback(result.map(cloneTab));
      },
      get(tabId, callback) {
        const tab = findTab(tabId);
        if (!tab) {
          setRuntimeError(`No tab with id: ${tabId}`);
          callback(undefined);
          return;
        }

        setRuntimeError(null);
        callback(cloneTab(tab));
      },
      update(tabId, updateProperties, callback) {
        const tab = findTab(tabId);
        if (!tab) {
          setRuntimeError(`No tab with id: ${tabId}`);
          callback(undefined);
          return;
        }

        const update = updateProperties || {};
        if (Object.prototype.hasOwnProperty.call(update, "active") && update.active) {
          for (const item of tabs) {
            if (item.windowId === tab.windowId) {
              item.active = false;
            }
          }
        }

        if (Object.prototype.hasOwnProperty.call(update, "muted")) {
          tab.mutedInfo = { muted: Boolean(update.muted) };
        }

        Object.assign(tab, update);
        setRuntimeError(null);
        callback(cloneTab(tab));
      },
      remove(tabIds, callback) {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        const removedWindowIds = new Set();

        for (const id of ids) {
          const index = tabs.findIndex((tab) => tab.id === id);
          if (index >= 0) {
            removedWindowIds.add(tabs[index].windowId);
            tabs.splice(index, 1);
          }
        }

        for (const windowId of removedWindowIds) {
          normalizeIndexes(windowId);
        }

        setRuntimeError(null);
        callback();
      },
      create(createProperties, callback) {
        const props = createProperties || {};
        const windowId = Number.isInteger(props.windowId) ? props.windowId : 1;
        const inWindow = tabs.filter((tab) => tab.windowId === windowId);

        if (props.active) {
          for (const tab of inWindow) {
            tab.active = false;
          }
        }

        const tab = cloneTab({
          id: nextTabId,
          windowId,
          index: inWindow.length,
          title: props.url || "New Tab",
          url: props.url || "about:blank",
          active: Boolean(props.active)
        });

        nextTabId += 1;
        tabs.push(tab);
        normalizeIndexes(windowId);

        setRuntimeError(null);
        callback(cloneTab(tab));
      },
      move(tabId, moveProperties, callback) {
        const tab = findTab(tabId);
        if (!tab) {
          setRuntimeError(`No tab with id: ${tabId}`);
          callback(undefined);
          return;
        }

        const windowTabs = tabs
          .filter((item) => item.windowId === tab.windowId && item.id !== tab.id)
          .slice()
          .sort((a, b) => a.index - b.index);

        const targetIndex = Number.isInteger(moveProperties?.index)
          ? moveProperties.index
          : windowTabs.length;
        const clampedIndex = Math.max(0, Math.min(windowTabs.length, targetIndex));

        windowTabs.splice(clampedIndex, 0, tab);
        windowTabs.forEach((item, index) => {
          item.index = index;
        });

        setRuntimeError(null);
        callback(cloneTab(tab));
      },
      duplicate(tabId, callback) {
        const source = findTab(tabId);
        if (!source) {
          setRuntimeError(`No tab with id: ${tabId}`);
          callback(undefined);
          return;
        }

        const inWindow = tabs
          .filter((tab) => tab.windowId === source.windowId)
          .slice()
          .sort((a, b) => a.index - b.index);

        for (const tab of inWindow) {
          if (tab.index > source.index) {
            tab.index += 1;
          }
        }

        const duplicated = cloneTab({
          ...source,
          id: nextTabId,
          index: source.index + 1,
          active: false
        });

        nextTabId += 1;
        tabs.push(duplicated);
        normalizeIndexes(source.windowId);

        setRuntimeError(null);
        callback(cloneTab(duplicated));
      },
      group(groupOptions, callback) {
        const options = groupOptions || {};
        const tabIds = Array.isArray(options.tabIds) ? options.tabIds : [];
        const groupId = Number.isInteger(options.groupId) ? options.groupId : nextGroupId++;

        for (const tabId of tabIds) {
          const tab = findTab(tabId);
          if (tab) {
            tab.groupId = groupId;
          }
        }

        if (!groups.has(groupId)) {
          const firstTab = tabIds.map((tabId) => findTab(tabId)).find(Boolean);
          groups.set(groupId, {
            id: groupId,
            windowId: firstTab?.windowId ?? 1,
            title: "",
            color: "grey",
            collapsed: false
          });
        }

        setRuntimeError(null);
        callback(groupId);
      },
      ungroup(tabIds, callback) {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        for (const tabId of ids) {
          const tab = findTab(tabId);
          if (tab) {
            tab.groupId = -1;
          }
        }

        setRuntimeError(null);
        callback();
      },
      sendMessage(tabId, message, callback) {
        sentTabMessages.push({ tabId, message });
        setRuntimeError(null);
        callback({ ok: true });
      }
    },
    tabGroups: {
      onCreated: createEvent(),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
      query(queryInfo, callback) {
        setRuntimeError(null);
        const windowId = queryInfo?.windowId;
        const values = Array.from(groups.values()).filter((group) => {
          if (!Number.isInteger(windowId)) {
            return true;
          }
          return group.windowId === windowId;
        });

        callback(values.map((group) => ({ ...group })));
      },
      update(groupId, updateProperties, callback) {
        const group = groups.get(groupId);
        if (!group) {
          setRuntimeError(`No group with id: ${groupId}`);
          callback(undefined);
          return;
        }

        Object.assign(group, updateProperties || {});
        setRuntimeError(null);
        callback({ ...group });
      }
    },
    action: {
      onClicked: createEvent()
    },
    commands: {
      onCommand: createEvent()
    },
    scripting: {
      executeScript(_details, callback) {
        setRuntimeError(null);
        callback([]);
      }
    }
  };

  function loadBackground() {
    const filePath = path.resolve(__dirname, "..", "background.js");
    const source = fs.readFileSync(filePath, "utf8");

    const context = vm.createContext({
      chrome,
      BraveSidebarMessages: messages,
      fetch: async () => {
        throw new Error("FETCH_NOT_IMPLEMENTED_IN_TEST");
      },
      btoa(value) {
        return Buffer.from(String(value), "binary").toString("base64");
      },
      setTimeout,
      clearTimeout,
      console,
      URL,
      Date,
      Map,
      Promise
    });

    context.globalThis = context;
    vm.runInContext(source, context, { filename: filePath });
  }

  async function sendRuntimeMessage(message, sender = { tab: { id: 1, windowId: 1 } }) {
    const listeners = runtime.onMessage.listeners;
    assert.ok(listeners.length > 0, "Expected background onMessage listener to be registered");

    return new Promise((resolve, reject) => {
      let settled = false;

      const sendResponse = (response) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(response);
      };

      for (const listener of listeners) {
        const keepAlive = listener(message, sender, sendResponse);
        if (keepAlive !== true && !settled) {
          settled = true;
          resolve(undefined);
        }
      }

      setTimeout(() => {
        if (!settled) {
          reject(new Error(`No response for message: ${message?.type || "unknown"}`));
        }
      }, 400);
    });
  }

  function getTabs() {
    return tabs.map(cloneTab);
  }

  function getGroups() {
    return Array.from(groups.values()).map((group) => ({ ...group }));
  }

  return {
    chrome,
    storage,
    sentTabMessages,
    loadBackground,
    sendRuntimeMessage,
    getTabs,
    getGroups
  };
}

function extractMessageTypes(source, pattern) {
  const types = new Set();
  let match = pattern.exec(source);
  while (match) {
    if (match[1]) {
      types.add(match[1]);
    }
    match = pattern.exec(source);
  }
  return types;
}

test("content outbound sidebar messages are handled by background contract", () => {
  const contentPath = path.resolve(__dirname, "..", "content.js");
  const backgroundPath = path.resolve(__dirname, "..", "background.js");

  const contentSource = fs.readFileSync(contentPath, "utf8");
  const backgroundSource = fs.readFileSync(backgroundPath, "utf8");

  const contentOutboundKeys = extractMessageTypes(contentSource, /type:\s*MESSAGE_TYPES\.([A-Z_]+)/g);
  const backgroundHandledKeys = extractMessageTypes(
    backgroundSource,
    /message\.type\s*===\s*MESSAGE_TYPES\.([A-Z_]+)/g
  );

  const knownKeys = new Set(Object.keys(MESSAGE_TYPES));
  const unknownContentKeys = Array.from(contentOutboundKeys)
    .filter((key) => !knownKeys.has(key))
    .sort();
  const unknownBackgroundKeys = Array.from(backgroundHandledKeys)
    .filter((key) => !knownKeys.has(key))
    .sort();

  const missingHandledKeys = Array.from(contentOutboundKeys)
    .filter((key) => !backgroundHandledKeys.has(key))
    .sort();

  assert.deepEqual(unknownContentKeys, []);
  assert.deepEqual(unknownBackgroundKeys, []);
  assert.deepEqual(missingHandledKeys, []);
});

test("background rejects invalid message payloads via shared contract", async () => {
  const harness = createBackgroundHarness({
    tabs: [
      {
        id: 1,
        windowId: 1,
        index: 0,
        title: "A",
        url: "https://a.example.com",
        active: true
      }
    ]
  });

  harness.loadBackground();

  const response = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.CREATE_TAB,
      payload: {
        windowId: "invalid-window-id",
        url: "https://new.example.com"
      }
    },
    { tab: { id: 1, windowId: 1 } }
  );

  assert.equal(response.ok, false);
  assert.equal(response.error, "INVALID_WINDOW_ID");
});

test("background serves getState and setWindowOpen flows used by content", async () => {
  const harness = createBackgroundHarness({
    tabs: [
      {
        id: 10,
        windowId: 7,
        index: 0,
        title: "Docs",
        url: "https://docs.example.com",
        favIconUrl: "data:image/png;base64,AA==",
        active: true
      },
      {
        id: 11,
        windowId: 7,
        index: 1,
        title: "Issues",
        url: "https://issues.example.com",
        favIconUrl: "data:image/png;base64,AA=="
      }
    ],
    groups: [{ id: 4, windowId: 7, title: "Sprint", color: "blue", collapsed: false }]
  });

  harness.loadBackground();

  const stateResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.GET_STATE,
      payload: { windowId: 7 }
    },
    { tab: { id: 10, windowId: 7 } }
  );

  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.snapshot.windowId, 7);
  assert.equal(stateResponse.snapshot.tabs.length, 2);
  assert.equal(stateResponse.snapshot.groups.length, 1);

  const openResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.SET_WINDOW_OPEN,
      payload: { windowId: 7, open: true }
    },
    { tab: { id: 10, windowId: 7 } }
  );

  assert.equal(openResponse.ok, true);
  assert.equal(harness.storage.bts_window_state_7.open, true);

  const openMessages = harness.sentTabMessages.filter(
    (entry) => entry.message?.type === MESSAGE_TYPES.SET_OPEN
  );

  assert.equal(openMessages.length, 2);
  assert.equal(openMessages.every((entry) => entry.message.payload.open === true), true);
});

test("background handles tab and group mutation messages from content", async () => {
  const harness = createBackgroundHarness({
    tabs: [
      {
        id: 21,
        windowId: 9,
        index: 0,
        title: "A",
        url: "https://a.example.com",
        favIconUrl: "data:image/png;base64,AA==",
        active: true
      },
      {
        id: 22,
        windowId: 9,
        index: 1,
        title: "B",
        url: "https://b.example.com",
        favIconUrl: "data:image/png;base64,AA==",
        active: false
      }
    ]
  });

  harness.loadBackground();

  const createResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.CREATE_TAB,
      payload: {
        windowId: 9,
        url: "  https://new.example.com/path  "
      }
    },
    { tab: { id: 21, windowId: 9 } }
  );

  assert.equal(createResponse.ok, true);
  assert.equal(harness.getTabs().some((tab) => tab.url === "https://new.example.com/path"), true);

  const targetTab = harness.getTabs().find((tab) => tab.url === "https://new.example.com/path");
  assert.ok(targetTab);

  const activateResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.ACTIVATE_TAB,
      payload: { tabId: 22 }
    },
    { tab: { id: 21, windowId: 9 } }
  );

  assert.equal(activateResponse.ok, true);
  const tabsAfterActivate = harness.getTabs();
  assert.equal(tabsAfterActivate.find((tab) => tab.id === 22).active, true);

  const moveResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.MOVE_TAB,
      payload: { tabId: targetTab.id, index: 0 }
    },
    { tab: { id: 21, windowId: 9 } }
  );

  assert.equal(moveResponse.ok, true);
  const firstTab = harness
    .getTabs()
    .filter((tab) => tab.windowId === 9)
    .sort((a, b) => a.index - b.index)[0];
  assert.equal(firstTab.id, targetTab.id);

  const createGroupResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.SET_TAB_GROUP,
      payload: {
        tabId: targetTab.id,
        createNew: true,
        title: "Focus"
      }
    },
    { tab: { id: 21, windowId: 9 } }
  );

  assert.equal(createGroupResponse.ok, true);

  const groupedTab = harness.getTabs().find((tab) => tab.id === targetTab.id);
  assert.ok(Number.isInteger(groupedTab.groupId) && groupedTab.groupId >= 0);
  const groups = harness.getGroups();
  assert.equal(groups.some((group) => group.id === groupedTab.groupId && group.title === "Focus"), true);

  const ungroupResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.SET_TAB_GROUP,
      payload: {
        tabId: targetTab.id,
        groupId: -1
      }
    },
    { tab: { id: 21, windowId: 9 } }
  );

  assert.equal(ungroupResponse.ok, true);
  assert.equal(harness.getTabs().find((tab) => tab.id === targetTab.id).groupId, -1);

  const closeResponse = await harness.sendRuntimeMessage(
    {
      type: MESSAGE_TYPES.CLOSE_TAB,
      payload: { tabId: targetTab.id }
    },
    { tab: { id: 21, windowId: 9 } }
  );

  assert.equal(closeResponse.ok, true);
  assert.equal(harness.getTabs().some((tab) => tab.id === targetTab.id), false);
});
