import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { getClient } from "@/lib/repo/clients";
import { getQuotation, updateQuotationStatus } from "@/lib/repo/quotations";
import { QuotationDocument } from "@/components/QuotationDocument";
import { PrintButton } from "@/components/PrintButton";
import { Card } from "@/components/ui";
import { computeSubscriptionPlans, formatMXN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from "@/lib/catalog";
import { paymentBreakdown } from "@/lib/payments";
import { getStripe, isStripeConfigured, CURRENCY, ANTICIPO_FRACTION } from "@/lib/stripe";

const PLAN_IDS = SUBSCRIPTION_PLANS.map((p) => p.id) as string[];

export default async function PortalQuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ quotationId: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const { quotationId } = await params;
  const sp = await searchParams;
  const session = await auth();
  const clientId = session?.user?.clientId;

  const quotation = getQuotation(Number(quotationId));
  // Ownership check: a client can only ever open their own quotation.
  if (!clientId || !quotation || quotation.client_id !== clientId) notFound();

  const client = getClient(clientId);

  async function acceptQuotation(formData: FormData) {
    "use server";
    // Re-verify everything server-side: the client may only accept their OWN
    // quotation, and only while it's ENVIADA (no re-accepting, no touching PAGADA).
    const s = await auth();
    const cid = s?.user?.clientId;
    const q = getQuotation(Number(quotationId));
    if (!cid || !q || q.client_id !== cid || q.status !== "ENVIADA") return;

    const modality = String(formData.get("modality"));
    if (modality !== "PROYECTO" && modality !== "SUSCRIPCION") return;

    let plan: SubscriptionPlanId | null = null;
    if (modality === "SUSCRIPCION") {
      if (q.suscripcion_monthly_base <= 0) return; // subscription wasn't offered
      const planRaw = String(formData.get("plan") ?? "");
      if (!PLAN_IDS.includes(planRaw)) return; // a plan is required
      plan = planRaw as SubscriptionPlanId;
    }

    updateQuotationStatus(q.id, "ACEPTADA", modality, plan);
    revalidatePath(`/portal/cotizaciones/${quotationId}`);
    revalidatePath("/portal");
  }

  async function payQuotation() {
    "use server";
    // Ownership + state guard: only the owner may pay, and only an ACCEPTED
    // (not yet paid) quotation.
    const s = await auth();
    const cid = s?.user?.clientId;
    const q = getQuotation(Number(quotationId));
    if (!cid || !q || q.client_id !== cid || q.status !== "ACEPTADA") return;

    const breakdown = paymentBreakdown(q);
    if (!breakdown) return;
    if (!isStripeConfigured()) {
      redirect(`/portal/cotizaciones/${quotationId}?pago=error`);
    }

    const h = await headers();
    const base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

    // Stripe Checkout (hosted) — the card never touches our server. The webhook
    // (/api/stripe/webhook) is the source of truth that marks it PAGADA.
    const checkout = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: s?.user?.email ?? undefined,
      line_items: breakdown.lines.map((l) => ({
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          product_data: { name: l.label },
          unit_amount: l.amountMXN * 100, // centavos
        },
      })),
      metadata: { quotationId: String(q.id) },
      success_url: `${base}/portal/cotizaciones/${q.id}?pago=exito`,
      cancel_url: `${base}/portal/cotizaciones/${q.id}?pago=cancelado`,
    });

    if (!checkout.url) redirect(`/portal/cotizaciones/${quotationId}?pago=error`);
    redirect(checkout.url);
  }

  const plans =
    quotation.suscripcion_monthly_base > 0
      ? computeSubscriptionPlans(quotation.suscripcion_monthly_base)
      : [];
  const projectTotal = quotation.proyecto_amount - quotation.proyecto_discount;
  const acceptedPlan = plans.find((p) => p.id === quotation.accepted_plan) ?? null;
  const breakdown = paymentBreakdown(quotation);
  const stripeReady = isStripeConfigured();
  const modalityLabel =
    quotation.accepted_modality === "SUSCRIPCION"
      ? `Suscripción${acceptedPlan ? ` (plan ${acceptedPlan.label})` : ""}`
      : "Proyecto";

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/portal" className="text-sm font-medium text-brand-indigo hover:underline">
          ← Volver a mi panel
        </Link>
        <PrintButton />
      </div>

      <QuotationDocument quotation={quotation} clientName={client?.name ?? ""} />

      {/* El cliente acepta su propia cotización cuando ya fue enviada. */}
      {quotation.status === "ENVIADA" && (
        <Card className="no-print">
          <h2 className="font-display text-lg text-brand-navy">Acepta tu cotización</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Elige la modalidad con la que quieres continuar. Al aceptar, SoftSolutions te contactará
            para el siguiente paso.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Modalidad Proyecto */}
            <form action={acceptQuotation} className="flex flex-col gap-3 border border-brand-border p-4">
              <div>
                <p className="text-sm font-semibold text-brand-navy">Modalidad Proyecto</p>
                <p className="mt-1 text-xs text-brand-muted">Pago único · el sitio es tuyo al liquidar.</p>
                <p className="font-display mt-2 text-xl text-brand-navy">{formatMXN(projectTotal)}</p>
              </div>
              <input type="hidden" name="modality" value="PROYECTO" />
              <button
                type="submit"
                className="mt-auto bg-brand-indigo px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#244a6e]"
              >
                Aceptar Proyecto
              </button>
            </form>

            {/* Modalidad Suscripción */}
            {plans.length > 0 && (
              <form action={acceptQuotation} className="flex flex-col gap-3 border border-brand-border p-4">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">Modalidad Suscripción</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    Mensualidad · incluye mantenimiento y soporte.
                  </p>
                </div>
                <input type="hidden" name="modality" value="SUSCRIPCION" />
                <div>
                  <label className="block text-xs font-medium text-brand-muted">Elige tu plan</label>
                  <select
                    name="plan"
                    required
                    defaultValue=""
                    className="mt-1 w-full border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  >
                    <option value="" disabled>
                      Plan / permanencia…
                    </option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {p.minPermanenceMonths} meses mín. · {formatMXN(p.total)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="mt-auto border border-brand-indigo px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-brand-indigo transition hover:bg-brand-indigo hover:text-white"
                >
                  Aceptar Suscripción
                </button>
              </form>
            )}
          </div>
        </Card>
      )}

      {/* Avisos del retorno de Stripe. */}
      {sp.pago === "cancelado" && (
        <Card className="no-print border-amber-200! bg-amber-50!">
          <p className="text-sm text-amber-800">
            Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.
          </p>
        </Card>
      )}
      {sp.pago === "error" && (
        <Card className="no-print border-red-200! bg-red-50!">
          <p className="text-sm text-red-700">
            No se pudo iniciar el pago. Intenta de nuevo o contacta a SoftSolutions.
          </p>
        </Card>
      )}
      {sp.pago === "exito" && quotation.status !== "PAGADA" && (
        <Card className="no-print border-emerald-200! bg-emerald-50!">
          <p className="text-sm text-emerald-800">
            Pago recibido — lo estamos confirmando. El estado se actualizará en un momento.
          </p>
        </Card>
      )}

      {/* Pago: cotización aceptada y pendiente de pagar. */}
      {quotation.status === "ACEPTADA" && breakdown && (
        <Card className="no-print">
          <h2 className="font-display text-lg text-brand-navy">Paga tu cotización</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Aceptaste la modalidad {modalityLabel}. Completa el pago con tarjeta para iniciar.
          </p>

          <div className="mt-4 border border-brand-border">
            <ul className="divide-y divide-brand-border">
              {breakdown.lines.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="text-brand-muted">{l.label}</span>
                  <span className="text-brand-navy">{formatMXN(l.amountMXN)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-brand-navy">Total a pagar ahora</span>
                <span className="font-display text-lg text-brand-navy">{formatMXN(breakdown.totalMXN)}</span>
              </li>
            </ul>
          </div>

          {stripeReady ? (
            <form action={payQuotation} className="mt-4">
              <button
                type="submit"
                className="w-full bg-brand-indigo px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#244a6e] sm:w-auto"
              >
                Pagar {formatMXN(breakdown.totalMXN)} con tarjeta
              </button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-brand-muted">
              El pago con tarjeta estará disponible en breve.
            </p>
          )}

          {quotation.accepted_modality === "PROYECTO" && ANTICIPO_FRACTION < 1 && (
            <p className="mt-2 text-xs text-brand-muted">
              Es el anticipo; el resto se cubre contra entrega, según los términos de la cotización.
            </p>
          )}
        </Card>
      )}

      {/* Aceptada pero sin monto a cobrar (caso borde). */}
      {quotation.status === "ACEPTADA" && !breakdown && (
        <Card className="no-print border-emerald-200! bg-emerald-50!">
          <p className="text-sm font-semibold text-emerald-800">¡Aceptaste esta cotización!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Elegiste la modalidad {modalityLabel}. SoftSolutions se pondrá en contacto contigo para
            continuar.
          </p>
        </Card>
      )}

      {/* Pagada. */}
      {quotation.status === "PAGADA" && (
        <Card className="no-print border-emerald-200! bg-emerald-50!">
          <p className="text-sm font-semibold text-emerald-800">Pago recibido — ¡gracias!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Tu pago de la modalidad {modalityLabel} quedó confirmado. Te enviamos el recibo a tu
            correo.
          </p>
        </Card>
      )}

      {/* Todavía en preparación: aún no se envía al cliente. */}
      {quotation.status === "BORRADOR" && (
        <Card className="no-print">
          <p className="text-sm text-brand-muted">
            Esta cotización todavía está en preparación. Podrás aceptarla en cuanto SoftSolutions te
            la envíe.
          </p>
        </Card>
      )}
    </div>
  );
}
