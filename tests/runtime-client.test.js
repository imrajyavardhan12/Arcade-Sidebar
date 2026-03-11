const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

globalThis.BraveSidebarRuntimeClient = undefined;
require("../sidebar/runtime-client.js");
const { createRuntimeClient } = globalThis.BraveSidebarRuntimeClient;

function createMockChromeApi(overrides = {}) {
  const lastError = { value: null };
  return {
    storage: {
      local: {
        get(keys, cb) {
          if (lastError.value) {
            Object.defineProperty(api.runtime, "lastError", { value: lastError.value, configurable: true });
            cb({});
            return;
          }
          const result = {};
          for (const key of keys) {
            if (overrides.storageData?.[key] !== undefined) {
              result[key] = overrides.storageData[key];
            }
          }
          cb(result);
        },
        set(items, cb) {
          if (lastError.value) {
            Object.defineProperty(api.runtime, "lastError", { value: lastError.value, configurable: true });
            cb();
            return;
          }
          Object.assign(overrides.storageData || {}, items);
          cb();
        }
      }
    },
    runtime: {
      lastError: null,
      sendMessage(message, cb) {
        if (overrides.sendResponse) {
          cb(overrides.sendResponse(message));
        } else {
          cb({ ok: true });
        }
      }
    },
    _lastError: lastError
  };
  var api = arguments.callee.call ? null : null;
}

function createMockMessagesModule() {
  return {
    isKnownMessageType(type) {
      return typeof type === "string" && type.startsWith("sidebar:");
    },
    validatePayload(_type, _payload) {
      return { ok: true };
    }
  };
}

describe("createRuntimeClient", () => {
  it("storageGet resolves stored value", async () => {
    const chromeApi = createMockChromeApi({ storageData: { myKey: "hello" } });
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    const value = await client.storageGet("myKey");
    assert.equal(value, "hello");
  });

  it("storageGet resolves undefined for missing key", async () => {
    const chromeApi = createMockChromeApi({ storageData: {} });
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    const value = await client.storageGet("missing");
    assert.equal(value, undefined);
  });

  it("storageSet writes to storage", async () => {
    const data = {};
    const chromeApi = createMockChromeApi({ storageData: data });
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    await client.storageSet("key1", 42);
    assert.equal(data.key1, 42);
  });

  it("sendMessage validates and sends", async () => {
    let sentMessage = null;
    const chromeApi = createMockChromeApi({
      sendResponse: (msg) => {
        sentMessage = msg;
        return { ok: true, data: "result" };
      }
    });
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    const response = await client.sendMessage({ type: "sidebar:getState" });
    assert.equal(response.ok, true);
    assert.deepEqual(sentMessage, { type: "sidebar:getState" });
  });

  it("sendMessage rejects unknown message type", async () => {
    const chromeApi = createMockChromeApi();
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    const response = await client.sendMessage({ type: "unknown:type" });
    assert.equal(response.ok, false);
    assert.equal(response.error, "UNKNOWN_MESSAGE_TYPE");
  });

  it("sendMessage returns error for invalid message shape", async () => {
    const chromeApi = createMockChromeApi();
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    const response = await client.sendMessage(null);
    assert.equal(response.ok, false);
    assert.equal(response.error, "INVALID_MESSAGE");
  });

  it("marks context invalidated on Extension context error", async () => {
    const chromeApi = {
      storage: {
        local: {
          get(_keys, _cb) {
            throw new Error("Extension context invalidated");
          },
          set: null
        }
      },
      runtime: { lastError: null }
    };
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    assert.equal(client.isAlive(), true);
    await client.storageGet("any");
    assert.equal(client.isAlive(), false);
  });

  it("storageGet returns undefined when context is dead", async () => {
    const chromeApi = createMockChromeApi({ storageData: { k: "v" } });
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    client.markContextInvalidated();
    const value = await client.storageGet("k");
    assert.equal(value, undefined);
  });

  it("sendMessage returns error when context is dead", async () => {
    const chromeApi = createMockChromeApi();
    const client = createRuntimeClient({ chromeApi, messagesModule: createMockMessagesModule() });
    client.markContextInvalidated();
    const response = await client.sendMessage({ type: "sidebar:getState" });
    assert.equal(response.ok, false);
    assert.equal(response.error, "EXTENSION_CONTEXT_INVALIDATED");
  });

  it("validateSidebarMessage works without messagesModule", () => {
    const client = createRuntimeClient({ chromeApi: createMockChromeApi(), messagesModule: null });
    const result = client.validateSidebarMessage({ type: "anything" });
    assert.equal(result.ok, true);
  });
});
