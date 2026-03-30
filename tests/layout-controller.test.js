const test = require("node:test");
const assert = require("node:assert/strict");

const { createSidebarLayoutController } = require("../sidebar/layout-controller.js");

function createClassList() {
  const values = new Set();
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    toggle(name, force) {
      if (force === true) {
        values.add(name);
        return true;
      }
      if (force === false) {
        values.delete(name);
        return false;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    },
    contains(name) {
      return values.has(name);
    }
  };
}

function createStyleTarget() {
  return {
    setProperty(name, value) {
      this[name] = value;
    },
    removeProperty(name) {
      delete this[name];
    }
  };
}

function createEventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener, options = {}) {
      const current = listeners.get(type) || [];
      current.push({
        listener,
        once: Boolean(options?.once)
      });
      listeners.set(type, current);
    },
    removeEventListener(type, listener) {
      const current = listeners.get(type) || [];
      listeners.set(
        type,
        current.filter((entry) => entry.listener !== listener)
      );
    },
    dispatchEvent(type, event = {}) {
      const current = (listeners.get(type) || []).slice();
      for (const entry of current) {
        entry.listener(event);
        if (entry.once) {
          this.removeEventListener(type, entry.listener);
        }
      }
    }
  };
}

function createElementStub(tagName) {
  const eventTarget = createEventTarget();
  return {
    ...eventTarget,
    tagName: String(tagName || "").toUpperCase(),
    id: "",
    textContent: "",
    style: createStyleTarget(),
    classList: createClassList(),
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    appendChild(_child) {},
    getBoundingClientRect() {
      return { width: 0, height: 0 };
    }
  };
}

function createDocumentStub() {
  const registry = new Map();
  const eventTarget = createEventTarget();

  function registerNode(node) {
    if (node?.id) {
      registry.set(node.id, node);
    }
    return node;
  }

  const documentElement = createElementStub("html");
  const head = createElementStub("head");

  documentElement.appendChild = registerNode;
  head.appendChild = registerNode;

  return {
    ...eventTarget,
    head,
    documentElement,
    createElement(tagName) {
      return createElementStub(tagName);
    },
    getElementById(id) {
      return registry.get(id) || null;
    }
  };
}

function createHarness(input = "example.com") {
  const options =
    typeof input === "string" ? { hostname: input } : { ...(input || {}) };
  const hostname = options.hostname || "example.com";
  const document = createDocumentStub();
  const sidebarEl = createElementStub("aside");
  const overlayEl = createElementStub("button");
  const hoverZoneEl = createElementStub("div");
  const toggleButton = createElementStub("button");
  const commandPaletteEl = createElementStub("div");
  const resizeHandle = createElementStub("div");
  const persistCalls = [];
  const broadcastCalls = [];
  const closeCalls = [];
  const stateChanges = [];

  resizeHandle.setPointerCapture = () => {};

  const globalScope = {
    document,
    location: { hostname },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    getComputedStyle(element) {
      return {
        transform: element?.style?.transform || "none"
      };
    }
  };

  const controller = createSidebarLayoutController({
    globalScope,
    document,
    sidebarEl,
    overlayEl,
    hoverZoneEl,
    toggleButton,
    commandPaletteEl,
    resizeHandle,
    defaultWidth: 320,
    minWidth: 240,
    maxWidth: 480,
    hoverCloseDelayMs: Number.isFinite(options.hoverCloseDelayMs)
      ? options.hoverCloseDelayMs
      : 260,
    onPersistState() {
      persistCalls.push(controller.getState());
    },
    onBroadcastOpenState() {
      broadcastCalls.push(controller.getState());
    },
    onClose() {
      closeCalls.push(controller.getState());
    },
    onStateChange(nextState) {
      stateChanges.push(nextState);
    }
  });

  return {
    broadcastCalls,
    closeCalls,
    commandPaletteEl,
    controller,
    document,
    hoverZoneEl,
    overlayEl,
    persistCalls,
    resizeHandle,
    sidebarEl,
    stateChanges,
    toggleButton
  };
}

test("layout controller clamps width and applies a regular-page open state", () => {
  const harness = createHarness("docs.example.com");

  harness.controller.setSidebarWidth(999, { persist: false });
  assert.equal(harness.controller.getSidebarWidth(), 480);
  assert.equal(harness.sidebarEl.style.width, "480px");
  assert.equal(harness.commandPaletteEl.style["--bts-sidebar-width"], "480px");

  harness.controller.setOpen(true, { persist: true, broadcast: true, animate: false });

  assert.equal(harness.document.documentElement.style.marginLeft, "480px");
  assert.equal(harness.sidebarEl.style.transform, "translateX(0)");
  assert.equal(harness.sidebarEl.classList.contains("is-open"), true);
  assert.equal(harness.overlayEl.classList.contains("is-open"), true);
  assert.equal(harness.toggleButton.title, "Hide sidebar");
  assert.equal(harness.toggleButton.attributes["aria-label"], "Hide sidebar");
  assert.equal(harness.persistCalls.length, 1);
  assert.equal(harness.broadcastCalls.length, 1);
});

