(function defineChromeStorageAdapter(globalScope) {
  "use strict";

  /**
   * Production adapter: wraps chrome.storage.local for StoragePort.
   * @param {object} chromeApi - the chrome global (or a stub in tests)
   * @returns {object} StoragePort implementation
   */
  function createChromeStorageAdapter(chromeApi) {
    function storageGet(keys) {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.get(keys, (result) => {
          if (chromeApi.runtime.lastError) {
            reject(new Error(chromeApi.runtime.lastError.message));
            return;
          }
          resolve(result);
        });
      });
    }

    function storageSet(items) {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.set(items, () => {
          if (chromeApi.runtime.lastError) {
            reject(new Error(chromeApi.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
    }

    return {
      /**
       * @template T
       * @param {string} key
       * @returns {Promise<T|undefined>}
       */
      get(key) {
        return storageGet([key]).then((result) => result?.[key]);
      },

      /**
       * @template T
       * @param {string} key
       * @param {T} value
       * @returns {Promise<void>}
       */
      set(key, value) {
        return storageSet({ [key]: value });
      },

      /**
       * @param {(changes: Record<string, {oldValue: unknown, newValue: unknown}>, areaName: string) => void} handler
       */
      onChanged(handler) {
        chromeApi.storage.onChanged.addListener((changes, areaName) => {
          handler(changes, areaName);
        });
      }
    };
  }

  globalScope.BraveSidebarChromeStorageAdapter = { createChromeStorageAdapter };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createChromeStorageAdapter };
  }
})(globalThis);
