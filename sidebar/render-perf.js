(function bootstrapSidebarRenderPerf(globalScope) {
  function shouldRenderArcSections(sidebarDataVersion, renderedArcDataVersion) {
    return Number(sidebarDataVersion) !== Number(renderedArcDataVersion);
  }

  function createRenderCoalescer(scheduleFrame, cancelFrame) {
    let frameHandle = null;

    function schedule(run) {
      if (frameHandle !== null) {
        return false;
      }

      frameHandle = scheduleFrame(() => {
        frameHandle = null;
        run();
      });

      return true;
    }

    function flush(run) {
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }

      run();
    }

    function isScheduled() {
      return frameHandle !== null;
    }

    return {
      schedule,
      flush,
      isScheduled
    };
  }

  const api = {
    shouldRenderArcSections,
    createRenderCoalescer
  };

  globalScope.BraveSidebarRenderPerf = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
