(function bootstrapSidebarSearch(globalScope) {
  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function tabMatches(tab, normalizedQuery) {
    if (!normalizedQuery) {
      return true;
    }

    const title = normalize(tab?.title);
    const url = normalize(tab?.url);
    return title.includes(normalizedQuery) || url.includes(normalizedQuery);
  }

  function filterTabs(tabs, query) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return Array.isArray(tabs) ? tabs.slice() : [];
    }

    return (Array.isArray(tabs) ? tabs : []).filter((tab) =>
      tabMatches(tab, normalizedQuery)
    );
  }

  globalScope.BraveSidebarSearch = {
    filterTabs,
    tabMatches
  };
})(globalThis);
