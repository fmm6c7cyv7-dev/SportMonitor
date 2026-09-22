# Public release security gate

SportMonitor serves public traffic through Next.js API routes. Browser clients must not
have direct write access to Supabase.

## Required runtime model

- Server-only database operations use `SUPABASE_SERVICE_ROLE_KEY`.
- `CRON_SECRET`, `INGEST_SECRET`, `FAVORITE_AUDIT_SECRET`, VAPID private keys and
  Supabase service/secret keys are server-only.
- Public/publishable Supabase keys are not authorization boundaries.
- Direct `anon` and `authenticated` table access is denied in production. Public
  reads/writes go through the application API.
- Internal ingest/admin/debug routes require `requireInternalRouteAuth`.

## Repository publication gate

Do not make the existing Git history public until historical credentials have been
rotated or the public repository is created from a clean snapshot. An older tracked
`.env.vercelprod` contained production credential material before it was removed.

Before publication:

1. Rotate any historical server credentials that may still be valid, especially the
   Supabase service-role/secret key.
2. Keep Vercel environment variables in Vercel only.
3. Publish from a clean snapshot or verify that credential-bearing history is not
   reachable from the public repository.
4. Re-run the database grants/RLS audit and application smoke tests.
