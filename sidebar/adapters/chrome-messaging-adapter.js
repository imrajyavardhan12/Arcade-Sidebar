(function defineChromeMessagingAdapter(globalScope) {
  "use strict";

  /**
   * Production adapter: wraps chrome.runtime for MessagingPort.
   * @param {object} chromeApi - the chrome global (or a stub in tests)
   * @param {object} messagesModule - BraveSidebarMessages module
   * @returns {object} MessagingPort implementation
   */
  function createChromeMessagingAdapter(chromeApi, messagesModule) {
    let alive = true;

    return {
      async sendMessage(message) {
        if (!alive) {
          return { ok: false, error: "EXTENSION_CONTEXT_INVALIDATED" };
        }

        const validatePayload = messagesModule?.validatePayload;
        if (validatePayload && message?.type) {
          const validation = validatePayload(message.type, message.payload);
          if (!validation.ok) {
            return { ok: false, error: validation.error };
          }
        }

        return new Promise((resolve) => {
          chromeApi.runtime.sendMessage(message, (response) => {
            if (chromeApi.runtime.lastError) {
              const errMsg = String(chromeApi.runtime.lastError.message || "");
              if (errMsg.includes("Extension context invalidated")) {
                alive = false;
              }
              resolve({ ok: false, error: errMsg });
              return;
            }
            resolve(response || { ok: false, error: "NO_RESPONSE" });
          });
        });
      },

      setMessageHandler(handler) {
        chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
          handler(message, sendResponse);
        });
      },

      validateMessage(message) {
        const isKnownMessageType = messagesModule?.isKnownMessageType;
        if (typeof isKnownMessageType === "function") {
          if (!isKnownMessageType(message?.type)) {
            return { ok: false, error: "UNKNOWN_MESSAGE_TYPE" };
          }
        }
        return { ok: true };
      },

      isContextAlive() {
        return alive;
      },

      markContextInvalidated() {
        alive = false;
      },

      /**
       * @returns {string} chrome.runtime.getURL prefix for this extension
       */
      getResourceURL(path) {
        return chromeApi.runtime.getURL(path);
      }
    };
  }

  globalScope.BraveSidebarChromeMessagingAdapter = { createChromeMessagingAdapter };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createChromeMessagingAdapter };
  }
})(globalThis);
