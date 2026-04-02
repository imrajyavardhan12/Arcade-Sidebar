(function defineShadowDOMAdapter(globalScope) {
  "use strict";

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  /**
   * Production adapter: real Shadow DOM + DOM APIs.
   * Used in the extension content script environment.
   */
  function createShadowDOMAdapter(documentRef, chromeApi) {
    return {
      createElement(tagName) {
        return documentRef.createElement(tagName);
      },

      createElementNS(_ns, tagName) {
        return documentRef.createElementNS(SVG_NAMESPACE, tagName);
      },

      querySelector(root, selector) {
        return root.querySelector(selector);
      },

      querySelectorAll(root, selector) {
        return Array.from(root.querySelectorAll(selector));
      },

      appendChild(parent, child) {
        parent.appendChild(child);
      },

      replaceChildren(parent) {
        parent.replaceChildren();
      },

      addEventListener(target, type, handler, options) {
        target.addEventListener(type, handler, options);
      },

      removeEventListener(target, type, handler) {
        target.removeEventListener(type, handler);
      },

      requestAnimationFrame(cb) {
        return globalScope.requestAnimationFrame(cb);
      },

      cancelAnimationFrame(id) {
        globalScope.cancelAnimationFrame(id);
      },

      getComputedStyle(el) {
        return globalScope.getComputedStyle(el);
      },

      prompt(message, defaultValue) {
        return globalScope.prompt(message, defaultValue);
      },

      getResourceURL(path) {
        return chromeApi.runtime.getURL(path);
      },

      /**
       * Create the fixed-shadow-host element and attach its open shadow root.
       * @returns {{ host: Element, shadowRoot: ShadowRoot }}
       */
      createHostAndShadow() {
        const host = this.createElement("div");
        host.id = "brave-tab-sidebar-host";
        host.style.cssText =
          "position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
        const shadowRoot = host.attachShadow({ mode: "open" });
        return { host, shadowRoot };
      }
    };
  }

  globalScope.BraveSidebarShadowDOMAdapter = { createShadowDOMAdapter };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createShadowDOMAdapter };
  }
})(globalThis);
