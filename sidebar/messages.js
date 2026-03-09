(function bootstrapSidebarMessages(globalScope) {
  const MESSAGE_TYPES = Object.freeze({
    GET_STATE: "sidebar:getState",
    GET_TAB: "sidebar:getTab",
    SET_WINDOW_OPEN: "sidebar:setWindowOpen",
    ACTIVATE_TAB: "sidebar:activateTab",
    CLOSE_TAB: "sidebar:closeTab",
    CREATE_TAB: "sidebar:createTab",
    MOVE_TAB: "sidebar:moveTab",
    UPDATE_TAB: "sidebar:updateTab",
    DUPLICATE_TAB: "sidebar:duplicateTab",
    CLOSE_OTHER_TABS: "sidebar:closeOtherTabs",
    SET_TAB_GROUP: "sidebar:setTabGroup",
    PING: "sidebar:ping",
    STATE: "sidebar:state",
    SET_OPEN: "sidebar:setOpen",
    TOGGLE_COMMAND_PALETTE: "sidebar:toggleCommandPalette"
  });

  const MESSAGE_TYPE_VALUES = new Set(Object.values(MESSAGE_TYPES));

  function isRecord(value) {
    return Boolean(value) && typeof value === "object";
  }

  function isIntegerOrUndefined(value) {
    return value === undefined || value === null || Number.isInteger(value);
  }

  function ok() {
    return { ok: true };
  }

  function invalid(error) {
    return {
      ok: false,
      error
    };
  }

  function validatePayload(type, payload) {
    const value = isRecord(payload) ? payload : {};

    if (type === MESSAGE_TYPES.GET_STATE) {
      return isIntegerOrUndefined(value.windowId) ? ok() : invalid("INVALID_WINDOW_ID");
    }

    if (type === MESSAGE_TYPES.GET_TAB) {
      return Number.isInteger(value.tabId) ? ok() : invalid("INVALID_TAB_ID");
    }

    if (type === MESSAGE_TYPES.SET_WINDOW_OPEN) {
      if (!isIntegerOrUndefined(value.windowId)) {
        return invalid("INVALID_WINDOW_ID");
      }
      return typeof value.open === "boolean" ? ok() : invalid("INVALID_OPEN");
    }

    if (
      type === MESSAGE_TYPES.ACTIVATE_TAB ||
      type === MESSAGE_TYPES.CLOSE_TAB ||
      type === MESSAGE_TYPES.DUPLICATE_TAB ||
      type === MESSAGE_TYPES.CLOSE_OTHER_TABS
    ) {
      return Number.isInteger(value.tabId) ? ok() : invalid("INVALID_TAB_ID");
    }

    if (type === MESSAGE_TYPES.CREATE_TAB) {
      if (!isIntegerOrUndefined(value.windowId)) {
        return invalid("INVALID_WINDOW_ID");
      }

      if (value.url !== undefined && typeof value.url !== "string") {
        return invalid("INVALID_URL");
      }

      return ok();
    }

    if (type === MESSAGE_TYPES.MOVE_TAB) {
      if (!Number.isInteger(value.tabId)) {
        return invalid("INVALID_TAB_ID");
      }
      return Number.isInteger(value.index) ? ok() : invalid("INVALID_INDEX");
    }

    if (type === MESSAGE_TYPES.UPDATE_TAB) {
      if (!Number.isInteger(value.tabId)) {
        return invalid("INVALID_TAB_ID");
      }
      return isRecord(value.update) ? ok() : invalid("INVALID_UPDATE");
    }

    if (type === MESSAGE_TYPES.SET_TAB_GROUP) {
      if (!Number.isInteger(value.tabId)) {
        return invalid("INVALID_TAB_ID");
      }

      if (value.createNew === true) {
        if (value.title !== undefined && typeof value.title !== "string") {
          return invalid("INVALID_TITLE");
        }
        return ok();
      }

      if (value.groupId === null || value.groupId === -1 || Number.isInteger(value.groupId)) {
        return ok();
      }

      return invalid("INVALID_GROUP_ID");
    }

    if (type === MESSAGE_TYPES.PING) {
      return ok();
    }

    if (type === MESSAGE_TYPES.STATE) {
      if (!Number.isInteger(value.windowId)) {
        return invalid("INVALID_WINDOW_ID");
      }

      if (!Array.isArray(value.tabs)) {
        return invalid("INVALID_TABS");
      }

      if (!Array.isArray(value.groups)) {
        return invalid("INVALID_GROUPS");
      }

      return ok();
    }

    if (type === MESSAGE_TYPES.SET_OPEN || type === MESSAGE_TYPES.TOGGLE_COMMAND_PALETTE) {
      if (!isIntegerOrUndefined(value.windowId)) {
        return invalid("INVALID_WINDOW_ID");
      }

      if (type === MESSAGE_TYPES.SET_OPEN && typeof value.open !== "boolean") {
        return invalid("INVALID_OPEN");
      }

      return ok();
    }

    return invalid("UNKNOWN_MESSAGE_TYPE");
  }

  function isKnownMessageType(type) {
    return MESSAGE_TYPE_VALUES.has(type);
  }

  const api = {
    MESSAGE_TYPES,
    isKnownMessageType,
    validatePayload
  };

  globalScope.BraveSidebarMessages = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
