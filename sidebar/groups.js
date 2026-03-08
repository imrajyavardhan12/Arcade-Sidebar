(function bootstrapSidebarGroups(globalScope) {
  const EDGE_GROUP_COLORS = {
    grey: "#5F6368",
    blue: "#1A73E8",
    red: "#D93025",
    yellow: "#F9AB00",
    green: "#1E8E3E",
    pink: "#E52592",
    cyan: "#12B5CB",
    orange: "#FA903E",
    purple: "#A142F4"
  };

  function mapGroups(groups) {
    const result = new Map();
    for (const group of Array.isArray(groups) ? groups : []) {
      if (Number.isInteger(group?.id)) {
        result.set(group.id, group);
      }
    }
    return result;
  }

  function buildSections(tabs, groupsById) {
    const sortedTabs = (Array.isArray(tabs) ? tabs : [])
      .slice()
      .sort((a, b) => (a.index || 0) - (b.index || 0));

    const sections = [];

    for (const tab of sortedTabs) {
      const groupId = Number.isInteger(tab?.groupId) ? tab.groupId : -1;
      const hasGroup = groupId >= 0 && groupsById.has(groupId);
      const sectionKey = hasGroup ? `group:${groupId}` : "ungrouped";
      const previous = sections[sections.length - 1];

      if (!previous || previous.key !== sectionKey) {
        if (hasGroup) {
          sections.push({
            key: sectionKey,
            kind: "group",
            group: groupsById.get(groupId),
            tabs: []
          });
        } else {
          sections.push({
            key: `${sectionKey}:${sections.length}`,
            kind: "ungrouped",
            tabs: []
          });
        }
      }

      sections[sections.length - 1].tabs.push(tab);
    }

    return sections;
  }

  function getGroupColor(colorName) {
    return EDGE_GROUP_COLORS[colorName] || EDGE_GROUP_COLORS.grey;
  }

  globalScope.BraveSidebarGroups = {
    EDGE_GROUP_COLORS,
    mapGroups,
    buildSections,
    getGroupColor
  };
})(globalThis);
