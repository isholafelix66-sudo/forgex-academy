#!/usr/bin/env node
/**
 * Resilient dependency install — the deploy build's install step.
 *
 * Why the backend matters
 * -----------------------
 * The build container's filesystem is a single virtiofs mount, and bun's
 * default materialization is `--backend=hardlink`: every file is linked from
 * the download cache into node_modules. On virtiofs that intermittently fails
 * part-way through a cold install:
 *
 *   FileNotFound: failed copying files from cache to destination for package X
 *   Failed to install N packages            (bun exits 1 → the build aborts)
 *
 * The failing set is random on every build, the tree is usually left complete
 * anyway, and — proven by this project's own build logs — the very same
 * install re-run with `--backend=copyfile` (plain copies, no hardlinks)
 * succeeds in that same container. There is no bunfig or environment-variable
 * equivalent: `--backend` is CLI-only, and every bunfig spelling still
 * hardlinks, so the install command itself has to carry it.
 *
 * What this step guarantees
 * -------------------------
 *   1. installs with --backend=copyfile up front (no hardlinks → no race),
 *   2. verifies the resulting tree (scripts/build.mjs --heal-check),
 *   3. deletes + reinstalls anything still incomplete, then resets from
 *      scratch as a last resort, and
 *   4. exits 0 ONLY when the tree is verified complete.
 *
 * The exit code is what aborts the deploy, so this check — not bun's own
 * (sometimes false-alarm) status — decides the outcome.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const buildScript = path.join(here, "build.mjs");
const nmDir = "node_modules";

/** Marker so the preinstall hook does not re-enter during our child installs. */
const childEnv = { FORGE_PREINSTALL: "1" };

function hasBun() {
  return !spawnSync("bun", ["--version"], { stdio: "ignore" }).error;
}

/** `--backend` is CLI-only; only pass it on a bun that advertises it. */
function backendSupported() {
  const res = spawnSync("bun", ["install", "--help"], { encoding: "utf8" });
  return !res.error && /--backend/.test(res.stdout ?? "");
}

const backendFlag = backendSupported() ? ["--backend=copyfile"] : [];

function install(label) {
  const [bin, args] = hasBun()
    ? ["bun", ["install", ...backendFlag]]
    : ["npm", ["install", "--no-audit", "--no-fund"]];
  console.log(`\n$ ${bin} ${args.join(" ")}${label ? `   (${label})` : ""}`);
  return spawnSync(bin, args, {
    stdio: "inherit",
    env: { ...process.env, ...childEnv },
  });
}

/** Incomplete package names, or null when the check itself could not run. */
function incomplete() {
  const res = spawnSync(process.execPath, [buildScript, "--heal-check"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) return null;
  return (res.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function stage(label) {
  const res = install(label);
  if (res.error) return { status: 1, broken: null, error: res.error };
  return { status: res.status ?? 1, broken: incomplete() };
}

const summarize = (names) =>
  `${names.slice(0, 5).join(", ")}${names.length > 5 ? ", …" : ""}`;

if (!existsSync(buildScript)) {
  console.warn(`[install] ${buildScript} not found — running a plain install`);
}

// 1. Install with the race-safe backend.
let result = stage("copyfile backend");
if (result.error) {
  console.error(`[install] could not start the install: ${result.error.message}`);
  process.exit(1);
}

if (result.broken === null) {
  console.warn(
    "[install] dependency check unavailable — deferring to the installer's exit status",
  );
  process.exit(result.status);
}
if (result.broken.length === 0) {
  console.log("[install] dependency tree verified complete");
  process.exit(0);
}

// 2. Repair passes: delete the incomplete dirs and reinstall them.
for (let attempt = 1; attempt <= 2 && result.broken.length > 0; attempt++) {
  console.log(
    `[install] ${result.broken.length} package(s) incomplete ` +
      `(${summarize(result.broken)}) — repairing (attempt ${attempt}/2)`,
  );
  for (const name of result.broken) {
    rmSync(path.join(nmDir, ...name.split("/")), { recursive: true, force: true });
  }
  result = stage("repair");
  if (result.broken === null) break;
}

// 3. Last resort: rebuild node_modules from scratch.
if (result.broken && result.broken.length > 0 && existsSync(nmDir)) {
  console.log(
    `[install] still incomplete (${summarize(result.broken)}) — reinstalling from scratch`,
  );
  try {
    rmSync(nmDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[install] could not remove node_modules: ${err.message}`);
  }
  result = stage("clean slate");
}

if (result.broken === null) {
  console.warn("[install] dependency check unavailable after repair");
  process.exit(result.status);
}
if (result.broken.length > 0) {
  console.error(
    `[install] dependency tree still incomplete after repair: ${result.broken.join(", ")}`,
  );
  process.exit(1);
}
console.log("[install] dependency tree verified complete");
process.exit(0);
