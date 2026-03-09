const test = require("node:test");
const assert = require("node:assert/strict");

const commandPaletteData = require("../sidebar/command-palette-data.js");

test("createCommandPaletteCandidates includes base actions and active-tab actions", () => {
  const candidates = commandPaletteData.createCommandPaletteCandidates({
    tabs: [
      {
        id: 1,
        title: "Docs",
        url: "https://docs.example.com",
        active: true,
        pinned: false
      }
    ],
    sidebarOpen: true,
    favorites: [],
    pinnedNodes: []
  });

  const ids = candidates.map((item) => item.id);
  assert.equal(ids.includes("action:new-tab"), true);
  assert.equal(ids.includes("action:focus-search"), true);
  assert.equal(ids.includes("action:toggle-sidebar"), true);
  assert.equal(ids.includes("action:close-active-tab"), true);
  assert.equal(ids.includes("action:toggle-pin-active-tab"), true);

  const toggleAction = candidates.find((item) => item.id === "action:toggle-sidebar");
  assert.equal(toggleAction.label, "Hide Sidebar");

  const pinAction = candidates.find((item) => item.id === "action:toggle-pin-active-tab");
  assert.equal(pinAction.label, "Pin Active Tab");
});

test("createCommandPaletteCandidates flattens pinned folders and favorites", () => {
  const candidates = commandPaletteData.createCommandPaletteCandidates({
    tabs: [],
    sidebarOpen: false,
    favorites: [
      {
        id: "fav-1",
        title: "GitHub",
        url: "https://github.com"
      }
    ],
    pinnedNodes: [
      {
        type: "folder",
        id: "folder-1",
        title: "Work",
        children: [
          {
            type: "link",
            id: "plink-1",
            title: "Docs",
            url: "https://docs.example.com"
          }
        ]
      }
    ]
  });

  const favorite = candidates.find((item) => item.id === "favorite:fav-1");
  assert.equal(favorite.subtitle, "Favorite • https://github.com");

  const pinned = candidates.find((item) => item.id === "pinned:plink-1");
  assert.equal(pinned.subtitle, "Pinned • Work • https://docs.example.com");

  const toggleAction = candidates.find((item) => item.id === "action:toggle-sidebar");
  assert.equal(toggleAction.label, "Show Sidebar");
});
