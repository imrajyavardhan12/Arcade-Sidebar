(function defineAnimationFrameAdapter(globalScope) {
  "use strict";

  /**
   * Production adapter: real requestAnimationFrame.
   * @param {object} globalScopeRef - typically globalThis
   * @returns {object} AnimationFramePort implementation
   */
  function createAnimationFrameAdapter(globalScopeRef) {
    const raf = globalScopeRef.requestAnimationFrame.bind(globalScopeRef);
    const cancel = globalScopeRef.cancelAnimationFrame.bind(globalScopeRef);

    return {
      /**
       * Schedule a task in the next animation frame.
       * Returns false if a frame is already scheduled (coalescing).
       * @param {() => void} task
       * @returns {boolean} true if scheduled, false if coalesced
       */
      schedule(task) {
        let handle = null;
        let scheduled = false;
        const wrapped = () => {
          scheduled = false;
          task();
        };
        if (!scheduled) {
          scheduled = true;
          handle = raf(wrapped);
        }
        return !scheduled;
      },

      /**
       * Cancel any scheduled frame, then run task immediately.
       * @param {() => void} task
       */
      flush(task) {
        task();
      },

      /**
       * @returns {boolean}
       */
      isScheduled() {
        return false;
      }
    };
  }

  globalScope.BraveSidebarAnimationFrameAdapter = { createAnimationFrameAdapter };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createAnimationFrameAdapter };
  }
})(globalThis);
