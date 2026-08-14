import { computeSubscriptionPlans } from "@/lib/catalog";
import type { Quotation } from "@/lib/repo/types";
import { ANTICIPO_FRACTION } from "@/lib/stripe";

export interface PaymentLine {
  label: string;
  amountMXN: number;
}

export interface PaymentBreakdown {
  lines: PaymentLine[];
  totalMXN: number;
}

/**
 * Qué se cobra en línea al pagar una cotización ACEPTADA, según la modalidad
 * que el cliente eligió y las reglas del catálogo:
 *  - Proyecto     → anticipo (50% del total por defecto, ver ANTICIPO_FRACTION).
 *  - Suscripción  → primer periodo del plan elegido (SIN la cuota de configuración).
 * Devuelve null si la cotización no tiene una modalidad aceptada válida.
 */
export function paymentBreakdown(q: Quotation): PaymentBreakdown | null {
  if (q.accepted_modality === "PROYECTO") {
    const total = q.proyecto_amount - q.proyecto_discount;
    if (total <= 0) return null;
    const anticipo = Math.round(total * ANTICIPO_FRACTION);
    const isPartial = ANTICIPO_FRACTION < 1;
    return {
      lines: [{ label: `${isPartial ? "Anticipo — " : ""}${q.title}`, amountMXN: anticipo }],
      totalMXN: anticipo,
    };
  }

  if (q.accepted_modality === "SUSCRIPCION" && q.accepted_plan && q.suscripcion_monthly_base > 0) {
    const plan = computeSubscriptionPlans(q.suscripcion_monthly_base).find(
      (p) => p.id === q.accepted_plan
    );
    if (!plan) return null;
    // Solo el primer periodo del plan. La cuota de configuración NO se cobra aquí.
    return {
      lines: [{ label: `Plan ${plan.label} — primer periodo`, amountMXN: plan.total }],
      totalMXN: plan.total,
    };
  }

  return null;
}
