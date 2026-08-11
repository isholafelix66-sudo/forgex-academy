import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Convex Auth's server helper: tests control who (if anyone) is signed
// in for submitStory / myStories.
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

import { getAuthUserId } from "@convex-dev/auth/server";
import * as stories from "./stories";

const mockGetAuthUserId = vi.mocked(getAuthUserId);

// ---------------------------------------------------------------------------
// Minimal in-memory fake of the Convex ctx used by stories.ts
// ---------------------------------------------------------------------------

type Row = Record<string, unknown> & { _id: string };

function makeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = structuredClone(seed);
  let seq = 1;

  const db = {
    tables,
    query(table: string) {
      const rows = tables[table] ?? [];
      const q = {
        _pred: null as Array<[string, unknown]> | null,
        withIndex(
          _name: string,
          pred?: (b: { eq: (f: string, v: unknown) => unknown }) => unknown,
        ) {
          if (pred) {
            const conds: Array<[string, unknown]> = [];
            const builder = {
              eq: (field: string, value: unknown) => {
                conds.push([field, value]);
                return builder;
              },
            };
            pred(builder);
            q._pred = conds;
          }
          return q;
        },
        first() {
          return q.collect()[0] ?? null;
        },
        collect() {
          let out = rows;
          if (q._pred) {
            out = rows.filter((r) => q._pred!.every(([f, v]) => r[f] === v));
          }
          return [...out];
        },
      };
      return q;
    },
    get(id: string) {
      for (const rows of Object.values(tables)) {
        const found = rows.find((r) => r._id === id);
        if (found) return found;
      }
      return null;
    },
    insert(table: string, doc: Record<string, unknown>) {
      const row = { ...doc, _id: `${table}_${seq++}` } as Row;
      (tables[table] ??= []).push(row);
      return row._id;
    },
    patch(id: string, patch: Record<string, unknown>) {
      const row = db.get(id);
      if (row) Object.assign(row, patch);
    },
    delete(id: string) {
      for (const key of Object.keys(tables)) {
        tables[key] = tables[key].filter((r) => r._id !== id);
      }
    },
  };
  return db;
}

function makeCtx(
  db: ReturnType<typeof makeDb>,
  getUrl: (id: string) => Promise<string | null> = async (id) =>
    `https://storage.example/${id}`,
) {
  return {
    db,
    storage: {
      getUrl,
      delete: vi.fn(async () => undefined),
      generateUploadUrl: vi.fn(async () => "https://upload.example/url"),
    },
  };
}

type Handler = (ctx: unknown, args: never) => Promise<unknown>;
const call = <T>(fn: unknown, ctx: unknown, args: unknown) =>
  (fn as { _handler: Handler })._handler(ctx, args as never) as Promise<T>;

/** Seed a valid admin session (TTL is 12h; createdAt=now stays valid). */
const seedAdmin = (db: ReturnType<typeof makeDb>, token = "admin-token") => {
  db.insert("adminSessions", { token, createdAt: Date.now() });
};

const validStory = {
  name: "Ada Lovelace",
  course: "Web Development Path",
  story: "ForgeX helped me land my first internship as a frontend developer.",
};

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  mockGetAuthUserId.mockResolvedValue(null); // signed out by default
});

// ---------------------------------------------------------------------------
// submitStory — moderation + validation
// ---------------------------------------------------------------------------

