const STATUS_STYLES: Record<string, string> = {
  // milestone status
  PENDIENTE: "bg-[#e6eaed] text-[#4c5a66]",
  EN_PROGRESO: "bg-amber-100 text-amber-800",
  COMPLETADO: "bg-emerald-100 text-emerald-800",
  // project status
  ACTIVO: "bg-emerald-100 text-emerald-800",
  PAUSADO: "bg-amber-100 text-amber-800",
  // quotation status
  BORRADOR: "bg-[#e6eaed] text-[#4c5a66]",
  ENVIADA: "bg-[#dbe6f0] text-[#2f5d8a]",
  ACEPTADA: "bg-emerald-100 text-emerald-800",
  PAGADA: "bg-[#161d24] text-[#f2f4f5]",
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  COMPLETADO: "Completado",
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  PAGADA: "Pagada",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${
        STATUS_STYLES[status] ?? "bg-[#e6eaed] text-[#4c5a66]"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ModalityBadge({ modality }: { modality: string }) {
  return (
    <span className="inline-flex items-center border border-brand-border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-brand-muted">
      {modality === "PROYECTO" ? "Proyecto" : "Suscripción"}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden bg-[#e1e6e9]">
        <div
          className="h-full bg-brand-indigo transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <p className="mt-1.5 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-brand-muted">
        {value}% completado
      </p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-brand-border bg-white p-5 shadow-[0_1px_2px_rgba(11,19,26,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-brand-border bg-white/60 p-8 text-center">
      <p className="font-display text-lg text-brand-navy">{title}</p>
      <p className="mt-1 text-sm text-brand-muted">{body}</p>
    </div>
  );
}
