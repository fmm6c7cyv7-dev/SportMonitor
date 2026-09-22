// web/src/lib/supabase.ts

import { createClient } from "@supabase/supabase-js";

/* ==========================================================================
   ENV HELPERS
   ========================================================================== */

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/* ==========================================================================
   CLIENT FACTORIES
   ========================================================================== */

export function supabaseService() {
  // Accept both the legacy JWT service_role key and Supabase's modern
  // sb_secret_ API keys. Keep a basic sanity check without assuming that
  // every valid server key is a long JWT.
  const isModernSecretKey =
    serviceKey.startsWith("sb_secret_") && serviceKey.length >= 32;
  const isLegacyServiceRoleKey = serviceKey.length >= 100;

  if (!isModernSecretKey && !isLegacyServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY has an unsupported format. Check the Vercel environment.",
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}