# SportMonitor 2.0 — Copilot routing and repository rules

Read `AGENTS.md` and `AI_WORKFLOW.md` before autonomous work.

## Primary entry point

For autonomous multi-step work, use **Project Orchestrator** as the user-facing entry point.

Project Orchestrator classifies the task, routes it to the least expensive capable specialist tier, coordinates only safe non-overlapping parallel work, collects verification, and escalates only when evidence requires it.

## Specialist routing

Choose by capability, risk and cost rather than by a permanently hard-coded model name.

1. **Fast Implementer**
   - bounded, low-risk implementation
   - UI, styling, copy, tests, config, simple bug fixes and small component/route changes

2. **Senior Developer**
   - complex multi-file implementation
   - difficult TypeScript/React/Next.js behavior
   - ranking, ingest, Supabase, push and state/data-flow regressions

3. **Architect Debugger**
   - ambiguous root cause
   - architecture/security-sensitive or cross-cutting work
   - high-risk production behavior
   - should prefer returning a bounded plan that a cheaper implementation tier can execute

4. **Deep Architect**
   - final deep-reasoning tier
   - reserved for Healing #2 or unresolved high-risk root cause when stronger reasoning is justified
   - one focused pass only

Do not run multiple write-capable agents against the same files or tightly coupled subsystem in parallel.

## Self-healing

Maximum two repair attempts per root symptom:

1. **Healing #1** — smallest evidence-based correction, then rerun the narrow relevant check.
2. **Healing #2** — reassess root cause; Project Orchestrator may automatically route to a stronger reasoning tier, including Deep Architect, when justified.

If Healing #2 fails, stop with evidence and a next diagnostic. Do not start a third agent loop.

## Cost guardrails

- one bounded specialist objective per work block;
- use the least expensive capable tier;
- do not spend a low-capability attempt on work that is obviously complex/high-risk;
- no repository-wide re-audit merely to answer review comments;
- read-only analysis and QA should stay with the Tech Lead/Orchestrator when no execution agent is needed;
- documentation/reporting-only corrections should not trigger a fresh specialist session;
- stop idle Codespaces;
- do not blindly rerun failed CI;
- keep durable policy independent of specific model names or temporary pricing.

## Delegation rules

- If custom-agent/subagent delegation is available, Project Orchestrator should invoke the selected specialist directly.
- Pass only the minimum context needed for the subtask.
- If delegation is unavailable, report `DELEGATION_BLOCKED` and provide one exact assignment for the intended specialist.
- Do not make the user manually relay prompts when direct delegation exists.
- A task is not complete until relevant verification has been collected.

## Repository rules

- GitHub `main` is the stable source of truth.
- Microfixes may go directly to `main` after AI QA; feature/risk work uses a short-lived branch or the GitHub-managed Copilot PR branch.
- Keep diffs small and task-scoped.
- Read only files needed for the task.
- Do not perform unrelated cleanup.
- Never open, print, copy or modify `.env*`, credential backups, secrets, tokens or private keys unless the task explicitly concerns secret management.
- Preserve server/client credential boundaries.
- Do not change database schema, migrations, dependency versions or deployment configuration unless explicitly required.
- Treat ranking, ingest, favorites, push dispatch and Supabase writes as regression-sensitive.
- Add or update tests when behavior changes.
- Do not claim external-service verification unless it actually occurred.

## Verification baseline

Use the narrowest relevant verification first:

- `git diff --check` for every production-code change;
- `npm run lint` for production-code changes unless a concrete technical blocker prevents it;
- targeted Vitest suite when a directly relevant test exists;
- `npm test` for broader behavior changes;
- `npm run build` for cross-cutting Next.js, API route, config or production-critical changes.

Code review alone is not sufficient automated verification for production-code changes. A failed required check is a failure. If a required check is skipped, report the exact blocker.

## Output discipline

Keep reports short:
- route/tier used;
- changed files;
- verification and PASS/FAIL;
- Human QA if required;
- blocker/residual risk;
- commit SHA or PR when available.
