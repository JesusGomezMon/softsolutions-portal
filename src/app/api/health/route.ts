import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Endpoint de salud para el health check del despliegue (Railway apunta aquí).
// Confirma que el proceso responde y que la base SQLite está accesible.
// No pasa por el proxy de auth (el matcher solo cubre /admin, /portal y
// /cambiar-password), así que es público.
export async function GET() {
  try {
    db.prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
