(function defineContextMenuActions(globalScope) {
  "use strict";

  async function executeTabAction(actionId, options) {
    const {
      tab,
      tabUrl,
      groupId,
      sendMessage,
      resolveTabForStorage,
      addTabToFavorites,
      removeFavoriteByUrl,
      pinTabInActiveSpace,
      unpinUrlInActiveSpace,
      MESSAGE_TYPES
    } = options;

    if (actionId === "remove-from-favorites") {
      await removeFavoriteByUrl(tabUrl);
      return { shouldRender: true };
    }

    if (actionId === "add-to-favorites") {
      const resolvedTab = await resolveTabForStorage(tab);
      await addTabToFavorites(resolvedTab);
      return { shouldRender: true };
    }

    if (actionId === "unpin-from-sidebar") {
      await unpinUrlInActiveSpace(tabUrl);
      return { shouldRender: true };
    }

    if (actionId === "pin-to-sidebar") {
      const resolvedTab = await resolveTabForStorage(tab);
      await pinTabInActiveSpace(resolvedTab);
      return { shouldRender: true };
    }

    if (actionId === "toggle-tab-pin") {
      await sendMessage({
        type: MESSAGE_TYPES.UPDATE_TAB,
        payload: {
          tabId: tab.id,
          update: { pinned: !tab.pinned }
        }
      });
      return { shouldRender: false };
    }

    if (actionId === "toggle-tab-mute") {
      await sendMessage({
        type: MESSAGE_TYPES.UPDATE_TAB,
        payload: {
          tabId: tab.id,
          update: { muted: !tab.muted }
        }
      });
      return { shouldRender: false };
    }

    if (actionId === "duplicate-tab") {
      await sendMessage({
        type: MESSAGE_TYPES.DUPLICATE_TAB,
        payload: { tabId: tab.id }
      });
      return { shouldRender: false };
    }

    if (actionId === "close-other-tabs") {
      await sendMessage({
        type: MESSAGE_TYPES.CLOSE_OTHER_TABS,
        payload: { tabId: tab.id }
      });
      return { shouldRender: false };
    }

    if (actionId === "close-tab") {
      await sendMessage({
        type: MESSAGE_TYPES.CLOSE_TAB,
        payload: { tabId: tab.id }
      });
      return { shouldRender: false };
    }

    if (actionId === "move-to-new-group") {
      await sendMessage({
        type: MESSAGE_TYPES.SET_TAB_GROUP,
        payload: {
          tabId: tab.id,
          createNew: true,
          title: "New Group"
        }
      });
      return { shouldRender: false };
    }

    if (actionId === "remove-from-group") {
      await sendMessage({
        type: MESSAGE_TYPES.SET_TAB_GROUP,
        payload: {
          tabId: tab.id,
          groupId: -1
        }
      });
      return { shouldRender: false };
    }

    if (actionId === "move-to-group" && Number.isInteger(groupId)) {
      await sendMessage({
        type: MESSAGE_TYPES.SET_TAB_GROUP,
        payload: {
          tabId: tab.id,
          groupId
        }
      });
      return { shouldRender: false };
    }

    return { shouldRender: false };
  }

  globalScope.BraveSidebarContextMenuActions = { executeTabAction };
})(globalThis);
