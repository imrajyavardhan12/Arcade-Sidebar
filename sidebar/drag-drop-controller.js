(function bootstrapSidebarDragDropController(globalScope) {
  function createDragDropController(options = {}) {
    const dragStateModule = options.dragStateModule;
    const maxFavorites = Number.isInteger(options.maxFavorites) ? options.maxFavorites : 12;

    let pinnedDragContext = null;
    let favoriteDragContext = null;
    let draggingTabId = null;

    function hasPinnedDrag() {
      return Boolean(pinnedDragContext?.linkId);
    }

    function hasFavoriteDrag() {
      return Boolean(favoriteDragContext?.itemId);
    }

    function hasTabDrag() {
      return Number.isInteger(draggingTabId);
    }

    function beginPinnedDrag(linkId, fromFolderId = null) {
      pinnedDragContext = {
        linkId,
        fromFolderId: fromFolderId || null
      };
    }

    function endPinnedDrag() {
      pinnedDragContext = null;
    }

    function beginFavoriteDrag(itemId) {
      favoriteDragContext = { itemId };
    }

    function endFavoriteDrag() {
      favoriteDragContext = null;
    }

    function beginTabDrag(tabId) {
      draggingTabId = Number.isInteger(tabId) ? tabId : null;
    }

    function endTabDrag() {
      draggingTabId = null;
    }

    function getDraggingTabId() {
      return draggingTabId;
    }

    function consumeDraggingTabId() {
      const value = draggingTabId;
      draggingTabId = null;
      return value;
    }

    function resetAll() {
      pinnedDragContext = null;
      favoriteDragContext = null;
      draggingTabId = null;
    }

    function movePinnedLinkToFolder(params = {}) {
      if (!hasPinnedDrag() || !dragStateModule?.movePinnedLinkToFolder) {
        return { moved: false, reason: "noPinnedDrag", nodes: params.nodes || [] };
      }

      const transition = dragStateModule.movePinnedLinkToFolder({
        nodes: params.nodes,
        linkId: pinnedDragContext.linkId,
        fromFolderId: pinnedDragContext.fromFolderId || null,
        targetFolderId: params.targetFolderId
      });

      if (transition.moved || transition.reason === "duplicateInTarget") {
        endPinnedDrag();
      }

      return transition;
    }

    function movePinnedLinkToTopLevel(params = {}) {
      if (!hasPinnedDrag() || !dragStateModule?.movePinnedLinkToTopLevel) {
        return { moved: false, reason: "noPinnedDrag", nodes: params.nodes || [] };
      }

      const transition = dragStateModule.movePinnedLinkToTopLevel({
        nodes: params.nodes,
        linkId: pinnedDragContext.linkId,
        fromFolderId: pinnedDragContext.fromFolderId || null
      });

      if (
        transition.moved ||
        transition.reason === "noFromFolder" ||
        transition.reason === "noSourceFolder" ||
        transition.reason === "noSourceLink"
      ) {
        endPinnedDrag();
      }

      return transition;
    }

    function moveFavoriteToPinnedTopLevel(params = {}) {
      if (!hasFavoriteDrag() || !dragStateModule?.moveFavoriteToPinnedTopLevel) {
        return {
          moved: false,
          reason: "noFavoriteDrag",
          nodes: params.nodes || [],
          favorites: params.favorites || []
        };
      }

      const transition = dragStateModule.moveFavoriteToPinnedTopLevel({
        nodes: params.nodes,
        favorites: params.favorites,
        favoriteId: favoriteDragContext.itemId,
        createPinnedId: params.createPinnedId
      });

      if (transition.moved || transition.reason === "noFavorite") {
        endFavoriteDrag();
      }

      return transition;
    }

    function moveFavoriteToFolder(params = {}) {
      if (!hasFavoriteDrag() || !dragStateModule?.moveFavoriteToFolder) {
        return {
          moved: false,
          reason: "noFavoriteDrag",
          nodes: params.nodes || [],
          favorites: params.favorites || []
        };
      }

      const transition = dragStateModule.moveFavoriteToFolder({
        nodes: params.nodes,
        favorites: params.favorites,
        favoriteId: favoriteDragContext.itemId,
        targetFolderId: params.targetFolderId,
        createPinnedId: params.createPinnedId
      });

      if (transition.moved || transition.reason === "noFavorite") {
        endFavoriteDrag();
      }

      return transition;
    }

    function movePinnedLinkToFavorites(params = {}) {
      if (!hasPinnedDrag() || !dragStateModule?.movePinnedLinkToFavorites) {
        return {
          moved: false,
          reason: "noPinnedDrag",
          nodes: params.nodes || [],
          favorites: params.favorites || []
        };
      }

      const transition = dragStateModule.movePinnedLinkToFavorites({
        nodes: params.nodes,
        favorites: params.favorites,
        linkId: pinnedDragContext.linkId,
        maxFavorites,
        createFavoriteId: params.createFavoriteId
      });

      endPinnedDrag();
      return transition;
    }

    function movePinnedLinkToToday(params = {}) {
      if (!hasPinnedDrag() || !dragStateModule?.movePinnedLinkToToday) {
        return { moved: false, reason: "noPinnedDrag", nodes: params.nodes || [] };
      }

      const transition = dragStateModule.movePinnedLinkToToday({
        nodes: params.nodes,
        linkId: pinnedDragContext.linkId
      });

      endPinnedDrag();
      return transition;
    }

    function moveFavoriteToToday(params = {}) {
      if (!hasFavoriteDrag() || !dragStateModule?.moveFavoriteToToday) {
        return {
          moved: false,
          reason: "noFavoriteDrag",
          favorites: params.favorites || []
        };
      }

      const transition = dragStateModule.moveFavoriteToToday({
        favorites: params.favorites,
        favoriteId: favoriteDragContext.itemId
      });

      endFavoriteDrag();
      return transition;
    }

    return {
      hasPinnedDrag,
      hasFavoriteDrag,
      hasTabDrag,
      beginPinnedDrag,
      endPinnedDrag,
      beginFavoriteDrag,
      endFavoriteDrag,
      beginTabDrag,
      endTabDrag,
      getDraggingTabId,
      consumeDraggingTabId,
      resetAll,
      movePinnedLinkToFolder,
      movePinnedLinkToTopLevel,
      moveFavoriteToPinnedTopLevel,
      moveFavoriteToFolder,
      movePinnedLinkToFavorites,
      movePinnedLinkToToday,
      moveFavoriteToToday
    };
  }

  const api = {
    createDragDropController
  };

  globalScope.BraveSidebarDragDropController = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
