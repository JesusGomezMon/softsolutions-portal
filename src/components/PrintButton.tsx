"use client";

// "Descargar PDF" opens the browser's print dialog, where the user can pick
// "Guardar como PDF". No PDF library needed — print CSS in globals.css hides
// the site chrome so only the quotation document lands on the page.
export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ||
        "no-print rounded-md border border-brand-indigo px-3 py-1.5 text-sm font-medium text-brand-indigo transition hover:bg-brand-indigo hover:text-white"
      }
    >
      Descargar PDF
    </button>
  );
}
