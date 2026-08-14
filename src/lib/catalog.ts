// Structured version of docs/../SoftSolutions_Catalogo_Comercial.pdf — sections 2 and 3
// (subscription plans and service price table). Kept as a static module rather than a
// DB-editable catalog for this iteration: prices change rarely enough that a code review
// on this file is an acceptable place to update them.

export type ServiceType = "LANDING_PAGE" | "SITIO_CORPORATIVO" | "TIENDA_LINEA" | "PERSONALIZADO";
export type ServiceTier = "ESENCIAL" | "PROFESIONAL" | "PREMIUM";
export type SubscriptionPlanId = "MENSUAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";

export interface TierInfo {
  tier: ServiceTier;
  label: string;
  priceMin: number;
  priceMax: number;
  time: string;
}

export interface ServiceInfo {
  type: ServiceType;
  label: string;
  warrantyDays: number;
  tiers: TierInfo[];
  defaultScope: string[];
  defaultIncluded: string[];
  /** Tarifa base mensual de referencia, solo cuando el catálogo la especifica explícitamente. */
  referenceMonthlyBase: number | null;
}

export const BASE_INCLUDED = [
  "Diseño responsive, optimización móvil y de imágenes",
  "Buenas prácticas de código, SEO técnico y accesibilidad básica",
  "SSL, formulario conectado a correo, Google Analytics y Search Console",
  "Configuración de dominio y hosting, respaldo inicial",
];

export const DEFAULT_PAYMENT_TERMS_PROYECTO = "50% de anticipo y 50% contra entrega.";
export const DEFAULT_VALIDITY_DAYS = 30;

export const SERVICES: ServiceInfo[] = [
  {
    type: "LANDING_PAGE",
    label: "Landing Page",
    warrantyDays: 30,
    referenceMonthlyBase: 1500,
    tiers: [
      { tier: "ESENCIAL", label: "Esencial", priceMin: 4500, priceMax: 6500, time: "1 semana" },
      { tier: "PROFESIONAL", label: "Profesional", priceMin: 7000, priceMax: 12000, time: "1–2 semanas" },
      { tier: "PREMIUM", label: "Alta Conversión", priceMin: 14000, priceMax: 22000, time: "2–3 semanas" },
    ],
    defaultScope: [
      "Hero principal con llamada a la acción",
      "Quiénes somos",
      "Descripción de servicios",
      "Proceso de trabajo",
      "Beneficios",
      "Galería de proyectos",
      "Formulario de contacto",
      "Botones de WhatsApp",
      "Footer con datos de contacto",
    ],
    defaultIncluded: [...BASE_INCLUDED, "SEO básico"],
  },
  {
    type: "SITIO_CORPORATIVO",
    label: "Sitio Corporativo",
    warrantyDays: 30,
    referenceMonthlyBase: null,
    tiers: [
      { tier: "ESENCIAL", label: "Esencial", priceMin: 14000, priceMax: 18000, time: "3 semanas" },
      { tier: "PROFESIONAL", label: "Profesional", priceMin: 19000, priceMax: 24000, time: "4 semanas" },
      { tier: "PREMIUM", label: "Premium", priceMin: 25000, priceMax: 28000, time: "5 semanas" },
    ],
    defaultScope: [
      "Página de inicio",
      "Quiénes somos",
      "Servicios",
      "Equipo",
      "Blog o noticias",
      "Formulario de contacto",
      "Footer con datos de contacto",
    ],
    defaultIncluded: [...BASE_INCLUDED, "SEO básico"],
  },
  {
    type: "TIENDA_LINEA",
    label: "Tienda en Línea",
    warrantyDays: 45,
    referenceMonthlyBase: null,
    tiers: [
      { tier: "ESENCIAL", label: "Esencial", priceMin: 28000, priceMax: 35000, time: "5 semanas" },
      { tier: "PROFESIONAL", label: "Profesional", priceMin: 36000, priceMax: 45000, time: "6 semanas" },
      { tier: "PREMIUM", label: "Premium", priceMin: 46000, priceMax: 55000, time: "8 semanas" },
    ],
    defaultScope: [
      "Catálogo de productos",
      "Carrito de compras",
      "Pasarela de pago",
      "Cuentas de cliente",
      "Gestión de pedidos",
      "Formulario de contacto",
      "Footer con datos de contacto",
    ],
    defaultIncluded: [...BASE_INCLUDED, "SEO básico"],
  },
  {
    type: "PERSONALIZADO",
    label: "Personalizado (fuera de catálogo)",
    warrantyDays: 30,
    referenceMonthlyBase: null,
    tiers: [],
    defaultScope: [],
    defaultIncluded: [...BASE_INCLUDED],
  },
];

export interface SubscriptionPlanDef {
  id: SubscriptionPlanId;
  label: string;
  months: number;
  discount: number;
  minPermanenceMonths: number;
  changesPerMonth: string;
  support: string;
}

// Sección 2 del catálogo: permanencia mínima, descuento, cambios/mes y soporte por plan.
export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  { id: "MENSUAL", label: "Mensual", months: 1, discount: 0, minPermanenceMonths: 2, changesPerMonth: "2", support: "Correo (estándar)" },
  { id: "TRIMESTRAL", label: "Trimestral", months: 3, discount: 0.1, minPermanenceMonths: 3, changesPerMonth: "4", support: "Correo y chat" },
  { id: "SEMESTRAL", label: "Semestral", months: 6, discount: 0.18, minPermanenceMonths: 6, changesPerMonth: "6", support: "Prioritario" },
  { id: "ANUAL", label: "Anual", months: 12, discount: 0.25, minPermanenceMonths: 12, changesPerMonth: "Ilimitado razonable", support: "Prioridad máxima" },
];

export interface SubscriptionPlanQuote extends SubscriptionPlanDef {
  total: number;
  perMonth: number;
}

/** Total pagadero por plan a partir de la tarifa base mensual, según las reglas de la sección 2 del catálogo. */
export function computeSubscriptionPlans(monthlyBase: number): SubscriptionPlanQuote[] {
  return SUBSCRIPTION_PLANS.map((p) => {
    const total = Math.round(p.months * monthlyBase * (1 - p.discount));
    return { ...p, total, perMonth: Math.round(total / p.months) };
  });
}

export function getService(type: ServiceType): ServiceInfo {
  const service = SERVICES.find((s) => s.type === type);
  if (!service) throw new Error(`Servicio desconocido: ${type}`);
  return service;
}

export function getTierInfo(type: ServiceType, tier: ServiceTier): TierInfo | undefined {
  return getService(type).tiers.find((t) => t.tier === tier);
}

// Tarifa base mensual sugerida para la modalidad Suscripción, derivada del tier
// elegido. El catálogo no publica una tabla de mensualidades por tier: solo da
// la cuota de configuración por tipo de sitio y, como ejemplo, $1,500/mes para
// Landing Page. Ese ejemplo equivale a ⅓ del precio mínimo del tier Esencial de
// Landing Page ($4,500), así que usamos esa misma regla para que la mensualidad
// escale con el tier igual que el precio de Proyecto. Es solo un prellenado: el
// admin puede ajustar el monto antes de guardar.
export function suggestedMonthlyBase(tier: TierInfo): number {
  return Math.round(tier.priceMin / 3 / 500) * 500;
}

export function formatMXN(amount: number): string {
  return amount.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}
