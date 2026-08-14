import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="border border-white/20 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#a7b2ba] transition hover:border-white/60 hover:text-white"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
