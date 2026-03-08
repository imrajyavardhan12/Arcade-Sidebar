const test = require("node:test");
const assert = require("node:assert/strict");

const sidebarData = require("../sidebar/sidebar-data.js");

test("createDefaultSidebarData builds initial state from provided default space", () => {
  const state = sidebarData.createDefaultSidebarData({
    id: "space-work",
    name: "Work",
    icon: "W"
  });

  assert.deepEqual(state, {
    spaces: [{ id: "space-work", name: "Work", icon: "W" }],
    activeSpaceId: "space-work",
    favorites: [],
    pinnedBySpace: {
      "space-work": []
    }
  });
});

test("sanitizeSavedItem keeps only http(s) URLs", () => {
  const valid = sidebarData.sanitizeSavedItem({
    id: "item-1",
    title: "Example",
    url: "https://example.com/path#hash",
    favIconUrl: "icon.png"
  });

  assert.equal(valid.id, "item-1");
  assert.equal(valid.title, "Example");
  assert.equal(valid.url, "https://example.com/path");
  assert.equal(valid.favIconUrl, "icon.png");

  const invalid = sidebarData.sanitizeSavedItem({
    id: "item-2",
    title: "Settings",
    url: "chrome://settings"
  });

  assert.equal(invalid, null);
});

test("sanitizePinnedFolderNode deduplicates children by normalized URL", () => {
  const folder = sidebarData.sanitizePinnedFolderNode({
    id: "folder-1",
    title: "Folder",
    children: [
      { id: "a", title: "A", url: "https://dup.com/path#one" },
      { id: "b", title: "B", url: "https://dup.com/path#two" },
      { id: "c", title: "C", url: "https://unique.com" }
    ]
  });

  assert.equal(folder.children.length, 2);
  assert.equal(folder.children[0].url, "https://dup.com/path");
  assert.equal(folder.children[1].url, "https://unique.com/");
});

test("sanitizeSidebarData enforces favorites limit, dedupes entries, and validates spaces", () => {
  const state = sidebarData.sanitizeSidebarData(
    {
      spaces: [
        { id: "space-1", name: "One", icon: "1" },
        { id: "space-2", name: "Two", icon: "2" }
      ],
      activeSpaceId: "space-2",
      favorites: [
        { id: "fav-1", title: "A", url: "https://a.com#hash" },
        { id: "fav-2", title: "A duplicate", url: "https://a.com#new" },
        { id: "fav-3", title: "B", url: "https://b.com" },
        { id: "fav-4", title: "C", url: "https://c.com" }
      ],
      pinnedBySpace: {
        "space-2": [
          { type: "link", id: "l1", title: "L1", url: "https://x.com#one" },
          { type: "link", id: "l2", title: "L2", url: "https://x.com#two" },
          {
            type: "folder",
            id: "folder-x",
            title: "Folder",
            children: [
              { id: "c1", title: "Child 1", url: "https://y.com#1" },
              { id: "c2", title: "Child 2", url: "https://y.com#2" }
            ]
          }
        ]
      }
    },
    {
      defaultSpace: { id: "space-default", name: "Default", icon: "D" },
      maxFavorites: 2
    }
  );

  assert.equal(state.activeSpaceId, "space-2");
  assert.equal(state.favorites.length, 2);
  assert.deepEqual(
    state.favorites.map((item) => item.url),
    ["https://a.com/", "https://b.com/"]
  );

  assert.equal(state.pinnedBySpace["space-2"].length, 2);
  const topLink = state.pinnedBySpace["space-2"][0];
  assert.equal(topLink.url, "https://x.com/");
  const folder = state.pinnedBySpace["space-2"][1];
  assert.equal(folder.type, "folder");
  assert.equal(folder.children.length, 1);
  assert.equal(folder.children[0].url, "https://y.com/");
});

test("createSavedItemFromTab rejects non-http tabs and creates item for http tabs", () => {
  const blocked = sidebarData.createSavedItemFromTab({
    title: "Settings",
    url: "chrome://extensions"
  });
  assert.equal(blocked, null);

  const saved = sidebarData.createSavedItemFromTab({
    title: "Example",
    url: "https://example.com#hash",
    favIconUrl: "icon.png"
  });

  assert.equal(saved.title, "Example");
  assert.equal(saved.url, "https://example.com/");
  assert.equal(saved.favIconUrl, "icon.png");
  assert.equal(typeof saved.id, "string");
});
