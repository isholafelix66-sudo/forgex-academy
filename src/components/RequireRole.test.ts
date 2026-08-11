import { describe, expect, it } from "vitest";
import { resolveTutorAccess } from "./RequireRole";

const base = {
  authLoading: false,
  adminLoading: false,
  isAdmin: false,
  token: null,
  isAuthenticated: false,
  role: null,
  verified: null,
  applicationStatus: null,
};

describe("resolveTutorAccess", () => {
  it("waits while auth or the admin-session check is loading", () => {
    expect(resolveTutorAccess({ ...base, authLoading: true })).toEqual({
      kind: "loading",
    });
    expect(resolveTutorAccess({ ...base, adminLoading: true })).toEqual({
      kind: "loading",
    });
  });

  it("renders the read-only preview for a valid admin session (no account)", () => {
    expect(resolveTutorAccess({ ...base, isAdmin: true })).toEqual({
      kind: "render",
    });
  });

  it("renders for a verified tutor even when carrying a stale admin token", () => {
    // Regression: an authenticated tutor who once opened the admin preview
    // keeps a token in sessionStorage. The token must not boot them out of
    // their own dashboard.
    expect(
      resolveTutorAccess({
        ...base,
        token: "stale-admin-token",
        isAuthenticated: true,
        role: "tutor",
        verified: true,
      }),
    ).toEqual({ kind: "render" });
  });

  it("renders for an authenticated admin user even with a stale token", () => {
    expect(
      resolveTutorAccess({
        ...base,
        token: "stale-admin-token",
        isAuthenticated: true,
        role: "admin",
        verified: false,
      }),
    ).toEqual({ kind: "render" });
  });

  it("sends an expired admin session (no account) to the admin gate, not /auth", () => {
    expect(resolveTutorAccess({ ...base, token: "expired" })).toEqual({
      kind: "redirect-admin",
    });
  });

  it("sends a stale-token non-tutor user to the admin gate", () => {
    expect(
      resolveTutorAccess({
        ...base,
        token: "expired",
        isAuthenticated: true,
        role: "student",
      }),
    ).toEqual({ kind: "redirect-admin" });
  });

  it("sends signed-out visitors to /auth", () => {
    expect(resolveTutorAccess({ ...base })).toEqual({
      kind: "redirect-auth",
    });
  });

  it("shows the pending-verification gate for an unverified tutor", () => {
    expect(
      resolveTutorAccess({
        ...base,
        isAuthenticated: true,
        role: "tutor",
        verified: false,
      }),
    ).toEqual({ kind: "pending-verification" });
  });

  it("shows the under-review gate for submitted applications", () => {
    expect(
      resolveTutorAccess({
        ...base,
        isAuthenticated: true,
        role: "student",
        applicationStatus: "under-review",
      }),
    ).toEqual({ kind: "under-review" });
    expect(
      resolveTutorAccess({
        ...base,
        isAuthenticated: true,
        role: "student",
        applicationStatus: "submitted",
      }),
    ).toEqual({ kind: "under-review" });
  });

  it("requires an application for everyone else", () => {
    expect(
      resolveTutorAccess({
        ...base,
        isAuthenticated: true,
        role: "student",
        applicationStatus: null,
      }),
    ).toEqual({ kind: "no-access" });
  });
});
