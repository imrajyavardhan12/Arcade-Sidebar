(function bootstrapSidebarTabs(globalScope) {
  const CLOSE_ANIMATION_MS = 160;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const TAB_ICON_PATHS = Object.freeze({
    speaker: [
      { tag: "path", attrs: { d: "M4.75 11.5H7.25L10.5 14V6L7.25 8.5H4.75Z" } },
      { tag: "path", attrs: { d: "M12.7 8.2a3.1 3.1 0 0 1 0 3.6" } },
      { tag: "path", attrs: { d: "M14.6 6.4a5.6 5.6 0 0 1 0 7.2" } }
    ],
    speakerOff: [
      { tag: "path", attrs: { d: "M4.75 11.5H7.25L10.5 14V6L7.25 8.5H4.75Z" } },
      { tag: "path", attrs: { d: "M13 8 16 11" } },
      { tag: "path", attrs: { d: "M16 8 13 11" } }
    ],
    pin: [
      { tag: "path", attrs: { d: "M6.75 6.25h6.5" } },
      { tag: "path", attrs: { d: "M8 6.25v3.2l-1.8 2.3h7.6L12 9.45v-3.2" } },
      { tag: "path", attrs: { d: "M10 11.75v4" } }
    ],
    loading: [
      { tag: "circle", attrs: { cx: "10", cy: "10", r: "5.1", "stroke-opacity": "0.24" } },
      { tag: "path", attrs: { d: "M10 4.9a5.1 5.1 0 0 1 5.1 5.1" } }
    ],
    attention: [{ tag: "circle", attrs: { cx: "10", cy: "10", r: "3.1", fill: "currentColor", stroke: "none" } }],
    chevronDown: [{ tag: "path", attrs: { d: "M4.75 7.5 10 12.75 15.25 7.5" } }],
    close: [
      { tag: "path", attrs: { d: "M5.5 5.5 14.5 14.5" } },
      { tag: "path", attrs: { d: "M14.5 5.5 5.5 14.5" } }
    ]
  });

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

  function createIcon(name, className = "bts-icon") {
    const iconDef = TAB_ICON_PATHS[name];
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);

    if (!iconDef) {
      return svg;
    }

    for (const definition of iconDef) {
      const part = document.createElementNS(SVG_NAMESPACE, definition.tag);
      for (const [key, value] of Object.entries(definition.attrs || {})) {
        part.setAttribute(key, value);
      }
      svg.append(part);
    }

    return svg;
  }

  function getStatusIcon(tab) {
    if (tab?.audible && !tab?.muted) {
      return "speaker";
    }
    if (tab?.muted) {
      return "speakerOff";
    }
    if (tab?.pinned) {
      return "pin";
    }
    if (tab?.status === "loading") {
      return "loading";
    }
    if (tab?.attention) {
      return "attention";
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

  function createTabRow(tab, activeTabId, focusedTabId, handlers, enteringTabIds) {
    const row = createEl("div", "bts-tab-row");
    row.dataset.tabId = String(tab.id);
    row.title = tab?.title || tab?.url || "Tab";
    row.tabIndex = tab?.id === focusedTabId ? 0 : -1;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", tab?.title || tab?.url || "Tab");
    if (tab?.id === activeTabId) {
      row.classList.add("is-active");
      row.setAttribute("aria-current", "page");
    }
    if (enteringTabIds?.has(tab.id)) {
      row.classList.add("is-entering");
    }

    const favicon = createFavicon(tab);
    const title = createEl("span", "bts-tab-title", tab?.title || "Untitled tab");
    const statusIconValue = getStatusIcon(tab);
    const status = createEl("span", "bts-tab-status");
    if (statusIconValue) {
      status.dataset.state = statusIconValue;
      status.append(
        createIcon(
          statusIconValue,
          `bts-icon bts-tab-status-icon${statusIconValue === "loading" ? " is-spinning" : ""}`
        )
      );
    }

    const closeButton = createEl("button", "bts-tab-close");
    closeButton.type = "button";
    closeButton.title = "Close tab";
    closeButton.setAttribute("aria-label", "Close tab");
    closeButton.append(createIcon("close"));

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
      handlers.onFocus?.(tab.id);
      handlers.onActivate?.(tab.id);
    });

    row.addEventListener("focus", () => {
      handlers.onFocus?.(tab.id);
    });

    row.draggable = true;
    row.addEventListener("dragstart", (event) => {
      handlers.onFocus?.(tab.id);
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
      handlers.onFocus?.(tab.id);
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

    const chevron = createEl("span", "bts-group-chevron");
    chevron.append(createIcon("chevronDown"));
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
      focusedTabId,
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
      const row = createTabRow(tab, activeTabId, focusedTabId, handlers, enteringTabIds);
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
      focusedTabId,
      collapsedGroupIds,
      isSearching,
      enteringTabIds,
      handlers,
      groupUtils
    } = options;

    if (!container) {
      return;
    }

    container.setAttribute("role", "list");
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
          focusedTabId,
          enteringTabIds,
          allowCollapse: !isSearching
        });
        fragment.append(groupSection);
      } else {
        for (const tab of section.tabs) {
          const row = createTabRow(tab, activeTabId, focusedTabId, handlers, enteringTabIds);
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
