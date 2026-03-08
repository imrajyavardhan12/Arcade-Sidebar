const test = require("node:test");
const assert = require("node:assert/strict");

const renderPerf = require("../sidebar/render-perf.js");

test("shouldRenderArcSections only when data version changed", () => {
  assert.equal(renderPerf.shouldRenderArcSections(1, 0), true);
  assert.equal(renderPerf.shouldRenderArcSections(5, 5), false);
});

test("createRenderCoalescer coalesces repeated schedules into one frame", () => {
  let nextHandle = 1;
  const scheduled = new Map();
  const runs = [];

  const coalescer = renderPerf.createRenderCoalescer(
    (run) => {
      const handle = nextHandle;
      nextHandle += 1;
      scheduled.set(handle, run);
      return handle;
    },
    (handle) => {
      scheduled.delete(handle);
    }
  );

  assert.equal(coalescer.schedule(() => runs.push("first")), true);
  assert.equal(coalescer.schedule(() => runs.push("second")), false);
  assert.equal(coalescer.isScheduled(), true);
  assert.equal(scheduled.size, 1);

  const pendingRun = Array.from(scheduled.values())[0];
  pendingRun();
  assert.equal(coalescer.isScheduled(), false);
  assert.deepEqual(runs, ["first"]);
});

test("createRenderCoalescer flush cancels pending frame and runs immediately", () => {
  let nextHandle = 1;
  const scheduled = new Map();
  const runs = [];

  const coalescer = renderPerf.createRenderCoalescer(
    (run) => {
      const handle = nextHandle;
      nextHandle += 1;
      scheduled.set(handle, run);
      return handle;
    },
    (handle) => {
      scheduled.delete(handle);
    }
  );

  coalescer.schedule(() => runs.push("deferred"));
  assert.equal(coalescer.isScheduled(), true);
  assert.equal(scheduled.size, 1);

  coalescer.flush(() => runs.push("immediate"));
  assert.equal(coalescer.isScheduled(), false);
  assert.equal(scheduled.size, 0);
  assert.deepEqual(runs, ["immediate"]);
});
