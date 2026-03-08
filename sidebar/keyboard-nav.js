(function bootstrapSidebarKeyboardNav(globalScope) {
  function normalizeTabIds(tabIds) {
    return (Array.isArray(tabIds) ? tabIds : []).filter((tabId) => Number.isInteger(tabId));
  }

  function resolveFocusTabId(params = {}) {
    const tabIds = normalizeTabIds(params.tabIds);
    if (tabIds.length === 0) {
      return null;
    }

    if (Number.isInteger(params.currentFocusedTabId) && tabIds.includes(params.currentFocusedTabId)) {
      return params.currentFocusedTabId;
    }

    if (Number.isInteger(params.activeTabId) && tabIds.includes(params.activeTabId)) {
      return params.activeTabId;
    }

    return tabIds[0];
  }

  function getNextFocusTabId(params = {}) {
    const tabIds = normalizeTabIds(params.tabIds);
    if (tabIds.length === 0) {
      return null;
    }

    const direction = Number(params.direction) < 0 ? -1 : 1;
    const currentFocusedTabId = params.currentFocusedTabId;
    const hasCurrent = Number.isInteger(currentFocusedTabId) && tabIds.includes(currentFocusedTabId);

    if (!hasCurrent) {
      if (Number.isInteger(params.activeTabId) && tabIds.includes(params.activeTabId)) {
        return params.activeTabId;
      }

      return direction < 0 ? tabIds[tabIds.length - 1] : tabIds[0];
    }

    const currentIndex = tabIds.indexOf(currentFocusedTabId);
    const nextIndex = Math.min(tabIds.length - 1, Math.max(0, currentIndex + direction));
    return tabIds[nextIndex];
  }

  function getFocusAfterClose(params = {}) {
    const tabIds = normalizeTabIds(params.tabIds);
    if (tabIds.length <= 1) {
      return null;
    }

    const closingTabId = params.closingTabId;
    const currentFocusedTabId = params.currentFocusedTabId;
    const closeIndex = Number.isInteger(closingTabId) ? tabIds.indexOf(closingTabId) : -1;

    if (closeIndex < 0) {
      return resolveFocusTabId({
        tabIds,
        currentFocusedTabId,
        activeTabId: params.activeTabId
      });
    }

    if (closeIndex < tabIds.length - 1) {
      return tabIds[closeIndex + 1];
    }

    return tabIds[closeIndex - 1];
  }

  const api = {
    normalizeTabIds,
    resolveFocusTabId,
    getNextFocusTabId,
    getFocusAfterClose
  };

  globalScope.BraveSidebarKeyboardNav = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
