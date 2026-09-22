export function getDeviceId(): string {
  const KEY = "sm_device_id";

  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;

    let id: string;

    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      id = "sm_" + crypto.randomUUID();
    } else {
      // fallback om randomUUID saknas
      id =
        "sm_" +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36);
    }

    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // fallback om localStorage inte är tillgängligt
    return (
      "sm_tmp_" +
      Math.random().toString(36).slice(2) +
      Date.now().toString(36)
    );
  }
}