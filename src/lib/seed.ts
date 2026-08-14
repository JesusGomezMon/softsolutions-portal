import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { countUsersByRole, createUser } from "@/lib/repo/users";
import { createClient } from "@/lib/repo/clients";
import { createProject } from "@/lib/repo/projects";
import { createMilestone, updateMilestoneStatus } from "@/lib/repo/milestones";
import { createQuotation, updateQuotationStatus } from "@/lib/repo/quotations";
import { getService, getTierInfo, DEFAULT_PAYMENT_TERMS_PROYECTO, DEFAULT_VALIDITY_DAYS } from "@/lib/catalog";

// Fictional demo data only — no real SoftSolutions client names or pricing
// decisions. Quotation #1 below mirrors the structure of a real quotation
// Jesús shared (client: ABC Swimming Pool Service, Landing Page Profesional)
// but is reproduced here for a fictional demo client with its own numbers.

let seeded = false;

/**
 * Ensures exactly one ADMIN exists, using ADMIN_EMAIL / ADMIN_PASSWORD from the
 * environment (falling back to local-dev defaults only when unset). Idempotent.
 */
function ensureAdminUser() {
  if (countUsersByRole("ADMIN") > 0) return;
  createUser({
    email: process.env.ADMIN_EMAIL || "admin@softsolutions.mx",
    password_hash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10),
    name: "Equipo SoftSolutions",
    role: "ADMIN",
  });
}

/**
 * Fictional demo data — only when ENABLE_DEMO_SEED=true, so a real production
 * deploy never mixes fake clients with real ones. Idempotent.
 */
