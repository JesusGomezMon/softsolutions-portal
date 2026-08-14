export type PortalArea = "admin" | "cliente";

// Mapea el host de la petición a un área del portal según su subdominio:
//   admin.softsolutions.mx     → "admin"
//   cliente.softsolutions.mx   → "cliente"  (también "portal.*")
//   softsolutions.mx / localhost (sin subdominio) → null → ruteo por ruta
//
// Es agnóstico al dominio (mira solo la primera etiqueta del host), así que
// funciona igual en local con admin.localhost:3000 / cliente.localhost:3000
// que en producción con admin.softsolutions.mx / cliente.softsolutions.mx.
export function areaFromHost(host: string | null | undefined): PortalArea | null {
  if (!host) return null;
  const sub = host.split(":")[0].split(".")[0].toLowerCase();
  if (sub === "admin") return "admin";
  if (sub === "cliente" || sub === "portal") return "cliente";
  return null;
}

// Base URL del portal de cliente para links que van al cliente (p.ej. la
// invitación de activación). Si la petición viene del subdominio admin.*, lo
// cambia a cliente.*; en local (localhost, sin subdominio) deja el host igual.
export function clientBaseUrl(host: string | null | undefined, proto: string): string {
  const h = host ?? "localhost:3000";
  const clientHost = h.startsWith("admin.") ? h.replace(/^admin\./, "cliente.") : h;
  return `${proto}://${clientHost}`;
}
