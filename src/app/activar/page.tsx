import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getClient } from "@/lib/repo/clients";
import { getUserByInviteToken, activateUser } from "@/lib/repo/users";

function inviteIsValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export default async function ActivarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const user = token ? await getUserByInviteToken(token) : undefined;
  const valid = user && inviteIsValid(user.invite_expires_at);

  async function activate(formData: FormData) {
    "use server";
    const formToken = String(formData.get("token") ?? "");
    const u = formToken ? await getUserByInviteToken(formToken) : undefined;
    // Re-validar del lado servidor: token vigente, contraseña OK.
    if (!u || !inviteIsValid(u.invite_expires_at)) {
      redirect("/activar?error=token");
    }

    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password.length < 8 || password !== confirm) {
      redirect(`/activar?token=${encodeURIComponent(formToken)}&error=pwd`);
    }

    const bcrypt = await import("bcryptjs");
    await activateUser(u!.id, bcrypt.hashSync(password, 10), name);

    // Inicia sesión con la contraseña recién definida → al portal del cliente.
    try {
      await signIn("credentials", { email: u!.email, password, redirectTo: "/portal" });
    } catch (error) {
      if (error instanceof AuthError) redirect("/login");
      throw error;
    }
  }

  const clientName = user?.client_id ? (await getClient(user.client_id))?.name ?? "" : "";

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-night px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-steel">
            SoftSolutions
          </span>
          <h1 className="font-display mt-3 text-3xl text-white">
            Activa tu <em>cuenta</em>
          </h1>
          <p className="mt-2 text-sm text-[#a7b2ba]">
            {valid
              ? "Define tu contraseña para entrar a tu portal."
              : "Este enlace de activación no es válido o ya expiró."}
          </p>
        </div>

        {valid ? (
          <form action={activate} className="space-y-4 border border-white/10 bg-white p-6 shadow-[0_20px_60px_rgba(11,19,26,0.4)]">
            <input type="hidden" name="token" value={token} />
            {sp.error === "pwd" && (
              <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                La contraseña debe tener al menos 8 caracteres y coincidir en ambos campos.
              </p>
            )}
            {clientName && (
              <p className="text-xs text-brand-muted">
                Portal de <span className="font-medium text-brand-navy">{clientName}</span> · {user!.email}
              </p>
            )}
            <div>
              <label htmlFor="name" className="block text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                Tu nombre
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={user!.name === user!.email ? "" : user!.name}
                autoComplete="name"
                className="mt-1.5 w-full border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
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
              Activar y entrar
            </button>
          </form>
        ) : (
          <div className="border border-white/10 bg-white p-6 text-sm text-brand-muted shadow-[0_20px_60px_rgba(11,19,26,0.4)]">
            Pide a SoftSolutions que te reenvíe una invitación nueva.
          </div>
        )}
      </div>
    </main>
  );
}
