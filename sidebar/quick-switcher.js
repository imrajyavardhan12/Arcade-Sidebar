(function bootstrapSidebarQuickSwitcher(globalScope) {
  function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function scoreValue(value, normalizedQuery) {
    if (!normalizedQuery) {
      return 0;
    }

    const normalizedValue = normalizeText(value);
    if (!normalizedValue) {
      return -1;
    }

    if (normalizedValue === normalizedQuery) {
      return 140;
    }

    if (normalizedValue.startsWith(normalizedQuery)) {
      return 120 - Math.min(30, normalizedValue.length / 8);
    }

    const index = normalizedValue.indexOf(normalizedQuery);
    if (index < 0) {
      return -1;
    }

    return 95 - Math.min(80, index) - Math.min(20, normalizedValue.length / 15);
  }

  function getTypeWeight(item) {
    switch (item?.type) {
      case "action":
        return 4;
      case "tab":
        return 2;
      case "favorite":
        return 1;
      case "pinned":
        return 1;
      default:
        return 0;
    }
  }

  function rankItems(items, query, limit = 40) {
    const sourceItems = Array.isArray(items) ? items : [];
    const normalizedQuery = normalizeText(query);
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 40;

    if (!normalizedQuery) {
      return sourceItems.slice(0, maxItems);
    }

    return sourceItems
      .map((item, index) => {
        const keywords = Array.isArray(item?.keywords) ? item.keywords : [];
        const bestScore = Math.max(
          scoreValue(item?.label, normalizedQuery),
          scoreValue(item?.subtitle, normalizedQuery),
          ...keywords.map((keyword) => scoreValue(keyword, normalizedQuery))
        );

        if (bestScore < 0) {
          return null;
        }

        return {
          item,
          index,
          score: bestScore + getTypeWeight(item)
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        const labelA = normalizeText(a.item?.label);
        const labelB = normalizeText(b.item?.label);
        if (labelA !== labelB) {
          return labelA.localeCompare(labelB);
        }

        return a.index - b.index;
      })
      .slice(0, maxItems)
      .map((entry) => entry.item);
  }

  const api = {
    normalizeText,
    rankItems
  };

  globalScope.BraveSidebarQuickSwitcher = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
