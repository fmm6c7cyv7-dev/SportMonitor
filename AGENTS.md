# AGENTS.md — SportMonitor

Read `AI_WORKFLOW.md` and `.github/copilot-instructions.md` before autonomous implementation.

## Binding rules
- `origin/main` is the stable source of truth.
- Keep diffs small, scoped and regression-aware.
- Microfixes may go directly to `main` after AI QA; feature/risk work uses a short-lived branch or the single GitHub-managed Copilot PR branch.
- Do not continuously synchronize work branches with `main`; refresh only when integration drift requires it.
- Use the least expensive capable specialist tier. Model names are not part of durable workflow policy.
- AI QA is the default gate. Human QA is requested only when automated evidence cannot establish acceptance.
- Maximum two self-healing attempts per defect/root symptom.
- Healing #2 must reassess root cause and may automatically use a stronger reasoning tier.
- After Healing #2 fails, stop and report evidence instead of launching another loop.
- Never open, print, copy or modify secret-bearing `.env*` files unless the task explicitly concerns secret management.
- Treat ranking, ingest, favorites, push, Supabase writes, schema/auth and deployment as regression-sensitive.
- Never weaken tests/checks merely to obtain PASS.
- Accepted work ends integrated into current `main`.
