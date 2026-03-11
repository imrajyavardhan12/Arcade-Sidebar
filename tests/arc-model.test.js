const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

globalThis.BraveSidebarArcModel = undefined;
require("../sidebar/arc-model.js");
const arcModel = globalThis.BraveSidebarArcModel;

const DEFAULT_SPACE = { id: "space-1", name: "Personal", icon: "🪼" };

function normalize(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href;
  } catch {
    return String(url || "");
  }
}

function makeSidebarData(overrides = {}) {
  return {
    spaces: [DEFAULT_SPACE],
    activeSpaceId: DEFAULT_SPACE.id,
    favorites: overrides.favorites || [],
    pinnedBySpace: overrides.pinnedBySpace || { [DEFAULT_SPACE.id]: overrides.pinned || [] }
  };
}

describe("getActiveSpace", () => {
  it("returns matching space by activeSpaceId", () => {
    const data = makeSidebarData();
    const space = arcModel.getActiveSpace(data, DEFAULT_SPACE);
    assert.equal(space.id, "space-1");
  });

  it("falls back to first space when activeSpaceId is invalid", () => {
    const data = makeSidebarData();
    data.activeSpaceId = "nonexistent";
    const space = arcModel.getActiveSpace(data, DEFAULT_SPACE);
    assert.equal(space.id, "space-1");
  });
});

describe("getActiveSpacePinnedNodes", () => {
  it("returns pinned nodes for active space", () => {
    const link = { type: "link", id: "l1", url: "https://a.com", title: "A" };
    const data = makeSidebarData({ pinned: [link] });
    const nodes = arcModel.getActiveSpacePinnedNodes(data, DEFAULT_SPACE);
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].id, "l1");
  });

  it("returns empty array when no pinned data", () => {
    const data = makeSidebarData();
    data.pinnedBySpace = {};
    const nodes = arcModel.getActiveSpacePinnedNodes(data, DEFAULT_SPACE);
    assert.deepEqual(nodes, []);
  });
});

describe("removePinnedLinkByIdFromNodes", () => {
  it("removes top-level link by id", () => {
    const nodes = [
      { type: "link", id: "l1", url: "https://a.com" },
      { type: "link", id: "l2", url: "https://b.com" }
    ];
    const result = arcModel.removePinnedLinkByIdFromNodes(nodes, "l1");
    assert.equal(result.removed, true);
    assert.equal(result.next.length, 1);
    assert.equal(result.next[0].id, "l2");
  });

  it("removes link inside folder", () => {
    const nodes = [
      {
        type: "folder", id: "f1", title: "Folder", children: [
          { type: "link", id: "l1", url: "https://a.com" },
          { type: "link", id: "l2", url: "https://b.com" }
        ]
      }
    ];
    const result = arcModel.removePinnedLinkByIdFromNodes(nodes, "l1");
    assert.equal(result.removed, true);
    assert.equal(result.next[0].children.length, 1);
    assert.equal(result.next[0].children[0].id, "l2");
  });

  it("returns removed=false when id not found", () => {
    const nodes = [{ type: "link", id: "l1", url: "https://a.com" }];
    const result = arcModel.removePinnedLinkByIdFromNodes(nodes, "missing");
    assert.equal(result.removed, false);
    assert.equal(result.next.length, 1);
  });
});

describe("addFavoriteItem", () => {
  it("adds new favorite", () => {
    const data = makeSidebarData();
    const item = { id: "fav1", url: "https://a.com", title: "A" };
    const result = arcModel.addFavoriteItem(data, item, {
      normalizeUrlKey: normalize,
      maxFavorites: 12
    });
    assert.equal(result.changed, true);
    assert.equal(result.favorites.length, 1);
    assert.equal(result.favorites[0].url, "https://a.com");
  });

  it("updates existing favorite by URL", () => {
    const data = makeSidebarData({
      favorites: [{ id: "fav1", url: "https://a.com/", title: "Old", favIconUrl: "old.png" }]
    });
    const item = { id: "fav2", url: "https://a.com/", title: "New", favIconUrl: "new.png" };
    const result = arcModel.addFavoriteItem(data, item, {
      normalizeUrlKey: normalize,
      maxFavorites: 12
    });
    assert.equal(result.changed, true);
    assert.equal(result.favorites.length, 1);
    assert.equal(result.favorites[0].title, "New");
  });

  it("blocks when at max favorites", () => {
    const favorites = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`, url: `https://${i}.com/`, title: `Site ${i}`
    }));
    const data = makeSidebarData({ favorites });
    const item = { id: "new", url: "https://new.com/", title: "New" };
    const result = arcModel.addFavoriteItem(data, item, {
      normalizeUrlKey: normalize,
      maxFavorites: 12
    });
    assert.equal(result.changed, false);
    assert.equal(result.favorites.length, 12);
  });
});

