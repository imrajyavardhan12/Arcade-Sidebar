const test = require("node:test");
const assert = require("node:assert/strict");

const contextMenuModel = require("../sidebar/context-menu-model.js");

function actionIds(items) {
  return items.filter((item) => item.kind === "action").map((item) => item.id);
}

test("buildTabContextMenuModel returns favorite/pin actions and group targets for storable tabs", () => {
  const items = contextMenuModel.buildTabContextMenuModel({
    tab: {
      id: 1,
      pinned: false,
      muted: false,
      groupId: -1
    },
    groups: [
      { id: 2, title: "Beta" },
      { id: 1, title: "Alpha" }
    ],
    canStoreUrl: true,
    isFavorite: false,
    favoritesCount: 3,
    maxFavorites: 12,
    isPinnedInActiveSpace: false
  });

  const ids = actionIds(items);
  assert.equal(ids.includes("add-to-favorites"), true);
  assert.equal(ids.includes("pin-to-sidebar"), true);
  assert.equal(ids.includes("toggle-tab-pin"), true);
  assert.equal(ids.includes("toggle-tab-mute"), true);
  assert.equal(ids.includes("duplicate-tab"), true);
  assert.equal(ids.includes("close-other-tabs"), true);
  assert.equal(ids.includes("close-tab"), true);
  assert.equal(ids.includes("move-to-new-group"), true);
  assert.equal(ids.includes("remove-from-group"), false);

  const moveToGroupItems = items.filter((item) => item.id === "move-to-group");
  assert.equal(moveToGroupItems.length, 2);
  assert.deepEqual(
    moveToGroupItems.map((item) => item.groupId),
    [1, 2]
  );
});

test("buildTabContextMenuModel returns unavailable + group-removal actions for non-storable grouped tab", () => {
  const items = contextMenuModel.buildTabContextMenuModel({
    tab: {
      id: 1,
      pinned: true,
      muted: true,
      groupId: 7
    },
    groups: [{ id: 7, title: "Current" }, { id: 8, title: "Other" }],
    canStoreUrl: false,
    isFavorite: false,
    favoritesCount: 12,
    maxFavorites: 12,
    isPinnedInActiveSpace: true
  });

  const ids = actionIds(items);
  assert.equal(ids.includes("pin-unavailable"), true);
  assert.equal(ids.includes("favorites-unavailable"), true);
  assert.equal(ids.includes("add-to-favorites"), false);
  assert.equal(ids.includes("remove-from-favorites"), false);
  assert.equal(ids.includes("remove-from-group"), true);

  const pinToggle = items.find((item) => item.id === "toggle-tab-pin");
  assert.equal(pinToggle.label, "Unpin tab");

  const muteToggle = items.find((item) => item.id === "toggle-tab-mute");
  assert.equal(muteToggle.label, "Unmute tab");

  const moveToGroupItems = items.filter((item) => item.id === "move-to-group");
  assert.equal(moveToGroupItems.length, 1);
  assert.equal(moveToGroupItems[0].groupId, 8);
});

test("buildTabContextMenuModel returns favorites-full disabled item at capacity", () => {
  const items = contextMenuModel.buildTabContextMenuModel({
    tab: { id: 1, pinned: false, muted: false, groupId: -1 },
    groups: [],
    canStoreUrl: true,
    isFavorite: false,
    favoritesCount: 12,
    maxFavorites: 12,
    isPinnedInActiveSpace: false
  });

  const favoritesFull = items.find((item) => item.id === "favorites-full");
  assert.ok(favoritesFull);
  assert.equal(favoritesFull.disabled, true);
  assert.equal(favoritesFull.secondary, true);
});
