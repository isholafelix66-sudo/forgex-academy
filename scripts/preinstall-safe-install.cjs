#!/usr/bin/env node
/**
 * Preinstall hook — performs the REAL dependency install through a safe path.
 *
 * Why this exists:
 *
 *   This project's build container runs `bun install` against a virtiofs
 *   mount, where bun's hardlink cache→node_modules materialization races and
 *   intermittently leaves a random handful of packages half-written:
 *
 *     FileNotFound: failed copying files from cache to destination for package X
 *     Failed to install N packages
 *
 *   The failing install exits non-zero, which aborts the deploy build before
 *   scripts/build.mjs (which can heal the tree) ever runs. The failure set is
 *   random each run (observed: 3–517 packages), and bun cannot repair the
 *   damage on a re-run because it trusts any existing directory with a
 *   manifest, even when that directory's files are missing.
 *
 *   `bunfig.toml`'s `[install.cache] disable = true` did not stop the race.
 *   But a **preinstall lifecycle script runs before the outer install touches
 *   node_modules** — and this hook exploits that: it runs the real install
 *   itself with the two flags that make materialization safe here:
 *
 *     --cache-dir <project-local>  a fresh download cache, never the
 *                                  inherited global cache (~/.bun/install)
 *     --backend=copyfile           copies files instead of hardlinking,
 *                                  which sidesteps the race entirely
 *
 *   When the nested install finishes, the tree is complete, so the outer
 *   install reconciles to a warm no-op ("Checked … no changes") and exits 0.
 *   The healing layer in scripts/build.mjs remains as a second line of
 *   defence for damage from any other source.
 *
 * Recursion guard:
 *
 *   When FORGE_BUN_CACHE=1 the nested install IS the real install, so this
 *   hook must exit immediately (a preinstall script runs for every `bun
 *   install`, including the nested one).
 *
 * Failure handling:
 *
 *   If the nested install fails, this hook exits non-zero, which fails the
 *   outer install with a CLEAR error instead of bun's misleading
 *   "Failed to install N packages". Nothing is hidden.
 */
if (process.env.FORGE_BUN_CACHE === "1") {
  process.exit(0);
}

const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const installer = process.env.npm_config_user_agent?.startsWith("npm")
  ? "npm"
  : "bun";

// npm has no --cache-dir-equivalent problem (its own cache is content-
// addressed and doesn't hardlink); and npm never hit this failure mode.
// Only route bun installs through the safe path.
if (installer !== "bun") {
  process.exit(0);
}

// Project-local download cache. Recreated from scratch each install so no
// inherited cache state can ever poison materialization; removed afterwards
// to keep the workspace small. TempDir-based so concurrent builds don't clash.
let cacheDir;
try {
  cacheDir = mkdtempSync(path.join(os.tmpdir(), "forgex-bun-cache-"));
} catch (err) {
  console.warn(`[preinstall] could not create a temp cache dir: ${err.message}`);
  process.exit(0); // fall through to bun's default behaviour
}

console.log(
  `[preinstall] running the real install with a fresh cache and the copyfile backend (race-safe on this filesystem)…`,
);

const args = ["install", "--cache-dir", cacheDir, "--backend=copyfile"];

const res = spawnSync(installer, args, {
  stdio: "inherit",
  env: { ...process.env, FORGE_BUN_CACHE: "1" },
});

try {
  rmSync(cacheDir, { recursive: true, force: true });
} catch {
  // Non-fatal: a leftover temp cache dir is harmless.
}

if (res.error) {
  console.error(`[preinstall] nested install failed to start: ${res.error.message}`);
  process.exit(1);
}

if (res.status !== 0) {
  console.error(
    `[preinstall] nested install exited ${res.status} — failing the outer install with this clear error instead of bun's "Failed to install N packages".`,
  );
  process.exit(res.status ?? 1);
}

console.log("[preinstall] real install completed — outer install will reconcile as a no-op");
process.exit(0);
