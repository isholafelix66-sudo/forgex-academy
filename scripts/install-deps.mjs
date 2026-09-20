#!/usr/bin/env node
/**
 * Dependency install for the deploy build (wired through vercel.json →
 * installCommand).
 *
 * Why this exists
 * ---------------
 * Deploy builds kept dying in the install step with a random handful of:
 *
 *   FileNotFound: failed copying files from cache to destination for package X
 *   Failed to install N packages            (bun exits 1 → the build aborts)
 *
 * Two separate faults were behind it:
 *
 *   1. bun's cache → node_modules materialization had a concurrency bug: when
 *      more than one bun process shares one download cache, entries can be
 *      read while another process rewrites them (oven-sh/bun#37830, "Concurrent
 *      bun x spawns can fail with FileNotFound: failed copying files from cache
 *      to destination"). Fixed in bun 1.4.0 — so package.json pins
 *      `packageManager: "bun@1.4.2"`.
 *   2. The default materialization uses hardlinks, which is the fragile part on
 *      this container's shared filesystem (`--backend=copyfile` has never
 *      failed here; the hardlink path has).
 *
 * So this step:
 *
 *   - installs with bun >= 1.4 when one is reachable (falling back to fetching
 *     it through bunx if the build image ships an older bun),
 *   - gives that install its own download cache (`--cache-dir`) so no other bun
 *     process can race it,
 *   - materializes with plain copies (`--backend=copyfile`), not hardlinks,
 *   - verifies the resulting tree (scripts/build.mjs --heal-check), repairs
 *     what is incomplete, resets from scratch as a last resort, and finally
 *     falls back to npm,
 *   - exits 0 ONLY once the tree is verified complete.
 *
 * The exit code is what gates the deploy, so this check — not bun's own
 * (sometimes false-alarm) status — decides the outcome.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const buildScript = path.join(here, "build.mjs");
const nmDir = "node_modules";

/** bun 1.4.0 fixed the concurrent cache-materialization bug (bun#37830). */
const MIN_BUN = [1, 4, 0];
/** Fetched through bunx when the build image ships an older bun. */
const PINNED_BUN = "1.4.2";
/** Private download cache — never shared with another bun process. */
const CACHE_DIR = path.join(os.tmpdir(), "forgex-bun-install-cache");

/** Marker so the preinstall hook does not re-enter during our child installs. */
const childEnv = { FORGE_PREINSTALL: "1" };

const spawn = (bin, args, options = {}) =>
  spawnSync(bin, args, { ...options, env: { ...process.env, ...childEnv } });

const summarize = (names) =>
  `${names.slice(0, 5).join(", ")}${names.length > 5 ? ", …" : ""}`;

function parseVersion(text) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text ?? "");
  return match ? match.slice(1).map(Number) : null;
}

function atLeast(version, min) {
  if (!version) return false;
  for (let i = 0; i < 3; i++) {
    if (version[i] !== min[i]) return version[i] > min[i];
  }
  return true;
}

/**
 * `{ bin, prefix }` used for every install attempt — `bun` alone, or
 * `bun x bun@1.4.2` when the image's bun predates the fix. null when there is
 * no bun at all, in which case npm is used.
 */
function resolveRunner() {
  if (spawnSync("bun", ["--version"], { stdio: "ignore" }).error) return null;

  const own = spawn("bun", ["--version"], { encoding: "utf8" });
  const ownVersion = own.status === 0 ? parseVersion(own.stdout) : null;
  if (atLeast(ownVersion, MIN_BUN)) {
    console.log(`[install] using bun ${ownVersion.join(".")}`);
    return { bin: "bun", prefix: [] };
  }

  console.log(
    `[install] bun ${ownVersion ? ownVersion.join(".") : "?"} predates the ` +
      `cache-materialization fix (${MIN_BUN.join(".")}) — fetching bun@${PINNED_BUN}`,
  );
  const runner = { bin: "bun", prefix: ["x", `bun@${PINNED_BUN}`] };
  const probed = spawn(runner.bin, [...runner.prefix, "--version"], {
    encoding: "utf8",
    timeout: 300_000,
  });
  const version = probed.status === 0 ? parseVersion(probed.stdout) : null;
  if (atLeast(version, MIN_BUN)) {
    console.log(`[install] bunx provided bun ${version.join(".")}`);
    return runner;
  }
  console.warn(
    "[install] could not obtain a fixed bun — continuing with the installed one " +
      "(private cache + copyfile backend still apply)",
  );
  return { bin: "bun", prefix: [] };
}

function runInstall(runner, label) {
  const args = [
    "install",
    "--backend=copyfile",
    `--cache-dir=${CACHE_DIR}`,
  ];
  console.log(
    `\n$ ${runner.bin} ${[...runner.prefix, ...args].join(" ")}${label ? `   (${label})` : ""}`,
  );
  return spawn(runner.bin, [...runner.prefix, ...args], { stdio: "inherit" });
}

function runNpm(label) {
  const args = ["install", "--no-audit", "--no-fund"];
  console.log(`\n$ npm ${args.join(" ")}${label ? `   (${label})` : ""}`);
  return spawn("npm", args, { stdio: "inherit" });
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

function removeTree(target) {
  try {
    rmSync(target, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.warn(`[install] could not remove ${target}: ${err.message}`);
    return false;
  }
}

if (!existsSync(buildScript)) {
  console.warn(`[install] ${buildScript} not found — the tree cannot be verified`);
}

const runner = resolveRunner();
const install = (label) => (runner ? runInstall(runner, label) : runNpm(label));

function stage(label) {
  const res = install(label);
  if (res.error) return { status: 1, broken: null, error: res.error };
  return { status: res.status ?? 1, broken: incomplete() };
}

// 1. Install with the race-safe backend, from a private cache.
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
    removeTree(path.join(nmDir, ...name.split("/")));
  }
  result = stage("repair");
  if (result.broken === null) break;
}

// 3. Last resort with bun: rebuild node_modules from scratch.
if (result.broken && result.broken.length > 0 && existsSync(nmDir)) {
  console.log(
    `[install] still incomplete (${summarize(result.broken)}) — reinstalling from scratch`,
  );
  if (removeTree(nmDir)) result = stage("clean slate");
}

// 4. Different installer, same gate: npm extracts tarballs directly instead of
//    linking from a shared cache.
if (runner && result.broken && result.broken.length > 0) {
  console.log(
    `[install] bun could not complete the tree (${summarize(result.broken)}) — falling back to npm`,
  );
  if (removeTree(nmDir)) result = stage("npm fallback");
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
