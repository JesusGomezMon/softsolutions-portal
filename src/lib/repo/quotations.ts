import { many, one, run } from "@/lib/db";
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

export async function listQuotationsByClient(clientId: number): Promise<Quotation[]> {
  const rows = await many<QuotationRow>(
    "SELECT * FROM quotations WHERE client_id = ? ORDER BY created_at DESC",
    [clientId]
  );
  return rows.map(parseRow);
}

export async function listAllQuotationsWithClientName(): Promise<(Quotation & { client_name: string })[]> {
  const rows = await many<QuotationRow & { client_name: string }>(
    `SELECT q.*, c.name AS client_name
     FROM quotations q JOIN clients c ON c.id = q.client_id
     ORDER BY q.created_at DESC`
  );
  return rows.map((r) => ({ ...parseRow(r), client_name: r.client_name }));
}

export async function getQuotation(id: number): Promise<Quotation | undefined> {
  const row = await one<QuotationRow>("SELECT * FROM quotations WHERE id = ?", [id]);
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

export async function createQuotation(input: CreateQuotationInput): Promise<number> {
  const result = await run(
    `INSERT INTO quotations (
      client_id, project_id, service_type, service_tier, title, objective,
      scope_items, included_items, courtesy_items,
      proyecto_amount, proyecto_discount, proyecto_discount_label,
      payment_terms, estimated_time,
      suscripcion_setup_fee, suscripcion_monthly_base, validity_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
      input.validity_days,
    ]
  );
  return Number(result.lastInsertRowid);
}

export async function deleteQuotation(id: number): Promise<void> {
  await run("DELETE FROM quotations WHERE id = ?", [id]);
}

/** Marks a quotation as paid from a confirmed Stripe checkout. Idempotent. */
export async function markQuotationPaid(id: number, stripeSessionId: string): Promise<void> {
  await run(
    "UPDATE quotations SET status = 'PAGADA', stripe_session_id = ?, paid_at = datetime('now') WHERE id = ?",
    [stripeSessionId, id]
  );
}

export async function updateQuotationStatus(
  id: number,
  status: QuotationStatus,
  acceptedModality?: "PROYECTO" | "SUSCRIPCION" | null,
  acceptedPlan?: SubscriptionPlanId | null
): Promise<void> {
  if (acceptedModality !== undefined) {
    const plan = acceptedModality === "SUSCRIPCION" ? acceptedPlan ?? null : null;
    await run(
      "UPDATE quotations SET status = ?, accepted_modality = ?, accepted_plan = ? WHERE id = ?",
      [status, acceptedModality, plan, id]
    );
  } else {
    await run("UPDATE quotations SET status = ? WHERE id = ?", [status, id]);
  }
}
