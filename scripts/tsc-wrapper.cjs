#!/usr/bin/env node
/**
 * Bounded-heap wrapper for the TypeScript compiler.
 *
 * The deploy runner invokes `tsc -b && vite build` directly. Under Bun (the
 * platform's JS runtime), tsc's heap balloons past the container memory limit
 * and the process is OOM-killed ("Killed") before Vite ever starts — measured
 * at ~1.76 GB RSS under Bun vs ~0.86 GB under Node for this project.
 *
 * vite.config.ts already re-execs the *Vite* phase under Node with a capped
 * heap for exactly this reason; this wrapper does the same for the *tsc*
 * phase. It is copied over node_modules/.bin/tsc by
 * scripts/install-tsc-wrapper.mjs (package.json "postinstall"), so every
 * `tsc` invocation — the deploy build and local checks alike — runs the real
 * compiler under Node with a capped old-space. If the capped run fails, it
 * retries uncapped so behaviour is never worse than before.
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

/** Locate the real compiler entry (typescript/bin/tsc). */
function findRealTsc() {
  // This file lives at node_modules/.bin/tsc → sibling typescript package.
  const besideBin = path.resolve(__dirname, "..", "typescript", "bin", "tsc");
  if (fs.existsSync(besideBin)) return besideBin;
  // Fallback: resolve from the project root (bins run with cwd = project).
  try {
    return require.resolve(path.join("typescript", "bin", "tsc"), {
      paths: [process.cwd()],
    });
  } catch {
    return null;
  }
}

/** Spawn the real tsc under Node; falls back to /usr/bin/node if `node` is not on PATH. */
function runTsc(nodeArgs) {
  const realTsc = findRealTsc();
  if (!realTsc) return { status: 1, error: new Error("typescript/bin/tsc not found") };

  const fullArgs = [...nodeArgs, realTsc, ...args];
  let result = spawnSync("node", fullArgs, { stdio: "inherit" });
  if (result.error && result.error.code === "ENOENT") {
    // `node` missing from PATH — try the standard install locations.
    for (const candidate of ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]) {
      if (!fs.existsSync(candidate)) continue;
      result = spawnSync(candidate, fullArgs, { stdio: "inherit" });
      if (!result.error) break;
    }
  }
  return result;
}

// Cap: measured peak (~0.86 GB RSS under Node) plus headroom, but far below
// Bun's unbounded ~1.76 GB. Let V8 manage it; on heap exhaustion the run
// fails and we retry uncapped below.
const CAPPED_ARGS = ["--max-old-space-size=1280"];

let result = runTsc(CAPPED_ARGS);
if (result.status !== 0) {
  // Fallback: uncapped, exactly the pre-wrapper behaviour.
  result = runTsc([]);
}

process.exit(result.status ?? 1);
