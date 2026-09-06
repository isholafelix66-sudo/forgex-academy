/**
 * Postinstall: replace node_modules/.bin/tsc with scripts/tsc-wrapper.cjs.
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
 */
import { chmodSync, copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
