import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    // Primary path: ForgeX Gmail SMTP (branded template, sender "ForgeX
    // Academy"). The relay runs inside this deployment — the code never
    // leaves our infrastructure and is never persisted.
    const siteUrl =
      process.env.CONVEX_SITE_URL || process.env.VITE_CONVEX_SITE_URL;
    if (siteUrl) {
      try {
        const res = await axios.post(
          `${siteUrl}/api/internal/email-relay`,
          JSON.stringify({ to: email, code: token, kind: "otp" }),
          {
            headers: {
              "Content-Type": "application/json",
              "x-internal-key":
                process.env.INTERNAL_EMAIL_KEY ?? "fx-internal-relay-v1",
            },
            timeout: 20_000,
          },
        );
        const data = res.data as { sent?: boolean; fallback?: boolean };
        if (res.status === 200 && data.sent) return; // delivered via Gmail SMTP
        // Not configured or send failed → fall through to the platform
        // sender so sign-in NEVER breaks because of email delivery.
      } catch (error) {
        console.error("[otp] gmail relay failed, using fallback:", error);
      }
    }

    // Fallback: platform OTP sender (keeps auth working without SMTP keys).
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            // Freebuff's OTP sender key. Prefer the env var so the key can
            // be rotated from the Keys tab without a code change; falls back
            // to the template default so sign-in keeps working out of the box.
            "x-api-key":
              process.env.FORGE_OTP_API_KEY ??
              "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
