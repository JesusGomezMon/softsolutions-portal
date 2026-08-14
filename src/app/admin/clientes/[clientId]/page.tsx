import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getClient } from "@/lib/repo/clients";
import { listUsersByClient, createUser, getUserByEmail } from "@/lib/repo/users";
import { sendInviteEmail, isEmailConfigured } from "@/lib/email";
import { clientBaseUrl } from "@/lib/subdomain";
import { listProjectsByClient, createProject } from "@/lib/repo/projects";
import {
  listMilestonesByProject,
  createMilestone,
  updateMilestoneStatus,
  projectProgress,
} from "@/lib/repo/milestones";
import { listQuotationsByClient, createQuotation, deleteQuotation } from "@/lib/repo/quotations";
import { Card, EmptyState, ModalityBadge, ProgressBar, StatusBadge } from "@/components/ui";
import type { MilestoneStatus, Modality } from "@/lib/repo/types";
import {
  SERVICES,
  getService,
  getTierInfo,
  suggestedMonthlyBase,
  formatMXN,
  DEFAULT_PAYMENT_TERMS_PROYECTO,
  DEFAULT_VALIDITY_DAYS,
  type ServiceTier,
  type ServiceType,
} from "@/lib/catalog";

const NEXT_MILESTONE_STATUS: Record<MilestoneStatus, MilestoneStatus | null> = {
  PENDIENTE: "EN_PROGRESO",
  EN_PROGRESO: "COMPLETADO",
  COMPLETADO: null,
};