function ensureDemoData() {
  if (process.env.ENABLE_DEMO_SEED !== "true") return;
  const existing = db.prepare("SELECT COUNT(*) as n FROM clients").get() as { n: number };
  if (existing.n > 0) return;

  db.exec("BEGIN");
  try {
    // --- Client 1: Panadería La Espiga — quotation modeled on the ABC example ---
    const c1 = createClient({
      name: "Panadería La Espiga",
      company: "La Espiga S.A. de C.V.",
      contact_email: "contacto@laespiga.mx",
    });
    createUser({
      email: "cliente1@laespiga.mx",
      password_hash: bcrypt.hashSync("cliente123", 10),
      name: "María Fernández",
      role: "CLIENT",
      client_id: c1,
    });
    const p1 = createProject({
      client_id: c1,
      name: "Landing page + catálogo en línea",
      modality: "PROYECTO",
      tier: "Profesional",
    });
    const p1m1 = createMilestone({ project_id: p1, title: "Descubrimiento y propuesta de diseño", order_index: 1 });
    const p1m2 = createMilestone({ project_id: p1, title: "Desarrollo del sitio", order_index: 2 });
    createMilestone({ project_id: p1, title: "Revisión y ajustes finales", order_index: 3 });
    createMilestone({ project_id: p1, title: "Publicación y entrega", order_index: 4 });
    updateMilestoneStatus(p1m1, "COMPLETADO");
    updateMilestoneStatus(p1m2, "EN_PROGRESO");

    const landingPage = getService("LANDING_PAGE");
    const landingProfesional = getTierInfo("LANDING_PAGE", "PROFESIONAL")!;
    const q1 = createQuotation({
      client_id: c1,
      project_id: p1,
      service_type: "LANDING_PAGE",
      service_tier: "PROFESIONAL",
      title: "Desarrollo de Landing Page Profesional",
      objective:
        "Desarrollar una landing page profesional enfocada en presentar la panadería, sus productos y su proceso de trabajo, facilitando el contacto con clientes potenciales.",
      scope_items: landingPage.defaultScope,
      included_items: landingPage.defaultIncluded,
      courtesy_items: [
        "Hosting durante el primer año",
        "Compra y configuración del dominio",
        "Capacitación básica",
      ],
      proyecto_amount: 8500,
      proyecto_discount: 1500,
      proyecto_discount_label: "Descuento especial de lanzamiento",
      payment_terms: DEFAULT_PAYMENT_TERMS_PROYECTO,
      estimated_time: landingProfesional.time,
      suscripcion_setup_fee: 0,
      suscripcion_monthly_base: landingPage.referenceMonthlyBase ?? 0,
      validity_days: DEFAULT_VALIDITY_DAYS,
    });
    updateQuotationStatus(q1, "ACEPTADA", "PROYECTO");

    // --- Client 2: Clínica Dental Sonrisa — subscription example ---
    const c2 = createClient({
      name: "Clínica Dental Sonrisa",
      company: "Grupo Sonrisa",
      contact_email: "administracion@clinicasonrisa.mx",
    });
    createUser({
      email: "cliente1@clinicasonrisa.mx",
      password_hash: bcrypt.hashSync("cliente123", 10),
      name: "Dr. Luis Ramírez",
      role: "CLIENT",
      client_id: c2,
    });
    const p2 = createProject({
      client_id: c2,
      name: "Sitio corporativo + mantenimiento mensual",
      modality: "SUSCRIPCION",
      tier: "Esencial",
    });
    const p2m1 = createMilestone({ project_id: p2, title: "Migración a nuevo hosting", order_index: 1 });
    createMilestone({ project_id: p2, title: "Configuración de respaldos automáticos", order_index: 2 });
    createMilestone({ project_id: p2, title: "Reporte mensual de rendimiento", order_index: 3 });
    updateMilestoneStatus(p2m1, "COMPLETADO");

    const sitioCorp = getService("SITIO_CORPORATIVO");
    const sitioEsencial = getTierInfo("SITIO_CORPORATIVO", "ESENCIAL")!;
    const q2 = createQuotation({
      client_id: c2,
      project_id: p2,
      service_type: "SITIO_CORPORATIVO",
      service_tier: "ESENCIAL",
      title: "Sitio Corporativo Esencial",
      objective:
        "Desarrollar el sitio corporativo de la clínica con información de servicios, equipo médico y contacto, bajo la modalidad de suscripción con mantenimiento continuo.",
      scope_items: sitioCorp.defaultScope,
      included_items: sitioCorp.defaultIncluded,
      courtesy_items: [],
      proyecto_amount: 16000,
      proyecto_discount: 0,
      proyecto_discount_label: null,
      payment_terms: DEFAULT_PAYMENT_TERMS_PROYECTO,
      estimated_time: sitioEsencial.time,
      suscripcion_setup_fee: 0,
      suscripcion_monthly_base: 2200,
      validity_days: DEFAULT_VALIDITY_DAYS,
    });
    updateQuotationStatus(q2, "PAGADA", "SUSCRIPCION", "SEMESTRAL");

    // --- Client 3: Ferretería El Tornillo — quotation still awaiting a reply ---
    const c3 = createClient({
      name: "Ferretería El Tornillo",
      company: "El Tornillo Comercial",
      contact_email: "ventas@eltornillo.mx",
    });
    createUser({
      email: "cliente1@eltornillo.mx",
      password_hash: bcrypt.hashSync("cliente123", 10),
      name: "Jorge Peña",
      role: "CLIENT",
      client_id: c3,
    });
    const p3 = createProject({
      client_id: c3,
      name: "Landing page de lanzamiento",
      modality: "PROYECTO",
      tier: "Esencial",
    });
    createMilestone({ project_id: p3, title: "Brief y referencias visuales", order_index: 1 });
    createMilestone({ project_id: p3, title: "Diseño de la landing", order_index: 2 });
    createMilestone({ project_id: p3, title: "Entrega final", order_index: 3 });

    const landingEsencial = getTierInfo("LANDING_PAGE", "ESENCIAL")!;
    const q3 = createQuotation({
      client_id: c3,
      project_id: p3,
      service_type: "LANDING_PAGE",
      service_tier: "ESENCIAL",
      title: "Desarrollo de Landing Page Esencial",
      objective: "Landing page de lanzamiento para presentar el catálogo de productos y los datos de contacto de la ferretería.",
      scope_items: landingPage.defaultScope,
      included_items: landingPage.defaultIncluded,
      courtesy_items: [],
      proyecto_amount: 5500,
      proyecto_discount: 0,
      proyecto_discount_label: null,
      payment_terms: DEFAULT_PAYMENT_TERMS_PROYECTO,
      estimated_time: landingEsencial.time,
      suscripcion_setup_fee: 0,
      suscripcion_monthly_base: landingPage.referenceMonthlyBase ?? 0,
      validity_days: DEFAULT_VALIDITY_DAYS,
    });
    updateQuotationStatus(q3, "ENVIADA");

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  ensureAdminUser();
  ensureDemoData();
}

ensureSeeded();
