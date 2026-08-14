# Project Plan — SoftSolutions Client Portal

## Development phases (sprints)

| Sprint | Phase | Est. duration | Deliverable |
|---|---|---|---|
| Sprint 0 | Planning | 1 day | This document + project selection doc |
| Sprint 1 | Data model & auth | 2 days | SQLite schema, seed data, login for both roles |
| Sprint 2 | Admin views | 2 days | Manage clients, projects, milestones, quotations |
| Sprint 3 | Client views | 1.5 days | Read-only dashboard: progress, quotations, payment status |
| Sprint 4 | Polish & QA | 1.5 days | Responsive check, functional/security/performance QA report |

**Total estimate:** ~8 calendar days / ~25–30 effective development hours.

## Resources

| Resource | Detail |
|---|---|
| Human | 1 developer (product owner + developer, AI-assisted) |
| Development tool | Claude Code, executing in sprints with checkpoints |
| Stack | Next.js (App Router), TypeScript, Tailwind CSS |
| Persistence | SQLite via Node's built-in `node:sqlite` module (no external DB engine required) |
| Auth | Auth.js (NextAuth v5), credentials provider, JWT sessions |
| Hosting | Vercel (free tier is sufficient for a functional demo) |
| Design | SoftSolutions' existing brand identity — dark base + single accent color |

> Note: the original stack constraint specified Prisma + SQLite. Prisma's engine
> binaries could not be downloaded in this sandboxed environment (network egress
> is restricted to a package-registry allowlist that does not include Prisma's
> binary CDN), so persistence was implemented directly on Node 22's built-in
> `node:sqlite` module instead. This keeps the same relational data model and
> zero-external-service footprint, with no behavior change from the client's
> point of view. Swapping in Prisma later (once running outside this sandbox) is
> a contained change limited to the `src/lib/db.ts` / `src/lib/repo/*` files.

## Budget (hours-based — solo AI-assisted build)

| Item | Estimate |
|---|---|
| Development hours | 25–30 h |
| AI tooling subscription | existing Claude plan (sunk cost, not incremental) |
| Hosting (Vercel free tier) | $0 |
| Database (SQLite, local file) | $0 |

## Methodology

Agile, sprint-based. Each sprint = design → code → functional test → review,
with progress appended to `docs/03-development-log.md` before moving to the
next sprint. `docs/04-iteration-notes.md` is left as a structured template for
real test-user feedback once the app is demoed to actual clients.
