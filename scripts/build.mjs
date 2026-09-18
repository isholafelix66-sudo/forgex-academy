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
// It also self-heals the dependency tree before building (see below).
//
// Runs the exact same steps as the previous `tsc -b && vite build`, just with
// per-step memory budgets. Fully cross-platform (spawns Node directly, so no
// shell-specific env syntax).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const thisFile = fileURLToPath(import.meta.url);

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
  return res.status ?? 1;
}

// ── Dependency healing (build-environment workaround) ──────────────────
//
// The build container's `bun install` intermittently ends with a random
// handful of packages only *partially* materialized into node_modules:
//
//   FileNotFound: failed copying files from cache to destination for package X
//   Failed to install N packages
//
// NOTE: `bun install` also reports that failure when a package it has to
// RE-materialize is missing from node_modules (reproduced by deleting any
// installed dir and re-running install), yet it still leaves a complete tree
// behind and exits non-zero. Healing can therefore never fix the install's
// exit code — which is why this repair runs here, as its own process on a
// settled tree, and not from the postinstall hook during the install itself.
//
// bun still reports partial success ("513 packages installed") while dropping
// a different set each run, and the damage is not always an empty directory —
// we have seen packages whose package.json survived but dist/ or .d.ts type
// files did not. A plain `bun install` does NOT repair these (bun trusts any
// dir that has a manifest); deleting the broken dir and reinstalling does.
//
// Two layers of defence:
//
//   1. Pre-flight check (fast, heuristic): every direct dependency must
//      resolve via require(), every installed dir must have its manifest,
//      the main entry's declared .d.ts must exist, and every installed
//      package (transitive ones included) must still have at least one of
//      the entry files its manifest declares. On damage, the broken dirs are
//      deleted and the install re-run (up to 2 passes). Deliberately
//      conservative to avoid false positives on healthy trees — verified
//      against all 539 installed packages: subpath and wildcard exports are
//      not validated (several packages legitimately declare type paths they
//      don't ship), entries are matched with Node-style extension fallback,
//      and type-only @types/* packages are not require()-checked (they have
//      no JS entry).
//   2. Failure fallback: if tsc/vite still report missing modules after the
//      pre-flight, node_modules is wiped and reinstalled from scratch, and
//      the failed step is retried once. Slow, but it runs only when healing
//      is genuinely needed.
const MISSING_MODULE_RE =
  /TS2307|Cannot find module|Could not resolve|Rollup failed to resolve|Could not load/;

const isTypesOnly = (name) => name.startsWith("@types/");

// Set BUILD_HEAL_DEBUG=1 to log exactly why a package is flagged as damaged.
const debug = process.env.BUILD_HEAL_DEBUG === "1";
const flag = (set, name, reason) => {
  if (debug) console.error(`[heal-debug] ${name}: ${reason}`);
  set.add(name);
};

/**
 * Every file path a manifest declares as an entry point (`main`, `module`, and
 * the file leaves of `exports`). Wildcard templates are skipped — packages
 * legitimately declare type paths they do not ship.
 */
