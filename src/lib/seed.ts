import bcrypt from "bcryptjs";
import { ensureSchema, one, run } from "@/lib/db";
import { countUsersByRole, createUser } from "@/lib/repo/users";
import { createClient } from "@/lib/repo/clients";
import { createProject } from "@/lib/repo/projects";
import { createMilestone, updateMilestoneStatus } from "@/lib/repo/milestones";
import { createQuotation, updateQuotationStatus } from "@/lib/repo/quotations";
import {
  getService,
  getTierInfo,
  DEFAULT_PAYMENT_TERMS_PROYECTO,
  DEFAULT_VALIDITY_DAYS,
} from "@/lib/catalog";

let seeded = false;

async function ensureAdminUser() {
  if ((await countUsersByRole("ADMIN")) > 0) return;
  await createUser({
    email: process.env.ADMIN_EMAIL || "admin@softsolutions.mx",
    password_hash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10),
    name: "Equipo SoftSolutions",
    role: "ADMIN",
  });
}

/** Cliente real: ABC Swimming Pool Service. Solo si la DB no tiene clientes. */
async function ensureAbcClient() {
  const existing = await one<{ n: number }>("SELECT COUNT(*) as n FROM clients");
  if (Number(existing?.n ?? 0) > 0) return;

  await run("BEGIN");
  try {
    const clientId = await createClient({
      name: "ABC Swimming Pool Service",
      company: "ABC Swimming Pool Service",
      contact_email: "fernando@abcswimmingpoolservice.com",
    });

    await createUser({
      email: "fernando@abcswimmingpoolservice.com",
      password_hash: bcrypt.hashSync(
        process.env.ABC_CLIENT_PASSWORD || "CambiarABC2026!",
        10
      ),
      name: "Fernando",
      role: "CLIENT",
      client_id: clientId,
      must_change_password: true,
    });

    const projectId = await createProject({
      client_id: clientId,
      name: "Landing page — abcswimmingpoolservice.com",
      modality: "PROYECTO",
      tier: "Profesional",
    });

    const titles = [
      "Descubrimiento y propuesta de diseño",
      "Desarrollo del sitio",
      "Revisión y ajustes finales",
      "Publicación y entrega",
    ];
    for (let i = 0; i < titles.length; i++) {
      const id = await createMilestone({
        project_id: projectId,
        title: titles[i],
        order_index: i + 1,
      });
      await updateMilestoneStatus(id, "COMPLETADO");
    }
    await run("UPDATE projects SET status = 'COMPLETADO' WHERE id = ?", [projectId]);

    const landing = getService("LANDING_PAGE");
    const profesional = getTierInfo("LANDING_PAGE", "PROFESIONAL")!;
    const quotationId = await createQuotation({
      client_id: clientId,
      project_id: projectId,
      service_type: "LANDING_PAGE",
      service_tier: "PROFESIONAL",
      title: "Desarrollo de Landing Page Profesional",
      objective:
        "Desarrollar una landing page profesional enfocada en presentar el servicio de mantenimiento de piscinas en San Antonio, generar confianza y facilitar el contacto para presupuestos gratis.",
      scope_items: landing.defaultScope,
      included_items: landing.defaultIncluded,
      courtesy_items: [
        "Hosting durante el primer año",
        "Compra y configuración del dominio",
        "Capacitación básica",
      ],
      proyecto_amount: 8500,
      proyecto_discount: 1500,
      proyecto_discount_label: "Descuento especial de lanzamiento",
      payment_terms: DEFAULT_PAYMENT_TERMS_PROYECTO,
      estimated_time: profesional.time,
      suscripcion_setup_fee: 0,
      suscripcion_monthly_base: landing.referenceMonthlyBase ?? 0,
      validity_days: DEFAULT_VALIDITY_DAYS,
    });
    await updateQuotationStatus(quotationId, "ACEPTADA", "PROYECTO");

    await run("COMMIT");
  } catch (err) {
    await run("ROLLBACK");
    throw err;
  }
}

export async function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  await ensureSchema();
  await ensureAdminUser();
  if (process.env.ENABLE_DEMO_SEED === "true") return;
  await ensureAbcClient();
}
