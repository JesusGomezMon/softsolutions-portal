# Development Log

Appended after each sprint with what was designed, built, and functionally tested.

## Sprint 0 — Planning

- Wrote `01-project-selection.md` (problem, objectives, expected impact, justification).
- Wrote `02-project-plan.md` (phases, resources, timeline, budget).
- Scaffolded the Next.js 16 project (App Router, TypeScript, Tailwind CSS v4) with `create-next-app`.
- Installed `next-auth@5` (beta) and `bcryptjs` for authentication.
- **Stack deviation:** Prisma's schema-engine binary could not be downloaded (network egress in
  this environment is restricted to a package-registry allowlist, and Prisma's binary CDN is not
  on it). Replaced with Node 22's built-in `node:sqlite` module — same relational model, zero
  external services, no behavior change. Documented in `02-project-plan.md`.

## Sprint 1 — Data model & auth

- Designed and implemented the SQLite schema directly on `node:sqlite`: `clients`, `users`,
  `projects`, `milestones`, `quotations`, with foreign keys and indexes (`src/lib/db.ts`).
- Built a thin repository layer per entity (`src/lib/repo/*.ts`) instead of an ORM.
- Implemented Auth.js v5 with a Credentials provider, bcrypt password hashing, JWT sessions,
  and a `Role`/`clientId` claim carried through the token and session (`src/auth.ts`,
  `src/types/next-auth.d.ts`).
- Added an idempotent seed script (`src/lib/seed.ts`) with 1 admin + 3 fictional demo clients
  (each with a project, milestones, and a quotation).
- Built `/login` with a server-action-based credential sign-in flow.
- **Deviation:** `next/font/google` also needs an external network call (Google's font CDN),
  unreachable here — swapped for a system font stack in `layout.tsx`.
- Functionally tested: TypeScript compiles clean (`tsc --noEmit`), `next build` succeeds.

## Sprint 2 — Admin panel

- `/admin`: client list + "new client" form (Server Action).
- `/admin/clientes/[clientId]`: project list per client, milestone list with an "advance status"
  action per milestone, "new project" and "new milestone" forms, quotation table with an
  "advance status" action, and a "new quotation" form.
- Role-based route protection via `src/proxy.ts` (Next.js 16's renamed `middleware.ts`
  convention — proxy always runs on the Node.js runtime, which is what lets it call `auth()`
  and reach the database).
- Functionally tested over real HTTP (see `05-qa-report.md`): admin login, client creation via
  the rendered Server Action, and access control on nested admin routes.

## Sprint 3 — Client panel

- `/portal`: read-only dashboard scoped to `session.user.clientId` — own project(s) with a
  progress bar computed from milestone completion, and own quotations with status.
- Verified client-to-client data isolation directly over HTTP (see `05-qa-report.md`, case 12).

## Sprint 4 — Polish & QA

- Added empty states, consistent status badges/colors, and a shared `Card`/`ProgressBar`/
  `StatusBadge` component set (`src/components/ui.tsx`).
- Ran the full functional/security/performance QA pass — see `05-qa-report.md` for all 14
  results and the one open item (manual responsive check, needs a real browser).
- Reset `data/app.db` before delivery so the app seeds fresh on first run.

## Sprint 5 — Catalog-driven quotations (post-delivery change request)

Jesús shared the real SoftSolutions commercial catalog (services, tiers, price ranges,
subscription plan discounts) and a real client quotation (ABC Swimming Pool Service,
Landing Page Profesional) and asked for quotations to be built on top of that document,
using the ABC quotation as the structural template.

- Added `src/lib/catalog.ts`: a structured, code-reviewable version of the catalog —
  3 service types × 3 tiers with real price ranges, subscription setup fees per service,
  the 4 subscription plans (Mensual/Trimestral/Semestral/Anual) with their real
  permanence/discount/support rules, and `computeSubscriptionPlans()` which reproduces
  the catalog's worked example exactly (Landing Page @ $1,500/mes → $1,500 / $4,050 /
  $7,380 / $13,500).
- Redesigned the `quotations` table: replaced the old free-text `modality`/`tier`/
  `amount_label` with `service_type`, `service_tier`, `title`, `objective`,
  `scope_items`/`included_items`/`courtesy_items` (JSON arrays), real Proyecto pricing
  (`proyecto_amount`, `proyecto_discount`, `proyecto_discount_label`), Suscripción
  pricing inputs (`suscripcion_setup_fee`, `suscripcion_monthly_base`), and
  `accepted_modality`. Added a migration guard in `db.ts` so a pre-existing local
  `data/app.db` upgrades itself instead of erroring (demo data only, safe to drop).
- Built `src/components/QuotationDocument.tsx`: renders a quotation exactly like the
  real PDF — client, servicio, objetivo, alcance, incluye, cortesías, tabla Proyecto
  (monto/descuento/total), tabla Suscripción (4 planes calculados), forma de pago,
  tiempo estimado, garantía, vigencia.
- New routes: `/admin/clientes/[id]/cotizaciones/[quotationId]` (full document +
  status/modality controls) and `/portal/cotizaciones/[quotationId]` (read-only,
  ownership-checked).
- Reworked "Nueva cotización" into a two-step, no-JS flow: a GET form picks a
  service+tier from the catalog and reloads the page with the selection in the query
  string; the page then prefills a second (POST) form with the catalog's price range,
  default scope/included items, setup fee, and estimated time — all still editable
  before creating the quotation.
- Updated seed data: Panadería La Espiga's quotation is modeled closely on the real
  ABC Swimming Pool Service example (same courtesy items, same discount pattern);
  Clínica Dental Sonrisa and Ferretería El Tornillo got realistic catalog-priced
  quotations in different states (PAGADA/SUSCRIPCION, ENVIADA).
- Tested over real HTTP: quotation detail page renders the correct computed total
  ($8,500 − $1,500 = $7,000) and the 4 subscription plan rows; step 1→step 2 prefill
  verified (tier-specific title generated correctly); ownership isolation re-verified
  on the new per-quotation routes (cross-client access → 404, unauthenticated → redirect).
- **Known gap:** the create-quotation POST itself could not be replayed via raw curl
  this round — Next.js's Server Actions serialize *closure-captured* variables (this
  form closes over the client `id`) as a separate bound-argument reference in the RSC
  stream, which isn't practical to reconstruct by hand outside a real browser. The
  underlying `createQuotation()` function this action calls is verified directly
  (`scripts/qa-check.ts`), and the identical form-submission mechanism was already
  proven end-to-end on the simpler client-creation form. A manual click-through in a
  real browser is the one thing this couldn't fully substitute for.
