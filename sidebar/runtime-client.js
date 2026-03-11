(function defineRuntimeClient(globalScope) {
  "use strict";

  function createRuntimeClient(options) {
    const messagesModule = options?.messagesModule || null;
    const chromeApi = options?.chromeApi || (typeof chrome !== "undefined" ? chrome : null);
    let alive = true;

    function isAlive() {
      return alive;
    }

    function markContextInvalidated() {
      alive = false;
    }

    function checkInvalidated(error) {
      if (String(error?.message || "").includes("Extension context invalidated")) {
        alive = false;
      }
    }

    function storageGet(key) {
      if (!alive) {
        return Promise.resolve(undefined);
      }

      return Promise.resolve()
        .then(
          () =>
            new Promise((resolve, reject) => {
              if (!chromeApi?.storage?.local?.get) {
                reject(new Error("STORAGE_GET_UNAVAILABLE"));
                return;
              }
              chromeApi.storage.local.get([key], (result) => {
                const error = chromeApi.runtime?.lastError;
                if (error) {
                  reject(new Error(error.message));
                  return;
                }
                resolve(result?.[key]);
              });
            })
        )
        .catch((error) => {
          checkInvalidated(error);
          return undefined;
        });
    }

    function storageSet(key, value) {
      if (!alive) {
        return Promise.resolve();
      }

      return Promise.resolve()
        .then(
          () =>
            new Promise((resolve, reject) => {
              if (!chromeApi?.storage?.local?.set) {
                reject(new Error("STORAGE_SET_UNAVAILABLE"));
                return;
              }
              chromeApi.storage.local.set({ [key]: value }, () => {
                const error = chromeApi.runtime?.lastError;
                if (error) {
                  reject(new Error(error.message));
                  return;
                }
                resolve();
              });
            })
        )
        .catch((error) => {
          checkInvalidated(error);
        });
    }

    function validateSidebarMessage(message) {
      if (!message || typeof message !== "object") {
        return { ok: false, error: "INVALID_MESSAGE" };
      }

      if (typeof message.type !== "string") {
        return { ok: false, error: "INVALID_MESSAGE_TYPE" };
      }

      const isKnownMessageType = messagesModule?.isKnownMessageType;
      if (typeof isKnownMessageType === "function" && !isKnownMessageType(message.type)) {
        return { ok: false, error: "UNKNOWN_MESSAGE_TYPE" };
      }

      const validatePayload = messagesModule?.validatePayload;
      if (typeof validatePayload !== "function") {
        return { ok: true };
      }

      return validatePayload(message.type, message.payload);
    }

    function sendMessage(message) {
      if (!alive) {
        return Promise.resolve({ ok: false, error: "EXTENSION_CONTEXT_INVALIDATED" });
      }

      const validation = validateSidebarMessage(message);
      if (!validation.ok) {
        return Promise.resolve({ ok: false, error: validation.error });
      }

      return Promise.resolve()
        .then(
          () =>
            new Promise((resolve, reject) => {
              if (!chromeApi?.runtime?.sendMessage) {
                reject(new Error("RUNTIME_SEND_UNAVAILABLE"));
                return;
              }
              chromeApi.runtime.sendMessage(message, (response) => {
                const error = chromeApi.runtime?.lastError;
                if (error) {
                  reject(new Error(error.message));
                  return;
                }
                resolve(response || { ok: false, error: "NO_RESPONSE" });
              });
            })
        )
        .catch((error) => {
          const messageText = String(error?.message || "SEND_FAILED");
          if (messageText.includes("Extension context invalidated")) {
            alive = false;
          }
          return { ok: false, error: messageText };
        });
    }

    return {
      storageGet,
      storageSet,
      sendMessage,
      validateSidebarMessage,
      isAlive,
      markContextInvalidated
    };
  }

  globalScope.BraveSidebarRuntimeClient = { createRuntimeClient };
})(globalThis);
