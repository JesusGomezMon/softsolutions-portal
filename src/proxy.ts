import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { areaFromHost } from "@/lib/subdomain";

// Next.js 16 renamed the middleware.ts convention to proxy.ts. The proxy
// runtime is always Node.js (not configurable), which is what lets this file
// call `auth()` and, through it, touch the node:sqlite-backed database.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const area = areaFromHost(req.headers.get("host"));

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forced password change (temp password issued by an admin) takes priority
  // over subdomain/role routing, for both roles.
  if (session.user.mustChangePassword && pathname !== "/cambiar-password") {
    return NextResponse.redirect(new URL("/cambiar-password", req.url));
  }
  if (pathname === "/cambiar-password") {
    return NextResponse.next();
  }

  const role = session.user.role;

  // --- Ruteo por subdominio ---------------------------------------------
  // Cada subdominio es una frontera: admin.* solo sirve el panel de admin,
  // cliente.* solo el portal. Un rol que no corresponde al subdominio se
  // manda al login (sin bucles: /login no pasa por el proxy).
  if (area === "admin") {
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/login", req.url));
    if (pathname.startsWith("/portal")) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (area === "cliente") {
    if (role !== "CLIENT") return NextResponse.redirect(new URL("/login", req.url));
    if (pathname.startsWith("/admin")) return NextResponse.redirect(new URL("/portal", req.url));
    return NextResponse.next();
  }

  // --- Host sin subdominio (localhost / apex): ruteo por ruta + rol -------
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  if (pathname.startsWith("/portal") && role !== "CLIENT") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/cambiar-password"],
};
