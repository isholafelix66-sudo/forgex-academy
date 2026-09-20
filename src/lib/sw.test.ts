import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./sw";

/** Install a fake Service Worker container + Cache Storage on the jsdom globals. */
function stubServiceWorker() {
  const unregister = vi.fn().mockResolvedValue(true);
  const register = vi.fn().mockResolvedValue({});
  const serviceWorker = {
    register,
    getRegistrations: vi
      .fn()
      .mockResolvedValue([{ unregister }, { unregister }]),
    controller: null,
  };
  const deleted: string[] = [];
  const cachesStub = {
    keys: vi
      .fn()
      .mockResolvedValue(["forgex-shell-v5", "forgex-fonts-v5", "unrelated"]),
    delete: vi.fn(async (key: string) => {
      deleted.push(key);
      return true;
    }),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: serviceWorker,
    configurable: true,
  });
  Object.defineProperty(window, "caches", {
    value: cachesStub,
    configurable: true,
  });
  return { register, unregister, deleted };
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  delete (window as unknown as Record<string, unknown>).caches;
  vi.restoreAllMocks();
});

describe("registerServiceWorker (dev)", () => {
  it("never registers against the dev server, even on a later load event", async () => {
    // The guard under test is the dev branch, so the suite must run in dev.
    expect(import.meta.env.DEV).toBe(true);
    const { register } = stubServiceWorker();

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();

    expect(register).not.toHaveBeenCalled();
  });

  it("unregisters workers installed by an earlier dev session", async () => {
    const { unregister, register } = stubServiceWorker();

    registerServiceWorker();

    await vi.waitFor(() => expect(unregister).toHaveBeenCalledTimes(2));
    expect(register).not.toHaveBeenCalled();
  });

  it("drops the app's cached shells but leaves unrelated caches alone", async () => {
    const { deleted } = stubServiceWorker();

    registerServiceWorker();

    await vi.waitFor(() =>
      expect(deleted).toEqual(["forgex-shell-v5", "forgex-fonts-v5"]),
    );
  });

  it("is a silent no-op where Service Workers are unavailable", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
    });
    expect(() => registerServiceWorker()).not.toThrow();
  });
});