describe("removeFavoriteByUrl", () => {
  it("removes matching URL", () => {
    const favorites = [
      { id: "f1", url: "https://a.com/", title: "A" },
      { id: "f2", url: "https://b.com/", title: "B" }
    ];
    const result = arcModel.removeFavoriteByUrl(favorites, "https://a.com/", normalize);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "f2");
  });
});

describe("unpinUrlFromNodes", () => {
  it("removes top-level link by URL", () => {
    const nodes = [
      { type: "link", id: "l1", url: "https://a.com/" },
      { type: "link", id: "l2", url: "https://b.com/" }
    ];
    const result = arcModel.unpinUrlFromNodes(nodes, "https://a.com/", normalize);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "l2");
  });

  it("removes link from inside folder", () => {
    const nodes = [
      {
        type: "folder", id: "f1", title: "F", children: [
          { type: "link", id: "l1", url: "https://a.com/" }
        ]
      }
    ];
    const result = arcModel.unpinUrlFromNodes(nodes, "https://a.com/", normalize);
    assert.equal(result[0].children.length, 0);
  });
});

describe("extractPinnedLinkByUrl", () => {
  it("extracts link from top level", () => {
    const nodes = [
      { type: "link", id: "l1", url: "https://a.com/" },
      { type: "link", id: "l2", url: "https://b.com/" }
    ];
    const result = arcModel.extractPinnedLinkByUrl(nodes, "https://a.com/", null, normalize);
    assert.equal(result.extracted.id, "l1");
    assert.equal(result.nextNodes.length, 1);
  });

  it("extracts link from folder but not target folder", () => {
    const nodes = [
      {
        type: "folder", id: "f1", title: "F1", children: [
          { type: "link", id: "l1", url: "https://a.com/" }
        ]
      },
      {
        type: "folder", id: "f2", title: "F2", children: [
          { type: "link", id: "l2", url: "https://a.com/" }
        ]
      }
    ];
    const result = arcModel.extractPinnedLinkByUrl(nodes, "https://a.com/", "f2", normalize);
    assert.equal(result.extracted.id, "l1");
    assert.equal(result.nextNodes[0].children.length, 0);
    assert.equal(result.nextNodes[1].children.length, 1);
  });
});

describe("pinItemToFolder", () => {
  it("adds item to folder", () => {
    const nodes = [
      { type: "folder", id: "f1", title: "F", children: [] }
    ];
    const item = { url: "https://a.com/", title: "A", favIconUrl: "a.png" };
    const createNode = (itm) => ({ type: "link", id: "new-id", ...itm });
    const result = arcModel.pinItemToFolder(nodes, item, "f1", {
      normalizeUrlKey: normalize,
      createPinnedLinkNodeFromSavedItem: createNode
    });
    assert.equal(result.changed, true);
    assert.equal(result.nodes[0].children.length, 1);
    assert.equal(result.nodes[0].children[0].title, "A");
  });

  it("returns changed=false when folder not found", () => {
    const nodes = [];
    const item = { url: "https://a.com/", title: "A" };
    const result = arcModel.pinItemToFolder(nodes, item, "missing", {
      normalizeUrlKey: normalize,
      createPinnedLinkNodeFromSavedItem: () => ({})
    });
    assert.equal(result.changed, false);
  });
});

describe("addSpace", () => {
  it("adds space and initializes pinned array", () => {
    const data = makeSidebarData();
    const newSpace = { id: "space-2", name: "Work", icon: "💼" };
    const result = arcModel.addSpace(data, newSpace);
    assert.equal(result.spaces.length, 2);
    assert.equal(result.activeSpaceId, "space-2");
    assert.deepEqual(result.pinnedBySpace["space-2"], []);
    assert.ok(result.pinnedBySpace["space-1"] !== undefined);
  });
});
