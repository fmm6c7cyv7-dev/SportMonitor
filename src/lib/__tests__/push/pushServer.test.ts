import { describe, expect, it } from "vitest";

import { deriveVapidPublicKey } from "@/lib/pushServer";

describe("pushServer VAPID helpers", () => {
  it("derives the matching public key from the private key", () => {
    const privateKey = "dPo2GeWsbzhS3ohEZ_U0Gn_g3jK-FyIr4UxjLdg2IBM";
    const expectedPublicKey =
      "BFbdCOmUpX4MSTsiPWjOvZq_qjKxiNRKOfKMLBmn-cZJ3HLeJMiXoL8mtYIJyV4sweUd6LvGX4f9SubNxiNDORI";

    expect(deriveVapidPublicKey(privateKey)).toBe(expectedPublicKey);
  });
});
