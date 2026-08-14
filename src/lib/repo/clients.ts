import { db } from "@/lib/db";
import type { Client } from "./types";

// node:sqlite devuelve filas con prototipo null; las volvemos objetos planos
// con spread para que sean serializables a través del límite servidor→cliente
// (props a Client Components o argumentos ligados de Server Actions).
export function listClients(): Client[] {
  const rows = db.prepare("SELECT * FROM clients ORDER BY name ASC").all() as unknown as Client[];
  return rows.map((r) => ({ ...r }));
}

export function getClient(id: number): Client | undefined {
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as unknown as Client | undefined;
  return row ? { ...row } : undefined;
}

export function createClient(input: { name: string; company: string; contact_email: string }): number {
  const result = db
    .prepare("INSERT INTO clients (name, company, contact_email) VALUES (?, ?, ?)")
    .run(input.name, input.company, input.contact_email);
  return Number(result.lastInsertRowid);
}
