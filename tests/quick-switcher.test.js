const test = require("node:test");
const assert = require("node:assert/strict");

const quickSwitcher = require("../sidebar/quick-switcher.js");

test("rankItems returns original order when query is empty", () => {
  const items = [
    { id: "a", type: "action", label: "New Tab" },
    { id: "b", type: "tab", label: "Brave Docs" },
    { id: "c", type: "favorite", label: "GitHub" }
  ];

  const ranked = quickSwitcher.rankItems(items, "");
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["a", "b", "c"]
  );
});

test("rankItems prefers stronger matches and type weight", () => {
  const items = [
    { id: "tab-1", type: "tab", label: "Project Board", subtitle: "https://board.example.com" },
    { id: "action-1", type: "action", label: "Project Settings", subtitle: "Open settings" },
    { id: "fav-1", type: "favorite", label: "Board Notes", subtitle: "https://notes.example.com" }
  ];

  const ranked = quickSwitcher.rankItems(items, "project");
  assert.equal(ranked[0].id, "action-1");
  assert.equal(ranked[1].id, "tab-1");
});

test("rankItems matches via keywords and honors limit", () => {
  const items = [
    { id: "x", type: "tab", label: "Alpha", keywords: ["workspace", "team"] },
    { id: "y", type: "tab", label: "Beta", keywords: ["workspace"] },
    { id: "z", type: "tab", label: "Gamma", keywords: ["workspace"] }
  ];

  const ranked = quickSwitcher.rankItems(items, "workspace", 2);
  assert.equal(ranked.length, 2);
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["x", "y"]
  );
});

test("rankItems filters out non-matching items", () => {
  const items = [
    { id: "a", type: "tab", label: "Brave" },
    { id: "b", type: "tab", label: "Arcade" }
  ];

  const ranked = quickSwitcher.rankItems(items, "github");
  assert.equal(ranked.length, 0);
});
