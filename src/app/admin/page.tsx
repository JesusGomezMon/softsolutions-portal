import Link from "next/link";
import { revalidatePath } from "next/cache";
import { listClients, createClient } from "@/lib/repo/clients";
import { listAllProjectsWithClientName } from "@/lib/repo/projects";
import { Card, EmptyState } from "@/components/ui";

async function createClientAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const contact_email = String(formData.get("contact_email") ?? "").trim();
  if (!name || !company || !contact_email) return;
  createClient({ name, company, contact_email });
  revalidatePath("/admin");
}

export default async function AdminHomePage() {
  const clients = listClients();
  const projects = listAllProjectsWithClientName();
  const projectCountByClient = new Map<number, number>();
  for (const p of projects) {
    projectCountByClient.set(p.client_id, (projectCountByClient.get(p.client_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow">Panel de administración</span>
        <h1 className="font-display mt-3 text-3xl text-brand-navy">Clientes</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Gestiona clientes, proyectos, hitos y cotizaciones desde un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {clients.length === 0 ? (
            <EmptyState
              title="Aún no hay clientes"
              body="Da de alta tu primer cliente con el formulario de la derecha."
            />
          ) : (
            <div className="border border-brand-border bg-white">
              <div className="hidden gap-4 border-b border-brand-border bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-brand-muted sm:grid sm:grid-cols-[2fr_2fr_auto_auto]">
                <span>Cliente</span>
                <span>Contacto</span>
                <span>Proyectos</span>
                <span />
              </div>
              <ul className="divide-y divide-brand-border">
                {clients.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 px-4 py-4 hover:bg-slate-50 sm:grid sm:grid-cols-[2fr_2fr_auto_auto] sm:items-center sm:gap-4 sm:py-3"
                  >
                    <div>
                      <p className="font-medium text-brand-navy">{c.name}</p>
                      <p className="text-xs text-brand-muted">{c.company}</p>
                    </div>
                    <p className="break-all text-sm text-brand-muted">{c.contact_email}</p>
                    <p className="text-sm text-brand-muted">
                      <span className="text-brand-muted sm:hidden">Proyectos: </span>
                      {projectCountByClient.get(c.id) ?? 0}
                    </p>
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-sm font-medium text-brand-indigo hover:underline sm:justify-self-end"
                    >
                      Ver detalle →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Card>
          <h2 className="text-sm font-semibold text-brand-navy">Nuevo cliente</h2>
          <form action={createClientAction} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted">Nombre del negocio</label>
              <input
                name="name"
                required
                className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                placeholder="Panadería La Espiga"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted">Razón social</label>
              <input
                name="company"
                required
                className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                placeholder="La Espiga S.A. de C.V."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted">Correo de contacto</label>
              <input
                name="contact_email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                placeholder="contacto@negocio.mx"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-indigo px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Crear cliente
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
