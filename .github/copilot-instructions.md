# SportMonitor 2.0 — Copilot routing and repository rules

## Primary entry point

For autonomous multi-step work, use **Project Orchestrator** as the user-facing entry point.

Project Orchestrator should classify the task, route it to the cheapest capable specialist, coordinate safe parallel work, collect verification, and escalate only when necessary.

## Specialist routing

Use the cheapest capable custom agent.

1. **Fast Implementer (GPT-5.6 Luna)**
   - default for bounded, low-risk implementation
   - UI, styling, copy, tests, config, simple bug fixes, small component or route changes

2. **Senior Developer (GPT-5.3-Codex)**
   - use for complex multi-file implementation
   - difficult TypeScript/React/Next.js behavior
   - ranking, ingest, Supabase, push, state/data-flow bugs
   - escalate here when Fast Implementer cannot safely complete the task

3. **Architect Debugger (GPT-5.3-Codex)**
   - default architecture/security specialist; intentionally cost-capped
   - use only for ambiguous root cause, architecture, security-sensitive or cross-cutting high-risk work
   - use when Senior Developer cannot establish a safe solution, or when risk clearly justifies direct routing
   - prefer returning a bounded plan that a lower-cost agent can implement

4. **Deep Architect (GPT-5.6 Sol)**
   - manual emergency/deep-review tier only
   - never invoke automatically
   - use only after `DEEP_REVIEW_REQUIRED` and an explicit owner/CTO decision

Do not run multiple write-capable agents against the same files or subsystem in parallel. Parallelize only independent work blocks with non-overlapping ownership.

Do not repeatedly retry a failing cheap agent. One failed or clearly inadequate attempt is enough to escalate.

Cost guardrails:
- one specialist pass per work block before review
- one implementation pass + one review pass is the default maximum loop
- no specialist may re-run a full repository audit merely to answer review comments
- documentation/reporting-only review fixes should not trigger a fresh specialist session
- Project Orchestrator must stop with `DEEP_REVIEW_REQUIRED` rather than automatically invoking the Sol tier

## Delegation rules

- If custom-agent/subagent delegation is available, Project Orchestrator should invoke the selected specialist directly.
- Pass only the minimum context needed for the subtask.
- If delegation is unavailable in the current runtime, report `DELEGATION_BLOCKED` and provide one exact assignment for the intended specialist. Do not claim a delegation occurred when it did not.
- Do not make the user manually relay agent prompts when the runtime can delegate directly.
- Architect Debugger should prefer handing a bounded implementation plan back to a cheaper implementation agent when safe.
- A task is not complete until the relevant verification result has been collected.

## Repository rules

- GitHub `main` is source of truth.
- Keep diffs small and task-scoped.
- Read only files needed for the task.
- Do not perform unrelated cleanup.
- Never open, print, copy or modify `.env*`, credential backups, secrets, tokens or private keys unless the task explicitly concerns secret management.
- Preserve server/client credential boundaries.
- Do not change database schema, migrations, dependency versions or deployment configuration unless explicitly requested.
- Treat ranking, ingest, favorites, push dispatch and Supabase writes as regression-sensitive.
- Add or update tests when behavior changes.
- Do not claim external-service verification unless it was actually performed.

## Verification baseline

Use the narrowest relevant verification first:

- `git diff --check` for every production-code change
- `npm run lint` for production-code changes unless a concrete technical blocker prevents it
- targeted Vitest suite when a directly relevant test exists
- `npm test` for broader behavior changes
- `npm run build` for cross-cutting Next.js, API route, config or production-critical changes

Code review alone never counts as sufficient automated verification.

A failed check is a failure. Do not relabel it as partial success. If a required check is skipped, report the exact blocker and do not declare the task COMPLETE unless the skip is justified by that blocker.

## Output discipline

Keep agent output short. Final reports should contain only:
- route/agent used
- changed files
- verification commands and PASS/FAIL
- Human QA if required
- blocker or residual risk
- commit SHA or PR when available

Avoid long progress narration and repeated repository summaries.