describe("submitStory", () => {
  it("always creates a pending, non-featured story", async () => {
    const db = makeDb();
    const ctx = makeCtx(db);
    const story = (await call(stories.submitStory, ctx, validStory)) as Row;

    expect(story.status).toBe("pending");
    expect(story.featured).toBe(false);
    expect(story.name).toBe("Ada Lovelace");
    expect(story.createdAt).toBeTypeOf("number");
  });

  it("trims whitespace from name and course", async () => {
    const db = makeDb();
    const ctx = makeCtx(db);
    const story = (await call(stories.submitStory, ctx, {
      name: "  Ada Lovelace  ",
      course: "  Web Dev  ",
      story: "  ForgeX helped me learn TypeScript and get hired.  ",
    })) as Row;

    expect(story.name).toBe("Ada Lovelace");
    expect(story.course).toBe("Web Dev");
    expect(story.story).toBe("ForgeX helped me learn TypeScript and get hired.");
  });

  it("rejects a story shorter than 30 characters", async () => {
    const db = makeDb();
    const ctx = makeCtx(db);
    await expect(
      call(stories.submitStory, ctx, { ...validStory, story: "Too short." }),
    ).rejects.toThrow(/at least 30 characters/);
  });

  it("rejects an empty name or course", async () => {
    const db = makeDb();
    const ctx = makeCtx(db);
    await expect(
      call(stories.submitStory, ctx, { ...validStory, name: "A" }),
    ).rejects.toThrow(/tell us your name/);
    await expect(
      call(stories.submitStory, ctx, { ...validStory, course: "" }),
    ).rejects.toThrow(/course or program/);
  });

  it("links the submitter when signed in", async () => {
    mockGetAuthUserId.mockResolvedValue("user_123");
    const db = makeDb();
    const ctx = makeCtx(db);
    const story = (await call(stories.submitStory, ctx, validStory)) as Row;
    expect(story.userId).toBe("user_123");
  });

  it("resolves a photo URL server-side when a storage id is provided", async () => {
    const db = makeDb();
    const ctx = makeCtx(db);
    const story = (await call(stories.submitStory, ctx, {
      ...validStory,
      photoStorageId: "storage_abc",
    })) as Row;
    expect(story.photoUrl).toBe("https://storage.example/storage_abc");
  });

  it("rate-limits signed-in users (3 per day)", async () => {
    mockGetAuthUserId.mockResolvedValue("user_123");
    const db = makeDb();
    const ctx = makeCtx(db);
    for (let i = 0; i < 3; i++) {
      await call(stories.submitStory, ctx, validStory);
    }
    await expect(call(stories.submitStory, ctx, validStory)).rejects.toThrow(
      /already shared a few stories/,
    );
  });
});

// ---------------------------------------------------------------------------
// Public queries — only approved content ever leaks
// ---------------------------------------------------------------------------

describe("public story queries", () => {
  function seedStories(db: ReturnType<typeof makeDb>) {
    db.insert("studentStories", {
      ...validStory,
      name: "Pending Person",
      status: "pending",
      featured: false,
      createdAt: 100,
    });
    db.insert("studentStories", {
      ...validStory,
      name: "Approved Person",
      status: "approved",
      featured: false,
      createdAt: 200,
    });
    db.insert("studentStories", {
      ...validStory,
      name: "Featured Person",
      status: "approved",
      featured: true,
      createdAt: 300,
    });
    db.insert("studentStories", {
      ...validStory,
      name: "Rejected Person",
      status: "rejected",
      featured: true,
      createdAt: 400,
    });
  }

  it("approvedStories returns only approved rows (featured first, then newest)", async () => {
    const db = makeDb();
    seedStories(db);
    const rows = await call<Array<Row>>(
      stories.approvedStories,
      makeCtx(db),
      {},
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Featured Person",
      "Approved Person",
    ]);
  });

  it("featuredStories returns only approved AND featured rows", async () => {
    const db = makeDb();
    seedStories(db);
    const rows = await call<Array<Row>>(
      stories.featuredStories,
      makeCtx(db),
      {},
    );
    expect(rows.map((r) => r.name)).toEqual(["Featured Person"]);
  });

  it("myStories returns only the signed-in user's rows", async () => {
    mockGetAuthUserId.mockResolvedValue("user_7");
    const db = makeDb();
    db.insert("studentStories", {
      ...validStory,
      userId: "user_7",
      status: "approved",
      featured: false,
      createdAt: Date.now(),
    });
    db.insert("studentStories", {
      ...validStory,
      userId: "user_8",
      status: "approved",
      featured: false,
      createdAt: Date.now(),
    });
    const rows = await call<Array<Row>>(stories.myStories, makeCtx(db), {});
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user_7");
  });

  it("myStories returns [] when signed out", async () => {
    const db = makeDb();
    const rows = await call<Array<Row>>(stories.myStories, makeCtx(db), {});
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Admin portal — every action requires a valid admin session token
// ---------------------------------------------------------------------------

describe("admin actions require an admin session", () => {
  const adminActions: Array<[string, unknown]> = [
    ["storiesList", { token: "bad" }],
    ["reviewStory", { token: "bad", id: "story_1", status: "approved" }],
    ["createStory", { token: "bad", ...validStory }],
    ["updateStory", { token: "bad", id: "story_1", ...validStory }],
    ["deleteStory", { token: "bad", id: "story_1" }],
    ["deleteAllStories", { token: "bad" }],
    ["setStoryFeatured", { token: "bad", id: "story_1", featured: true }],
  ];

  it.each(adminActions)("%s throws without a valid token", async (fn, args) => {
    const db = makeDb();
    const ctx = makeCtx(db);
    const callable = (stories as unknown as Record<string, unknown>)[fn];
    await expect(call(callable, ctx, args)).rejects.toThrow(
      /Admin access required/,
    );
  });
});

describe("reviewStory", () => {
  it("approves a pending story", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "pending",
      featured: false,
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    const row = (await call(stories.reviewStory, ctx, {
      token: "admin-token",
      id,
      status: "approved",
    })) as Row;
    expect(row.status).toBe("approved");
    expect(row.reviewedAt).toBeTypeOf("number");
  });

  it("rejecting a story un-features it", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "approved",
      featured: true,
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    const row = (await call(stories.reviewStory, ctx, {
      token: "admin-token",
      id,
      status: "rejected",
    })) as Row;
    expect(row.status).toBe("rejected");
    expect(row.featured).toBe(false);
  });

  it("throws when the story does not exist", async () => {
    const db = makeDb();
    seedAdmin(db);
    await expect(
      call(stories.reviewStory, makeCtx(db), {
        token: "admin-token",
        id: "missing_1",
        status: "approved",
      }),
    ).rejects.toThrow(/Story not found/);
  });
});

describe("createStory", () => {
  it("creates an approved story (admin bypasses the queue)", async () => {
    const db = makeDb();
    seedAdmin(db);
    const ctx = makeCtx(db);
    const row = (await call(stories.createStory, ctx, {
      token: "admin-token",
      ...validStory,
    })) as Row;
    expect(row.status).toBe("approved");
    expect(row.featured).toBe(false);
  });

  it("honors the featured flag at creation", async () => {
    const db = makeDb();
    seedAdmin(db);
    const ctx = makeCtx(db);
    const row = (await call(stories.createStory, ctx, {
      token: "admin-token",
      ...validStory,
      featured: true,
    })) as Row;
    expect(row.featured).toBe(true);
  });

  it("validates content like submissions", async () => {
    const db = makeDb();
    seedAdmin(db);
    await expect(
      call(stories.createStory, makeCtx(db), {
        token: "admin-token",
        ...validStory,
        story: "nope",
      }),
    ).rejects.toThrow(/at least 30 characters/);
  });
});

describe("updateStory", () => {
  it("edits content and writes updatedAt", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "approved",
      featured: false,
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    const row = (await call(stories.updateStory, ctx, {
      token: "admin-token",
      id,
      name: "Grace Hopper",
      course: validStory.course,
      story: validStory.story,
    })) as Row;
    expect(row.name).toBe("Grace Hopper");
    expect(row.updatedAt).toBeTypeOf("number");
  });

  it("clears the photo when requested (and deletes storage)", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "approved",
      featured: false,
      photoStorageId: "storage_xyz",
      photoUrl: "https://storage.example/storage_xyz",
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    const row = (await call(stories.updateStory, ctx, {
      token: "admin-token",
      id,
      ...validStory,
      clearPhoto: true,
    })) as Row;
    expect(row.photoStorageId).toBeUndefined();
    expect(row.photoUrl).toBeUndefined();
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_xyz");
  });
});

