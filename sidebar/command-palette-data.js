(function bootstrapSidebarCommandPaletteData(globalScope) {
  function getActiveSnapshotTab(tabs) {
    return (Array.isArray(tabs) ? tabs : []).find((tab) => tab?.active) || null;
  }

  function getPinnedLinkEntriesForPalette(pinnedNodes) {
    const entries = [];
    for (const node of Array.isArray(pinnedNodes) ? pinnedNodes : []) {
      if (node?.type === "link") {
        entries.push({
          node,
          folderTitle: ""
        });
        continue;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        for (const child of node.children) {
          entries.push({
            node: child,
            folderTitle: node.title || "Folder"
          });
        }
      }
    }

    return entries;
  }

  function createCommandPaletteCandidates(options = {}) {
    const tabs = Array.isArray(options.tabs) ? options.tabs : [];
    const favorites = Array.isArray(options.favorites) ? options.favorites : [];
    const pinnedNodes = Array.isArray(options.pinnedNodes) ? options.pinnedNodes : [];
    const sidebarOpen = Boolean(options.sidebarOpen);
    const activeTab = getActiveSnapshotTab(tabs);

    const candidates = [];

    candidates.push({
      id: "action:new-tab",
      type: "action",
      command: "new-tab",
      label: "New Tab",
      subtitle: "Create a new tab",
      keywords: ["create", "tab", "new"]
    });

    candidates.push({
      id: "action:focus-search",
      type: "action",
      command: "focus-search",
      label: "Focus Sidebar Search",
      subtitle: "Jump to the sidebar search input",
      keywords: ["search", "find", "sidebar"]
    });

    candidates.push({
      id: "action:toggle-sidebar",
      type: "action",
      command: "toggle-sidebar",
      label: sidebarOpen ? "Hide Sidebar" : "Show Sidebar",
      subtitle: "Toggle sidebar visibility",
      keywords: ["toggle", "show", "hide", "sidebar"]
    });

    if (activeTab?.id) {
      candidates.push({
        id: "action:close-active-tab",
        type: "action",
        command: "close-active-tab",
        tabId: activeTab.id,
        label: "Close Active Tab",
        subtitle: activeTab.title || activeTab.url || "Close tab",
        keywords: ["close", "active", "tab"]
      });

      candidates.push({
        id: "action:toggle-pin-active-tab",
        type: "action",
        command: "toggle-pin-active-tab",
        tabId: activeTab.id,
        nextPinned: !activeTab.pinned,
        label: activeTab.pinned ? "Unpin Active Tab" : "Pin Active Tab",
        subtitle: activeTab.title || activeTab.url || "Pin state",
        keywords: ["pin", "unpin", "active", "tab"]
      });
    }

    for (const tab of tabs) {
      if (!Number.isInteger(tab?.id)) {
        continue;
      }

      candidates.push({
        id: `tab:${tab.id}`,
        type: "tab",
        command: "activate-tab",
        tabId: tab.id,
        label: tab.title || "Untitled tab",
        subtitle: tab.url || "Open tab",
        keywords: ["tab", tab.url, tab.title]
      });
    }

    for (const favorite of favorites) {
      if (!favorite?.url) {
        continue;
      }

      candidates.push({
        id: `favorite:${favorite.id}`,
        type: "favorite",
        command: "open-url",
        url: favorite.url,
        label: favorite.title || favorite.url,
        subtitle: `Favorite • ${favorite.url}`,
        keywords: ["favorite", favorite.title, favorite.url]
      });
    }

    for (const entry of getPinnedLinkEntriesForPalette(pinnedNodes)) {
      const linkNode = entry.node;
      if (!linkNode?.url) {
        continue;
      }

      candidates.push({
        id: `pinned:${linkNode.id}`,
        type: "pinned",
        command: "open-url",
        url: linkNode.url,
        label: linkNode.title || linkNode.url,
        subtitle: entry.folderTitle
          ? `Pinned • ${entry.folderTitle} • ${linkNode.url}`
          : `Pinned • ${linkNode.url}`,
        keywords: ["pinned", entry.folderTitle, linkNode.title, linkNode.url]
      });
    }

    return candidates;
  }

  const api = {
    createCommandPaletteCandidates,
    getPinnedLinkEntriesForPalette
  };

  globalScope.BraveSidebarCommandPaletteData = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
