import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for `src/lib/lucide.ts`.
 *
 * vite.config.ts aliases the exact specifier `lucide-react` to that barrel, so
 * `import { Foo } from "lucide-react"` must find `Foo` there. TypeScript does
 * NOT catch a missing icon (the real package's types still describe it), so
 * the failure only surfaces at `vite build` time, mid-deploy:
 *
 *   "Lightbulb" is not exported by "src/lib/lucide.ts"
 *
 * This test walks every source file, collects the named imports from
 * `lucide-react`, and asserts each one is exported by the barrel — turning a
 * silent deploy break into a failing unit test.
 */

const SRC = path.resolve(__dirname, "..");
const BARREL = path.join(SRC, "lib", "lucide.ts");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "_generated" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && full !== BARREL && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Names (and default) exported by the curated barrel. */
function barrelExports(): { named: Set<string>; hasDefault: boolean } {
  const source = readFileSync(BARREL, "utf8");
  const named = new Set<string>();

  // `export { default as Foo } from "...";` and `export { A, B as C };`
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const specifier of match[1].split(",")) {
      const trimmed = specifier.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+as\s+/);
      const exported = (parts[1] ?? parts[0]).replace(/^type\s+/, "").trim();
      if (exported && exported !== "default") named.add(exported);
    }
  }

  // `export const Foo = ...;`
  for (const match of source.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g)) {
    named.add(match[1]);
  }

  return { named, hasDefault: /export\s+default\b/.test(source) };
}

describe("lucide barrel", () => {
  it("exports every icon imported from `lucide-react`", () => {
    const { named, hasDefault } = barrelExports();
    const missing = new Map<string, string[]>();

    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      const rel = path.relative(SRC, file);

      for (const match of source.matchAll(
        /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g,
      )) {
        for (const specifier of match[1].split(",")) {
          const trimmed = specifier.trim();
          if (!trimmed) continue;
          // Type-only specifiers are erased by the compiler and never reach Rollup.
          if (/^type\s/.test(trimmed)) continue;
          const local = trimmed.split(/\s+as\s+/).slice(-1)[0].trim();
          if (!local || named.has(local)) continue;
          if (!missing.has(local)) missing.set(local, []);
          missing.get(local)!.push(rel);
        }
      }

      if (/import\s+[A-Za-z0-9_$]+\s+from\s*["']lucide-react["']/.test(source) && !hasDefault) {
        missing.set("(default import)", [...(missing.get("(default import)") ?? []), rel]);
      }
    }

    expect(
      [...missing.entries()].map(([icon, files]) => `${icon} (used by ${files.join(", ")})`),
    ).toEqual([]);
  });
});
