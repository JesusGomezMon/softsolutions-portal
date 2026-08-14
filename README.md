# SoftSolutions — Portal de clientes

Admin: clientes, proyectos, hitos y cotizaciones.
Cliente: ve su avance y paga cotizaciones aceptadas.

## Stack

- Next.js 16 + TypeScript + Tailwind CSS v4
- LibSQL / Turso (SQLite remoto — requerido en Vercel)
- Auth.js v5 — roles `ADMIN` / `CLIENT`
- Stripe (pagos) + Resend (invitaciones)

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Sin `DATABASE_URL` usa `data/app.db` en disco. Subdominios:
`http://admin.localhost:3000` y `http://cliente.localhost:3000`.

## Producción (Vercel)

1. Crea una base en [Turso](https://turso.tech) y pon `DATABASE_URL` + `DATABASE_AUTH_TOKEN` en Vercel.
2. Variables: ver `.env.example` (`ENABLE_DEMO_SEED=false`, Stripe live, etc.).
3. Dominios: `admin.softsolutions.mx` y `cliente.softsolutions.mx`.

Al arrancar vacío se crea el admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) y el cliente
**ABC Swimming Pool Service** con su cotización de landing profesional.

## Cobro

- Proyecto → 50% anticipo
- Suscripción → primer periodo del plan (sin cuota de configuración)

Catálogo: `src/lib/catalog.ts`.