test("layout controller applies YouTube-specific page shifting and clears it on close", () => {
  const harness = createHarness("www.youtube.com");

  harness.controller.setOpen(true, { persist: false, broadcast: false, animate: false });

  assert.equal(harness.document.documentElement.style.marginLeft, "0px");
  assert.equal(
    harness.document.documentElement.style["--bts-page-offset"],
    "320px"
  );

  const shiftStyle = harness.document.getElementById("bts-fixed-shift");
  assert.ok(shiftStyle);
  assert.match(shiftStyle.textContent, /ytd-app/);

  harness.controller.setOpen(false, { persist: false, broadcast: false, animate: false });

  assert.equal(
    harness.document.documentElement.style["--bts-page-offset"],
    undefined
  );
  assert.equal(shiftStyle.textContent, "");
  assert.equal(harness.closeCalls.length, 1);
});

test("layout controller honors explicit layout adapter override", () => {
  const harness = createHarness("docs.example.com");
  harness.document.documentElement.setAttribute("data-bts-layout-adapter", "youtube");

  harness.controller.setOpen(true, { persist: false, broadcast: false, animate: false });

  assert.equal(harness.document.documentElement.style.marginLeft, "0px");
  assert.equal(
    harness.document.documentElement.style["--bts-page-offset"],
    "320px"
  );

  const shiftStyle = harness.document.getElementById("bts-fixed-shift");
  assert.ok(shiftStyle);
  assert.match(shiftStyle.textContent, /ytd-app/);
});

test("layout controller completes animated transitions when transform ends", () => {
  const harness = createHarness("example.com");

  harness.controller.setOpen(true, { persist: false, broadcast: false, animate: true });
  assert.equal(harness.controller.getAnimationState(), "opening");
  assert.equal(harness.sidebarEl.style.willChange, "transform");

  harness.controller.handleTransitionEnd({ propertyName: "transform" });

  assert.equal(harness.controller.getAnimationState(), "open");
  assert.equal(harness.sidebarEl.style.willChange, "auto");
});

test("layout controller binds resize interactions and persists on pointer up", () => {
  const harness = createHarness("example.com");

  harness.controller.bindResizeHandle();
  const pointerDown = harness.resizeHandle.listeners.get("pointerdown");
  assert.equal(pointerDown.length, 1);

  pointerDown[0].listener({
    clientX: 100,
    pointerId: 1,
    preventDefault() {}
  });

  harness.document.dispatchEvent("pointermove", { clientX: 180 });
  assert.equal(harness.controller.getSidebarWidth(), 400);
  assert.equal(harness.persistCalls.length, 0);

  harness.document.dispatchEvent("pointerup", {});
  assert.equal(harness.persistCalls.length, 1);
  assert.equal(harness.resizeHandle.classList.contains("is-dragging"), false);
});

test("layout controller toggles pinned-open mode and updates hover classes", () => {
  const harness = createHarness("example.com");

  assert.equal(harness.controller.isPinnedOpen(), true);
  assert.equal(harness.sidebarEl.classList.contains("is-pinned-open"), true);
  assert.equal(harness.overlayEl.classList.contains("is-hover-mode"), false);
  assert.equal(harness.hoverZoneEl.classList.contains("is-enabled"), false);

  harness.controller.setPinnedOpen(false, {
    persist: true,
    broadcast: true,
    animate: false
  });

  assert.equal(harness.controller.isPinnedOpen(), false);
  assert.equal(harness.sidebarEl.classList.contains("is-pinned-open"), false);
  assert.equal(harness.overlayEl.classList.contains("is-hover-mode"), true);
  assert.equal(harness.hoverZoneEl.classList.contains("is-enabled"), true);
  assert.equal(harness.controller.isOpen(), false);
  assert.equal(harness.persistCalls.length > 0, true);
  assert.equal(harness.broadcastCalls.length > 0, true);

  harness.controller.setPinnedOpen(true, {
    persist: true,
    broadcast: false,
    animate: false
  });

  assert.equal(harness.controller.isPinnedOpen(), true);
  assert.equal(harness.controller.isOpen(), true);
  assert.equal(harness.overlayEl.classList.contains("is-hover-mode"), false);
  assert.equal(harness.hoverZoneEl.classList.contains("is-enabled"), false);
});

test("layout controller hover mode opens from edge hover and auto-closes on mouse leave", async () => {
  const harness = createHarness({
    hostname: "example.com",
    hoverCloseDelayMs: 5
  });

  harness.controller.setPinnedOpen(false, {
    persist: false,
    broadcast: false,
    animate: false
  });
  harness.controller.bindHoverInteractions();

  harness.hoverZoneEl.dispatchEvent("mouseenter");
  assert.equal(harness.controller.isOpen(), true);

  harness.sidebarEl.dispatchEvent("mouseleave", { relatedTarget: null });
  await new Promise((resolve) => setTimeout(resolve, 15));

  assert.equal(harness.controller.isOpen(), false);
});
