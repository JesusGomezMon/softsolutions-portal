import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: sp.callbackUrl || "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/login?error=1${sp.callbackUrl ? `&callbackUrl=${encodeURIComponent(sp.callbackUrl)}` : ""}`);
      }
      throw error;
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-night px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-steel">
            SoftSolutions
          </span>
          <h1 className="font-display mt-3 text-3xl text-white">
            Portal de <em>clientes</em>
          </h1>
          <p className="mt-2 text-sm text-[#a7b2ba]">
            Inicia sesión para ver el avance de tus proyectos.
          </p>
        </div>

        <form action={login} className="space-y-4 border border-white/10 bg-white p-6 shadow-[0_20px_60px_rgba(11,19,26,0.4)]">
          {sp.error && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Correo o contraseña incorrectos.
            </p>
          )}
          <div>
            <label htmlFor="email" className="block text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1.5 w-full border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-indigo px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#244a6e]"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
