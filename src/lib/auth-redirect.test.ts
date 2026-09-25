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
    expect(resolveRedirectAfterAuth(null)).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth(undefined)).toBe("/academy/dashboard");
  });

  it("blocks protocol-relative URLs (open redirect)", () => {
    expect(resolveRedirectAfterAuth("//evil.com")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("//evil.com/path")).toBe("/academy/dashboard");
  });

  it("blocks non-path returnTos", () => {
    expect(resolveRedirectAfterAuth("https://evil.com")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("javascript:alert(1)")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("mailto:admin@evil.com")).toBe(
      "/academy/dashboard",
    );
    expect(resolveRedirectAfterAuth("dashboard")).toBe("/academy/dashboard");
  });

  it("blocks backslashes and control characters", () => {
    expect(resolveRedirectAfterAuth("/\\evil.com")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("/path\u0000")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("/path\u001F")).toBe("/academy/dashboard");
  });

  it("blocks /auth as a target (redirect-loop guard)", () => {
    expect(resolveRedirectAfterAuth("/auth")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("/auth?mode=signup")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("/auth?returnTo=/dashboard")).toBe(
      "/academy/dashboard",
    );
    expect(resolveRedirectAfterAuth("/auth#top")).toBe("/academy/dashboard");
    expect(resolveRedirectAfterAuth("/auth/forgot")).toBe("/academy/dashboard");
  });

  it("does not block unrelated paths that merely share the /auth prefix", () => {
    expect(resolveRedirectAfterAuth("/dashboard")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("/courses")).toBe("/courses");
  });

  it("honors a custom fallback", () => {
    expect(resolveRedirectAfterAuth(null, "/tutor")).toBe("/tutor");
    expect(resolveRedirectAfterAuth("//evil.com", "/tutor")).toBe("/tutor");
    expect(resolveRedirectAfterAuth("/auth", "/tutor")).toBe("/tutor");
  });
});
