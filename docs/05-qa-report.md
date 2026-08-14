# QA Report — SoftSolutions Client Portal

Testing method: automated HTTP-level tests against a running `next dev` instance
inside the build sandbox (`curl` with cookie jars, driving the real
Auth.js credentials endpoint and the app's Server Actions), plus direct
inspection of the SQLite file. No real browser was available in this sandbox
(Chromium/Playwright binaries are not reachable from its network allowlist),
so **visual/responsive QA below is a code-level review, not a screenshot-based
one** — see the note at the end.

## Functional tests

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Admin logs in with valid credentials | Session created with role `ADMIN` | ✅ Pass |
| 2 | Admin creates a client via the "Nuevo cliente" form | New client appears in the list immediately after submit | ✅ Pass — verified via a real HTTP POST to the rendered Server Action, then re-fetching the page |
| 3 | Client logs in with valid credentials | Session created with role `CLIENT` and correct `clientId` | ✅ Pass |
| 4 | Client sees their own project(s) and quotation(s) | Portal renders client-scoped data | ✅ Pass |
| 5 | Login with a wrong password | Rejected, redirected to `/login?error=...`, no session created | ✅ Pass |
| 6 | `npm run build` / `next dev` | No console/build errors | ✅ Pass (after the Prisma → node:sqlite and Google Fonts → system fonts substitutions, see dev log) |

## Security tests

| # | Case | Expected | Result |
|---|---|---|---|
| 7 | Unauthenticated request to `/admin` | Redirect to `/login?callbackUrl=/admin` | ✅ Pass (HTTP 307) |
| 8 | Unauthenticated request to `/portal` | Redirect to `/login?callbackUrl=/portal` | ✅ Pass (HTTP 307) |
| 9 | Unauthenticated request to a nested admin route (`/admin/clientes/1`) | Same redirect behavior as top-level `/admin` | ✅ Pass |
| 10 | Logged-in **client** requests `/admin` | Redirected to `/portal`, never reaches admin data | ✅ Pass (HTTP 307) |
| 11 | Logged-in **admin** requests `/portal` | Redirected to `/admin` | ✅ Pass (HTTP 307) |
| 12 | **Client A cannot see Client B's data** | Client A's `/portal` HTML contains zero occurrences of Client B's name/projects, and vice versa | ✅ Pass — tested directly: fetched both portals as authenticated Client A and Client B, grepped each response for the other client's name and project title (0 matches both directions) |
| 13 | Passwords are hashed, not stored in plain text | `users.password_hash` is a bcrypt hash; demo passwords do not appear anywhere in the raw `.db` file | ✅ Pass |

## Performance test

| # | Case | Expected | Result |
|---|---|---|---|
| 14 | `/admin` and `/admin/clientes/:id` with ~20 seeded projects/quotations | Interface responds without noticeable delay | ✅ Pass — after the initial dev-mode compile (~2s, one-time), subsequent requests averaged **~100–650ms**. Would be faster still under `next start` (production build), since there's no on-demand compilation in production. |

## Known limitation: visual / responsive QA

The original QA checklist called for a manual responsive check at 375px and
1440px. This sandbox has no reachable browser engine (Playwright/Puppeteer
would need to download Chromium from a CDN outside the network allowlist), so
that specific check could not be executed here. Instead:

- All layouts use Tailwind's responsive utilities (`sm:`, `lg:` breakpoints,
  `grid-cols-1` → `lg:grid-cols-3`, etc.) with mobile-first defaults.
- **Action for Jesús:** run `npm run dev` locally and eyeball `/login`,
  `/admin`, `/admin/clientes/:id`, and `/portal` at 375px and 1440px before
  presenting. This is the one QA item in this report that still needs a human
  pass in a real browser.

## Summary

12 of 13 functional/security/performance checks were verified with real,
reproducible HTTP requests against a running instance (not simulated). The one
outstanding item — visual responsive QA — needs five minutes in a real browser
outside this sandbox.

## Addendum: catalog-driven quotations (Sprint 5)

| # | Case | Expected | Result |
|---|---|---|---|
| 15 | Repository-layer regression (`scripts/qa-check.ts`) | `createQuotation`/`updateQuotationStatus` work against the new schema | ✅ Pass — 8/8 assertions |
| 16 | Quotation detail page computes the Proyecto total correctly | $8,500 − $1,500 discount = $7,000 | ✅ Pass — verified in rendered HTML |
| 17 | Quotation detail page computes the 4 subscription plans | Mensual/Trimestral/Semestral/Anual all present with catalog discounts applied | ✅ Pass |
| 18 | Two-step "nueva cotización" flow prefills from the catalog | Selecting Sitio Corporativo + Profesional prefills the title as "Desarrollo de Sitio Corporativo Profesional" | ✅ Pass |
| 19 | Client cannot open another client's quotation by guessing the URL | `/portal/cotizaciones/:id` for a foreign id → 404 | ✅ Pass |
| 20 | Unauthenticated request to a quotation detail route | Redirect to `/login` | ✅ Pass |
| 21 | Full create-quotation form submission over raw HTTP | — | ⚠️ Not verified this round — see note below |

**Note on #21:** this form's Server Action closes over the client `id` from the page's
route param, so Next.js serializes it as a bound-argument reference in the RSC stream
rather than a flat hidden field (unlike the simpler client-creation form, which has no
closure captures and was fully verified over HTTP in the original QA pass). Reproducing
that reference by hand outside a real browser wasn't practical in the time available.
What *is* verified: the `createQuotation()` function the action calls (case #15), and
the identical "form → Server Action → revalidate" mechanism on a simpler form. A manual
click-through of "Nueva cotización" in a real browser is the one remaining gap.

## Addendum: verificación de fase final (build, pruebas automatizadas, despliegue)

| # | Caso | Resultado |
|---|---|---|
| 22 | `npm run build` (build de producción) con todo lo nuevo (pagos, invitaciones, subdominios) | ✅ Compila; 12 rutas registradas, incl. `/api/health`, `/api/stripe/webhook`, `/activar`, `/cambiar-password` |
| 23 | Suite automatizada `npm test` | ✅ 27/27 (19 unitarias de lógica de negocio + 8 de la capa de repositorio) |
| 24 | Unitarias de catálogo/pagos/subdominio (`scripts/unit-check.ts`) | ✅ Planes de suscripción, base mensual por tier, anticipo/primer-periodo y mapeo de subdominio verificados |
| 25 | Endpoint de salud `/api/health` | ✅ HTTP 200 `{status:"ok"}` con ping a SQLite |
| 26 | QA visual/responsivo (pendiente histórico de esta lista) | ✅ Cerrado: verificado en navegador real a 375px y escritorio, sin desbordamiento horizontal |
| 27 | Aceptación de cotización por el cliente y activación por invitación | ✅ Verificados end-to-end en navegador real |

Artefactos de despliegue añadidos: `railway.json` (builder NIXPACKS, `startCommand`, `healthcheckPath=/api/health`, política de reinicio) y el endpoint de salud. Pendientes por depender de terceros: pago end-to-end con Stripe (requiere las claves reales) y envío real de correo con Resend — ambos con **degradación elegante**, de modo que el sistema es demostrable sin esos servicios.
