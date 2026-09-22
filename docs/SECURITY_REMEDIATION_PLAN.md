# Security remediation plan

This plan records deferred security work from the repository audit. It
contains no credentials or secret values.

## Priority 1: rotate and remove exposed credentials

- Rotate the ingest and Supabase service-role credentials through the hosting
  provider and Supabase.
- Remove tracked environment backups from the repository and purge sensitive
  values from Git history using the repository owner's approved process.
- Keep environment files and backup variants ignored by `.gitignore`.
- Replace cron query-string credentials with a protected authorization header
  or an equivalent provider-supported secret mechanism.

## Priority 2: protect privileged routes

- Require authenticated, constant-time authorization for force-push, push
  dispatch/test, scrape, and debug routes.
- Remove or disable diagnostic routes in production unless explicitly needed.
- Do not transmit secrets in URLs or browser storage.

## Priority 3: reduce service-role exposure

- Review `events`, `favorites`, `seen`, and push subscription ownership checks.
- Prefer least-privileged Supabase clients and enforce row-level ownership.
- Add request validation, rate limits, and abuse monitoring to public writes.

## Verification and ownership

These changes require security-owner review, credential rotation, and
deployment verification before implementation. They are intentionally not
included in the documentation/hygiene change set.
