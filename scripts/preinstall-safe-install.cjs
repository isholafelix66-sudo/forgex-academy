#!/usr/bin/env node
/**
 * Preinstall hook — read-only health check.
 *
 * History
 * -------
 * This hook used to REPAIR the tree (delete damaged package dirs, then run a
 * nested `bun install --backend=copyfile`) because the build container's
 * `bun install` kept failing with
 *
 *   FileNotFound: failed copying files from cache to destination for package X
 *   Failed to install N packages
 *
 * That never helped: bun runs lifecycle scripts AFTER it has materialized
 * node_modules, so by the time this hook runs the outer install's exit code —
 * the only thing that aborts the deploy — is already decided. And a nested
 * install makes two installers write node_modules at the same time.
 *
 * Where the fix lives now
 * -----------------------
 * The install step itself (scripts/install-deps.mjs, wired through vercel.json
 * → installCommand) installs with `--backend=copyfile` up front — plain copies
 * rather than the hardlinks that intermittently fail on this virtiofs mount —
 * and then verifies and repairs the tree after the install has finished.
 *
 * So this hook only reports: verify-only, always exit 0, never mutate.
 */
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");

/** Every non-wildcard entry path a manifest declares (main/module/exports). */
function declaredEntries(manifest) {
  const out = [];
  for (const key of ["main", "module"]) {
    const value = manifest[key];
    if (typeof value === "string" && !value.includes("*")) out.push(value);
  }
  const visit = (node) => {
    if (typeof node === "string") {
      // package.json is itself an exports leaf in almost every package and
      // always exists, so counting it would mask real damage (e.g. dist/
      // vanished while the manifest survived).
      if (!node.includes("*") && path.posix.basename(node) !== "package.json") {
        out.push(node);
      }
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const value of Object.values(node)) visit(value);
  };
  visit(manifest.exports);
  return out;
}

const ENTRY_SUFFIXES = [
  "",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  "/index.js",
  "/index.mjs",
  "/index.cjs",
];

function anyEntryExists(dir, entries) {
  return entries.some((rel) =>
    ENTRY_SUFFIXES.some((suffix) => existsSync(path.join(dir, rel + suffix))),
  );
}

/** Names of installed packages whose dir is missing, unreadable, or empty-ish. */
function findIncomplete() {
  let nmEntries = [];
  try {
    nmEntries = readdirSync("node_modules");
  } catch {
    return null; // no node_modules yet — nothing to report
  }
  const names = [];
  const push = (scope, name) => {
    if (!name.startsWith(".")) names.push(scope ? `${scope}/${name}` : name);
  };
  for (const entry of nmEntries) {
    if (entry.startsWith(".")) continue;
    if (!entry.startsWith("@")) {
      push(null, entry);
      continue;
    }
    let scoped = [];
    try {
      scoped = readdirSync(path.join("node_modules", entry));
    } catch {
      names.push(entry); // unreadable scope dir
      continue;
    }
    for (const name of scoped) push(entry, name);
  }

  const broken = [];
  for (const name of names) {
    const dir = path.join("node_modules", ...name.split("/"));
    const manifestPath = path.join(dir, "package.json");
    if (!existsSync(manifestPath)) {
      broken.push(name);
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      broken.push(name);
      continue;
    }
    const entries = declaredEntries(manifest);
    if (entries.length > 0 && !anyEntryExists(dir, entries)) broken.push(name);
  }
  return broken;
}

try {
  const broken = findIncomplete();
  if (broken === null) {
    console.log("[preinstall] no node_modules yet — install will populate it");
  } else if (broken.length === 0) {
    console.log("[preinstall] existing dependency tree looks complete");
  } else {
    console.warn(
      `[preinstall] ${broken.length} package(s) look incomplete ` +
        `(${broken.slice(0, 5).join(", ")}${broken.length > 5 ? ", …" : ""}) — ` +
        `the install step verifies and repairs the tree when it finishes`,
    );
  }
} catch (err) {
  // A diagnostic hook must never be able to fail the install.
  console.warn(`[preinstall] check skipped: ${err && err.message}`);
}
process.exit(0);
