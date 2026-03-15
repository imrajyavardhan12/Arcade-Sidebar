const { expect, test } = require("./extension-fixture.js");

const TOGGLE_COMMAND_PALETTE = "sidebar:toggleCommandPalette";
const SHADOW_HOST_SELECTOR = "#brave-tab-sidebar-host";

function shortcutForPlatform() {
  return process.platform === "darwin" ? "Meta+K" : "Control+K";
}

async function waitForSidebarInjected(page) {
  await expect(page.locator("#brave-tab-sidebar-host")).toHaveCount(1);
  await expect(page.locator("#brave-tab-sidebar-host .bts-sidebar")).toHaveClass(/is-open/);
}

async function expectPageOffset(page, expectedMarginLeft) {
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).marginLeft)
    )
    .toBe(expectedMarginLeft);
}

async function expectSidebarOpenState(page, isOpen) {
  const expected = isOpen ? /is-open/ : /^bts-sidebar$/;
  await expect(page.locator("#brave-tab-sidebar-host .bts-sidebar")).toHaveClass(expected);
}

async function dispatchDragAndDrop(page, sourceSelector, targetSelector) {
  await page.evaluate(
    ({ hostSelector, sourceSelectorValue, targetSelectorValue }) => {
      const host = document.querySelector(hostSelector);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) {
        throw new Error("MISSING_SHADOW_ROOT");
      }

      const source = shadowRoot.querySelector(sourceSelectorValue);
      const target = shadowRoot.querySelector(targetSelectorValue);
      if (!source) {
        throw new Error(`MISSING_SOURCE:${sourceSelectorValue}`);
      }
      if (!target) {
        throw new Error(`MISSING_TARGET:${targetSelectorValue}`);
      }

      const dataTransfer = new DataTransfer();
      const events = [
        { target: source, type: "dragstart" },
        { target, type: "dragenter" },
        { target, type: "dragover" },
        { target, type: "drop" },
        { target: source, type: "dragend" }
      ];

      for (const entry of events) {
        entry.target.dispatchEvent(
          new DragEvent(entry.type, {
            bubbles: true,
            cancelable: true,
            dataTransfer
          })
        );
      }
    },
    {
      hostSelector: SHADOW_HOST_SELECTOR,
      sourceSelectorValue: sourceSelector,
      targetSelectorValue: targetSelector
    }
  );
}

async function createBackgroundTab(serviceWorker, targetUrl, options = {}) {
  await serviceWorker.evaluate(
    async ({ targetUrlValue, active }) => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.windowId) {
        throw new Error("NO_ACTIVE_WINDOW");
      }

      const created = await chrome.tabs.create({
        windowId: tab.windowId,
        url: targetUrlValue,
        active
      });

      const startedAt = Date.now();
      while (Date.now() - startedAt < 10_000) {
        const nextTab = await chrome.tabs.get(created.id);
        if (
          nextTab?.status === "complete" &&
          nextTab?.url === targetUrlValue &&
          String(nextTab?.title || "").trim().length > 0
        ) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error("TAB_LOAD_TIMEOUT");
    },
    {
      targetUrlValue: targetUrl,
      active: Boolean(options.active)
    }
  );
}

test("injects the sidebar on a normal page and shifts fixed content", async ({ page }) => {
  await page.goto("/index.html");
  await waitForSidebarInjected(page);

  await expectPageOffset(page, "320px");
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.getElementById("fixed-banner")).marginLeft)
    )
    .toBe("320px");
});

test("persists closed open-state across reloads", async ({ page }) => {
  await page.goto("/index.html");
  await waitForSidebarInjected(page);

  await page.locator("#brave-tab-sidebar-host #bts-toggle-btn").click();
  await expectSidebarOpenState(page, false);
  await expectPageOffset(page, "0px");

  await page.reload();
  await expect(page.locator("#brave-tab-sidebar-host")).toHaveCount(1);
  await expectSidebarOpenState(page, false);
  await expectPageOffset(page, "0px");
});

