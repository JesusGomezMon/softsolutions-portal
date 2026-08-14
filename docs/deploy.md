# Deploy — SoftSolutions Portal

App lista para Railway. Lo de abajo es lo que falta en cuentas/DNS (tú) vs
lo que ya trae el código.

## Ya listo en el repo

- `railway.json` con healthcheck en `/api/health`
- `DATA_DIR` para montar el volumen (ej. `/data`)
- SQLite en una sola instancia (no escalar horizontal)
- Subdominios `admin.*` / `cliente.*` en `src/lib/subdomain.ts` + `proxy.ts`
- Invitaciones (Resend opcional), Stripe Checkout + webhook
- `ENABLE_DEMO_SEED=false` por defecto en `.env.example`
- Admin bootstrap con `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `.env` en `.gitignore` (solo se versiona `.env.example`)
- `engines.node >= 22`

## 1. Railway

1. New Project → Deploy from GitHub → `JesusGomezMon/softsolutions-portal`
2. Volume persistente montado en `/data`
3. Réplicas = 1 (SQLite)
4. Variables (producción):

```
AUTH_SECRET=<openssl rand -base64 32>
AUTH_TRUST_HOST=true
DATA_DIR=/data
ADMIN_EMAIL=<tu correo real>
ADMIN_PASSWORD=<contraseña fuerte>
ENABLE_DEMO_SEED=false
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # del dashboard, no de stripe listen
RESEND_API_KEY=re_...
EMAIL_FROM=SoftSolutions <no-reply@softsolutions.mx>
```

5. Dominios custom en el servicio: `admin.softsolutions.mx` y
   `cliente.softsolutions.mx` (TLS automático)

## 2. DNS (softsolutions.mx)

| Host | Tipo | Destino |
|---|---|---|
| admin | CNAME | hostname de Railway |
| cliente | CNAME | hostname de Railway |
| @ / www | → | sitio de marketing (aparte) |

## 3. Stripe live

1. Activar cuenta live (verificación del negocio)
2. Webhook: `https://cliente.softsolutions.mx/api/stripe/webhook`
   - evento: `checkout.session.completed`
   - copiar `whsec_...` a `STRIPE_WEBHOOK_SECRET`
3. Moneda MXN, recibos por correo activados
4. Probar un pago real y reembolsarlo

## 4. Resend

1. Verificar dominio softsolutions.mx (SPF/DKIM)
2. `EMAIL_FROM` con correo de ese dominio
3. Probar una invitación real desde el admin

## 5. Seguridad

- Rotar las `sk_test` / `pk_test` que quedaron en chats
- No pegar live keys en el repo ni en el chat
- Tras el primer login admin, confirma que `ADMIN_PASSWORD` no sea `admin123`

## 6. Smoke test post-deploy

- [ ] `GET /api/health` → 200
- [ ] Login admin → crear cliente → invitar → correo llega → activar
- [ ] Cliente acepta cotización → paga → webhook marca PAGADA
- [ ] `admin.*` solo admin, `cliente.*` solo cliente
- [ ] Vista móvil ~375px

## 7. Operación

- Logs: Railway + Stripe Dashboard → Webhooks
- Rollback: redeploy del commit anterior en Railway
- Backups: snapshot/copia periódica de `/data/app.db` del volumen; probar
  restauración al menos una vez
