const test = require("node:test");
const assert = require("node:assert/strict");

const dragState = require("../sidebar/drag-state.js");

function link(id, url, title = id) {
  return {
    type: "link",
    id,
    title,
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

function favorite(id, url, title = id) {
  return {
    id,
    title,
    url,
    favIconUrl: `${id}.png`
  };
}

test("movePinnedLinkToFolder moves top-level pinned link into target folder", () => {
  const initial = [link("l1", "https://a.com/page"), folder("f1", [])];

  const result = dragState.movePinnedLinkToFolder({
    nodes: initial,
    linkId: "l1",
    fromFolderId: null,
    targetFolderId: "f1"
  });

  assert.equal(result.moved, true);
  assert.equal(result.nodes.some((node) => node.type === "link" && node.id === "l1"), false);
  const targetFolder = result.nodes.find((node) => node.type === "folder" && node.id === "f1");
  assert.equal(targetFolder.children.length, 1);
  assert.equal(targetFolder.children[0].id, "l1");
  assert.equal(initial[1].children.length, 0);
});

test("movePinnedLinkToFolder blocks duplicate URL in target folder", () => {
  const initial = [
    link("l1", "https://a.com/page"),
    folder("f1", [link("existing", "https://a.com/page")])
  ];

  const result = dragState.movePinnedLinkToFolder({
    nodes: initial,
    linkId: "l1",
    fromFolderId: null,
    targetFolderId: "f1"
  });

  assert.equal(result.moved, false);
  assert.equal(result.reason, "duplicateInTarget");
  assert.deepEqual(result.nodes, initial);
});

test("movePinnedLinkToTopLevel moves link out of folder and dedupes top-level by URL", () => {
  const fromFolder = [folder("f1", [link("l1", "https://a.com/page")]), link("top", "https://b.com")];
  const moved = dragState.movePinnedLinkToTopLevel({
    nodes: fromFolder,
    linkId: "l1",
    fromFolderId: "f1"
  });

  assert.equal(moved.moved, true);
  assert.equal(moved.nodes[0].children.length, 0);
  assert.equal(moved.nodes.some((node) => node.type === "link" && node.id === "l1"), true);

  const duplicate = dragState.movePinnedLinkToTopLevel({
    nodes: [folder("f1", [link("child", "https://dup.com")]), link("existing", "https://dup.com")],
    linkId: "child",
    fromFolderId: "f1"
  });

  assert.equal(duplicate.moved, true);
  assert.equal(duplicate.addedToTopLevel, false);
  assert.equal(duplicate.nodes[0].children.length, 0);
  assert.equal(
    duplicate.nodes.filter((node) => node.type === "link" && node.url === "https://dup.com").length,
    1
  );
});

test("moveFavoriteToPinnedTopLevel updates existing pinned URL and removes favorite", () => {
  const result = dragState.moveFavoriteToPinnedTopLevel({
    nodes: [folder("f1", [link("child", "https://a.com", "Old title")])],
    favorites: [favorite("fav1", "https://a.com", "New title")],
    favoriteId: "fav1",
    createPinnedId: () => "new-link-id"
  });

  assert.equal(result.moved, true);
  assert.equal(result.favorites.length, 0);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].children.length, 1);
  assert.equal(result.nodes[0].children[0].title, "New title");
});

test("moveFavoriteToFolder moves favorite into target folder and removes it from favorites", () => {
  const result = dragState.moveFavoriteToFolder({
    nodes: [folder("f1", [])],
    favorites: [favorite("fav1", "https://fav.com", "Fav link")],
    favoriteId: "fav1",
    targetFolderId: "f1",
    createPinnedId: () => "plink-fav1"
  });

  assert.equal(result.moved, true);
  assert.equal(result.favorites.length, 0);
  const targetFolder = result.nodes.find((node) => node.type === "folder" && node.id === "f1");
  assert.equal(targetFolder.children.length, 1);
  assert.equal(targetFolder.children[0].id, "plink-fav1");
  assert.equal(targetFolder.children[0].url, "https://fav.com");
});

test("movePinnedLinkToFavorites supports success, favorites-full block, and duplicate-update", () => {
  const success = dragState.movePinnedLinkToFavorites({
    nodes: [folder("f1", [link("l1", "https://a.com", "A")])],
    favorites: [],
    linkId: "l1",
    maxFavorites: 12,
    createFavoriteId: () => "fav-created"
  });

  assert.equal(success.moved, true);
  assert.equal(success.favorites.length, 1);
  assert.equal(success.favorites[0].id, "fav-created");
  assert.equal(success.nodes[0].children.length, 0);

  const fullFavorites = Array.from({ length: 12 }, (_item, index) =>
    favorite(`fav-${index}`, `https://site-${index}.com`)
  );
  const blocked = dragState.movePinnedLinkToFavorites({
    nodes: [folder("f1", [link("l2", "https://new.com", "New")])],
    favorites: fullFavorites,
    linkId: "l2",
    maxFavorites: 12,
    createFavoriteId: () => "should-not-be-used"
  });

  assert.equal(blocked.moved, false);
  assert.equal(blocked.reason, "favoritesFull");
  assert.equal(blocked.nodes[0].children.length, 1);
  assert.equal(blocked.favorites.length, 12);

  const deduped = dragState.movePinnedLinkToFavorites({
    nodes: [folder("f1", [link("l3", "https://dup.com", "Updated title")])],
    favorites: [favorite("fav-existing", "https://dup.com", "Old title")],
    linkId: "l3",
    maxFavorites: 12,
    createFavoriteId: () => "unused"
  });

  assert.equal(deduped.moved, true);
  assert.equal(deduped.favorites.length, 1);
  assert.equal(deduped.favorites[0].title, "Updated title");
  assert.equal(deduped.nodes[0].children.length, 0);
});

test("filterTodayTabs excludes HTTP tabs that are pinned or favorited and keeps non-http tabs", () => {
  const tabs = [
    { id: 1, url: "https://pinned.com" },
    { id: 2, url: "https://favorite.com" },
    { id: 3, url: "https://today.com" },
    { id: 4, url: "chrome://extensions" }
  ];

  const filtered = dragState.filterTodayTabs({
    tabs,
    pinnedNodes: [link("p1", "https://pinned.com")],
    favorites: [favorite("f1", "https://favorite.com")]
  });

  assert.deepEqual(
    filtered.map((tab) => tab.id),
    [3, 4]
  );
});

test("movePinnedLinkToToday and moveFavoriteToToday remove items by id", () => {
  const movedToToday = dragState.movePinnedLinkToToday({
    nodes: [link("l1", "https://a.com"), folder("f1", [link("l2", "https://b.com")])],
    linkId: "l2"
  });

  assert.equal(movedToToday.moved, true);
  assert.equal(movedToToday.nodes[1].children.length, 0);

  const favoriteToToday = dragState.moveFavoriteToToday({
    favorites: [favorite("f1", "https://a.com"), favorite("f2", "https://b.com")],
    favoriteId: "f1"
  });

  assert.equal(favoriteToToday.moved, true);
  assert.deepEqual(
    favoriteToToday.favorites.map((item) => item.id),
    ["f2"]
  );
});
