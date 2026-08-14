import Stripe from "stripe";

// Lazy Stripe client. Keys live in env (never in code) so the app runs fine in
// dev/CI without them; payment actions guard on isStripeConfigured() first.
let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurada.");
  if (!cached) cached = new Stripe(key);
  return cached;
}

export const CURRENCY = "mxn";

// Modalidad Proyecto: el catálogo cobra 50% de anticipo y 50% contra entrega.
// El pago en línea al aceptar es ese anticipo. Cámbialo a 1 si quieres cobrar
// el total en línea.
export const ANTICIPO_FRACTION = 0.5;
