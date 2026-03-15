const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { chromium, test: base, expect } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..", "..");

const test = base.extend({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bts-playwright-"));
    const args = [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ];

    if (process.env.CI) {
      args.push("--no-sandbox");
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      viewport: {
        width: 1440,
        height: 960
      },
      args
    });

    try {
      await use(context);
    } finally {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },

  serviceWorker: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    await use(serviceWorker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await page.close();
    }
  }
});

module.exports = {
  expect,
  test
};
