(function bootstrapSidebarTabs(globalScope) {
  const CLOSE_ANIMATION_MS = 160;

  function isSafeImageSource(src) {
    const value = String(src || "").trim();
    if (!value) {
      return false;
    }
    return /^(data:|blob:|chrome-extension:)/i.test(value);
  }

  function createEl(tagName, className, textContent) {
    const el = document.createElement(tagName);
    if (className) {
      el.className = className;
    }
    if (typeof textContent === "string") {
      el.textContent = textContent;
    }
    return el;
  }

  function getStatusIcon(tab) {
    if (tab?.audible && !tab?.muted) {
      return "🔊";
    }
    if (tab?.muted) {
      return "🔇";
    }
    if (tab?.pinned) {
      return "📌";
    }
    if (tab?.status === "loading") {
      return "⏳";
    }
    if (tab?.attention) {
      return "●";
    }
    return "";
  }

  function createFavicon(tab) {
    const favicon = createEl("img", "bts-tab-favicon");
    favicon.alt = "";
    favicon.decoding = "async";
    favicon.loading = "lazy";

    const src = tab?.favIconUrl;
    if (isSafeImageSource(src)) {
      favicon.src = src;
    } else {
      favicon.classList.add("is-fallback");
    }

    favicon.addEventListener("error", () => {
      favicon.removeAttribute("src");
      favicon.classList.add("is-fallback");
    });

    return favicon;
  }

  function createTabRow(tab, activeTabId, handlers, enteringTabIds) {
    const row = createEl("div", "bts-tab-row");
    row.dataset.tabId = String(tab.id);
    row.title = tab?.title || tab?.url || "Tab";
    if (tab?.id === activeTabId) {
      row.classList.add("is-active");
    }
    if (enteringTabIds?.has(tab.id)) {
      row.classList.add("is-entering");
    }

    const favicon = createFavicon(tab);
    const title = createEl("span", "bts-tab-title", tab?.title || "Untitled tab");
    const statusIconValue = getStatusIcon(tab);
    const status = createEl("span", "bts-tab-status", statusIconValue);

    const closeButton = createEl("button", "bts-tab-close", "×");
    closeButton.type = "button";
    closeButton.title = "Close tab";
    closeButton.setAttribute("aria-label", "Close tab");

    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (row.classList.contains("is-closing")) {
        return;
      }
      row.classList.add("is-closing");
      setTimeout(() => {
        handlers.onClose?.(tab.id);
      }, CLOSE_ANIMATION_MS);
    });

    row.addEventListener("click", () => {
      handlers.onActivate?.(tab.id);
    });

    row.draggable = true;
    row.addEventListener("dragstart", (event) => {
      handlers.onDragStart?.(tab.id);
      row.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(tab.id));
      }
    });

    row.addEventListener("dragover", (event) => {
      const draggingId = handlers.getDraggingTabId?.();
      if (!Number.isInteger(draggingId) || draggingId === tab.id) {
        return;
      }
      event.preventDefault();
      row.classList.add("is-drop-target");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("is-drop-target");
    });

    row.addEventListener("drop", (event) => {
      const draggingId = handlers.getDraggingTabId?.();
      if (!Number.isInteger(draggingId) || draggingId === tab.id) {
        return;
      }
      event.preventDefault();
      row.classList.remove("is-drop-target");
      handlers.onDrop?.(draggingId, tab.id);
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      row.classList.remove("is-drop-target");
      handlers.onDragEnd?.();
    });

    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onContextMenu?.({
        tab,
        x: event.clientX,
        y: event.clientY
      });
    });

    row.append(favicon, title, status, closeButton);
    return row;
  }

  function createGroupHeader(section, collapsed, handlers, colorHex) {
    const header = createEl("button", "bts-group-header");
    header.type = "button";
    header.dataset.groupId = String(section.group.id);
    if (collapsed) {
      header.classList.add("is-collapsed");
    }

    const chevron = createEl("span", "bts-group-chevron", "▾");
    const colorDot = createEl("span", "bts-group-color");
    colorDot.style.backgroundColor = colorHex;
    const name = createEl("span", "bts-group-name", section.group.title || "Unnamed group");
    const count = createEl("span", "bts-group-count", String(section.tabs.length));

    header.append(chevron, colorDot, name, count);
    return header;
  }

  function createGroupSection(section, options) {
    const {
      collapsed,
      handlers,
      colorHex,
      activeTabId,
      enteringTabIds,
      allowCollapse
    } = options;

    const sectionEl = createEl("section", "bts-group-section");
    if (collapsed) {
      sectionEl.classList.add("is-collapsed");
    }

    const header = createGroupHeader(section, collapsed, handlers, colorHex);
    const body = createEl("div", "bts-group-body");

    for (const tab of section.tabs) {
      const row = createTabRow(tab, activeTabId, handlers, enteringTabIds);
      body.append(row);
    }

    header.addEventListener("click", () => {
      if (!allowCollapse) {
        return;
      }
      const nextCollapsed = !sectionEl.classList.contains("is-collapsed");
      sectionEl.classList.toggle("is-collapsed", nextCollapsed);
      header.classList.toggle("is-collapsed", nextCollapsed);
      handlers.onToggleGroup?.(section.group.id, nextCollapsed);
    });

    sectionEl.append(header, body);
    return sectionEl;
  }

  function renderTabList(options) {
    const {
      container,
      tabs,
      groups,
      activeTabId,
      collapsedGroupIds,
      isSearching,
      enteringTabIds,
      handlers,
      groupUtils
    } = options;

    if (!container) {
      return;
    }

    container.replaceChildren();
    if (!tabs?.length) {
      const empty = createEl("div", "bts-empty-state", "No tabs match this view.");
      container.append(empty);
      return;
    }

    const groupsById = groupUtils.mapGroups(groups);
    const sections = groupUtils.buildSections(tabs, groupsById);
    const fragment = document.createDocumentFragment();

    for (const section of sections) {
      if (section.kind === "group") {
        const groupId = section.group.id;
        const collapsed = collapsedGroupIds.has(groupId) && !isSearching;
        const colorHex = groupUtils.getGroupColor(section.group.color);
        const groupSection = createGroupSection(section, {
          collapsed,
          handlers,
          colorHex,
          activeTabId,
          enteringTabIds,
          allowCollapse: !isSearching
        });
        fragment.append(groupSection);
      } else {
        for (const tab of section.tabs) {
          const row = createTabRow(tab, activeTabId, handlers, enteringTabIds);
          fragment.append(row);
        }
      }
    }

    container.append(fragment);
  }

  globalScope.BraveSidebarTabs = {
    renderTabList
  };
})(globalThis);
