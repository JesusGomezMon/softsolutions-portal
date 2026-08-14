import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getClient } from "@/lib/repo/clients";
import { getQuotation, updateQuotationStatus, deleteQuotation } from "@/lib/repo/quotations";
import { QuotationDocument } from "@/components/QuotationDocument";
import { PrintButton } from "@/components/PrintButton";
import { Card } from "@/components/ui";
import { computeSubscriptionPlans, formatMXN, type SubscriptionPlanId } from "@/lib/catalog";

export default async function AdminQuotationDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; quotationId: string }>;
}) {
  const { clientId, quotationId } = await params;
  const client = await getClient(Number(clientId));
  const quotation = await getQuotation(Number(quotationId));
  if (!client || !quotation || quotation.client_id !== client.id) notFound();

  const path = `/admin/clientes/${clientId}/cotizaciones/${quotationId}`;

  async function markSent() {
    "use server";
    await updateQuotationStatus(quotation!.id, "ENVIADA");
    revalidatePath(path);
  }

  async function markAccepted(formData: FormData) {
    "use server";
    const modality = String(formData.get("modality")) as "PROYECTO" | "SUSCRIPCION";
    const planRaw = String(formData.get("plan") ?? "");
    const plan = (planRaw || null) as SubscriptionPlanId | null;
    await updateQuotationStatus(quotation!.id, "ACEPTADA", modality, plan);
    revalidatePath(path);
  }

  async function markPaid() {
    "use server";
    // Preserve the accepted plan when advancing to PAGADA.
    await updateQuotationStatus(quotation!.id, "PAGADA", quotation!.accepted_modality, quotation!.accepted_plan);
    revalidatePath(path);
  }

  async function deleteAction() {
    "use server";
    await deleteQuotation(quotation!.id);
    revalidatePath(`/admin/clientes/${clientId}`);
    redirect(`/admin/clientes/${clientId}`);
  }

  const plans =
    quotation.suscripcion_monthly_base > 0
      ? computeSubscriptionPlans(quotation.suscripcion_monthly_base)
      : [];

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/clientes/${clientId}`} className="text-sm font-medium text-brand-indigo hover:underline">
          ← Volver a {client.name}
        </Link>
        <PrintButton />
      </div>

      <QuotationDocument quotation={quotation} clientName={client.name} />

      <Card className="no-print">
        <h2 className="text-sm font-semibold text-brand-navy">Avanzar estado</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quotation.status === "BORRADOR" && (
            <form action={markSent}>
              <button type="submit" className="rounded-md bg-brand-indigo px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Marcar como enviada
              </button>
            </form>
          )}
          {quotation.status === "ENVIADA" && (
            <>
              <form action={markAccepted}>
                <input type="hidden" name="modality" value="PROYECTO" />
                <button type="submit" className="rounded-md border border-brand-indigo px-3 py-1.5 text-sm font-medium text-brand-indigo hover:bg-brand-indigo hover:text-white">
                  Cliente aceptó: Proyecto
                </button>
              </form>
              {plans.length > 0 && (
                <form action={markAccepted} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="modality" value="SUSCRIPCION" />
                  <select
                    name="plan"
                    required
                    defaultValue=""
                    className="rounded-md border border-brand-border px-3 py-1.5 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  >
                    <option value="" disabled>
                      Elige el plan…
                    </option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {p.minPermanenceMonths} meses mín. · {formatMXN(p.total)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-md border border-brand-indigo px-3 py-1.5 text-sm font-medium text-brand-indigo hover:bg-brand-indigo hover:text-white">
                    Cliente aceptó: Suscripción
                  </button>
                </form>
              )}
            </>
          )}
          {quotation.status === "ACEPTADA" && (
            <form action={markPaid}>
              <button type="submit" className="rounded-md bg-brand-indigo px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Marcar como pagada
              </button>
            </form>
          )}
          {quotation.status === "PAGADA" && (
            <p className="text-sm text-brand-muted">Esta cotización ya está pagada.</p>
          )}
        </div>
      </Card>

      <Card className="no-print border-red-200">
        <h2 className="text-sm font-semibold text-red-700">Eliminar cotización</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Esta acción es permanente y no se puede deshacer.
        </p>
        <form action={deleteAction} className="mt-3">
          <button
            type="submit"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-600 hover:text-white"
          >
            Borrar cotización
          </button>
        </form>
      </Card>
    </div>
  );
}
