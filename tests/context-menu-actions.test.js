const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

globalThis.BraveSidebarContextMenuActions = undefined;
require("../sidebar/context-menu-actions.js");
const { executeTabAction } = globalThis.BraveSidebarContextMenuActions;

const MESSAGE_TYPES = {
  UPDATE_TAB: "sidebar:updateTab",
  DUPLICATE_TAB: "sidebar:duplicateTab",
  CLOSE_TAB: "sidebar:closeTab",
  CLOSE_OTHER_TABS: "sidebar:closeOtherTabs",
  SET_TAB_GROUP: "sidebar:setTabGroup"
};

function createDeps(overrides = {}) {
  const calls = [];
  return {
    calls,
    sendMessage: overrides.sendMessage || (async (msg) => { calls.push({ fn: "sendMessage", msg }); }),
    resolveTabForStorage: overrides.resolveTabForStorage || (async (tab) => tab),
    addTabToFavorites: overrides.addTabToFavorites || (async (tab) => { calls.push({ fn: "addTabToFavorites", tab }); }),
    removeFavoriteByUrl: overrides.removeFavoriteByUrl || (async (url) => { calls.push({ fn: "removeFavoriteByUrl", url }); }),
    pinTabInActiveSpace: overrides.pinTabInActiveSpace || (async (tab) => { calls.push({ fn: "pinTabInActiveSpace", tab }); }),
    unpinUrlInActiveSpace: overrides.unpinUrlInActiveSpace || (async (url) => { calls.push({ fn: "unpinUrlInActiveSpace", url }); }),
    MESSAGE_TYPES
  };
}

describe("executeTabAction", () => {
  it("remove-from-favorites calls removeFavoriteByUrl and returns shouldRender", async () => {
    const deps = createDeps();
    const tab = { id: 1, url: "https://a.com" };
    const result = await executeTabAction("remove-from-favorites", {
      ...deps, tab, tabUrl: "https://a.com"
    });
    assert.equal(result.shouldRender, true);
    assert.equal(deps.calls[0].fn, "removeFavoriteByUrl");
    assert.equal(deps.calls[0].url, "https://a.com");
  });

  it("add-to-favorites resolves tab and adds", async () => {
    const deps = createDeps();
    const tab = { id: 1, url: "https://a.com" };
    const result = await executeTabAction("add-to-favorites", {
      ...deps, tab, tabUrl: "https://a.com"
    });
    assert.equal(result.shouldRender, true);
    assert.equal(deps.calls[0].fn, "addTabToFavorites");
  });

  it("pin-to-sidebar resolves tab and pins", async () => {
    const deps = createDeps();
    const tab = { id: 1, url: "https://a.com" };
    const result = await executeTabAction("pin-to-sidebar", {
      ...deps, tab, tabUrl: "https://a.com"
    });
    assert.equal(result.shouldRender, true);
    assert.equal(deps.calls[0].fn, "pinTabInActiveSpace");
  });

  it("unpin-from-sidebar calls unpinUrlInActiveSpace", async () => {
    const deps = createDeps();
    const tab = { id: 1, url: "https://a.com" };
    const result = await executeTabAction("unpin-from-sidebar", {
      ...deps, tab, tabUrl: "https://a.com"
    });
    assert.equal(result.shouldRender, true);
    assert.equal(deps.calls[0].fn, "unpinUrlInActiveSpace");
  });

  it("toggle-tab-pin sends UPDATE_TAB message", async () => {
    const deps = createDeps();
    const tab = { id: 5, pinned: false };
    const result = await executeTabAction("toggle-tab-pin", {
      ...deps, tab, tabUrl: ""
    });
    assert.equal(result.shouldRender, false);
    assert.deepEqual(deps.calls[0].msg, {
      type: MESSAGE_TYPES.UPDATE_TAB,
      payload: { tabId: 5, update: { pinned: true } }
    });
  });

  it("toggle-tab-mute sends UPDATE_TAB with muted", async () => {
    const deps = createDeps();
    const tab = { id: 3, muted: true };
    const result = await executeTabAction("toggle-tab-mute", {
      ...deps, tab, tabUrl: ""
    });
    assert.equal(result.shouldRender, false);
    assert.deepEqual(deps.calls[0].msg.payload, { tabId: 3, update: { muted: false } });
  });

  it("close-tab sends CLOSE_TAB", async () => {
    const deps = createDeps();
    const tab = { id: 7 };
    const result = await executeTabAction("close-tab", { ...deps, tab, tabUrl: "" });
    assert.equal(result.shouldRender, false);
    assert.equal(deps.calls[0].msg.type, MESSAGE_TYPES.CLOSE_TAB);
  });

  it("move-to-new-group sends SET_TAB_GROUP with createNew", async () => {
    const deps = createDeps();
    const tab = { id: 2 };
    const result = await executeTabAction("move-to-new-group", { ...deps, tab, tabUrl: "" });
    assert.equal(result.shouldRender, false);
    assert.equal(deps.calls[0].msg.payload.createNew, true);
  });

  it("move-to-group sends SET_TAB_GROUP with groupId", async () => {
    const deps = createDeps();
    const tab = { id: 2 };
    const result = await executeTabAction("move-to-group", { ...deps, tab, tabUrl: "", groupId: 10 });
    assert.equal(result.shouldRender, false);
    assert.equal(deps.calls[0].msg.payload.groupId, 10);
  });

  it("unknown action returns shouldRender false", async () => {
    const deps = createDeps();
    const tab = { id: 1 };
    const result = await executeTabAction("unknown-action", { ...deps, tab, tabUrl: "" });
    assert.equal(result.shouldRender, false);
    assert.equal(deps.calls.length, 0);
  });
});