function linesFrom(formData: FormData, field: string): string[] {
  return String(formData.get(field) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const INVITE_TTL_DAYS = 7;

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    service?: string;
    tier?: string;
    project_id?: string;
    invitado?: string;
    accesoError?: string;
  }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const id = Number(clientId);
  const client = await getClient(id);
  if (!client) notFound();

  const path = `/admin/clientes/${id}`;
  // Capturamos solo el nombre (string plano). El objeto `client` que devuelve
  // node:sqlite tiene prototipo null y NO puede serializarse como argumento
  // ligado del Server Action hacia el cliente (React lo rechaza).
  const clientName = client.name;

  async function inviteClientUserAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    if (!email) return;

    // Guard: el correo es único; no invitar a alguien ya registrado.
    if (await getUserByEmail(email)) {
      redirect(`${path}?accesoError=${encodeURIComponent(email)}`);
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // Contraseña placeholder no adivinable: nadie entra hasta activar por el link.
    const placeholderHash = bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10);

    await createUser({
      email,
      password_hash: placeholderHash,
      name: name || email,
      role: "CLIENT",
      client_id: id,
      invite_token: token,
      invite_expires_at: expiresAt,
    });

    // El link apunta al portal de cliente (cliente.* en prod, localhost en dev).
    const h = await headers();
    const base = clientBaseUrl(h.get("host"), h.get("x-forwarded-proto") ?? "http");
    const activationUrl = `${base}/activar?token=${token}`;
    await sendInviteEmail({ to: email, clientName, activationUrl });

    revalidatePath(path);
    redirect(`${path}?invitado=${encodeURIComponent(email)}`);
  }

  async function createProjectAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const modality = String(formData.get("modality") ?? "PROYECTO") as Modality;
    const tier = String(formData.get("tier") ?? "").trim();
    if (!name || !tier) return;
    await createProject({ client_id: id, name, modality, tier });
    revalidatePath(path);
  }

  async function createMilestoneAction(formData: FormData) {
    "use server";
    const projectId = Number(formData.get("project_id"));
    const title = String(formData.get("title") ?? "").trim();
    if (!projectId || !title) return;
    await createMilestone({ project_id: projectId, title });
    revalidatePath(path);
  }

  async function advanceMilestoneAction(formData: FormData) {
    "use server";
    const milestoneId = Number(formData.get("milestone_id"));
    const current = String(formData.get("current") ?? "") as MilestoneStatus;
    const next = NEXT_MILESTONE_STATUS[current];
    if (!next) return;
    await updateMilestoneStatus(milestoneId, next);
    revalidatePath(path);
  }

  async function createQuotationAction(formData: FormData) {
    "use server";
    const serviceType = String(formData.get("service_type")) as ServiceType;
    const serviceTierRaw = String(formData.get("service_tier") ?? "");
    const serviceTier = (serviceTierRaw || null) as ServiceTier | null;
    const projectId = Number(formData.get("project_id")) || null;
    const title = String(formData.get("title") ?? "").trim();
    if (!serviceType || !title) return;

    const newId = await createQuotation({
      client_id: id,
      project_id: projectId,
      service_type: serviceType,
      service_tier: serviceTier,
      title,
      objective: String(formData.get("objective") ?? "").trim(),
      scope_items: linesFrom(formData, "scope_items"),
      included_items: linesFrom(formData, "included_items"),
      courtesy_items: linesFrom(formData, "courtesy_items"),
      proyecto_amount: Number(formData.get("proyecto_amount")) || 0,
      proyecto_discount: Number(formData.get("proyecto_discount")) || 0,
      proyecto_discount_label: String(formData.get("proyecto_discount_label") ?? "").trim() || null,
      payment_terms: String(formData.get("payment_terms") ?? DEFAULT_PAYMENT_TERMS_PROYECTO),
      estimated_time: String(formData.get("estimated_time") ?? "").trim(),
      suscripcion_setup_fee: 0, // La cuota de configuración ya no se cobra ni se captura.
      suscripcion_monthly_base: Number(formData.get("suscripcion_monthly_base")) || 0,
      validity_days: Number(formData.get("validity_days")) || DEFAULT_VALIDITY_DAYS,
    });
    revalidatePath(path);
    redirect(`/admin/clientes/${id}/cotizaciones/${newId}`);
  }

  async function deleteQuotationAction(formData: FormData) {
    "use server";
    const quotationId = Number(formData.get("quotation_id"));
    if (!quotationId) return;
    await deleteQuotation(quotationId);
    revalidatePath(path);
  }

  const projects = await listProjectsByClient(id);
  const quotations = await listQuotationsByClient(id);
  const clientUsers = await listUsersByClient(id);
  const projectsWithMilestones = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      milestones: await listMilestonesByProject(p.id),
    }))
  );
  const invitedEmail = sp.invitado ? decodeURIComponent(sp.invitado) : null;
  const emailReady = isEmailConfigured();
  // Base del portal de cliente para reconstruir el link de activación de cada
  // invitación pendiente (para copiarlo/reenviarlo, aunque el correo no esté puesto).
  const hdrs = await headers();
  const clientBase = clientBaseUrl(hdrs.get("host"), hdrs.get("x-forwarded-proto") ?? "http");

  const selectedServiceType = (sp.service as ServiceType | undefined) || undefined;
  const selectedTier = (sp.tier as ServiceTier | undefined) || undefined;
  const selectedService = selectedServiceType ? getService(selectedServiceType) : null;
  const tierInfo = selectedService && selectedTier ? getTierInfo(selectedService.type, selectedTier) : undefined;
  const suggestedProjectId = sp.project_id ?? "";

  const defaultTitle = selectedService
    ? selectedService.type === "PERSONALIZADO"
      ? ""
      : `Desarrollo de ${selectedService.label}${tierInfo ? " " + tierInfo.label : ""}`
    : "";
  const defaultAmount = tierInfo ? Math.round((tierInfo.priceMin + tierInfo.priceMax) / 2) : 0;
  // La base mensual de suscripción también depende del tier (igual que el monto
  // de Proyecto). Sin tier (personalizado) cae a la referencia del servicio.
  const suggestedBase = tierInfo
    ? suggestedMonthlyBase(tierInfo)
    : selectedService?.referenceMonthlyBase ?? null;

  return (
    <div className="space-y-8">
      <Link href="/admin" className="text-sm font-medium text-brand-indigo hover:underline">
        ← Volver a clientes
      </Link>

      <div>
        <span className="eyebrow">Cliente</span>
        <h1 className="font-display mt-3 text-3xl text-brand-navy">{client.name}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          {client.company} · {client.contact_email}
        </p>
      </div>

      {/* Client access / users */}
      <section className="space-y-4">
        <h2 className="font-display text-xl text-brand-navy">Accesos del cliente</h2>

        {invitedEmail && (
          <Card className="border-emerald-200! bg-emerald-50!">
            <p className="text-sm font-semibold text-emerald-800">
              Invitación creada para {invitedEmail}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              {emailReady
                ? "Le enviamos un correo con el link para activar su cuenta y definir su contraseña."
                : "El correo automático aún no está configurado — copia el link de activación de la lista de abajo y compártelo con el cliente."}
            </p>
          </Card>
        )}

        {sp.accesoError && (
          <Card className="border-red-200! bg-red-50!">
            <p className="text-sm text-red-700">
              Ya existe un acceso con el correo {decodeURIComponent(sp.accesoError)}.
            </p>
          </Card>
        )}

        {clientUsers.length > 0 && (
          <div className="border border-brand-border bg-white">
            <div className="hidden gap-4 border-b border-brand-border bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-brand-muted sm:grid sm:grid-cols-[1.5fr_2fr_auto]">
              <span>Nombre</span>
              <span>Correo</span>
              <span>Estado</span>
            </div>
            <ul className="divide-y divide-brand-border">
              {clientUsers.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 px-4 py-4 sm:py-3">
                  <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[1.5fr_2fr_auto] sm:items-center sm:gap-4">
                    <span className="font-medium text-brand-navy">{u.name}</span>
                    <span className="break-all text-sm text-brand-muted">{u.email}</span>
                    <span className="text-xs sm:justify-self-start">
                      {u.invite_token ? (
                        <span className="text-amber-700">Invitación pendiente</span>
                      ) : (
                        <span className="text-emerald-700">Activo</span>
                      )}
                    </span>
                  </div>
                  {u.invite_token && (
                    <div className="border-l-2 border-brand-border pl-3">
                      <p className="text-[0.7rem] uppercase tracking-wide text-brand-muted">
                        Link de activación
                      </p>
                      <p className="break-all font-mono text-xs text-brand-indigo">
                        {clientBase}/activar?token={u.invite_token}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card>
          <h3 className="text-sm font-semibold text-brand-navy">Invitar por correo</h3>
          <form action={inviteClientUserAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              name="email"
              type="email"
              required
              placeholder="correo@cliente.com"
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
            <input
              name="name"
              placeholder="Nombre (opcional)"
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
            <button
              type="submit"
              className="bg-brand-indigo px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#244a6e]"
            >
              Enviar invitación
            </button>
          </form>
          <p className="mt-2 text-xs text-brand-muted">
            La cuenta se crea al instante y le llega un link para que el propio cliente defina su
            contraseña. {emailReady ? "El link se envía por correo." : "Mientras no conectes el correo, verás el link aquí para compartirlo tú."}
          </p>
        </Card>
      </section>

      {/* Projects */}
      <section className="space-y-4">
        <h2 className="font-display text-xl text-brand-navy">Proyectos</h2>

        {projectsWithMilestones.length === 0 ? (
          <EmptyState title="Sin proyectos todavía" body="Crea el primer proyecto de este cliente abajo." />
        ) : (
          <div className="space-y-4">
            {projectsWithMilestones.map(({ project: p, milestones }) => {
              const progress = projectProgress(milestones);
              return (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-brand-navy">{p.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <ModalityBadge modality={p.modality} />
                        <span className="text-xs text-brand-muted">{p.tier}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                    <div className="w-40">
                      <ProgressBar value={progress} />
                    </div>
                  </div>

                  <ul className="mt-4 divide-y divide-brand-border">
                    {milestones.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-sm text-brand-navy">{m.title}</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={m.status} />
                          {NEXT_MILESTONE_STATUS[m.status] && (
                            <form action={advanceMilestoneAction}>
                              <input type="hidden" name="milestone_id" value={m.id} />
                              <input type="hidden" name="current" value={m.status} />
                              <button
                                type="submit"
                                className="text-xs font-medium text-brand-indigo hover:underline"
                              >
                                Avanzar →
                              </button>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <form action={createMilestoneAction} className="mt-3 flex gap-2">
                    <input type="hidden" name="project_id" value={p.id} />
                    <input
                      name="title"
                      required
                      placeholder="Nuevo hito (ej. Entrega de wireframes)"
                      className="flex-1 rounded-md border border-brand-border px-3 py-1.5 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-brand-indigo px-3 py-1.5 text-sm font-medium text-brand-indigo hover:bg-brand-indigo hover:text-white"
                    >
                      Agregar
                    </button>
                  </form>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <h3 className="text-sm font-semibold text-brand-navy">Nuevo proyecto</h3>
          <form action={createProjectAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              name="name"
              required
              placeholder="Nombre del proyecto"
              className="sm:col-span-2 rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
            <select
              name="modality"
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            >
              <option value="PROYECTO">Proyecto</option>
              <option value="SUSCRIPCION">Suscripción</option>
            </select>
            <input
              name="tier"
              required
              placeholder="Tier (ej. Tier 1)"
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
            <button
              type="submit"
              className="sm:col-span-4 rounded-md bg-brand-indigo px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Crear proyecto
            </button>
          </form>
        </Card>
      </section>

      {/* Quotations */}
      <section className="space-y-4">
        <h2 className="font-display text-xl text-brand-navy">Cotizaciones</h2>

        {quotations.length === 0 ? (
          <EmptyState title="Sin cotizaciones todavía" body="Elige un servicio del catálogo abajo para crear la primera." />
        ) : (
          <div className="border border-brand-border bg-white">
            <div className="hidden gap-4 border-b border-brand-border bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-brand-muted sm:grid sm:grid-cols-[2fr_1fr_auto_auto]">
              <span>Servicio</span>
              <span>Monto (Proyecto)</span>
              <span>Estado</span>
              <span />
            </div>
            <ul className="divide-y divide-brand-border">
              {quotations.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 px-4 py-4 sm:grid sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center sm:gap-4 sm:py-3"
                >
                  <span className="font-medium text-brand-navy">{q.title}</span>
                  <span className="text-sm text-brand-muted">
                    <span className="text-brand-muted sm:hidden">Monto: </span>
                    {formatMXN(q.proyecto_amount - q.proyecto_discount)}
                  </span>
                  <span><StatusBadge status={q.status} /></span>
                  <div className="flex items-center gap-4 sm:justify-self-end">
                    <Link
                      href={`/admin/clientes/${id}/cotizaciones/${q.id}`}
                      className="text-sm font-medium text-brand-indigo hover:underline"
                    >
                      Ver / gestionar →
                    </Link>
                    <form action={deleteQuotationAction}>
                      <input type="hidden" name="quotation_id" value={q.id} />
                      <button
                        type="submit"
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Borrar
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 1: pick a service from the catalog */}
        <Card>
          <h3 className="text-sm font-semibold text-brand-navy">Nueva cotización — 1. Elige el servicio</h3>
          <form method="GET" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              name="service"
              defaultValue={selectedServiceType ?? ""}
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            >
              <option value="" disabled>
                Servicio…
              </option>
              {SERVICES.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              name="tier"
              defaultValue={selectedTier ?? ""}
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            >
              <option value="">Sin tier (personalizado)</option>
              <option value="ESENCIAL">Esencial</option>
              <option value="PROFESIONAL">Profesional</option>
              <option value="PREMIUM">Premium / Alta Conversión</option>
            </select>
            <select
              name="project_id"
              defaultValue={suggestedProjectId}
              className="rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            >
              <option value="">Sin proyecto asociado</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-brand-indigo px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Continuar →
            </button>
          </form>
        </Card>

        {/* Step 2: full quotation form, prefilled from the catalog */}
        {selectedService && (
          <Card>
            <h3 className="text-sm font-semibold text-brand-navy">
              2. Detalles de la cotización — {selectedService.label}
              {tierInfo ? ` (${tierInfo.label})` : ""}
            </h3>
            <form action={createQuotationAction} className="mt-3 space-y-4">
              <input type="hidden" name="service_type" value={selectedService.type} />
              <input type="hidden" name="service_tier" value={selectedTier ?? ""} />
              <input type="hidden" name="project_id" value={suggestedProjectId} />

              <div>
                <label className="block text-xs font-medium text-brand-muted">Título de la cotización</label>
                <input
                  name="title"
                  required
                  defaultValue={defaultTitle}
                  className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-muted">Objetivo</label>
                <textarea
                  name="objective"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  placeholder="¿Qué busca lograr el cliente con este sitio?"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-brand-muted">Alcance del proyecto (una línea por punto)</label>
                  <textarea
                    name="scope_items"
                    rows={6}
                    defaultValue={selectedService.defaultScope.join("\n")}
                    className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-muted">Incluye (una línea por punto)</label>
                  <textarea
                    name="included_items"
                    rows={6}
                    defaultValue={selectedService.defaultIncluded.join("\n")}
                    className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-muted">
                  Cortesías (opcional, una línea por punto)
                </label>
                <textarea
                  name="courtesy_items"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  placeholder={"Hosting durante el primer año\nCapacitación básica"}
                />
              </div>

              <div className="rounded-lg border border-brand-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Modalidad Proyecto</p>
                {tierInfo && (
                  <p className="mt-1 text-xs text-brand-muted">
                    Rango sugerido del catálogo: {formatMXN(tierInfo.priceMin)} – {formatMXN(tierInfo.priceMax)}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-brand-muted">Monto (MXN)</label>
                    <input
                      type="number"
                      name="proyecto_amount"
                      min={0}
                      defaultValue={defaultAmount || undefined}
                      className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-muted">Descuento (MXN, opcional)</label>
                    <input
                      type="number"
                      name="proyecto_discount"
                      min={0}
                      defaultValue={0}
                      className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-muted">Motivo del descuento</label>
                    <input
                      name="proyecto_discount_label"
                      placeholder="Descuento especial de lanzamiento"
                      className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-brand-muted">Forma de pago</label>
                    <input
                      name="payment_terms"
                      defaultValue={DEFAULT_PAYMENT_TERMS_PROYECTO}
                      className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-muted">Tiempo estimado</label>
                    <input
                      name="estimated_time"
                      defaultValue={tierInfo?.time ?? ""}
                      className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-brand-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Modalidad Suscripción</p>
                <p className="mt-1 text-xs text-brand-muted">
                  Los 4 planes (Mensual/Trimestral/Semestral/Anual) se calculan automáticamente a partir
                  de la tarifa base mensual, con los descuentos del catálogo (10% / 18% / 25%).
                </p>
                <div className="mt-3">
                  <div>
                    <label className="block text-xs font-medium text-brand-muted">Tarifa base mensual (MXN)</label>
                    <input
                      type="number"
                      name="suscripcion_monthly_base"
                      min={0}
                      key={`base-${selectedService.type}-${selectedTier ?? "none"}`}
                      defaultValue={suggestedBase ?? undefined}
                      placeholder={suggestedBase ? undefined : "0 = sin opción de suscripción"}
                      className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                    {tierInfo ? (
                      <p className="mt-1 text-xs text-brand-muted">
                        Sugerido para el tier {tierInfo.label} (≈⅓ del precio mínimo). Ajústalo si lo
                        necesitas.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-brand-muted">
                        Sin tier el catálogo no fija una tarifa — defínela según el caso, o deja 0 si no
                        vas a ofrecer suscripción.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-40">
                <label className="block text-xs font-medium text-brand-muted">Vigencia (días)</label>
                <input
                  type="number"
                  name="validity_days"
                  min={1}
                  defaultValue={DEFAULT_VALIDITY_DAYS}
                  className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                />
              </div>

              <button
                type="submit"
                className="rounded-md bg-brand-indigo px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Crear cotización
              </button>
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}
