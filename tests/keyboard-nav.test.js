const test = require("node:test");
const assert = require("node:assert/strict");

const keyboardNav = require("../sidebar/keyboard-nav.js");

test("resolveFocusTabId prefers current focused tab when visible", () => {
  const focused = keyboardNav.resolveFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 22,
    activeTabId: 33
  });

  assert.equal(focused, 22);
});

test("resolveFocusTabId falls back to active tab then first tab", () => {
  const activeFallback = keyboardNav.resolveFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 99,
    activeTabId: 33
  });
  assert.equal(activeFallback, 33);

  const firstFallback = keyboardNav.resolveFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 99,
    activeTabId: 88
  });
  assert.equal(firstFallback, 11);
});

test("getNextFocusTabId moves by direction and clamps within bounds", () => {
  const down = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 22,
    direction: 1
  });
  assert.equal(down, 33);

  const downClamp = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 33,
    direction: 1
  });
  assert.equal(downClamp, 33);

  const up = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 22,
    direction: -1
  });
  assert.equal(up, 11);

  const upClamp = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: 11,
    direction: -1
  });
  assert.equal(upClamp, 11);
});

test("getNextFocusTabId fallback without current uses active or edge based on direction", () => {
  const withActive = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: null,
    activeTabId: 22,
    direction: 1
  });
  assert.equal(withActive, 22);

  const downEdge = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: null,
    activeTabId: null,
    direction: 1
  });
  assert.equal(downEdge, 11);

  const upEdge = keyboardNav.getNextFocusTabId({
    tabIds: [11, 22, 33],
    currentFocusedTabId: null,
    activeTabId: null,
    direction: -1
  });
  assert.equal(upEdge, 33);
});

test("getFocusAfterClose returns next tab, or previous when closing last", () => {
  const next = keyboardNav.getFocusAfterClose({
    tabIds: [11, 22, 33],
    closingTabId: 22,
    currentFocusedTabId: 22
  });
  assert.equal(next, 33);

  const previous = keyboardNav.getFocusAfterClose({
    tabIds: [11, 22, 33],
    closingTabId: 33,
    currentFocusedTabId: 33
  });
  assert.equal(previous, 22);
});

test("getFocusAfterClose returns null when one or zero tabs remain", () => {
  const one = keyboardNav.getFocusAfterClose({
    tabIds: [11],
    closingTabId: 11,
    currentFocusedTabId: 11
  });
  assert.equal(one, null);

  const none = keyboardNav.getFocusAfterClose({
    tabIds: [],
    closingTabId: null,
    currentFocusedTabId: null
  });
  assert.equal(none, null);
});
