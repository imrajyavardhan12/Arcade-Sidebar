const test = require("node:test");
const assert = require("node:assert/strict");

const dragState = require("../sidebar/drag-state.js");
const dragDropController = require("../sidebar/drag-drop-controller.js");

function link(id, url) {
  return {
    type: "link",
    id,
    title: id,
    url,
    favIconUrl: `${id}.png`
  };
}

function folder(id, children = []) {
  return {
    type: "folder",
    id,
    title: id,
    collapsed: false,
    children
  };
}

test("movePinnedLinkToFolder clears pinned drag context on duplicate and success", () => {
  const controller = dragDropController.createDragDropController({
    dragStateModule: dragState,
    maxFavorites: 12
  });

  controller.beginPinnedDrag("l1", null);
  const duplicate = controller.movePinnedLinkToFolder({
    nodes: [link("l1", "https://a.com"), folder("f1", [link("existing", "https://a.com")])],
    targetFolderId: "f1"
  });

  assert.equal(duplicate.moved, false);
  assert.equal(duplicate.reason, "duplicateInTarget");
  assert.equal(controller.hasPinnedDrag(), false);

  controller.beginPinnedDrag("l2", null);
  const moved = controller.movePinnedLinkToFolder({
    nodes: [link("l2", "https://b.com"), folder("f1", [])],
    targetFolderId: "f1"
  });

  assert.equal(moved.moved, true);
  assert.equal(controller.hasPinnedDrag(), false);
});

test("moveFavoriteToPinnedTopLevel clears favorite drag context on missing and success", () => {
  const controller = dragDropController.createDragDropController({
    dragStateModule: dragState,
    maxFavorites: 12
  });

  controller.beginFavoriteDrag("fav-missing");
  const missing = controller.moveFavoriteToPinnedTopLevel({
    nodes: [],
    favorites: []
  });

  assert.equal(missing.moved, false);
  assert.equal(missing.reason, "noFavorite");
  assert.equal(controller.hasFavoriteDrag(), false);

  controller.beginFavoriteDrag("fav-1");
  const moved = controller.moveFavoriteToPinnedTopLevel({
    nodes: [],
    favorites: [
      {
        id: "fav-1",
        title: "Fav",
        url: "https://fav.com",
        favIconUrl: "fav.png"
      }
    ],
    createPinnedId: () => "plink-1"
  });

  assert.equal(moved.moved, true);
  assert.equal(controller.hasFavoriteDrag(), false);
});

test("movePinnedLinkToFavorites clears pinned drag even when favorites are full", () => {
  const controller = dragDropController.createDragDropController({
    dragStateModule: dragState,
    maxFavorites: 2
  });

  controller.beginPinnedDrag("l1", null);
  const transition = controller.movePinnedLinkToFavorites({
    nodes: [link("l1", "https://a.com")],
    favorites: [
      { id: "f1", title: "A", url: "https://x.com", favIconUrl: "x.png" },
      { id: "f2", title: "B", url: "https://y.com", favIconUrl: "y.png" }
    ],
    createFavoriteId: () => "unused"
  });

  assert.equal(transition.moved, false);
  assert.equal(transition.reason, "favoritesFull");
  assert.equal(controller.hasPinnedDrag(), false);
});

test("tab drag tracking supports consume and reset", () => {
  const controller = dragDropController.createDragDropController({
    dragStateModule: dragState,
    maxFavorites: 12
  });

  controller.beginTabDrag(42);
  controller.beginPinnedDrag("l1", null);
  controller.beginFavoriteDrag("fav-1");

  assert.equal(controller.hasTabDrag(), true);
  assert.equal(controller.getDraggingTabId(), 42);
  assert.equal(controller.consumeDraggingTabId(), 42);
  assert.equal(controller.hasTabDrag(), false);

  controller.resetAll();
  assert.equal(controller.hasPinnedDrag(), false);
  assert.equal(controller.hasFavoriteDrag(), false);
  assert.equal(controller.hasTabDrag(), false);
});
