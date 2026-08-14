// Unit checks for the pure business logic — no server, no database, fully
// deterministic. Run with: npx tsx scripts/unit-check.ts
//
// Cubre: cálculo de planes de suscripción y base mensual sugerida (catálogo),
// el desglose de lo que se cobra por modalidad (pagos), y el ruteo por
// subdominio. Son las reglas de negocio verificadas antes a mano; aquí quedan
// automatizadas.

import {
  computeSubscriptionPlans,
  suggestedMonthlyBase,
  getTierInfo,
} from "../src/lib/catalog";
import { paymentBreakdown } from "../src/lib/payments";
import { areaFromHost, clientBaseUrl } from "../src/lib/subdomain";
import type { Quotation } from "../src/lib/repo/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// Base de cotización para pruebas de pago (solo importan los campos que lee
// paymentBreakdown; el resto se rellena con valores neutros).
function quote(overrides: Partial<Quotation>): Quotation {
  return {
    id: 1, client_id: 1, project_id: null,
    service_type: "LANDING_PAGE", service_tier: "ESENCIAL",
    title: "Cotización de prueba", objective: "",
    scope_items: [], included_items: [], courtesy_items: [],
    proyecto_amount: 0, proyecto_discount: 0, proyecto_discount_label: null,
    payment_terms: "", estimated_time: "",
    suscripcion_setup_fee: 0, suscripcion_monthly_base: 0, validity_days: 30,
    status: "ACEPTADA", accepted_modality: null, accepted_plan: null,
    stripe_session_id: null, paid_at: null, created_at: "2026-01-01 00:00:00",
    ...overrides,
  };
}

// ---- Catálogo: planes de suscripción (ejemplo real del catálogo) ----
const plans = computeSubscriptionPlans(1500);
const totals = plans.map((p) => p.total);
assert(
  JSON.stringify(totals) === JSON.stringify([1500, 4050, 7380, 13500]),
  "computeSubscriptionPlans(1500): totales = 1500 / 4050 / 7380 / 13500 (ejemplo del catálogo)"
);
assert(
  plans.find((p) => p.id === "ANUAL")?.perMonth === 1125,
  "computeSubscriptionPlans: plan anual = $1,125/mes"
);

// ---- Catálogo: base mensual sugerida escala por tier ----
assert(
  suggestedMonthlyBase(getTierInfo("LANDING_PAGE", "ESENCIAL")!) === 1500,
  "suggestedMonthlyBase: Landing Page Esencial = $1,500 (ancla real del catálogo)"
);
assert(
  suggestedMonthlyBase(getTierInfo("LANDING_PAGE", "PREMIUM")!) === 4500,
  "suggestedMonthlyBase: Landing Page Premium = $4,500 (escala por tier)"
);
assert(
  suggestedMonthlyBase(getTierInfo("TIENDA_LINEA", "PROFESIONAL")!) === 12000,
  "suggestedMonthlyBase: Tienda Profesional = $12,000"
);

// ---- Pagos: modalidad Proyecto = anticipo 50% ----
const proyecto = paymentBreakdown(quote({ accepted_modality: "PROYECTO", proyecto_amount: 9500 }));
assert(proyecto?.totalMXN === 4750, "paymentBreakdown Proyecto: anticipo 50% de $9,500 = $4,750");
assert(proyecto?.lines.length === 1, "paymentBreakdown Proyecto: una sola línea");

const proyectoDesc = paymentBreakdown(
  quote({ accepted_modality: "PROYECTO", proyecto_amount: 9500, proyecto_discount: 1500 })
);
assert(proyectoDesc?.totalMXN === 4000, "paymentBreakdown Proyecto: anticipo sobre total con descuento ($8,000 → $4,000)");

// ---- Pagos: modalidad Suscripción = solo el primer periodo (SIN cuota) ----
const susc = paymentBreakdown(
  quote({
    accepted_modality: "SUSCRIPCION",
    accepted_plan: "TRIMESTRAL",
    suscripcion_monthly_base: 2500,
    suscripcion_setup_fee: 4500,
  })
);
assert(
  susc?.totalMXN === 6750 && susc?.lines.length === 1,
  "paymentBreakdown Suscripción: solo Trimestral $6,750 (1 línea, la cuota de configuración NO se cobra)"
);

// ---- Pagos: casos que no cobran ----
assert(
  paymentBreakdown(quote({ accepted_modality: "SUSCRIPCION", suscripcion_monthly_base: 2500 })) === null,
  "paymentBreakdown: suscripción sin plan aceptado → null"
);
assert(
  paymentBreakdown(quote({ accepted_modality: null })) === null,
  "paymentBreakdown: sin modalidad aceptada → null"
);

// ---- Subdominio: mapeo host → área ----
assert(areaFromHost("admin.softsolutions.mx") === "admin", "areaFromHost: admin.* → admin");
assert(areaFromHost("cliente.softsolutions.mx") === "cliente", "areaFromHost: cliente.* → cliente");
assert(areaFromHost("portal.softsolutions.mx") === "cliente", "areaFromHost: portal.* → cliente");
assert(areaFromHost("localhost:3000") === null, "areaFromHost: localhost → null (ruteo por ruta)");
assert(areaFromHost("softsolutions.mx") === null, "areaFromHost: apex → null");
assert(areaFromHost(undefined) === null, "areaFromHost: host indefinido → null");

// ---- Subdominio: base URL del portal de cliente ----
assert(
  clientBaseUrl("admin.softsolutions.mx", "https") === "https://cliente.softsolutions.mx",
  "clientBaseUrl: admin.* → cliente.* (para el link de invitación)"
);
assert(
  clientBaseUrl("localhost:3000", "http") === "http://localhost:3000",
  "clientBaseUrl: localhost se conserva"
);

if (process.exitCode === 1) {
  console.error("\nAlgunas verificaciones fallaron.");
  process.exit(1);
} else {
  console.log("\nTodas las verificaciones unitarias pasaron.");
}
