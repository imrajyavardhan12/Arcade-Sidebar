const test = require("node:test");
const assert = require("node:assert/strict");

const messages = require("../sidebar/messages.js");
const sidebarData = require("../sidebar/sidebar-data.js");
const dragState = require("../sidebar/drag-state.js");
const keyboardNav = require("../sidebar/keyboard-nav.js");
const commandPaletteData = require("../sidebar/command-palette-data.js");
const quickSwitcher = require("../sidebar/quick-switcher.js");

test("smoke e2e: today/pinned/favorites journey remains keyboard + palette accessible", () => {
  const defaultSpace = {
    id: "space-personal",
    name: "Personal",
    icon: "•"
  };

  const state = sidebarData.createDefaultSidebarData(defaultSpace);
  const activeSpaceId = state.activeSpaceId;

  const snapshotTabs = [
    {
      id: 1,
      title: "Inbox",
      url: "https://mail.example.com",
      active: true,
      pinned: false
    },
    {
      id: 2,
      title: "Project Docs",
      url: "https://docs.example.com/roadmap",
      active: false,
      pinned: false
    }
  ];

  const savedItem = sidebarData.createSavedItemFromTab(snapshotTabs[1]);
  assert.ok(savedItem);

  state.pinnedBySpace[activeSpaceId] = [sidebarData.createPinnedLinkNodeFromSavedItem(savedItem)];

  const pinnedLinkId = state.pinnedBySpace[activeSpaceId][0].id;
  const pinnedToFavorites = dragState.movePinnedLinkToFavorites({
    nodes: state.pinnedBySpace[activeSpaceId],
    favorites: state.favorites,
    linkId: pinnedLinkId,
    maxFavorites: 12,
    createFavoriteId: () => "fav-docs"
  });

  assert.equal(pinnedToFavorites.moved, true);
  state.pinnedBySpace[activeSpaceId] = pinnedToFavorites.nodes;
  state.favorites = pinnedToFavorites.favorites;
  assert.equal(state.favorites.length, 1);

  let todayTabs = dragState.filterTodayTabs({
    tabs: snapshotTabs,
    pinnedNodes: state.pinnedBySpace[activeSpaceId],
    favorites: state.favorites
  });

  assert.deepEqual(
    todayTabs.map((tab) => tab.id),
    [1]
  );

  const favoriteToToday = dragState.moveFavoriteToToday({
    favorites: state.favorites,
    favoriteId: "fav-docs"
  });

  assert.equal(favoriteToToday.moved, true);
  state.favorites = favoriteToToday.favorites;

  todayTabs = dragState.filterTodayTabs({
    tabs: snapshotTabs,
    pinnedNodes: state.pinnedBySpace[activeSpaceId],
    favorites: state.favorites
  });

  assert.deepEqual(
    todayTabs.map((tab) => tab.id),
    [1, 2]
  );

  const focusTabId = keyboardNav.resolveFocusTabId({
    tabIds: todayTabs.map((tab) => tab.id),
    currentFocusedTabId: null,
    activeTabId: 1
  });

  assert.equal(focusTabId, 1);

  const candidates = commandPaletteData.createCommandPaletteCandidates({
    tabs: snapshotTabs,
    favorites: state.favorites,
    pinnedNodes: state.pinnedBySpace[activeSpaceId],
    sidebarOpen: true
  });

  const ranked = quickSwitcher.rankItems(candidates, "project docs", 5);
  assert.ok(ranked.length > 0);
  assert.equal(ranked[0].type, "tab");

  const createTabValidation = messages.validatePayload(messages.MESSAGE_TYPES.CREATE_TAB, {
    windowId: 1,
    url: "https://new.example.com"
  });
  assert.equal(createTabValidation.ok, true);
});
