import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { areaFromHost } from "@/lib/subdomain";

export default async function Home() {
  const area = areaFromHost((await headers()).get("host"));

  // En un subdominio, el área ya está decidida por el host; el proxy se encarga
  // de exigir sesión y el rol correcto al entrar a /admin o /portal.
  if (area === "admin") redirect("/admin");
  if (area === "cliente") redirect("/portal");

  // Host sin subdominio: se decide por el rol de la sesión.
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "ADMIN" ? "/admin" : "/portal");
}
