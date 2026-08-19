import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { spawnSync } from "node:child_process";
import { defineConfig } from "vite";

// The deploy runner invokes `tsc -b && vite build` directly (it never runs
// `npm run build`), so a wrapper script can't bound the build's memory. V8's
// heap limit is only honoured when set at process start (runtime
// setFlagsFromString cannot lower it), so when we detect a production build
// invocation we re-exec the build as a child process with the cap applied
// from the first instruction. This keeps peak RSS ~1.1 GB — without it the
// build (three.js, recharts, Mux, canvas/PDF libs — 3,400+ modules) balloons
// past the container limit and the platform kills it with a bare "Killed".
// Dev server and preview runs (`vite`, `vite dev`, `vite preview`) are
// untouched — only `vite build` re-executes.
if (
  process.argv.includes("build") &&
  !process.env.__FORGEX_VITE_MEM_CAPPED__
) {
  // Prefer system Node (the flag is a V8 heap limit; Bun uses JavaScriptCore
  // and silently ignores --max-old-space-size, which is exactly when the
  // platform build balloons past the container limit and gets "Killed"). If
  // the CLI is being executed by Bun, spawn Node explicitly — trying PATH
  // first, then the standard install locations — and only fall back to the
  // current runtime (Bun, uncappable) when no Node binary exists at all.
  const execPath = process.execPath;
  const candidates =
    execPath.includes("bun") && !execPath.includes("node")
      ? [
          "node",
          "/usr/bin/node",
          "/usr/local/bin/node",
          "/opt/homebrew/bin/node",
        ]
      : [execPath];
  const run = (bin: string) =>      spawnSync(bin, ["--max-old-space-size=1024", ...process.argv.slice(1)], {
      stdio: "inherit",
      env: {
        ...process.env,
        __FORGEX_VITE_MEM_CAPPED__: "1",
        // Don't double-apply a NODE_OPTIONS cap from a wrapper script.
        NODE_OPTIONS: "",
      },
    });
  let result: ReturnType<typeof run> | null = null;
  for (const candidate of candidates) {
    try {
      result = run(candidate);
      if (!result.error) break;
    } catch {
      // Binary missing — try the next candidate.
    }
  }
  process.exit(result?.status ?? 1);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vlyPlugin(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        // Exact-match only (regex, not string prefix): swap the giant
        // lucide-react barrel (~1,900 icon modules) for a curated module
        // that re-exports only the icons the app actually uses. Deep
        // imports like "lucide-react/dist/esm/icons/*" keep resolving to
        // the real files. This roughly halves the build module graph and
        // keeps the production build within the platform's memory budget.
        find: /^lucide-react$/,
        replacement: path.resolve(__dirname, "./src/lib/lucide.ts"),
      },
    ],
    // Force a single copy of React across all packages (including vlyPlugin).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Skip the gzip-size computation pass — saves time and a little peak
    // memory during the final render phase (sizes still appear, just not
    // gzipped).
    reportCompressedSize: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
    rollupOptions: {
      // Limit concurrent module transforms: for a 3,400+ module graph this
      // measurably lowers peak memory during the transform/render phase.
      maxParallelFileOps: 2,
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@convex-dev/auth/react',
      'framer-motion',
    ],
  },
  // Performance hints
  server: {
    // Bind to all interfaces so WebContainer's server-ready event fires.
    host: true,
    port: 5173,
    // HMR must stay fully disabled in the managed preview environment: the
    // proxy cannot carry HMR websockets, and a broken HMR socket makes the
    // browser fall back to full-page reloads (pages appear to "keep
    // reloading").
    hmr: false,
  },
});