describe("deleteStory", () => {
  it("deletes the row and its stored photo", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "approved",
      featured: true,
      photoStorageId: "storage_xyz",
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    await call(stories.deleteStory, ctx, { token: "admin-token", id });
    expect(db.get(id)).toBeNull();
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_xyz");
  });
});

describe("deleteAllStories", () => {
  it("deletes every story and returns the count", async () => {
    const db = makeDb();
    seedAdmin(db);
    db.insert("studentStories", {
      ...validStory,
      status: "approved",
      featured: true,
      createdAt: Date.now(),
    });
    db.insert("studentStories", {
      ...validStory,
      status: "pending",
      featured: false,
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    const count = await call<number>(stories.deleteAllStories, ctx, {
      token: "admin-token",
    });
    expect(count).toBe(2);
    expect(db.tables.studentStories ?? []).toHaveLength(0);
  });
});

describe("setStoryFeatured", () => {
  it("features an approved story", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "approved",
      featured: false,
      createdAt: Date.now(),
    });
    const ctx = makeCtx(db);
    const row = (await call(stories.setStoryFeatured, ctx, {
      token: "admin-token",
      id,
      featured: true,
    })) as Row;
    expect(row.featured).toBe(true);
  });

  it("hard-blocks featuring a pending story", async () => {
    const db = makeDb();
    seedAdmin(db);
    const id = db.insert("studentStories", {
      ...validStory,
      status: "pending",
      featured: false,
      createdAt: Date.now(),
    });
    await expect(
      call(stories.setStoryFeatured, makeCtx(db), {
        token: "admin-token",
        id,
        featured: true,
      }),
    ).rejects.toThrow(/Only approved stories can be featured/);
  });
});
