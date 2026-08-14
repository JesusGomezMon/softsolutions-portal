import { computeSubscriptionPlans, formatMXN, getService } from "@/lib/catalog";
import type { Quotation } from "@/lib/repo/types";
import { Card, StatusBadge } from "@/components/ui";

const SERVICE_LABELS: Record<string, string> = {
  LANDING_PAGE: "Landing Page",
  SITIO_CORPORATIVO: "Sitio Corporativo",
  TIENDA_LINEA: "Tienda en Línea",
  PERSONALIZADO: "Personalizado",
};

const TIER_LABELS: Record<string, string> = {
  ESENCIAL: "Esencial",
  PROFESIONAL: "Profesional",
  PREMIUM: "Premium / Alta Conversión",
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

export function QuotationDocument({ quotation, clientName }: { quotation: Quotation; clientName: string }) {
  const total = quotation.proyecto_amount - quotation.proyecto_discount;
  const plans = quotation.suscripcion_monthly_base > 0 ? computeSubscriptionPlans(quotation.suscripcion_monthly_base) : [];
  const service = quotation.service_type !== "PERSONALIZADO" ? getService(quotation.service_type) : null;
  const acceptedPlan = plans.find((p) => p.id === quotation.accepted_plan) ?? null;

  return (
    <div className="space-y-6">
      <div className="bg-brand-night p-6 text-white shadow-[0_1px_2px_rgba(11,19,26,0.04)]">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-steel">
          SoftSolutions
        </span>
        <h1 className="font-display mt-2 text-2xl text-white">Cotización comercial</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#a7b2ba]">
          <span>
            Cliente: <span className="text-white">{clientName}</span>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Servicio: <span className="text-white">{quotation.title}</span>
          </span>
          <span className="text-white/20">·</span>
          <StatusBadge status={quotation.status} />
        </div>
      </div>

      {quotation.objective && (
        <Card>
          <h2 className="text-sm font-semibold text-brand-navy">Objetivo</h2>
          <p className="mt-2 text-sm text-brand-muted">{quotation.objective}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quotation.scope_items.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-brand-navy">Alcance del proyecto</h2>
            <ul className="mt-2 space-y-1.5">
              {quotation.scope_items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-brand-muted">
                  <span className="text-brand-indigo">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {quotation.included_items.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-brand-navy">Incluye</h2>
            <ul className="mt-2 space-y-1.5">
              {quotation.included_items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-brand-muted">
                  <span className="text-emerald-600">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {quotation.courtesy_items.length > 0 && (
        <Card className="border-amber-200! bg-amber-50!">
          <h2 className="text-sm font-semibold text-amber-800">Cortesías SoftSolutions</h2>
          <ul className="mt-2 space-y-1.5">
            {quotation.courtesy_items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-800">
                <span>🎁</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Modalidad Proyecto */}
      <Card
        className={
          quotation.accepted_modality === "PROYECTO" ? "ring-2 ring-brand-indigo" : undefined
        }
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-navy">Modalidad por Proyecto</h2>
          {quotation.accepted_modality === "PROYECTO" && (
            <span className="text-xs font-semibold text-brand-indigo">Modalidad elegida ✓</span>
          )}
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-brand-border">
            <tr>
              <td className="py-2 text-brand-muted">{quotation.title}</td>
              <td className="py-2 text-right text-brand-navy">{formatMXN(quotation.proyecto_amount)}</td>
            </tr>
            {quotation.proyecto_discount > 0 && (
              <tr>
                <td className="py-2 text-brand-muted">{quotation.proyecto_discount_label || "Descuento"}</td>
                <td className="py-2 text-right text-red-600">-{formatMXN(quotation.proyecto_discount)}</td>
              </tr>
            )}
            <tr>
              <td className="py-2 font-semibold text-brand-navy">TOTAL</td>
              <td className="py-2 text-right font-semibold text-brand-navy">{formatMXN(total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-brand-muted">
          <span>Forma de pago: {quotation.payment_terms}</span>
          {quotation.estimated_time && <span>Tiempo estimado: {quotation.estimated_time}</span>}
          {service && <span>Garantía: {service.warrantyDays} días</span>}
        </div>
      </Card>

      {/* Modalidad Suscripción */}
      {plans.length > 0 && (
        <Card
          className={
            quotation.accepted_modality === "SUSCRIPCION" ? "ring-2 ring-brand-indigo" : undefined
          }
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-navy">Modalidad de Suscripción</h2>
            {quotation.accepted_modality === "SUSCRIPCION" && (
              <span className="text-xs font-semibold text-brand-indigo">
                {acceptedPlan ? `Plan elegido: ${acceptedPlan.label} ✓` : "Modalidad elegida ✓"}
              </span>
            )}
          </div>
          <div className="mt-3 overflow-x-auto border border-brand-border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-brand-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Plan</th>
                  <th className="px-3 py-2 text-left font-medium">Permanencia</th>
                  <th className="px-3 py-2 text-left font-medium">Soporte</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {plans.map((p) => {
                  const isChosen = quotation.accepted_plan === p.id;
                  return (
                    <tr key={p.id} className={isChosen ? "bg-indigo-50" : undefined}>
                      <td className="px-3 py-2 font-medium text-brand-navy">
                        {p.label}
                        {isChosen && (
                          <span className="ml-2 text-xs font-semibold text-brand-indigo">Elegido ✓</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-brand-muted">{p.minPermanenceMonths} meses mín.</td>
                      <td className="px-3 py-2 text-brand-muted">{p.support}</td>
                      <td className="px-3 py-2 text-right text-brand-navy">
                        {formatMXN(p.total)}
                        {p.months > 1 && (
                          <span className="text-xs text-brand-muted"> ({formatMXN(p.perMonth)}/mes)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-brand-muted">
            Incluye mantenimiento, soporte, actualizaciones, respaldos y mejoras menores del sitio
            durante la vigencia del plan. Planes Trimestral, Semestral y Anual se pagan en una sola
            exhibición al inicio del periodo.
          </p>
        </Card>
      )}

      <p className="text-xs text-brand-muted">
        Esta cotización tiene una vigencia de {quotation.validity_days} días naturales a partir de su
        emisión, hasta el {addDays(quotation.created_at, quotation.validity_days)}.
      </p>
    </div>
  );
}

export { SERVICE_LABELS, TIER_LABELS };
