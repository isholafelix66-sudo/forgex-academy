// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Value } from "convex/values";
import { type MutationCtx } from "./_generated/server";
import { emailOtp } from "./auth/emailOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    emailOtp,
    Password({
      id: "password",
      profile(params) {
        const profile: { email: string; name?: string } = {
          email: params.email as string,
        };
        const name = (params.name as string | undefined)?.trim();
        if (name) profile.name = name;
        return profile;
      },
    }),
  ],
  // One account per person. This project can sign a person in through more
  // than one path (email OTP here + the federated Freebuff JWT configured in
  // auth.config.ts), and the library's default linking only kicks in when a
  // provider proves the email is verified — the federated path doesn't, so it
  // would otherwise create a second users row for the same email. This
  // callback links any new account whose email already belongs to a user to
  // that SAME user, so a returning student always lands on their existing
  // dashboard (enrollments, certificates, profile) instead of a fresh empty
  // account. Seeded demo accounts are never matched, so a real sign-up can't
  // take over a demo identity.
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId !== null) return existingUserId;
      // The library types ctx as a generic AnyDataModel; at runtime it IS the
      // project's mutation ctx, so cast to the typed ctx to query our tables.
      const db = (ctx as unknown as MutationCtx).db;
      const email = (profile.email ?? "").trim().toLowerCase();
      if (email) {
        // One email may already belong to several rows (legacy duplicates,
        // e.g. a student account created before a tutor application). Always
        // link to the BEST account for that email — never create a second
        // one, and never land a tutor on a stale student portal. Preference:
        // admin > verified tutor > tutor > student, then most recently active.
        const matches = await db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .collect();
        const real = matches
          .filter((u) => !u.isSeed)
          .sort((a, b) => {
            const prio = (u: (typeof matches)[number]) => {
              if (u.role === "admin") return 4;
              if (u.role === "tutor" && u.verified) return 3;
              if (u.role === "tutor") return 2;
              return 1; // student / unknown — lowest
            };
            return prio(b) - prio(a) || (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
          });
        const best = real[0];
        if (best) return best._id;
      }
      return await db.insert("users", {
        name: typeof profile.name === "string" ? profile.name : undefined,
        email: typeof profile.email === "string" ? profile.email : undefined,
        image: typeof profile.image === "string" ? profile.image : undefined,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        isAnonymous:
          typeof profile.isAnonymous === "boolean" ? profile.isAnonymous : undefined,
      });
    },
  },
});
