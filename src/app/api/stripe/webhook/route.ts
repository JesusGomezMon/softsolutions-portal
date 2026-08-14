import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { markQuotationPaid } from "@/lib/repo/quotations";

// Stripe confirma el pago aquí (server-to-server) — es la fuente de verdad, no
// el redirect de regreso. La ruta NO pasa por el proxy de auth (el matcher solo
// cubre /admin, /portal y /cambiar-password), así que Stripe la alcanza libre.
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !webhookSecret) {
    return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Falta la firma de Stripe." }, { status: 400 });
  }

  // Raw body is required for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "firma inválida";
    return NextResponse.json({ error: `Webhook inválido: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quotationId = Number(session.metadata?.quotationId);
    if (quotationId && session.payment_status === "paid") {
      await markQuotationPaid(quotationId, session.id);
    }
  }

  return NextResponse.json({ received: true });
}
