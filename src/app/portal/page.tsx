import Link from "next/link";
import { auth } from "@/auth";
import { getClient } from "@/lib/repo/clients";
import { listProjectsByClient } from "@/lib/repo/projects";
import { listMilestonesByProject, projectProgress } from "@/lib/repo/milestones";
import { listQuotationsByClient } from "@/lib/repo/quotations";
import { formatMXN } from "@/lib/catalog";
import { Card, EmptyState, ModalityBadge, ProgressBar, StatusBadge } from "@/components/ui";

export default async function PortalPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;

  if (!clientId) {
    return (
      <EmptyState
        title="Tu cuenta no está asociada a ningún cliente"
        body="Contacta a SoftSolutions para vincular tu usuario a tu cuenta de cliente."
      />
    );
  }

  const client = getClient(clientId);
  const projects = listProjectsByClient(clientId);
  const quotations = listQuotationsByClient(clientId);

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow">Hola, {session?.user?.name}</span>
        <h1 className="font-display mt-3 text-3xl text-brand-navy">{client?.name}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Aquí puedes ver el avance de tus proyectos y el estado de tus cotizaciones.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-brand-navy">Mis proyectos</h2>
        {projects.length === 0 ? (
          <EmptyState title="Aún no tienes proyectos activos" body="Cuando SoftSolutions dé de alta un proyecto, aparecerá aquí." />
        ) : (
          <div className="space-y-4">
            {projects.map((p) => {
              const milestones = listMilestonesByProject(p.id);
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
                        <StatusBadge status={m.status} />
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-brand-navy">Mis cotizaciones</h2>
        {quotations.length === 0 ? (
          <EmptyState title="Sin cotizaciones todavía" body="Cuando SoftSolutions te envíe una cotización, aparecerá aquí." />
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
                  <Link
                    href={`/portal/cotizaciones/${q.id}`}
                    className="text-sm font-medium text-brand-indigo hover:underline sm:justify-self-end"
                  >
                    Ver cotización →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
