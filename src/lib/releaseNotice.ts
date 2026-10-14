import packageJson from "../../package.json";

export const RELEASE_VERSION = packageJson.version;
export const WELCOME_STORAGE_KEY = "sm_seen_welcome";
export const RELEASE_STORAGE_PREFIX = "sm_seen_release:";
export type ReleaseNoticeMode = "hidden" | "welcome" | "update";

type NoticeEnvironment = {
  storage: () => Pick<Storage, "getItem" | "setItem">;
  listen: (listener: (key: string | null) => void) => () => void;
};

/** Persist only acknowledgement; memory prevents repeat dialogs if storage is blocked. */
export function createReleaseNoticeStore(version: string, environment: NoticeEnvironment) {
  const releaseKey = `${RELEASE_STORAGE_PREFIX}${version}`;
  const acknowledged = new Set<string>();
  const listeners = new Set<() => void>();
  const seen = (key: string) => {
    if (acknowledged.has(key)) return true;
    try { return environment.storage().getItem(key) === "true"; }
    catch { return false; }
  };
  const emit = () => { for (const listener of listeners) listener(); };
  const snapshot = (): ReleaseNoticeMode => {
    if (!seen(WELCOME_STORAGE_KEY)) return "welcome";
    return seen(releaseKey) ? "hidden" : "update";
  };
  return {
    snapshot,
    acknowledge() {
      for (const key of [WELCOME_STORAGE_KEY, releaseKey]) {
        acknowledged.add(key);
        try { environment.storage().setItem(key, "true"); } catch { /* Session fallback. */ }
      }
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      const unsubscribe = environment.listen((key) => {
        if (key === null || key === WELCOME_STORAGE_KEY || key === releaseKey) emit();
      });
      return () => { listeners.delete(listener); unsubscribe(); };
    },
  };
}

export const releaseNoticeStore = createReleaseNoticeStore(RELEASE_VERSION, {
  storage: () => window.localStorage,
  listen: listener => {
    const onStorage = (event: StorageEvent) => listener(event.key);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
});
export const getReleaseNoticeServerSnapshot = (): ReleaseNoticeMode => "hidden";
