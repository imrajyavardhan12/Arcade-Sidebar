(function bootstrapSidebarContent(globalScope) {
  "use strict";

  if (globalScope.top !== globalScope.self) {
    return;
  }

  if (globalScope.__BRAVE_TAB_SIDEBAR_LOADED__) {
    return;
  }
  globalScope.__BRAVE_TAB_SIDEBAR_LOADED__ = true;

  // ─── Load all sidebar modules ────────────────────────────────────────────
  // Modules are registered on globalThis by their IIFE wrappers.
  // The script tags in manifest.json load these before content.js.
  const searchModule = globalScope.BraveSidebarSearch;
  const groupsModule = globalScope.BraveSidebarGroups;
  const tabsModule = globalScope.BraveSidebarTabs;
  const sidebarDataModule = globalScope.BraveSidebarData;
  const dragStateModule = globalScope.BraveSidebarDragState;
  const dragDropControllerModule = globalScope.BraveSidebarDragDropController;
  const keyboardNavModule = globalScope.BraveSidebarKeyboardNav;
  const renderPerfModule = globalScope.BraveSidebarRenderPerf;
  const contextMenuModelModule = globalScope.BraveSidebarContextMenuModel;
  const commandPaletteDataModule = globalScope.BraveSidebarCommandPaletteData;
  const quickSwitcherModule = globalScope.BraveSidebarQuickSwitcher;
  const messagesModule = globalScope.BraveSidebarMessages;
  const runtimeClientModule = globalScope.BraveSidebarRuntimeClient;
  const arcModelModule = globalScope.BraveSidebarArcModel;
  const contextMenuActionsModule = globalScope.BraveSidebarContextMenuActions;
  const layoutControllerModule = globalScope.BraveSidebarLayoutController;
  const interactionControllerModule = globalScope.BraveSidebarInteractionController;

  if (
    !searchModule ||
    !groupsModule ||
    !tabsModule ||
    !sidebarDataModule ||
    !dragStateModule ||
    !dragDropControllerModule ||
    !keyboardNavModule ||
    !renderPerfModule ||
    !contextMenuModelModule ||
    !commandPaletteDataModule ||
    !quickSwitcherModule ||
    !runtimeClientModule ||
    !arcModelModule ||
    !contextMenuActionsModule ||
    !layoutControllerModule ||
    !interactionControllerModule ||
    !globalScope.BraveSidebarApp
  ) {
    return;
  }

  // ─── Bootstrap SidebarApp kernel ────────────────────────────────────────
  // All application state, message routing, storage listeners, and DOM wiring
  // are encapsulated inside the SidebarApp instance.
  const sidebarApp = globalScope.BraveSidebarApp.create({
    chromeApi: chrome,
    globalScope,
    modules: {
      searchModule,
      groupsModule,
      tabsModule,
      sidebarDataModule,
      dragStateModule,
      dragDropControllerModule,
      keyboardNavModule,
      renderPerfModule,
      contextMenuModelModule,
      commandPaletteDataModule,
      quickSwitcherModule,
      messagesModule,
      runtimeClientModule,
      arcModelModule,
      contextMenuActionsModule,
      layoutControllerModule,
      interactionControllerModule
    }
  });

  // Expose on globalThis for debugging / external access
  globalScope.__BRAVE_SIDEBAR_APP__ = sidebarApp;
})(globalThis);
