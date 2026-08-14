# SoftSolutions — Portal de clientes

Admin: clientes, proyectos, hitos y cotizaciones.
Cliente: ve su avance y paga cotizaciones aceptadas.

## Stack

- Next.js 16 + TypeScript + Tailwind CSS v4
- SQLite (`node:sqlite`, Node 22+)
- Auth.js v5 — roles `ADMIN` / `CLIENT`
- Stripe (pagos) + Resend (invitaciones)

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

http://localhost:3000

Subdominios en local: `http://admin.localhost:3000` y `http://cliente.localhost:3000`.

Con `ENABLE_DEMO_SEED=true` se cargan cuentas demo (admin@softsolutions.mx / admin123).

## Deploy

Ver `docs/deploy.md`. Resumen: Railway + volumen en `/data`, dominios
`admin.softsolutions.mx` y `cliente.softsolutions.mx`, variables de `.env.example`
en modo producción (`ENABLE_DEMO_SEED=false`, claves live de Stripe, etc.).

## Catálogo

Precios en `src/lib/catalog.ts`. Cobro en línea:

- Proyecto → 50% anticipo
- Suscripción → primer periodo del plan (sin cuota de configuración)
