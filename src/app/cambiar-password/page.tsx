import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { setPassword } from "@/lib/repo/users";

export default async function CambiarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = Number(session.user.id);
  const email = session.user.email!;

  async function changePassword(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < 8 || password !== confirm) {
      redirect("/cambiar-password?error=1");
    }

    const bcrypt = await import("bcryptjs");
    setPassword(userId, bcrypt.hashSync(password, 10));

    // Re-authenticate so the session's mustChangePassword claim refreshes
    // (JWT sessions don't re-read the DB on every request).
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: session!.user.role === "ADMIN" ? "/admin" : "/portal",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login");
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
            Elige tu <em>contraseña</em>
          </h1>
          <p className="mt-2 text-sm text-[#a7b2ba]">
            Es tu primer ingreso — define una contraseña nueva antes de continuar.
          </p>
        </div>

        <form action={changePassword} className="space-y-4 border border-white/10 bg-white p-6 shadow-[0_20px_60px_rgba(11,19,26,0.4)]">
          {sp.error && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              La contraseña debe tener al menos 8 caracteres y coincidir en ambos campos.
            </p>
          )}
          <div>
            <label htmlFor="password" className="block text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-indigo px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#244a6e]"
          >
            Guardar y continuar
          </button>
        </form>
      </div>
    </main>
  );
}
