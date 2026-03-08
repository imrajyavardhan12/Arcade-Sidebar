(function bootstrapSidebarDragState(globalScope) {
  function isHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function normalizeUrlKey(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      return "";
    }

    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return raw;
    }
  }

  function clonePinnedNode(node) {
    if (node?.type === "folder") {
      return {
        ...node,
        children: Array.isArray(node.children) ? node.children.map((child) => ({ ...child })) : []
      };
    }

    return { ...node };
  }

  function clonePinnedNodes(nodes) {
    return (Array.isArray(nodes) ? nodes : []).map(clonePinnedNode);
  }

  function cloneFavorites(favorites) {
    return (Array.isArray(favorites) ? favorites : []).map((item) => ({ ...item }));
  }

  function findPinnedLinkNodeById(nodes, linkId) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (node?.type === "link" && node.id === linkId) {
        return node;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        const child = node.children.find((item) => item.id === linkId);
        if (child) {
          return child;
        }
      }
    }

    return null;
  }

  function findPinnedLinkLocation(nodes, linkId) {
    const list = Array.isArray(nodes) ? nodes : [];
    for (let topIndex = 0; topIndex < list.length; topIndex += 1) {
      const node = list[topIndex];
      if (node?.type === "link" && node.id === linkId) {
        return {
          kind: "top",
          topIndex,
          link: node
        };
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
          const child = node.children[childIndex];
          if (child?.id === linkId) {
            return {
              kind: "folder",
              folderIndex: topIndex,
              childIndex,
              link: child
            };
          }
        }
      }
    }

    return null;
  }

  function removePinnedLinkByIdFromNodes(nodes, linkId) {
    const nextNodes = clonePinnedNodes(nodes);
    let removed = false;
    let removedNode = null;

    const filtered = nextNodes
      .map((node) => {
        if (node?.type === "link") {
          if (node.id === linkId) {
            removed = true;
            removedNode = node;
            return null;
          }
          return node;
        }

        if (node?.type === "folder" && Array.isArray(node.children)) {
          const children = node.children.filter((child) => {
            if (child.id === linkId) {
              removed = true;
              removedNode = child;
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

    return {
      nodes: filtered,
      removed,
      removedNode
    };
  }

  function isUrlInFavorites(favorites, url) {
    const key = normalizeUrlKey(url);
    return (Array.isArray(favorites) ? favorites : []).some(
      (item) => normalizeUrlKey(item?.url) === key
    );
  }

  function isUrlPinnedInNodes(nodes, url) {
    const key = normalizeUrlKey(url);
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (node?.type === "link" && normalizeUrlKey(node.url) === key) {
        return true;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        if (node.children.some((child) => normalizeUrlKey(child?.url) === key)) {
          return true;
        }
      }
    }

    return false;
  }

  function updatePinnedLinkByUrl(nodes, urlKey, updateLink) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (node?.type === "link" && normalizeUrlKey(node.url) === urlKey) {
        updateLink(node);
        return true;
      }

      if (node?.type === "folder" && Array.isArray(node.children)) {
        const match = node.children.find((child) => normalizeUrlKey(child.url) === urlKey);
        if (match) {
          updateLink(match);
          return true;
        }
      }
    }

    return false;
  }

  function createPinnedLinkFromFavorite(item, createPinnedId) {
    const id =
      typeof createPinnedId === "function"
        ? createPinnedId(item)
        : `plink-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      type: "link",
      id,
      title: item?.title || item?.url || "",
      url: item?.url || "",
      favIconUrl: item?.favIconUrl || ""
    };
  }

  function createFavoriteFromPinned(node, createFavoriteId) {
    const id =
      typeof createFavoriteId === "function"
        ? createFavoriteId(node)
        : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      id,
      title: node?.title || node?.url || "",
      url: node?.url || "",
      favIconUrl: node?.favIconUrl || ""
    };
  }

  function movePinnedLinkToFolder(params) {
    const {
      nodes,
      linkId,
      fromFolderId = null,
      targetFolderId
    } = params || {};

    if (!linkId) {
      return { moved: false, reason: "noLinkId", nodes: clonePinnedNodes(nodes) };
    }

    const nextNodes = clonePinnedNodes(nodes);
    const targetFolder = nextNodes.find(
      (node) => node?.type === "folder" && node.id === targetFolderId
    );

    if (!targetFolder) {
      return { moved: false, reason: "noTargetFolder", nodes: nextNodes };
    }

    if (fromFolderId && fromFolderId === targetFolderId) {
      return { moved: false, reason: "sameFolder", nodes: nextNodes };
    }

    const sourceNode = findPinnedLinkNodeById(nextNodes, linkId);
    if (!sourceNode) {
      return { moved: false, reason: "noSourceLink", nodes: nextNodes };
    }

    const sourceUrlKey = normalizeUrlKey(sourceNode.url);
    const duplicateAlreadyInTarget = targetFolder.children.some(
      (child) => normalizeUrlKey(child.url) === sourceUrlKey
    );

    if (duplicateAlreadyInTarget) {
      return { moved: false, reason: "duplicateInTarget", nodes: nextNodes };
    }

    if (fromFolderId) {
      const sourceFolder = nextNodes.find(
        (node) => node?.type === "folder" && node.id === fromFolderId
      );

      if (!sourceFolder) {
        return { moved: false, reason: "noSourceFolder", nodes: nextNodes };
      }

      const childIndex = sourceFolder.children.findIndex((child) => child.id === linkId);
      if (childIndex < 0) {
        return { moved: false, reason: "noSourceLink", nodes: nextNodes };
      }

      const movedNode = sourceFolder.children.splice(childIndex, 1)[0];
      targetFolder.children.push({
        ...movedNode,
        type: "link"
      });
      return { moved: true, nodes: nextNodes };
    }

    const linkIndex = nextNodes.findIndex((node) => node?.type === "link" && node.id === linkId);
    if (linkIndex < 0) {
      return { moved: false, reason: "noSourceLink", nodes: nextNodes };
    }

    const movedNode = nextNodes.splice(linkIndex, 1)[0];
    targetFolder.children.push({
      ...movedNode,
      type: "link"
    });

    return { moved: true, nodes: nextNodes };
  }

  function movePinnedLinkToTopLevel(params) {
    const { nodes, linkId, fromFolderId = null } = params || {};

    if (!linkId) {
      return { moved: false, reason: "noLinkId", nodes: clonePinnedNodes(nodes) };
    }

    const nextNodes = clonePinnedNodes(nodes);
    if (!fromFolderId) {
      return { moved: false, reason: "noFromFolder", nodes: nextNodes };
    }

    const sourceFolder = nextNodes.find(
      (node) => node?.type === "folder" && node.id === fromFolderId
    );

    if (!sourceFolder) {
      return { moved: false, reason: "noSourceFolder", nodes: nextNodes };
    }

    const childIndex = sourceFolder.children.findIndex((child) => child.id === linkId);
    if (childIndex < 0) {
      return { moved: false, reason: "noSourceLink", nodes: nextNodes };
    }

    const movedNode = sourceFolder.children.splice(childIndex, 1)[0];
    const movedUrlKey = normalizeUrlKey(movedNode?.url);
    const alreadyTopLevel = nextNodes.some(
      (node) => node?.type === "link" && normalizeUrlKey(node.url) === movedUrlKey
    );

    if (!alreadyTopLevel) {
      nextNodes.push({
        ...movedNode,
        type: "link"
      });
    }

    return {
      moved: true,
      addedToTopLevel: !alreadyTopLevel,
      nodes: nextNodes
    };
  }

  function moveFavoriteToPinnedTopLevel(params) {
    const { nodes, favorites, favoriteId, createPinnedId } = params || {};
    if (!favoriteId) {
      return {
        moved: false,
        reason: "noFavoriteId",
        nodes: clonePinnedNodes(nodes),
        favorites: cloneFavorites(favorites)
      };
    }

    const nextNodes = clonePinnedNodes(nodes);
    const nextFavorites = cloneFavorites(favorites);
    const favoriteIndex = nextFavorites.findIndex((item) => item.id === favoriteId);
    if (favoriteIndex < 0) {
      return { moved: false, reason: "noFavorite", nodes: nextNodes, favorites: nextFavorites };
    }

    const favoriteItem = nextFavorites[favoriteIndex];
    const key = normalizeUrlKey(favoriteItem.url);
    const updated = updatePinnedLinkByUrl(nextNodes, key, (existing) => {
      existing.title = favoriteItem.title;
      existing.favIconUrl = favoriteItem.favIconUrl || existing.favIconUrl;
    });

    if (!updated) {
      nextNodes.push(createPinnedLinkFromFavorite(favoriteItem, createPinnedId));
    }

    nextFavorites.splice(favoriteIndex, 1);

    return {
      moved: true,
      nodes: nextNodes,
      favorites: nextFavorites
    };
  }

  function moveFavoriteToFolder(params) {
    const { nodes, favorites, favoriteId, targetFolderId, createPinnedId } = params || {};
    if (!favoriteId) {
      return {
        moved: false,
        reason: "noFavoriteId",
        nodes: clonePinnedNodes(nodes),
        favorites: cloneFavorites(favorites)
      };
    }

    const nextNodes = clonePinnedNodes(nodes);
    const nextFavorites = cloneFavorites(favorites);
    const favoriteIndex = nextFavorites.findIndex((item) => item.id === favoriteId);
    if (favoriteIndex < 0) {
      return { moved: false, reason: "noFavorite", nodes: nextNodes, favorites: nextFavorites };
    }

    const targetFolder = nextNodes.find(
      (node) => node?.type === "folder" && node.id === targetFolderId
    );
    if (!targetFolder) {
      return {
        moved: false,
        reason: "noTargetFolder",
        nodes: nextNodes,
        favorites: nextFavorites
      };
    }

    const favoriteItem = nextFavorites[favoriteIndex];
    const key = normalizeUrlKey(favoriteItem.url);
    const existingChild = targetFolder.children.find((child) => normalizeUrlKey(child.url) === key);

    if (existingChild) {
      existingChild.title = favoriteItem.title;
      existingChild.favIconUrl = favoriteItem.favIconUrl || existingChild.favIconUrl;
    } else {
      targetFolder.children.push(createPinnedLinkFromFavorite(favoriteItem, createPinnedId));
    }

    nextFavorites.splice(favoriteIndex, 1);

    return {
      moved: true,
      nodes: nextNodes,
      favorites: nextFavorites
    };
  }

  function movePinnedLinkToFavorites(params) {
    const {
      nodes,
      favorites,
      linkId,
      maxFavorites = 12,
      createFavoriteId
    } = params || {};

    if (!linkId) {
      return {
        moved: false,
        reason: "noLinkId",
        nodes: clonePinnedNodes(nodes),
        favorites: cloneFavorites(favorites)
      };
    }

    const nextNodes = clonePinnedNodes(nodes);
    const nextFavorites = cloneFavorites(favorites);
    const sourceLocation = findPinnedLinkLocation(nextNodes, linkId);
    if (!sourceLocation) {
      return {
        moved: false,
        reason: "noSourceLink",
        nodes: nextNodes,
        favorites: nextFavorites
      };
    }

    const sourceNode = sourceLocation.link;
    const key = normalizeUrlKey(sourceNode.url);
    const existingFavoriteIndex = nextFavorites.findIndex(
      (item) => normalizeUrlKey(item.url) === key
    );

    if (existingFavoriteIndex >= 0) {
      nextFavorites[existingFavoriteIndex] = {
        ...nextFavorites[existingFavoriteIndex],
        title: sourceNode.title,
        favIconUrl: sourceNode.favIconUrl || nextFavorites[existingFavoriteIndex].favIconUrl
      };
    } else {
      if (nextFavorites.length >= maxFavorites) {
        return {
          moved: false,
          reason: "favoritesFull",
          nodes: nextNodes,
          favorites: nextFavorites
        };
      }

      nextFavorites.push(createFavoriteFromPinned(sourceNode, createFavoriteId));
    }

    if (sourceLocation.kind === "top") {
      nextNodes.splice(sourceLocation.topIndex, 1);
    } else {
      nextNodes[sourceLocation.folderIndex].children.splice(sourceLocation.childIndex, 1);
    }

    return {
      moved: true,
      nodes: nextNodes,
      favorites: nextFavorites
    };
  }

  function movePinnedLinkToToday(params) {
    const { nodes, linkId } = params || {};
    if (!linkId) {
      return { moved: false, reason: "noLinkId", nodes: clonePinnedNodes(nodes) };
    }

    const removal = removePinnedLinkByIdFromNodes(nodes, linkId);
    return {
      moved: removal.removed,
      nodes: removal.nodes,
      removedNode: removal.removedNode
    };
  }

  function moveFavoriteToToday(params) {
    const { favorites, favoriteId } = params || {};
    const nextFavorites = cloneFavorites(favorites);
    if (!favoriteId) {
      return { moved: false, reason: "noFavoriteId", favorites: nextFavorites };
    }

    const index = nextFavorites.findIndex((item) => item.id === favoriteId);
    if (index < 0) {
      return { moved: false, reason: "noFavorite", favorites: nextFavorites };
    }

    const removed = nextFavorites.splice(index, 1)[0];
    return {
      moved: true,
      favorites: nextFavorites,
      removed
    };
  }

  function filterTodayTabs(params) {
    const { tabs, pinnedNodes, favorites } = params || {};
    return (Array.isArray(tabs) ? tabs : []).filter((tab) => {
      const key = normalizeUrlKey(tab?.url);
      if (!isHttpUrl(key)) {
        return true;
      }

      return !isUrlPinnedInNodes(pinnedNodes, key) && !isUrlInFavorites(favorites, key);
    });
  }

  const api = {
    isHttpUrl,
    normalizeUrlKey,
    clonePinnedNodes,
    cloneFavorites,
    findPinnedLinkNodeById,
    removePinnedLinkByIdFromNodes,
    isUrlInFavorites,
    isUrlPinnedInNodes,
    updatePinnedLinkByUrl,
    movePinnedLinkToFolder,
    movePinnedLinkToTopLevel,
    moveFavoriteToPinnedTopLevel,
    moveFavoriteToFolder,
    movePinnedLinkToFavorites,
    movePinnedLinkToToday,
    moveFavoriteToToday,
    filterTodayTabs
  };

  globalScope.BraveSidebarDragState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
