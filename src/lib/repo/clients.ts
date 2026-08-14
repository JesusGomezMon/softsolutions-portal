import { many, one, run } from "@/lib/db";
import type { Client } from "./types";

function plain<T extends object>(row: T): T {
  return { ...row };
}

export async function listClients(): Promise<Client[]> {
  const rows = await many<Client>("SELECT * FROM clients ORDER BY name ASC");
  return rows.map(plain);
}

export async function getClient(id: number): Promise<Client | undefined> {
  const row = await one<Client>("SELECT * FROM clients WHERE id = ?", [id]);
  return row ? plain(row) : undefined;
}

export async function createClient(input: {
  name: string;
  company: string;
  contact_email: string;
}): Promise<number> {
  const result = await run(
    "INSERT INTO clients (name, company, contact_email) VALUES (?, ?, ?)",
    [input.name, input.company, input.contact_email]
  );
  return Number(result.lastInsertRowid);
}
