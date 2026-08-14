import { db } from "@/lib/db";
import type { Quotation, QuotationRow, QuotationStatus } from "./types";
import type { ServiceTier, ServiceType, SubscriptionPlanId } from "@/lib/catalog";

function parseRow(row: QuotationRow): Quotation {
  return {
    ...row,
    scope_items: JSON.parse(row.scope_items || "[]"),
    included_items: JSON.parse(row.included_items || "[]"),
    courtesy_items: JSON.parse(row.courtesy_items || "[]"),
  };
}

export function listQuotationsByClient(clientId: number): Quotation[] {
  const rows = db
    .prepare("SELECT * FROM quotations WHERE client_id = ? ORDER BY created_at DESC")
    .all(clientId) as unknown as QuotationRow[];
  return rows.map(parseRow);
}

export function listAllQuotationsWithClientName(): (Quotation & { client_name: string })[] {
  const rows = db
    .prepare(
      `SELECT q.*, c.name AS client_name
       FROM quotations q JOIN clients c ON c.id = q.client_id
       ORDER BY q.created_at DESC`
    )
    .all() as unknown as (QuotationRow & { client_name: string })[];
  return rows.map((r) => ({ ...parseRow(r), client_name: r.client_name }));
}

export function getQuotation(id: number): Quotation | undefined {
  const row = db.prepare("SELECT * FROM quotations WHERE id = ?").get(id) as unknown as
    | QuotationRow
    | undefined;
  return row ? parseRow(row) : undefined;
}

export interface CreateQuotationInput {
  client_id: number;
  project_id?: number | null;
  service_type: ServiceType;
  service_tier?: ServiceTier | null;
  title: string;
  objective: string;
  scope_items: string[];
  included_items: string[];
  courtesy_items: string[];
  proyecto_amount: number;
  proyecto_discount: number;
  proyecto_discount_label?: string | null;
  payment_terms: string;
  estimated_time: string;
  suscripcion_setup_fee: number;
  suscripcion_monthly_base: number;
  validity_days: number;
}

export function createQuotation(input: CreateQuotationInput): number {
  const result = db
    .prepare(
      `INSERT INTO quotations (
        client_id, project_id, service_type, service_tier, title, objective,
        scope_items, included_items, courtesy_items,
        proyecto_amount, proyecto_discount, proyecto_discount_label,
        payment_terms, estimated_time,
        suscripcion_setup_fee, suscripcion_monthly_base, validity_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.client_id,
      input.project_id ?? null,
      input.service_type,
      input.service_tier ?? null,
      input.title,
      input.objective,
      JSON.stringify(input.scope_items),
      JSON.stringify(input.included_items),
      JSON.stringify(input.courtesy_items),
      input.proyecto_amount,
      input.proyecto_discount,
      input.proyecto_discount_label ?? null,
      input.payment_terms,
      input.estimated_time,
      input.suscripcion_setup_fee,
      input.suscripcion_monthly_base,
      input.validity_days
    );
  return Number(result.lastInsertRowid);
}

export function deleteQuotation(id: number): void {
  db.prepare("DELETE FROM quotations WHERE id = ?").run(id);
}

/** Marks a quotation as paid from a confirmed Stripe checkout. Idempotent. */
export function markQuotationPaid(id: number, stripeSessionId: string): void {
  db.prepare(
    "UPDATE quotations SET status = 'PAGADA', stripe_session_id = ?, paid_at = datetime('now') WHERE id = ?"
  ).run(stripeSessionId, id);
}

export function updateQuotationStatus(
  id: number,
  status: QuotationStatus,
  acceptedModality?: "PROYECTO" | "SUSCRIPCION" | null,
  acceptedPlan?: SubscriptionPlanId | null
): void {
  if (acceptedModality !== undefined) {
    // Only a subscription carries a plan; a project acceptance clears it.
    const plan = acceptedModality === "SUSCRIPCION" ? acceptedPlan ?? null : null;
    db.prepare(
      "UPDATE quotations SET status = ?, accepted_modality = ?, accepted_plan = ? WHERE id = ?"
    ).run(status, acceptedModality, plan, id);
  } else {
    db.prepare("UPDATE quotations SET status = ? WHERE id = ?").run(status, id);
  }
}