test("opens the command palette from keyboard shortcut and tab message route", async ({
  page,
  serviceWorker
}) => {
  await page.goto("/index.html");
  await waitForSidebarInjected(page);

  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.keyboard.press(shortcutForPlatform());

  await expect(page.locator("#brave-tab-sidebar-host .bts-command-palette")).toHaveClass(/is-open/);
  await expect(page.locator("#brave-tab-sidebar-host #bts-command-input")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#brave-tab-sidebar-host .bts-command-palette")).not.toHaveClass(/is-open/);

  await serviceWorker.evaluate(async (messageType) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !Number.isInteger(tab.windowId)) {
      throw new Error("NO_ACTIVE_TAB");
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: messageType,
      payload: {
        windowId: tab.windowId
      }
    });
  }, TOGGLE_COMMAND_PALETTE);

  await expect(page.locator("#brave-tab-sidebar-host .bts-command-palette")).toHaveClass(/is-open/);
});

test("injects into extension-created http tabs", async ({ context, page, serviceWorker }) => {
  await page.goto("/index.html");
  await waitForSidebarInjected(page);

  const createdPagePromise = context.waitForEvent("page");
  await serviceWorker.evaluate(async (targetUrl) => {
    await chrome.tabs.create({
      url: targetUrl,
      active: true
    });
  }, "http://127.0.0.1:3100/index.html?from=extension");

  const createdPage = await createdPagePromise;
  await createdPage.waitForLoadState("domcontentloaded");
  await expect(createdPage).toHaveURL(/from=extension/);
  await waitForSidebarInjected(createdPage);
});

test("supports drag-and-drop journey across today, favorites, pinned, and back to today", async ({
  page,
  serviceWorker
}) => {
  await page.goto("/index.html?title=Primary%20Tab");
  await waitForSidebarInjected(page);

  await createBackgroundTab(
    serviceWorker,
    "http://127.0.0.1:3100/index.html?title=Secondary%20Tab"
  );

  await expect(
    page.locator(`${SHADOW_HOST_SELECTOR} .bts-tab-row[aria-label="Primary Tab"]`)
  ).toHaveCount(1);
  await expect(
    page.locator(`${SHADOW_HOST_SELECTOR} .bts-tab-row[aria-label="Secondary Tab"]`)
  ).toHaveCount(1);

  await dispatchDragAndDrop(
    page,
    '.bts-tab-row[aria-label="Secondary Tab"]',
    "#bts-favorites-grid"
  );

  await expect(page.locator(`${SHADOW_HOST_SELECTOR} .bts-favorite-btn`)).toHaveCount(1);
  await expect(
    page.locator(`${SHADOW_HOST_SELECTOR} .bts-tab-row[aria-label="Secondary Tab"]`)
  ).toHaveCount(0);
  await expect(
    page.locator(`${SHADOW_HOST_SELECTOR} .bts-tab-row[aria-label="Primary Tab"]`)
  ).toHaveCount(1);

  await dispatchDragAndDrop(page, ".bts-favorite-btn", "#bts-pinned-list");

  await expect(page.locator(`${SHADOW_HOST_SELECTOR} .bts-favorite-btn`)).toHaveCount(0);
  await expect(page.locator(`${SHADOW_HOST_SELECTOR} .bts-pinned-row`)).toHaveCount(1);
  await expect(
    page.locator(`${SHADOW_HOST_SELECTOR} .bts-pinned-row .bts-pinned-title`)
  ).toContainText("Secondary Tab");

  await dispatchDragAndDrop(page, ".bts-pinned-row", "#bts-tab-list");

  await expect(page.locator(`${SHADOW_HOST_SELECTOR} .bts-pinned-row`)).toHaveCount(0);
  await expect(
    page.locator(`${SHADOW_HOST_SELECTOR} .bts-tab-row[aria-label="Secondary Tab"]`)
  ).toHaveCount(1);
});

test("applies YouTube-specific push mode on a youtube-host fixture", async ({ page }) => {
  await page.goto("http://127.0.0.1:3100/youtube.html");
  await waitForSidebarInjected(page);

  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--bts-page-offset").trim()
      )
    )
    .toBe("320px");

  await expectPageOffset(page, "0px");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.querySelector("ytd-app")).marginLeft))
    .toBe("320px");
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.getElementById("guide")).marginLeft)
    )
    .toBe("320px");

  await page.locator(`${SHADOW_HOST_SELECTOR} #bts-toggle-btn`).click();
  await expectSidebarOpenState(page, false);

  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--bts-page-offset").trim()
      )
    )
    .toBe("");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.querySelector("ytd-app")).marginLeft))
    .toBe("0px");
});
