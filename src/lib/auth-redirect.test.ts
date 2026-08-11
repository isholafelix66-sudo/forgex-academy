import { describe, expect, it } from "vitest";
import { resolveRedirectAfterAuth } from "./auth-redirect";

describe("resolveRedirectAfterAuth", () => {
  it("returns a same-site path unchanged", () => {
    expect(resolveRedirectAfterAuth("/dashboard")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("/learn/typescript")).toBe(
      "/learn/typescript",
    );
    expect(resolveRedirectAfterAuth("/courses?tab=popular")).toBe(
      "/courses?tab=popular",
    );
  });

  it("falls back for null and undefined returnTo", () => {
    expect(resolveRedirectAfterAuth(null)).toBe("/dashboard");
    expect(resolveRedirectAfterAuth(undefined)).toBe("/dashboard");
  });

  it("blocks protocol-relative URLs (open redirect)", () => {
    expect(resolveRedirectAfterAuth("//evil.com")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("//evil.com/path")).toBe("/dashboard");
  });

  it("blocks non-path returnTos", () => {
    expect(resolveRedirectAfterAuth("https://evil.com")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("javascript:alert(1)")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("mailto:admin@evil.com")).toBe(
      "/dashboard",
    );
    expect(resolveRedirectAfterAuth("dashboard")).toBe("/dashboard");
  });

  it("blocks backslashes and control characters", () => {
    expect(resolveRedirectAfterAuth("/\\evil.com")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("/path\u0000")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("/path\u001F")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(resolveRedirectAfterAuth(null, "/tutor")).toBe("/tutor");
    expect(resolveRedirectAfterAuth("//evil.com", "/tutor")).toBe("/tutor");
  });
});
