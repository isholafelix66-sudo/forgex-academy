import "@testing-library/jest-dom/vitest";

// Convex's generated server helpers log a warning (and may throw in future
// versions) when imported in a browser-like environment. Inside jsdom tests
// we import those modules only to unit-test their handlers, so opt in.
if (
  typeof window !== "undefined" &&
  typeof (window as { __convexAllowFunctionsInBrowser?: boolean })
    .__convexAllowFunctionsInBrowser !== "boolean"
) {
  (window as { __convexAllowFunctionsInBrowser?: boolean })
    .__convexAllowFunctionsInBrowser = true;
}
