import { NextResponse } from "next/server";
import { ensureSchema, one } from "@/lib/db";

// Endpoint de salud para el health check del despliegue (Railway apunta aquí).
// Confirma que el proceso responde y que la base SQLite está accesible.
// No pasa por el proxy de auth (el matcher solo cubre /admin, /portal y
// /cambiar-password), así que es público.
export async function GET() {
  try {
    await ensureSchema();
    await one("SELECT 1");
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
