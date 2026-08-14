import { Resend } from "resend";

// Envío de correo vía Resend, opcional. Si RESEND_API_KEY no está, todo sigue
// funcionando: el link de activación se muestra en el panel del admin para
// copiarlo/compartirlo a mano (degradación elegante, igual que Stripe).
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendInviteEmail(opts: {
  to: string;
  clientName: string;
  activationUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.EMAIL_FROM || "SoftSolutions <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: "Activa tu acceso al portal de SoftSolutions",
    html: `
      <div style="font-family:Inter,Arial,sans-serif;color:#161d24;line-height:1.6">
        <p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#2f5d8a;margin:0 0 8px">SoftSolutions</p>
        <h1 style="font-size:20px;font-weight:600;margin:0 0 12px">Activa tu acceso</h1>
        <p>Hola, SoftSolutions creó tu acceso al portal de clientes${
          opts.clientName ? ` de <strong>${opts.clientName}</strong>` : ""
        }. Define tu contraseña para entrar:</p>
        <p style="margin:24px 0">
          <a href="${opts.activationUrl}" style="background:#2f5d8a;color:#fff;padding:12px 24px;text-decoration:none;font-size:13px;letter-spacing:.06em;text-transform:uppercase;display:inline-block">Activar mi cuenta</a>
        </p>
        <p style="font-size:13px;color:#4c5a66">Si el botón no funciona, copia este enlace:<br>${opts.activationUrl}</p>
        <p style="font-size:12px;color:#7c97ac;margin-top:24px">Este enlace caduca en 7 días. Si no esperabas este correo, ignóralo.</p>
      </div>
    `,
  });

  return !error;
}
