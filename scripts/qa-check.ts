// Lightweight regression check for the data-access layer, independent of the
// Next.js server. Run with: npx tsx scripts/qa-check.ts
//
// Exercises exactly what the admin UI's Server Actions call — creating a
// project, a milestone on it, and a quotation — and asserts the shape of the
// result. Useful as a fast sanity check after touching src/lib/repo/*.

import { listClients } from "../src/lib/repo/clients";
import { createProject, listProjectsByClient } from "../src/lib/repo/projects";
import { createMilestone, listMilestonesByProject, updateMilestoneStatus, projectProgress } from "../src/lib/repo/milestones";
import { createQuotation, listQuotationsByClient, updateQuotationStatus } from "../src/lib/repo/quotations";
import { ensureSeeded } from "../src/lib/seed";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function main() {
  await ensureSeeded();

  const client = (await listClients())[0];
  assert(!!client, "at least one seeded client exists");

  const projectId = await createProject({
    client_id: client.id,
    name: "QA — Sitio de prueba",
    modality: "PROYECTO",
    tier: "Tier 1",
  });
  const projectsAfter = await listProjectsByClient(client.id);
  assert(
    projectsAfter.some((p) => p.id === projectId && p.name === "QA — Sitio de prueba"),
    "createProject: new project is retrievable via listProjectsByClient"
  );

  const milestoneId = await createMilestone({ project_id: projectId, title: "QA — Hito de prueba" });
  let milestones = await listMilestonesByProject(projectId);
  assert(
    milestones.some((m) => m.id === milestoneId && m.status === "PENDIENTE"),
    "createMilestone: new milestone starts as PENDIENTE"
  );
  assert(projectProgress(milestones) === 0, "projectProgress: 0% with no completed milestones");

  await updateMilestoneStatus(milestoneId, "COMPLETADO");
  milestones = await listMilestonesByProject(projectId);
  assert(
    milestones.find((m) => m.id === milestoneId)?.status === "COMPLETADO",
    "updateMilestoneStatus: status transitions to COMPLETADO"
  );
  assert(projectProgress(milestones) === 100, "projectProgress: 100% when all milestones are completed");

  const quotationId = await createQuotation({
    client_id: client.id,
    project_id: projectId,
    service_type: "LANDING_PAGE",
    service_tier: "ESENCIAL",
    title: "QA — Landing page de prueba",
    objective: "Objetivo de prueba",
    scope_items: ["Hero", "Contacto"],
    included_items: ["SSL", "SEO básico"],
    courtesy_items: [],
    proyecto_amount: 5000,
    proyecto_discount: 0,
    proyecto_discount_label: null,
    payment_terms: "50% de anticipo y 50% contra entrega.",
    estimated_time: "1 semana",
    suscripcion_setup_fee: 4500,
    suscripcion_monthly_base: 1500,
    validity_days: 30,
  });
  let quotations = await listQuotationsByClient(client.id);
  assert(
    quotations.some((q) => q.id === quotationId && q.status === "BORRADOR"),
    "createQuotation: new quotation starts as BORRADOR"
  );

  await updateQuotationStatus(quotationId, "ENVIADA");
  quotations = await listQuotationsByClient(client.id);
  assert(
    quotations.find((q) => q.id === quotationId)?.status === "ENVIADA",
    "updateQuotationStatus: status transitions to ENVIADA"
  );

  if (process.exitCode === 1) {
    console.error("\nSome checks failed.");
    process.exit(1);
  } else {
    console.log("\nAll repository-layer checks passed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
