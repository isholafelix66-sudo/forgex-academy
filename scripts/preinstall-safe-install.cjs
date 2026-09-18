#!/usr/bin/env node
/**
 * Preinstall hook — make sure the dependency tree is complete BEFORE the
 * outer `bun install` plans its work.
 *
 * Why this exists:
 *
 *   The build container's `bun install` intermittently fails with
 *
 *     FileNotFound: failed copying files from cache to destination for package X
 *     Failed to install N packages
 *
 *   and exits non-zero, which aborts the deploy build before any healing
 *   could run.
 *
 * Root cause (identified 2026-09-18):
 *
 *   bun's download cache lives INSIDE the synced workspace
 *   (node_modules/.cache). The platform's file-sync layer intermittently
 *   drops files while copying — it has been losing node_modules files all
 *   along — so the cache entries themselves became incomplete. Each build
 *   container then inherited a poisoned cache and failed while READING from
 *   it (the FileNotFound lines are cache reads that happen before
 *   extraction). bunfig's `[install.cache] dir = "/tmp/forgex-bun-cache"`
 *   (see bunfig.toml) moves the cache outside the workspace, which removes
 *   the source of the poison; this hook is the second line of defence.
 *
 * What this hook does now:
 *
 *   Before the outer install starts, it verifies that every installed
 *   package still has a readable manifest and at least one declared entry
 *   file. If anything is damaged, it deletes the broken dirs and repairs
 *   the tree with a copyfile-backend install (plain copies, no hardlinks —
 *   the safest materialization on this filesystem). When the tree is
 *   already healthy, this costs a few hundred milliseconds and the outer
 *   install becomes a warm no-op that exits 0.
 *
 * Recursion guard:
 *
 *   FORGE_PREINSTALL=1 marks the hook's own child installs, whose
 *   lifecycle scripts must not recurse.
 */
if (process.env.FORGE_PREINSTALL === "1") {
  process.exit(0);
}

const { spawnSync } = require("node:child_process");
const { existsSync, readdirSync, readFileSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");

const installer = process.env.npm_config_user_agent?.startsWith("npm")
  ? "npm"
  : "bun";

// npm's cache is content-addressed and has never hit this failure mode.
if (installer !== "bun") {
  process.exit(0);
}

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
    return []; // no node_modules — the outer install will create it fresh
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
      names.push(entry); // unreadable scope dir — let the repair handle it
      continue;
    }
    for (const name of scoped) push(entry, name);
  }

  const broken = [];
  for (const name of names) {
    const dir = path.join("node_modules", ...name.split("/"));
    let st;
    try {
      st = statSync(dir);
    } catch {
      broken.push(name);
      continue;
    }
    if (!st.isDirectory()) continue;
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

const broken = findIncomplete();
if (broken.length === 0) {
  console.log(
    "[preinstall] dependency tree verified complete — outer install can proceed",
  );
  process.exit(0);
}

console.log(
  `[preinstall] ${broken.length} package(s) incomplete in node_modules ` +
    `(${broken.slice(0, 5).join(", ")}${broken.length > 5 ? ", …" : ""}) — repairing before the outer install`,
);

// bun trusts any existing dir with a manifest, so broken dirs must be deleted
// first or the reinstall would skip them.
for (const name of broken) {
  try {
    rmSync(path.join("node_modules", ...name.split("/")), {
      recursive: true,
      force: true,
    });
  } catch (err) {
    console.warn(`[preinstall] could not remove node_modules/${name}: ${err.message}`);
  }
}

// copyfile backend = plain copies, no hardlinks: the safest materialization
// on this filesystem, and independent of any cache entry state.
const args = ["install", "--backend=copyfile"];
const res = spawnSync(installer, args, {
  stdio: "inherit",
  env: { ...process.env, FORGE_PREINSTALL: "1" },
});

if (res.error) {
  console.error(`[preinstall] repair install failed to start: ${res.error.message}`);
  process.exit(1);
}
if (res.status !== 0) {
  console.error(
    `[preinstall] repair install exited ${res.status} — failing with this clear error instead of bun's "Failed to install N packages".`,
  );
  process.exit(res.status ?? 1);
}
console.log("[preinstall] repair completed — outer install will reconcile");
