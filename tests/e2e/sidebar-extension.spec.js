const { expect, test } = require("./extension-fixture.js");

const TOGGLE_COMMAND_PALETTE = "sidebar:toggleCommandPalette";

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
