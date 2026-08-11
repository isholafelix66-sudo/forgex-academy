import path from "path";
import { defineConfig } from "vitest/config";

// Dedicated test config: mirrors the `@` alias from vite.config.ts without
// pulling in the app's dev-server plugins (vlyPlugin, Tailwind), which are
// not needed — and can be disruptive — inside the test environment.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 15000,
  },
});
