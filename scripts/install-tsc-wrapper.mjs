/**
 * Postinstall hook. Two jobs:
 *
 * 1. Repair the dependency tree.
 *
 *    The build container's `bun install` intermittently ends with a random
 *    handful of packages only partially materialized into node_modules:
 *
 *      FileNotFound: failed copying files from cache to destination for package X
 *      Failed to install N packages
 *
 *    The install still exits non-zero there, so the deploy build aborts before
 *    scripts/build.mjs ever runs — but lifecycle scripts DO run, which makes
 *    this hook the only place we can repair the tree inside that same install.
 *    Once repaired, the node_modules tree is complete, so the next install is a
 *    no-op ("Checked … no changes", exit 0) and the build proceeds.
 *
 *    Two complementary repairs, because the failures come in two shapes:
 *
 *      - Whole packages absent (usually transitive deps, invisible to any
 *        check that only looks at direct dependencies): a reconciling
 *        `bun install` restores them, since bun knows from the lockfile what
 *        the tree should contain.
 *      - Packages present but half-written (manifest kept, dist/ or .d.ts
 *        missing): bun trusts a directory that still has a manifest, so the
 *        broken directory has to be deleted first. That repair lives in
 *        scripts/build.mjs (--heal), which also runs before the real build.
 *
 * 2. Replace node_modules/.bin/tsc with scripts/tsc-wrapper.cjs.
 *
 *    The deploy runner executes `tsc -b && vite build` in a freshly installed
 *    node_modules. Under Bun, tsc's heap balloons past the container memory
 *    limit and the build dies with "Killed" (measured ~1.76 GB under Bun vs
 *    ~0.86 GB under Node for this project). The Vite phase already re-execs
 *    under Node via vite.config.ts; this pins the tsc phase to a capped-heap
 *    Node run the same way.
 *
 *    Re-running is idempotent: if .bin/tsc already holds the wrapper, it is
 *    left as-is; a fresh `bun install` recreates the vendor symlink, which this
 *    script then replaces again (after unlinking it, so the real
 *    typescript/bin/tsc is never written through).
 */
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const installer = process.env.npm_config_user_agent?.startsWith("npm") ? "npm" : "bun";

/**
 * Repair the dependency tree after an install. Skipped when this postinstall is
 * itself running inside a repairing install (FORGE_DEP_HEAL), which is how the
 * recursion is bounded. Never throws: bun treats a non-zero postinstall as a
 * fatal install error, and a repair problem must not fail the install.
 */
function healDependencies() {
  if (process.env.FORGE_DEP_HEAL === "1") return;

  // 1. Reconcile: a no-op ("Checked … no changes") on a complete tree, and the
  //    only thing that restores whole packages the failed install skipped.
  try {
    spawnSync(installer, ["install"], {
      stdio: "inherit",
      cwd: root,
      env: { ...process.env, FORGE_DEP_HEAL: "1" },
    });
  } catch (err) {
    console.warn(`[postinstall] dependency reconcile skipped: ${err?.message ?? err}`);
  }

  // 2. Repair half-written packages (bun will not, see above).
  const script = resolve(root, "scripts/build.mjs");
  if (!existsSync(script)) return;
  try {
    const res = spawnSync(process.execPath, [script, "--heal"], {
      stdio: "inherit",
      cwd: root,
    });
    if (res.error) {
      console.warn(`[postinstall] partial-copy repair skipped: ${res.error.message}`);
    }
  } catch (err) {
    console.warn(`[postinstall] partial-copy repair skipped: ${err?.message ?? err}`);
  }
}

healDependencies();

const binTsc = resolve(root, "node_modules/.bin/tsc");
const wrapper = resolve(root, "scripts/tsc-wrapper.cjs");

if (!existsSync(binTsc)) {
  // typescript not installed yet — nothing to wrap.
  console.log("[postinstall] node_modules/.bin/tsc missing — skipped");
  process.exit(0);
}

// What is the current .bin/tsc?
let current = "";
try {
  current = readFileSync(binTsc, "utf8");
} catch {
  // unreadable — treat as unknown and leave it alone
}

// Marker: a unique line from the wrapper's own docstring, so re-runs detect
// an already-wrapped bin regardless of how it got there.
const WRAPPER_MARKER = "Bounded-heap wrapper for the TypeScript compiler";

if (current.includes(WRAPPER_MARKER)) {
  // Already wrapped (e.g. rerun after a partial install) — just refresh it.
  copyFileSync(wrapper, binTsc);
  chmodSync(binTsc, 0o755);
  console.log("[postinstall] node_modules/.bin/tsc -> bounded-heap Node wrapper (refreshed)");
  process.exit(0);
}

if (current.includes("lib/tsc.js")) {
  // The vendor shim (`require('../lib/tsc.js')`) — possibly reached through
  // the bun symlink. Unlink first so copying never writes through the link
  // into typescript/bin/tsc.
  try {
    unlinkSync(binTsc);
  } catch {
    console.error("[postinstall] could not unlink node_modules/.bin/tsc — leaving as-is");
    process.exit(0);
  }
  copyFileSync(wrapper, binTsc);
  chmodSync(binTsc, 0o755);
  console.log("[postinstall] node_modules/.bin/tsc -> bounded-heap Node wrapper");
  process.exit(0);
}

// Unknown content — leave it alone rather than break a foreign setup.
console.log("[postinstall] node_modules/.bin/tsc has unexpected content — left untouched");
