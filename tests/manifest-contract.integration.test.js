const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const EXTENSION_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(EXTENSION_ROOT, "manifest.json");
const CONTENT_PATH = path.join(EXTENSION_ROOT, "content.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getContentScriptFiles(manifest) {
  const entry = Array.isArray(manifest?.content_scripts) ? manifest.content_scripts[0] : null;
  return Array.isArray(entry?.js) ? entry.js : [];
}

function extractGlobalAssignments(source) {
  const provided = new Set();
  const pattern = /globalScope\.(BraveSidebar[A-Za-z0-9_]+)\s*=/g;
  let match = pattern.exec(source);
  while (match) {
    provided.add(match[1]);
    match = pattern.exec(source);
  }
  return provided;
}

function extractContentModuleBindings(source) {
  const bindings = new Map();
  const pattern = /const\s+([A-Za-z0-9_]+)\s*=\s*globalScope\.(BraveSidebar[A-Za-z0-9_]+);/g;
  let match = pattern.exec(source);
  while (match) {
    bindings.set(match[1], match[2]);
    match = pattern.exec(source);
  }
  return bindings;
}

function extractRequiredModuleVariableNames(source) {
  const guards = [];
  const guardPattern = /if\s*\(([\s\S]*?)\)\s*{\s*return;\s*}/g;
  let guardMatch = guardPattern.exec(source);
  while (guardMatch) {
    if (guardMatch[1].includes("Module")) {
      guards.push(guardMatch[1]);
    }
    guardMatch = guardPattern.exec(source);
  }

  const moduleGuard = guards.find((guard) => /!\s*[A-Za-z0-9_]+Module/.test(guard)) || "";
  const required = new Set();
  const requiredPattern = /!\s*([A-Za-z0-9_]+Module)\b/g;
  let requiredMatch = requiredPattern.exec(moduleGuard);
  while (requiredMatch) {
    required.add(requiredMatch[1]);
    requiredMatch = requiredPattern.exec(moduleGuard);
  }
  return required;
}

test("manifest content script files exist on disk", () => {
  const manifest = readJson(MANIFEST_PATH);
  const files = getContentScriptFiles(manifest);

  assert.ok(files.length > 0, "Expected manifest content script list to be non-empty");

  const missing = files.filter((relativePath) => {
    const absolutePath = path.join(EXTENSION_ROOT, relativePath);
    return !fs.existsSync(absolutePath);
  });

  assert.deepEqual(missing, [], `Missing content script files: ${missing.join(", ")}`);
});

test("content bootstrap-required modules are provided before content.js in manifest order", () => {
  const manifest = readJson(MANIFEST_PATH);
  const files = getContentScriptFiles(manifest);
  const contentIndex = files.indexOf("content.js");

  assert.ok(contentIndex >= 0, "Expected content.js in manifest content_scripts[0].js");
  assert.ok(contentIndex > 0, "Expected content.js to be loaded after module scripts");

  const contentSource = readText(CONTENT_PATH);
  const moduleBindings = extractContentModuleBindings(contentSource);
  const requiredModuleVariables = extractRequiredModuleVariableNames(contentSource);

  assert.ok(requiredModuleVariables.size > 0, "Expected at least one required module guard");

  const requiredGlobalNames = Array.from(requiredModuleVariables, (variableName) =>
    moduleBindings.get(variableName)
  );

  assert.equal(
    requiredGlobalNames.includes(undefined),
    false,
    "Every required module variable should map to a BraveSidebar global binding"
  );

  const providedGlobals = new Set();
  const providerFiles = files.slice(0, contentIndex);
  for (const relativePath of providerFiles) {
    const absolutePath = path.join(EXTENSION_ROOT, relativePath);
    const source = readText(absolutePath);
    for (const globalName of extractGlobalAssignments(source)) {
      providedGlobals.add(globalName);
    }
  }

  const missingGlobals = requiredGlobalNames.filter(
    (globalName) => !providedGlobals.has(globalName)
  );

  assert.deepEqual(
    missingGlobals,
    [],
    `content.js requires globals not provided before load: ${missingGlobals.join(", ")}`
  );
});