function declaredEntries(manifest) {
  const out = [];
  for (const key of ["main", "module"]) {
    const value = manifest[key];
    if (typeof value === "string" && !value.includes("*")) out.push(value);
  }
  const visit = (node) => {
    if (typeof node === "string") {
      if (!node.includes("*")) out.push(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const value of Object.values(node)) visit(value);
  };
  visit(manifest.exports);
  return out;
}

// CJS packages routinely declare extensionless entries (`"main": "index"`) and
// directory entries, so a candidate counts as present if any Node-style
// resolution of it lands on a real file.
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

function findBrokenDeps() {
  const projectRequire = createRequire(path.join(process.cwd(), "package.json"));

  let pkg;
  try {
    pkg = JSON.parse(readFileSync("package.json", "utf8"));
  } catch (err) {
    console.warn(`[build] could not read package.json: ${err.message}`);
    return [];
  }
  const directDeps = Object.keys({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  });

  const broken = new Set();

  for (const name of directDeps) {
    const dir = path.join("node_modules", ...name.split("/"));
    const manifestPath = path.join(dir, "package.json");
    if (!existsSync(manifestPath)) {
      flag(broken, name, "package.json missing");
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (err) {
      flag(broken, name, `package.json unreadable: ${err.message}`);
      continue;
    }
    if (!isTypesOnly(name)) {
      try {
        projectRequire.resolve(name);
      } catch (err) {
        // ERR_PACKAGE_PATH_NOT_EXPORTED = import-only package, not damage.
        if (err?.code === "MODULE_NOT_FOUND" || err?.code === "ENOENT") {
          flag(broken, name, `resolve failed: ${err.code}`);
          continue;
        }
      }
    }
    // Main-entry types only: top-level types/typings and exports["."].
    // Skip wildcard templates and subpaths (legitimately unshipped sometimes).
    const typeCandidates = [];
    for (const value of [manifest.types, manifest.typings]) {
      if (typeof value === "string" && !value.includes("*")) {
        typeCandidates.push(value);
      }
    }
    const dotExport = manifest.exports?.["."];
    const visitDot = (node) => {
      if (!node || typeof node !== "object") return;
      if (typeof node.types === "string" && !node.types.includes("*")) {
        typeCandidates.push(node.types);
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === "object") visitDot(value);
      }
    };
    visitDot(dotExport);
    if (typeCandidates.some((rel) => !existsSync(path.join(dir, rel)))) {
      const missing = typeCandidates.filter((rel) => !existsSync(path.join(dir, rel)));
      flag(broken, name, `main-entry d.ts missing: ${missing.join(", ")}`);
    }
  }

  // Sweep EVERY installed dir — transitive dependencies included. This is the
  // only layer that can see transitive damage: the loop above only resolves
  // direct dependencies, and a partial copy of a transitive dep leaves the
  // manifest in place, so a manifest-existence test alone misses it. Both
  // observed shapes are caught here:
  //   - the manifest itself is gone, and
  //   - the manifest survived but not one entry file it declares exists
  //     (e.g. `@csstools/css-tokenizer`, a jsdom dependency that shipped only
  //     its package.json while dist/ vanished — it broke `vitest` outright).
  // Dot-entries (.bin, .cache, …) are not packages.
  const installedDirs = [];
  let nmEntries = [];
  try {
    nmEntries = readdirSync("node_modules");
  } catch {
    return [...broken]; // node_modules absent entirely — fallback will install
  }
  for (const entry of nmEntries) {
    if (entry.startsWith(".")) continue;
    if (!entry.startsWith("@")) {
      installedDirs.push(entry);
      continue;
    }
    let scoped = [];
    try {
      scoped = readdirSync(path.join("node_modules", entry));
    } catch {
      installedDirs.push(entry); // unreadable scope — flagged below
      continue;
    }
    for (const name of scoped) {
      if (!name.startsWith(".")) installedDirs.push(`${entry}/${name}`);
    }
  }

  for (const name of installedDirs) {
    const dir = path.join("node_modules", ...name.split("/"));
    const manifestPath = path.join(dir, "package.json");
    if (!existsSync(manifestPath)) {
      flag(broken, name, "sweep: package.json missing");
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (err) {
      flag(broken, name, `sweep: package.json unreadable: ${err.message}`);
      continue;
    }
    const entries = declaredEntries(manifest);
    // No declared entry at all (meta packages) is not damage.
    if (entries.length > 0 && !anyEntryExists(dir, entries)) {
      flag(
        broken,
        name,
        `sweep: no declared entry file exists (${entries.slice(0, 2).join(", ")})`,
      );
    }
  }

  return [...broken];
}

function healDependencies() {
  const broken = findBrokenDeps();
  if (broken.length === 0) return;

  const installer = process.env.npm_config_user_agent?.startsWith("npm")
    ? "npm"
    : "bun";

  let remaining = broken;
  for (let attempt = 1; attempt <= 2 && remaining.length > 0; attempt++) {
    console.log(
      `[build] ${remaining.length} package(s) damaged or missing in node_modules ` +
        `(${remaining.slice(0, 5).join(", ")}${remaining.length > 5 ? ", …" : ""}) — ` +
        `removing and reinstalling (healing attempt ${attempt}/2)`,
    );
    // bun trusts any existing dir with a manifest, so broken dirs must be
    // deleted first or the reinstall is a no-op.
    for (const name of remaining) {
      try {
        rmSync(path.join("node_modules", ...name.split("/")), {
          recursive: true,
          force: true,
        });
      } catch (err) {
        console.warn(`[build] could not remove node_modules/${name}: ${err.message}`);
      }
    }
    const res = spawnSync(installer, ["install"], {
      stdio: "inherit",
      env: process.env,
    });
    if (res.error) {
      console.warn(`[build] healing install failed to start: ${res.error.message}`);
      return;
    }
    // Recheck in a fresh child process (--heal-check mode) so no module
    // resolution state from the failing pre-heal check can leak into it.
    const recheck = spawnSync(process.execPath, [thisFile, "--heal-check"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (recheck.error || recheck.status !== 0) {
      console.warn("[build] healing recheck failed to run — assuming healed, continuing");
      return;
    }
    remaining = (recheck.stdout ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (remaining.length === 0) {
      console.log("[build] dependency tree healed — continuing");
      return;
    }
  }
  console.warn(
    "[build] packages still damaged after healing attempts: " + remaining.join(", "),
  );
}

/** Wipe node_modules and reinstall from scratch (slow, last-resort fallback). */
function resetNodeModules() {
  const installer = process.env.npm_config_user_agent?.startsWith("npm")
    ? "npm"
    : "bun";
  console.log(
    `[build] resetting node_modules and reinstalling with ${installer} (this can take a minute)…`,
  );
  try {
    rmSync("node_modules", { recursive: true, force: true });
  } catch (err) {
    console.warn(`[build] could not remove node_modules: ${err.message}`);
    return false;
  }
  const res = spawnSync(installer, ["install"], {
    stdio: "inherit",
    env: process.env,
  });
  return !res.error && res.status === 0;
}

/**
 * Run a build step with capture, so a missing-module failure can trigger one
 * full dependency reset + retry. Output is forwarded as it arrives (tsc/vite
 * write plain text, so the captured buffer is echoed verbatim afterwards).
 */
function runWithHeal(step, bin, args, memoryMb) {
  const attempt = (label) => {
    const env = {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${memoryMb}`,
    };
    console.log(`\n$ ${step}${label}`);
    const res = spawnSync(process.execPath, [bin, ...args], {
      stdio: ["inherit", "pipe", "pipe"],
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.stdout?.length) process.stdout.write(res.stdout);
    if (res.stderr?.length) process.stderr.write(res.stderr);
    return res;
  };

  let res = attempt("");
  if (res.status === 0) return;

  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (!MISSING_MODULE_RE.test(output)) {
    process.exit(res.status ?? 1); // genuine build error — no healing will help
  }

  console.warn(
    `[build] "${step}" failed with missing-module errors — attempting dependency reset and one retry`,
  );
  if (!resetNodeModules()) {
    console.warn("[build] dependency reset failed — aborting");
    process.exit(res.status ?? 1);
  }
  res = attempt(" (retry after dependency reset)");
  process.exit(res.status ?? 1);
}

// --heal-check mode: print damaged packages (one per line) and exit. Used
// internally for post-install rechecks in a fresh process, and usable
// standalone to inspect the tree without healing or building.
if (process.argv.includes("--heal-check")) {
  for (const name of findBrokenDeps()) console.log(name);
  process.exit(0);
}

// --heal mode: repair the dependency tree and exit, without building. The
// postinstall hook invokes this — it is the only code we get to run during a
// `bun install` that reports partial failures, which is exactly when the tree
// is left damaged and must be repaired before the next install can be a no-op.
if (process.argv.includes("--heal")) {
  healDependencies();
  process.exit(0);
}

healDependencies();

// ── Convex codegen (best-effort) ───────────────────────────────────────
// On Vercel / CI the Convex session may not be available, so codegen can
// fail.  As long as the committed _generated/ files are present the build
// will still succeed.
const convexBin = resolvePackageBin("convex");
const tscBin = resolvePackageBin("typescript");
const viteBin = resolvePackageBin("vite");

const codegen = spawnSync(process.execPath, [convexBin, "codegen"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024" },
});
if (codegen.status !== 0) {
  console.warn(
    `[build] convex codegen exited ${codegen.status} (optional, continuing)`,
  );
}

runWithHeal("tsc -b", tscBin, ["-b"], 2048);
runWithHeal("vite build", viteBin, ["build"], 1536);
