const test = require("node:test");
const assert = require("node:assert/strict");

const dragState = require("../sidebar/drag-state.js");
const sidebarData = require("../sidebar/sidebar-data.js");

function folder(id, title = id, children = []) {
  return {
    type: "folder",
    id,
    title,
    collapsed: false,
    children
  };
}

function tab(id, url, title = id) {
  return {
    id,
    title,
    url,
    favIconUrl: `${id}.png`
  };
}

test("critical drag/drop roundtrip: today tab → pinned → folder → favorites → pinned → today", () => {
  const saved = sidebarData.createSavedItemFromTab(tab("tab-1", "https://alpha.example.com/path#hash"));
  assert.ok(saved);

  let nodes = [
    folder("folder-1", "Focus"),
    sidebarData.createPinnedLinkNodeFromSavedItem(saved)
  ];
  let favorites = [];

  const pinnedTopLevel = nodes.find((node) => node.type === "link");
  assert.ok(pinnedTopLevel);

  const toFolder = dragState.movePinnedLinkToFolder({
    nodes,
    linkId: pinnedTopLevel.id,
    targetFolderId: "folder-1"
  });

  assert.equal(toFolder.moved, true);
  nodes = toFolder.nodes;
  assert.equal(nodes[0].children.length, 1);
  assert.equal(nodes.some((node) => node.type === "link"), false);

  const toTopLevel = dragState.movePinnedLinkToTopLevel({
    nodes,
    linkId: nodes[0].children[0].id,
    fromFolderId: "folder-1"
  });

  assert.equal(toTopLevel.moved, true);
  nodes = toTopLevel.nodes;
  assert.equal(nodes[0].children.length, 0);
  assert.equal(nodes.some((node) => node.type === "link"), true);

  const movedLinkId = nodes.find((node) => node.type === "link").id;
  const toFavorites = dragState.movePinnedLinkToFavorites({
    nodes,
    favorites,
    linkId: movedLinkId,
    maxFavorites: 12,
    createFavoriteId: () => "fav-1"
  });

  assert.equal(toFavorites.moved, true);
  nodes = toFavorites.nodes;
  favorites = toFavorites.favorites;
  assert.equal(favorites.length, 1);
  assert.equal(nodes.some((node) => node.type === "link"), false);

  const backToPinned = dragState.moveFavoriteToPinnedTopLevel({
    nodes,
    favorites,
    favoriteId: "fav-1",
    createPinnedId: () => "plink-return"
  });

  assert.equal(backToPinned.moved, true);
  nodes = backToPinned.nodes;
  favorites = backToPinned.favorites;
  assert.equal(favorites.length, 0);
  assert.equal(nodes.some((node) => node.type === "link" && node.id === "plink-return"), true);

  const toToday = dragState.movePinnedLinkToToday({
    nodes,
    linkId: "plink-return"
  });

  assert.equal(toToday.moved, true);
  nodes = toToday.nodes;
  assert.equal(nodes.some((node) => node.type === "link"), false);
});

test("critical drag/drop behavior: dedupe in folder and today filtering across pinned/favorites", () => {
  const existingPinned = sidebarData.createPinnedLinkNodeFromSavedItem(
    sidebarData.createSavedItemFromTab(tab("tab-existing", "https://docs.example.com"))
  );

  let nodes = [folder("folder-1", "Docs", [existingPinned])];
  let favorites = [
    {
      id: "fav-1",
      title: "Docs Updated",
      url: "https://docs.example.com",
      favIconUrl: "updated.png"
    },
    {
      id: "fav-2",
      title: "Keep",
      url: "https://keep.example.com",
      favIconUrl: "keep.png"
    }
  ];

  const favoriteToFolder = dragState.moveFavoriteToFolder({
    nodes,
    favorites,
    favoriteId: "fav-1",
    targetFolderId: "folder-1",
    createPinnedId: () => "unused"
  });

  assert.equal(favoriteToFolder.moved, true);
  nodes = favoriteToFolder.nodes;
  favorites = favoriteToFolder.favorites;

  const folderNode = nodes[0];
  assert.equal(folderNode.children.length, 1);
  assert.equal(folderNode.children[0].title, "Docs Updated");
  assert.equal(favorites.some((item) => item.id === "fav-1"), false);

  const tabsForToday = [
    { id: 1, url: "https://docs.example.com" },
    { id: 2, url: "https://keep.example.com" },
    { id: 3, url: "https://today.example.com" },
    { id: 4, url: "chrome://extensions" }
  ];

  const beforeFavoriteToToday = dragState.filterTodayTabs({
    tabs: tabsForToday,
    pinnedNodes: nodes,
    favorites
  });

  assert.deepEqual(
    beforeFavoriteToToday.map((item) => item.id),
    [3, 4]
  );

  const favoriteToToday = dragState.moveFavoriteToToday({
    favorites,
    favoriteId: "fav-2"
  });

  assert.equal(favoriteToToday.moved, true);
  favorites = favoriteToToday.favorites;

  const afterFavoriteToToday = dragState.filterTodayTabs({
    tabs: tabsForToday,
    pinnedNodes: nodes,
    favorites
  });

  assert.deepEqual(
    afterFavoriteToToday.map((item) => item.id),
    [2, 3, 4]
  );
});
