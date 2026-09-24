/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminCrypto from "../adminCrypto.js";
import type * as adminLessonExtras from "../adminLessonExtras.js";
import type * as adminSecurity from "../adminSecurity.js";
import type * as aiCourseCatalog from "../aiCourseCatalog.js";
import type * as aiCourseSeed from "../aiCourseSeed.js";
import type * as aiResources from "../aiResources.js";
import type * as aiSupport from "../aiSupport.js";
import type * as aiSupportData from "../aiSupportData.js";
import type * as aiVoice from "../aiVoice.js";
import type * as apitemplate from "../apitemplate.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as certificateExportHtml from "../certificateExportHtml.js";
import type * as certificates from "../certificates.js";
import type * as cloudinary from "../cloudinary.js";
import type * as community from "../community.js";
import type * as communityAdmin from "../communityAdmin.js";
import type * as contact from "../contact.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emailData from "../emailData.js";
import type * as emailService from "../emailService.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as emailTriggers from "../emailTriggers.js";
import type * as exams from "../exams.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as learn from "../learn.js";
import type * as lessonquizzes from "../lessonquizzes.js";
import type * as lib from "../lib.js";
import type * as lms from "../lms.js";
import type * as lmsShared from "../lmsShared.js";
import type * as media from "../media.js";
import type * as messages from "../messages.js";
import type * as monitor from "../monitor.js";
import type * as monitorCore from "../monitorCore.js";
import type * as monitorData from "../monitorData.js";
import type * as monitorMutation from "../monitorMutation.js";
import type * as mux from "../mux.js";
import type * as notifications from "../notifications.js";
import type * as portfolioAdmin from "../portfolioAdmin.js";
import type * as portfolioEmail from "../portfolioEmail.js";
import type * as portfolioEmailLog from "../portfolioEmailLog.js";
import type * as portfolioHelp from "../portfolioHelp.js";
import type * as portfolioMessages from "../portfolioMessages.js";
import type * as portfolioNotifications from "../portfolioNotifications.js";
import type * as portfolioUploads from "../portfolioUploads.js";
import type * as portfolioUsers from "../portfolioUsers.js";
import type * as portfolioVideo from "../portfolioVideo.js";
import type * as projects from "../projects.js";
import type * as promptSeedData from "../promptSeedData.js";
import type * as prompts from "../prompts.js";
import type * as public_ from "../public.js";
import type * as quizBank from "../quizBank.js";
import type * as quizgen from "../quizgen.js";
import type * as quizgenInternal from "../quizgenInternal.js";
import type * as quizzes from "../quizzes.js";
import type * as resilienceData from "../resilienceData.js";
import type * as resilienceGateway from "../resilienceGateway.js";
import type * as reviews from "../reviews.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as storage from "../storage.js";
import type * as stories from "../stories.js";
import type * as submissions from "../submissions.js";
import type * as syncData from "../syncData.js";
import type * as team from "../team.js";
import type * as teamAccess from "../teamAccess.js";
import type * as teamWorkspace from "../teamWorkspace.js";
import type * as tutor from "../tutor.js";
import type * as tutorSupport from "../tutorSupport.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminCrypto: typeof adminCrypto;
  adminLessonExtras: typeof adminLessonExtras;
  adminSecurity: typeof adminSecurity;
  aiCourseCatalog: typeof aiCourseCatalog;
  aiCourseSeed: typeof aiCourseSeed;
  aiResources: typeof aiResources;
  aiSupport: typeof aiSupport;
  aiSupportData: typeof aiSupportData;
  aiVoice: typeof aiVoice;
  apitemplate: typeof apitemplate;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  certificateExportHtml: typeof certificateExportHtml;
  certificates: typeof certificates;
  cloudinary: typeof cloudinary;
  community: typeof community;
  communityAdmin: typeof communityAdmin;
  contact: typeof contact;
  crons: typeof crons;
  email: typeof email;
  emailData: typeof emailData;
  emailService: typeof emailService;
  emailTemplates: typeof emailTemplates;
  emailTriggers: typeof emailTriggers;
  exams: typeof exams;
  http: typeof http;
  jobs: typeof jobs;
  learn: typeof learn;
  lessonquizzes: typeof lessonquizzes;
  lib: typeof lib;
  lms: typeof lms;
  lmsShared: typeof lmsShared;
  media: typeof media;
  messages: typeof messages;
  monitor: typeof monitor;
  monitorCore: typeof monitorCore;
  monitorData: typeof monitorData;
  monitorMutation: typeof monitorMutation;
  mux: typeof mux;
  notifications: typeof notifications;
  portfolioAdmin: typeof portfolioAdmin;
  portfolioEmail: typeof portfolioEmail;
  portfolioEmailLog: typeof portfolioEmailLog;
  portfolioHelp: typeof portfolioHelp;
  portfolioMessages: typeof portfolioMessages;
  portfolioNotifications: typeof portfolioNotifications;
  portfolioUploads: typeof portfolioUploads;
  portfolioUsers: typeof portfolioUsers;
  portfolioVideo: typeof portfolioVideo;
  projects: typeof projects;
  promptSeedData: typeof promptSeedData;
  prompts: typeof prompts;
  public: typeof public_;
  quizBank: typeof quizBank;
  quizgen: typeof quizgen;
  quizgenInternal: typeof quizgenInternal;
  quizzes: typeof quizzes;
  resilienceData: typeof resilienceData;
  resilienceGateway: typeof resilienceGateway;
  reviews: typeof reviews;
  search: typeof search;
  seed: typeof seed;
  storage: typeof storage;
  stories: typeof stories;
  submissions: typeof submissions;
  syncData: typeof syncData;
  team: typeof team;
  teamAccess: typeof teamAccess;
  teamWorkspace: typeof teamWorkspace;
  tutor: typeof tutor;
  tutorSupport: typeof tutorSupport;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
