# AI_WORKFLOW.md — SportMonitor AI Development Workflow v2.0

## Goal
Run SportMonitor with maximum practical autonomy while protecting production stability and controlling AI credits, GitHub Actions, Codespaces and deploy churn. `origin/main` is the stable source of truth.

## Work classification
- **Microfix:** small, isolated and low-risk. May go directly to `main` after AI QA.
- **Feature/fix block:** use a short-lived `feature/*` or `fix/*` branch, or the single GitHub-managed Copilot branch/PR.
- **Risk change:** ranking/ingest, Supabase writes/schema, push, auth/secrets, deployment, billing or major architecture. Always isolate on a branch and perform explicit risk review.

A work branch does not need continuous synchronization with `main`. Start from current `main`; refresh before integration only when drift/conflicts require it. Accepted work ends integrated into current `main`.

## Roles
- **AI Tech Lead / QA:** scopes work, chooses the execution tier, reviews diff/evidence, decides PASS/FIX/HUMAN-QA and integrates accepted work.
- **Execution specialist:** implements one bounded objective.
- **Human QA:** requested only when acceptance depends on subjective UI, real notification/device behavior, account-controlled action or a final product/release decision.

## Capability tiers
Choose by capability and cost, not a permanently hard-coded model name:
1. **Fast implementation tier** — bounded, low-risk edits.
2. **Senior implementation tier** — complex multi-file behavior and difficult regressions.
3. **Architecture/debug tier** — ambiguous root cause, security, cross-cutting or high-risk design.
4. **Deep reasoning tier** — reserved for Healing #2 or unresolved high-risk root cause when stronger reasoning is justified.

Use the least expensive capable tier. Do not spend a cheap attempt on work that is obviously complex enough to require a stronger tier.

## Two-step self-healing
For the same defect/root symptom:
1. **Healing #1:** use concrete failure evidence, make the smallest correction, rerun the narrow relevant verification.
2. **Healing #2:** explicitly reassess root cause rather than repeating the first hypothesis. The Tech Lead/Orchestrator may automatically select a stronger reasoning tier for this final healing attempt.

If Healing #2 fails, stop. Preserve evidence and report attempts, likely root cause, uncertainty and next diagnostic. Do not open an unlimited third agent loop.

## QA ladder
Use the narrowest evidence that proves the changed risk:
- diff/scope/secret review;
- targeted tests;
- lint/type/static checks;
- broader `npm test` only when behavior breadth justifies it;
- `npm run build` for cross-cutting/production-critical changes;
- PR CI at integration;
- Human QA only where automation cannot establish acceptance.

## Cost controls
- One specialist = one bounded objective.
- Do not re-audit the whole repository when a scoped brief already exists.
- Prefer direct repository analysis/QA by the Tech Lead over cloud-agent sessions for read-only work.
- Stop Codespaces after the work block.
- Do not retry failed CI blindly; inspect first and rerun only the narrow failed job where possible.
- Avoid duplicate CI after a PR has already passed equivalent integration checks.
- Keep model names/pricing out of durable policy; capabilities and costs change over time.

## Completion
A block is complete when scope is satisfied, relevant QA passes, the diff is clean, documentation is current, and accepted work is integrated into `main`. Remaining Human QA must be explicit.
