(function defineArcModel(globalScope) {
  "use strict";

  function getActiveSpace(sidebarData, defaultSpace) {
    const active = sidebarData.spaces.find(
      (space) => space.id === sidebarData.activeSpaceId
    );
    return active || sidebarData.spaces[0] || defaultSpace;
  }

  function getActiveSpacePinnedNodes(sidebarData, defaultSpace) {
    const activeSpace = getActiveSpace(sidebarData, defaultSpace);
    const items = sidebarData.pinnedBySpace[activeSpace.id];
    return Array.isArray(items) ? items : [];
  }

  function removePinnedLinkByIdFromNodes(nodes, linkId) {
    let removed = false;
    const next = [];

    for (const node of nodes) {
      if (node?.type === "link") {
        if (node.id === linkId) {
          removed = true;
          continue;
        }
        next.push(node);
        continue;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        const children = node.children.filter((child) => {
          if (child.id === linkId) {
            removed = true;
            return false;
          }
          return true;
        });

        next.push({
          ...node,
          children
        });
        continue;
      }

      next.push(node);
    }

    return { next, removed };
  }

  function extractPinnedLinkByUrl(nodes, urlKey, targetFolderId, normalizeUrlKey) {
    let extracted = null;

    const nextNodes = nodes
      .map((node) => {
        if (node?.type === "link") {
          if (normalizeUrlKey(node.url) === urlKey) {
            extracted = node;
            return null;
          }
          return node;
        }

        if (node?.type === "folder" && Array.isArray(node.children)) {
          const children = node.children.filter((child) => {
            const isMatch = normalizeUrlKey(child.url) === urlKey;
            if (isMatch && node.id !== targetFolderId) {
              extracted = child;
              return false;
            }
            return true;
          });

          return {
            ...node,
            children
          };
        }

        return node;
      })
      .filter(Boolean);

    return { nextNodes, extracted };
  }

  function addFavoriteItem(sidebarData, item, options) {
    const { normalizeUrlKey, maxFavorites } = options;
    const favorites = sidebarData.favorites.slice();
    const key = normalizeUrlKey(item.url);
    const existingIndex = favorites.findIndex(
      (entry) => normalizeUrlKey(entry.url) === key
    );

    if (existingIndex >= 0) {
      favorites[existingIndex] = {
        ...favorites[existingIndex],
        title: item.title,
        favIconUrl: item.favIconUrl || favorites[existingIndex].favIconUrl
      };
      return { changed: true, favorites };
    }

    if (favorites.length >= maxFavorites) {
      return { changed: false, favorites: sidebarData.favorites };
    }

    favorites.push(item);
    return { changed: true, favorites };
  }

  function removeFavoriteByUrl(favorites, url, normalizeUrlKey) {
    const key = normalizeUrlKey(url);
    return favorites.filter(
      (item) => normalizeUrlKey(item.url) !== key
    );
  }

  function pinSavedItemInActiveSpace(sidebarData, item, options) {
    const { normalizeUrlKey, defaultSpace, updatePinnedLinkByUrl, createPinnedLinkNodeFromSavedItem } = options;
    const activeSpace = getActiveSpace(sidebarData, defaultSpace);
    const currentItems = getActiveSpacePinnedNodes(sidebarData, defaultSpace).slice();
    const key = normalizeUrlKey(item.url);

    const updated = updatePinnedLinkByUrl(currentItems, key, (existing) => {
      existing.title = item.title;
      existing.favIconUrl = item.favIconUrl || existing.favIconUrl;
    });

    if (!updated) {
      currentItems.push(createPinnedLinkNodeFromSavedItem(item));
    }

    return { spaceId: activeSpace.id, nodes: currentItems };
  }

  function unpinUrlFromNodes(nodes, url, normalizeUrlKey) {
    const key = normalizeUrlKey(url);
    return nodes
      .map((node) => {
        if (node?.type === "link") {
          return normalizeUrlKey(node.url) === key ? null : node;
        }

        if (node?.type === "folder" && Array.isArray(node.children)) {
          return {
            ...node,
            children: node.children.filter(
              (child) => normalizeUrlKey(child.url) !== key
            )
          };
        }

        return node;
      })
      .filter(Boolean);
  }

  function pinItemToFolder(nodes, item, folderId, options) {
    const { normalizeUrlKey, createPinnedLinkNodeFromSavedItem } = options;
    const key = normalizeUrlKey(item.url);
    const { nextNodes, extracted } = extractPinnedLinkByUrl(nodes, key, folderId, normalizeUrlKey);
    const folderInNext = nextNodes.find(
      (node) => node?.type === "folder" && node.id === folderId
    );

    if (!folderInNext) {
      return { changed: false, nodes };
    }

    const existingChild = folderInNext.children.find(
      (child) => normalizeUrlKey(child.url) === key
    );

    if (existingChild) {
      existingChild.title = item.title;
      existingChild.favIconUrl = item.favIconUrl || existingChild.favIconUrl;
    } else {
      const nodeToInsert = extracted
        ? {
            ...extracted,
            title: item.title,
            favIconUrl: item.favIconUrl || extracted.favIconUrl,
            type: "link"
          }
        : createPinnedLinkNodeFromSavedItem(item);

      folderInNext.children.push(nodeToInsert);
    }

    return { changed: true, nodes: nextNodes };
  }

  function addSpace(sidebarData, newSpace) {
    const spaces = sidebarData.spaces.slice();
    spaces.push(newSpace);
    const pinnedBySpace = { ...sidebarData.pinnedBySpace, [newSpace.id]: [] };
    return { spaces, pinnedBySpace, activeSpaceId: newSpace.id };
  }

  globalScope.BraveSidebarArcModel = {
    getActiveSpace,
    getActiveSpacePinnedNodes,
    removePinnedLinkByIdFromNodes,
    extractPinnedLinkByUrl,
    addFavoriteItem,
    removeFavoriteByUrl,
    pinSavedItemInActiveSpace,
    unpinUrlFromNodes,
    pinItemToFolder,
    addSpace
  };
})(globalThis);
