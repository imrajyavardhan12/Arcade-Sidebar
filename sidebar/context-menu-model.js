(function bootstrapSidebarContextMenuModel(globalScope) {
  function sortGroups(groups) {
    return (Array.isArray(groups) ? groups : []).slice().sort((a, b) => {
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
  }

  function action(id, label, options = {}) {
    return {
      kind: "action",
      id,
      label,
      destructive: Boolean(options.destructive),
      secondary: Boolean(options.secondary),
      disabled: Boolean(options.disabled),
      groupId: options.groupId
    };
  }

  function separator() {
    return { kind: "separator" };
  }

  function buildTabContextMenuModel(options = {}) {
    const tab = options.tab;
    const groups = sortGroups(options.groups);
    const canStoreUrl = Boolean(options.canStoreUrl);
    const isFavorite = Boolean(options.isFavorite);
    const isPinnedInActiveSpace = Boolean(options.isPinnedInActiveSpace);
    const favoritesCount = Number.isInteger(options.favoritesCount) ? options.favoritesCount : 0;
    const maxFavorites = Number.isInteger(options.maxFavorites) ? options.maxFavorites : 12;

    const items = [];

    if (canStoreUrl) {
      if (isFavorite) {
        items.push(action("remove-from-favorites", "Remove from favorites"));
      } else if (favoritesCount >= maxFavorites) {
        items.push(
          action("favorites-full", `Favorites full (${maxFavorites})`, {
            secondary: true,
            disabled: true
          })
        );
      } else {
        items.push(action("add-to-favorites", "Add to favorites"));
      }

      if (isPinnedInActiveSpace) {
        items.push(action("unpin-from-sidebar", "Unpin from sidebar"));
      } else {
        items.push(action("pin-to-sidebar", "Pin to sidebar"));
      }

      items.push(separator());
    } else {
      items.push(
        action("pin-unavailable", "Pin unavailable for this page", {
          secondary: true,
          disabled: true
        })
      );
      items.push(
        action("favorites-unavailable", "Favorites unavailable for this page", {
          secondary: true,
          disabled: true
        })
      );
      items.push(separator());
    }

    items.push(action("toggle-tab-pin", tab?.pinned ? "Unpin tab" : "Pin tab"));
    items.push(action("toggle-tab-mute", tab?.muted ? "Unmute tab" : "Mute tab"));

    items.push(separator());

    items.push(action("duplicate-tab", "Duplicate tab"));
    items.push(action("close-other-tabs", "Close other tabs"));
    items.push(action("close-tab", "Close tab", { destructive: true }));

    items.push(separator());

    items.push(action("move-to-new-group", "Move to new group", { secondary: true }));

    if (tab?.groupId >= 0) {
      items.push(action("remove-from-group", "Remove from group", { secondary: true }));
    }

    for (const group of groups) {
      if (!Number.isInteger(group?.id) || group.id === tab?.groupId) {
        continue;
      }

      const groupName = group.title || "Unnamed group";
      items.push(
        action("move-to-group", `Move to group: ${groupName}`, {
          secondary: true,
          groupId: group.id
        })
      );
    }

    return items;
  }

  const api = {
    buildTabContextMenuModel
  };

  globalScope.BraveSidebarContextMenuModel = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
