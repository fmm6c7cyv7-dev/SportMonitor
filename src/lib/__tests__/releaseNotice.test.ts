import { describe, expect, it } from "vitest";
import packageJson from "../../../package.json";
import packageLock from "../../../package-lock.json";
import {
  RELEASE_VERSION,
  RELEASE_STORAGE_PREFIX,
  releaseNoticeKey,
  WELCOME_STORAGE_KEY,
  createReleaseNoticeStore,
  getReleaseNoticeServerSnapshot,
} from "@/lib/releaseNotice";

function environment(initial: Record<string, string> = {}, blocked = false) {
  const values = new Map(Object.entries(initial));
  const events = new Set<(key: string | null) => void>();
  return {
    values,
    fire(key: string | null) { for (const listener of events) listener(key); },
    environment: {
      storage: () => {
        if (blocked) throw new Error("Storage blocked");
        return {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => { values.set(key, value); },
        };
      },
      listen: (listener: (key: string | null) => void) => {
        events.add(listener);
        return () => { events.delete(listener); };
      },
    },
  };
}

describe("release version and acknowledgement", () => {
  it("uses one synchronized package version in footer/release store and lockfile", () => {
    expect(RELEASE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(RELEASE_VERSION).toBe(packageJson.version);
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
  });
  it("keeps server rendering hidden to avoid hydration flash", () => {
    expect(getReleaseNoticeServerSnapshot()).toBe("hidden");
  });
  it("shows one combined welcome on first opening without acknowledging at render", () => {
    const env = environment();
    const store = createReleaseNoticeStore("6.3.1", env.environment);
    expect(store.snapshot()).toBe("welcome");
    expect(store.snapshot()).toBe("welcome");
    expect(env.values.size).toBe(0);
    store.acknowledge();
    expect(env.values.get(WELCOME_STORAGE_KEY)).toBe("true");
    expect(env.values.get(releaseNoticeKey("6.3.1"))).toBe("true");
    expect(store.snapshot()).toBe("hidden");
  });
  it("shows only the update to an existing user, then stays hidden after reopening", () => {
    const env = environment({[WELCOME_STORAGE_KEY]: "true"});
    const store = createReleaseNoticeStore("6.3.1", env.environment);
    expect(store.snapshot()).toBe("update");
    store.acknowledge();
    expect(createReleaseNoticeStore("6.3.1", env.environment).snapshot()).toBe("hidden");
  });
  it("shows a new release after the old release was acknowledged", () => {
    const env = environment({[WELCOME_STORAGE_KEY]: "true"});
    createReleaseNoticeStore("6.3.1", env.environment).acknowledge();
    expect(createReleaseNoticeStore("6.3.2", env.environment).snapshot()).toBe("hidden");
    expect(createReleaseNoticeStore("6.4.1", env.environment).snapshot()).toBe("update");
    expect(createReleaseNoticeStore("7.0.1", env.environment).snapshot()).toBe("update");
  });
  it("inherits acknowledgement from a previously seen patch-specific release", () => {
    const env = environment({[WELCOME_STORAGE_KEY]: "true", [`${RELEASE_STORAGE_PREFIX}6.3.1`]: "true"});
    expect(createReleaseNoticeStore("6.3.2", env.environment).snapshot()).toBe("hidden");
    expect(createReleaseNoticeStore("6.4.1", env.environment).snapshot()).toBe("update");
  });
  it("never repeats an acknowledged minor release for subsequent patches", () => {
    const env = environment({[WELCOME_STORAGE_KEY]: "true"});
    createReleaseNoticeStore("6.4.1", env.environment).acknowledge();
    expect(createReleaseNoticeStore("6.4.2", env.environment).snapshot()).toBe("hidden");
    expect(createReleaseNoticeStore("6.4.99", env.environment).snapshot()).toBe("hidden");
  });
  it("does not overwrite a newer release acknowledgement from an older tab", () => {
    const env = environment({[WELCOME_STORAGE_KEY]: "true"});
    const old = createReleaseNoticeStore("6.3.1", env.environment);
    const current = createReleaseNoticeStore("6.3.2", env.environment);
    current.acknowledge();
    old.acknowledge();
    expect(createReleaseNoticeStore("6.3.2", env.environment).snapshot()).toBe("hidden");
    expect(env.values.get(releaseNoticeKey("6.3.1"))).toBe("true");
  });
  it("emits same-tab updates and supports remount without repeating acknowledgement", () => {
    const env = environment();
    const store = createReleaseNoticeStore("6.3.1", env.environment);
    let renders = 0;
    const unmount = store.subscribe(() => { renders++; });
    store.acknowledge();
    expect(renders).toBe(1);
    unmount();
    const remount = store.subscribe(() => { renders++; });
    expect(store.snapshot()).toBe("hidden");
    remount();
  });
  it("observes another tab acknowledging this release and unsubscribes cleanly", () => {
    const env = environment({[WELCOME_STORAGE_KEY]: "true"});
    const store = createReleaseNoticeStore("6.3.1", env.environment);
    let updates = 0;
    const unsubscribe = store.subscribe(() => { updates++; });
    env.fire("unrelated-setting");
    expect(updates).toBe(0);
    env.values.set(`${RELEASE_STORAGE_PREFIX}6.3.1`, "true");
    env.fire(`${RELEASE_STORAGE_PREFIX}6.3.1`);
    expect(updates).toBe(1);
    expect(store.snapshot()).toBe("hidden");
    unsubscribe();
    env.fire(null);
    expect(updates).toBe(1);
  });
  it("survives storage getter failures with in-session acknowledgement", () => {
    const env = environment({}, true);
    const store = createReleaseNoticeStore("6.3.1", env.environment);
    expect(store.snapshot()).toBe("welcome");
    expect(() => store.acknowledge()).not.toThrow();
    expect(store.snapshot()).toBe("hidden");
    // The same module store is reused across React remounts.
    const unsubscribe = store.subscribe(() => {});
    expect(store.snapshot()).toBe("hidden");
    unsubscribe();
  });
  it("survives setItem quota failures even when getItem still returns null", () => {
    const store = createReleaseNoticeStore("6.3.1", {
      storage: () => ({getItem: () => null, setItem: () => { throw new Error("Quota"); }}),
      listen: () => () => {},
    });
    store.acknowledge();
    expect(store.snapshot()).toBe("hidden");
  });
});
