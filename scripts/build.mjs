// Production build runner.
//
// This app is large (3,400+ modules: three.js, recharts, Mux player, canvas
// and PDF libraries…). On the deploy build environment (Freebuff/Vercel) the
// process is SIGKILLed ("Killed") when Rollup's "rendering chunks" phase
// peaks above the container's memory budget — with an unlimited heap, V8
// defers garbage collection and peak RSS climbs to ~1.3-1.4 GB.
//
// Two levers keep the build inside the budget:
//
//   1. No manual chunk grouping in vite.config.ts — default splitting renders
//      smaller chunks with a measurably lower peak (and no empty-chunk
//      warnings).
//   2. A bounded V8 heap for `vite build` (~1024 MB): V8 collects earlier and
//      peak RSS stays near ~1.1-1.2 GB, which fits the container. TypeScript
//      gets a generous cap so it can never abort.
//
// Runs the exact same steps as the previous `tsc -b && vite build`, just with
// per-step memory budgets. Fully cross-platform (spawns Node directly, so no
// shell-specific env syntax).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Resolve the real JS entry of a package's bin (bypasses "exports" maps). */
function resolvePackageBin(pkgName) {
  const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const bin =
    typeof pkg.bin === "string" ? pkg.bin : (pkg.bin && Object.values(pkg.bin)[0]);
  if (!bin) throw new Error(`No bin entry found for ${pkgName}`);
  return path.join(path.dirname(pkgJsonPath), bin);
}

function run(step, bin, args, memoryMb) {
  const env = {
    ...process.env,
    NODE_OPTIONS: `--max-old-space-size=${memoryMb}`,
  };
  console.log(`\n$ ${step}`);
  const res = spawnSync(process.execPath, [bin, ...args], {
    stdio: "inherit",
    env,
  });
  if (res.error) {
    console.error(`[build] failed to start "${step}":`, res.error);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const convexBin = resolvePackageBin("convex");
const tscBin = resolvePackageBin("typescript");
const viteBin = resolvePackageBin("vite");

run("convex codegen", convexBin, ["codegen"], 1024);
run("tsc -b", tscBin, ["-b"], 2048);
run("vite build", viteBin, ["build"], 1536);
