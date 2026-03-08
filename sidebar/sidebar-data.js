(function bootstrapSidebarData(globalScope) {
  function defaultNormalizeUrlKey(url) {
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

  function defaultIsHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function resolveNormalizeUrlKey(options) {
    return typeof options?.normalizeUrlKey === "function"
      ? options.normalizeUrlKey
      : defaultNormalizeUrlKey;
  }

  function resolveIsHttpUrl(options) {
    return typeof options?.isHttpUrl === "function" ? options.isHttpUrl : defaultIsHttpUrl;
  }

  function createDefaultSidebarData(defaultSpace) {
    const space = {
      id: String(defaultSpace?.id || "space-personal"),
      name: String(defaultSpace?.name || "Personal"),
      icon: String(defaultSpace?.icon || "•")
    };

    return {
      spaces: [space],
      activeSpaceId: space.id,
      favorites: [],
      pinnedBySpace: {
        [space.id]: []
      }
    };
  }

  function sanitizeSavedItem(item, options = {}) {
    const normalizeUrlKey = resolveNormalizeUrlKey(options);
    const isHttpUrl = resolveIsHttpUrl(options);

    const normalizedUrl = normalizeUrlKey(item?.url);
    if (!normalizedUrl || !isHttpUrl(normalizedUrl)) {
      return null;
    }

    return {
      id: String(item?.id || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      title: String(item?.title || normalizedUrl),
      url: normalizedUrl,
      favIconUrl: typeof item?.favIconUrl === "string" ? item.favIconUrl : ""
    };
  }

  function sanitizePinnedLinkNode(node, options = {}) {
    const item = sanitizeSavedItem(node, options);
    if (!item) {
      return null;
    }

    return {
      type: "link",
      id: String(node?.id || item.id || `plink-${Date.now()}`),
      title: item.title,
      url: item.url,
      favIconUrl: item.favIconUrl
    };
  }

  function sanitizePinnedFolderNode(node, options = {}) {
    const normalizeUrlKey = resolveNormalizeUrlKey(options);

    const id = String(node?.id || `pfolder-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const title = String(node?.title || "New Folder").trim() || "New Folder";
    const children = [];
    const seen = new Set();
    const rawChildren = Array.isArray(node?.children) ? node.children : [];

    for (const child of rawChildren) {
      const linkNode = sanitizePinnedLinkNode(child, options);
      if (!linkNode) {
        continue;
      }

      const key = normalizeUrlKey(linkNode.url);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      children.push(linkNode);
    }

    return {
      type: "folder",
      id,
      title,
      collapsed: Boolean(node?.collapsed),
      children
    };
  }

  function sanitizePinnedNode(node, options = {}) {
    if (node?.type === "folder") {
      return sanitizePinnedFolderNode(node, options);
    }

    return sanitizePinnedLinkNode(node, options);
  }

  function sanitizeSidebarData(rawValue, options = {}) {
    const normalizeUrlKey = resolveNormalizeUrlKey(options);
    const maxFavorites = Number.isInteger(options.maxFavorites) ? options.maxFavorites : 12;

    const fallback = createDefaultSidebarData(options.defaultSpace);
    if (!rawValue || typeof rawValue !== "object") {
      return fallback;
    }

    const spaces = Array.isArray(rawValue.spaces)
      ? rawValue.spaces
          .map((space) => {
            const id = String(space?.id || "").trim();
            if (!id) {
              return null;
            }

            return {
              id,
              name: String(space?.name || "Untitled Space"),
              icon: String(space?.icon || "•")
            };
          })
          .filter(Boolean)
      : [];

    const normalizedSpaces = spaces.length > 0 ? spaces : fallback.spaces;
    const validSpaceIds = new Set(normalizedSpaces.map((space) => space.id));

    const activeSpaceId = validSpaceIds.has(rawValue.activeSpaceId)
      ? rawValue.activeSpaceId
      : normalizedSpaces[0].id;

    const favorites = [];
    const favoriteSeen = new Set();
    const rawFavorites = Array.isArray(rawValue.favorites) ? rawValue.favorites : [];
    for (const item of rawFavorites) {
      const sanitized = sanitizeSavedItem(item, options);
      if (!sanitized) {
        continue;
      }

      const key = normalizeUrlKey(sanitized.url);
      if (favoriteSeen.has(key)) {
        continue;
      }

      favoriteSeen.add(key);
      favorites.push(sanitized);
      if (favorites.length >= maxFavorites) {
        break;
      }
    }

    const pinnedBySpace = {};
    const rawPinnedBySpace =
      rawValue.pinnedBySpace && typeof rawValue.pinnedBySpace === "object"
        ? rawValue.pinnedBySpace
        : {};

    for (const space of normalizedSpaces) {
      const spaceItems = Array.isArray(rawPinnedBySpace[space.id]) ? rawPinnedBySpace[space.id] : [];
      const deduped = [];
      const seen = new Set();

      for (const item of spaceItems) {
        const sanitized = sanitizePinnedNode(item, options);
        if (!sanitized) {
          continue;
        }

        if (sanitized.type === "folder") {
          deduped.push(sanitized);
          continue;
        }

        const key = normalizeUrlKey(sanitized.url);
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        deduped.push(sanitized);
      }

      pinnedBySpace[space.id] = deduped;
    }

    return {
      spaces: normalizedSpaces,
      activeSpaceId,
      favorites,
      pinnedBySpace
    };
  }

  function createSavedItemFromTab(tab, options = {}) {
    const normalizeUrlKey = resolveNormalizeUrlKey(options);
    const isHttpUrl = resolveIsHttpUrl(options);

    const normalizedUrl = normalizeUrlKey(tab?.url);
    if (!normalizedUrl || !isHttpUrl(normalizedUrl)) {
      return null;
    }

    return {
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: tab?.title || normalizedUrl,
      url: normalizedUrl,
      favIconUrl: tab?.favIconUrl || ""
    };
  }

  function createPinnedLinkNodeFromSavedItem(item) {
    return {
      type: "link",
      id: `plink-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: item.title,
      url: item.url,
      favIconUrl: item.favIconUrl || ""
    };
  }

  const api = {
    createDefaultSidebarData,
    sanitizeSavedItem,
    sanitizePinnedLinkNode,
    sanitizePinnedFolderNode,
    sanitizePinnedNode,
    sanitizeSidebarData,
    createSavedItemFromTab,
    createPinnedLinkNodeFromSavedItem
  };

  globalScope.BraveSidebarData = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
