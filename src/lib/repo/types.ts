import type { ServiceType, ServiceTier, SubscriptionPlanId } from "@/lib/catalog";

export type Role = "ADMIN" | "CLIENT";
export type Modality = "PROYECTO" | "SUSCRIPCION";
export type ProjectStatus = "ACTIVO" | "PAUSADO" | "COMPLETADO";
export type MilestoneStatus = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO";
export type QuotationStatus = "BORRADOR" | "ENVIADA" | "ACEPTADA" | "PAGADA";

export interface Client {
  id: number;
  name: string;
  company: string;
  contact_email: string;
  created_at: string;
}

export interface AppUser {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  client_id: number | null;
  must_change_password: number;
  invite_token: string | null;
  invite_expires_at: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  modality: Modality;
  tier: string;
  status: ProjectStatus;
  created_at: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  status: MilestoneStatus;
  order_index: number;
  due_date: string | null;
}

export interface Quotation {
  id: number;
  client_id: number;
  project_id: number | null;
  service_type: ServiceType;
  service_tier: ServiceTier | null;
  title: string;
  objective: string;
  scope_items: string[];
  included_items: string[];
  courtesy_items: string[];
  proyecto_amount: number;
  proyecto_discount: number;
  proyecto_discount_label: string | null;
  payment_terms: string;
  estimated_time: string;
  suscripcion_setup_fee: number;
  suscripcion_monthly_base: number;
  validity_days: number;
  status: QuotationStatus;
  accepted_modality: "PROYECTO" | "SUSCRIPCION" | null;
  accepted_plan: SubscriptionPlanId | null;
  stripe_session_id: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Raw shape as stored in SQLite, before JSON-parsing the array columns. */
export interface QuotationRow extends Omit<Quotation, "scope_items" | "included_items" | "courtesy_items"> {
  scope_items: string;
  included_items: string;
  courtesy_items: string;
}
