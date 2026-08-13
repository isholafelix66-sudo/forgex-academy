import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

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
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
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
