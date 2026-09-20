import { describe, expect, it } from "vitest";
import { friendlyError, isBackendRejection, isValidationError } from "./errors";

/** A realistic wrapped server error as the Convex client surfaces it. */
const wrapped = (message: string) =>
  `[CONVEX M(admin:setUserRole)] [Request ID: 8f3a1c] Server Error\n` +
  `Uncaught Error: ${message}\n` +
  `    at handler (../convex/admin.ts:341:13)\n` +
  `    at async invoke (../convex/server.ts:88:5)`;

describe("friendlyError", () => {
  it("keeps the app's own message from a wrapped server error", () => {
    expect(
      friendlyError(wrapped("The Owner account is permanent — it cannot be changed to another role.")),
    ).toBe(
      "The Owner account is permanent — it cannot be changed to another role.",
    );
    expect(friendlyError(wrapped("Incorrect access password."))).toBe(
      "Incorrect access password.",
    );
    expect(friendlyError(wrapped("The OTP is incorrect or has expired."))).toBe(
      "The OTP is incorrect or has expired.",
    );
  });

  it("never surfaces backend internals", () => {
    const cases = [
      wrapped("Something exploded"),
      `[CONVEX M(adminSecurity:requestPasswordChange)] [Request ID: 1] Server Error`,
      "ArgumentValidationError: Value does not match validator.\nPath: .token",
    ];
    for (const err of cases) {
      const out = friendlyError(err);
      expect(out).not.toMatch(/convex|Request ID|CONVEX|ArgumentValidation|adminSecurity/i);
      expect(out).not.toMatch(/at handler|\.ts:\d+/);
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it("returns the hiccup message for an envelope with no detail", () => {
    expect(
      friendlyError("[CONVEX M(admin:stats)] [Request ID: 2] Server Error"),
    ).toBe("The server hiccuped — please try again in a moment.");
  });

  it("passes plain app errors and strings through untouched", () => {
    expect(friendlyError(new Error("Not signed in"))).toBe("Not signed in");
    expect(friendlyError("You must be signed in")).toBe("You must be signed in");
    expect(friendlyError(null, "Fallback copy")).toBe("Fallback copy");
    expect(friendlyError(undefined)).toBe(
      "Something went wrong — please try again.",
    );
  });

  it("maps validation rejections to friendly copy", () => {
    expect(friendlyError("ArgumentValidationError: Value does not match validator.")).toBe(
      "One of the fields you entered wasn't accepted — please check the form and try again.",
    );
  });

  it("classifies validation and generic backend rejections", () => {
    expect(isValidationError(wrapped("ArgumentValidationError: nope"))).toBe(true);
    expect(isValidationError("Not signed in")).toBe(false);
    expect(isBackendRejection("[CONVEX M(x)] [Request ID: 1] Server Error")).toBe(true);
    expect(isBackendRejection("Incorrect access password.")).toBe(false);
  });
});
