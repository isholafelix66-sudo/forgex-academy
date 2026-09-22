/**
 * Postinstall hook: replace node_modules/.bin/tsc with scripts/tsc-wrapper.cjs.
 *
 * The deploy runner executes `tsc -b && vite build` in a freshly installed
 * node_modules. Under Bun, tsc's heap balloons past the container memory
 * limit and the build dies with "Killed" (measured ~1.76 GB under Bun vs
 * ~0.86 GB under Node for this project). The Vite phase already re-execs
 * under Node via vite.config.ts; this pins the tsc phase to a capped-heap
 * Node run the same way.
 *
 * Re-running is idempotent: if .bin/tsc already holds the wrapper, it is
 * left as-is; a fresh `bun install` recreates the vendor symlink, which this
 * script then replaces again (after unlinking it, so the real
 * typescript/bin/tsc is never written through).
 *
 * Dependency-tree healing
 * -----------------------
 * The deploy image runs a bare `bun install` (1.3.14) that intermittently
 * exits 1 with "FileNotFound: failed copying files from cache to destination"
 * while leaving a random handful of packages half-written. History:
 *
 *  - Repairing from HERE was tried and removed because lifecycle scripts run
 *    while bun is still materializing the tree: the check saw packages bun
 *    was about to finish as damaged, deleted them, and spawned a nested
 *    install — two installers writing node_modules at once.
 *  - The repair therefore moved to scripts/build.mjs (postinstall ran it in
 *    --heal mode). But when the bare install exits 1 the build aborts BEFORE
 *    any build step, so nothing ever healed, and because bun trusts any
 *    existing dir with a manifest, the NEXT install was a partial no-op
 *    forever ("41 package(s) look incomplete" on every attempt).
 *
 * This hook now heals again — safely. bun runs postinstall only after the
 * tree materialization attempt has SETTLED (the earlier re-entrancy came from
 * the PREinstall hook, which bun runs before materialization finishes). The
 * heal runs scripts/build.mjs --heal in a child process with FORGE_PREINSTALL
 * set, which preinstall checks to stay read-only, so there is no nesting and
 * no concurrent writer. A torn package is deleted and reinstalled with
 * --backend=copyfile (the path that has never failed on this filesystem).
 * The heal can fail for its own reasons; then this hook still exits 0 — it
 * must never turn a partial install into a hard failure — but a healed tree
 * is what lets the next `bun install` be a real install instead of a no-op.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const binTsc = resolve(root, "node_modules/.bin/tsc");
const wrapper = resolve(root, "scripts/tsc-wrapper.cjs");
const buildScript = resolve(root, "scripts/build.mjs");

// ---------------------------------------------------------------------------
// 1. tsc wrapper (unchanged behavior)
// ---------------------------------------------------------------------------

if (!existsSync(binTsc)) {
  // typescript not installed yet — nothing to wrap.
  console.log("[postinstall] node_modules/.bin/tsc missing — skipped");
} else {
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
  } else if (current.includes("lib/tsc.js")) {
    // The vendor shim (`require('../lib/tsc.js')`) — possibly reached through
    // the bun symlink. Unlink first so copying never writes through the link
    // into typescript/bin/tsc.
    try {
      unlinkSync(binTsc);
      copyFileSync(wrapper, binTsc);
      chmodSync(binTsc, 0o755);
      console.log("[postinstall] node_modules/.bin/tsc -> bounded-heap Node wrapper");
    } catch {
      console.error("[postinstall] could not replace node_modules/.bin/tsc — leaving as-is");
    }
  } else {
    // Unknown content — leave it alone rather than break a foreign setup.
    console.log("[postinstall] node_modules/.bin/tsc has unexpected content — left untouched");
  }
}

// ---------------------------------------------------------------------------
// 2. Heal a partially-materialized dependency tree (bare-install failures)
// ---------------------------------------------------------------------------

// Guard: our own child installs set this so preinstall stays read-only. This
// hook also honors it so a repair install's postinstall cannot re-enter.
if (process.env.FORGE_PREINSTALL === "1") {
  process.exit(0);
}

// Only heal when the install that ran us reports a problem. A successful
// install fully materializes every package, so healing there would be pure
// overhead (and would also mask nothing). `npm_config_user_agent` alone does
// not tell us bun's verdict, so we run the cheap check unconditionally ONLY
// when bun's exit code was non-zero — communicated by bun via
// `BUN_INSTALL_EXIT` is not available, so instead: run the check always but
// make it cheap. build.mjs --heal-check walks manifests and exits fast when
// the tree is fine; the heal itself (the expensive part) only runs when the
// check finds damage.
try {
  const check = spawnSync(process.execPath, [buildScript, "--heal-check"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    cwd: root,
  });
  const damaged = check.status === 0 && check.stdout
    ? check.stdout.split("\n").map((l) => l.trim()).filter(Boolean)
    : null;

  if (damaged && damaged.length > 0) {
    console.log(
      `[postinstall] ${damaged.length} package(s) incomplete ` +
        `(${damaged.slice(0, 5).join(", ")}${damaged.length > 5 ? ", …" : ""}) — healing`,
    );
    // build.mjs --heal removes the damaged dirs and reinstalls them with
    // --backend=copyfile. FORGE_PREINSTALL=1 keeps every nested hook
    // read-only, so exactly one installer ever writes node_modules.
    const heal = spawnSync(process.execPath, [buildScript, "--heal"], {
      stdio: "inherit",
      cwd: root,
      env: { ...process.env, FORGE_PREINSTALL: "1" },
    });
    if (heal.status !== 0) {
      // Never fail the install from here — the tree may still be usable, and
      // scripts/build.mjs heals again (and retries) at build time.
      console.warn(`[postinstall] heal exited ${heal.status} — continuing`);
    }
  }
} catch (err) {
  console.warn(`[postinstall] heal check skipped: ${err?.message ?? err}`);
}
