import { createClient, type Client, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// LibSQL (Turso) instead of node:sqlite — Vercel has no persistent disk, so the
// DB must live remotely. Locally we fall back to a file URL under ./data.

type SqlArgs = InValue[] | Record<string, InValue>;

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(/* turbopackIgnore: true */ dir)) {
    fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  }
  // file: URL with forward slashes works on Windows too
  const file = path.join(dir, "app.db").replace(/\\/g, "/");
  return `file:${file}`;
}

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: databaseUrl(),
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return client;
}

export async function one<T>(sql: string, args: SqlArgs = []): Promise<T | undefined> {
  const rs = await getDb().execute({ sql, args });
  return (rs.rows[0] as T | undefined) ?? undefined;
}

export async function many<T>(sql: string, args: SqlArgs = []): Promise<T[]> {
  const rs = await getDb().execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function run(sql: string, args: SqlArgs = []) {
  return getDb().execute({ sql, args });
}

export async function ensureSchema() {
  if (!schemaReady) schemaReady = migrate();
  await schemaReady;
}

async function migrate() {
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLIENT')),
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      invite_token TEXT,
      invite_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      modality TEXT NOT NULL CHECK (modality IN ('PROYECTO', 'SUSCRIPCION')),
      tier TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ACTIVO', 'PAUSADO', 'COMPLETADO')) DEFAULT 'ACTIVO',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO')) DEFAULT 'PENDIENTE',
      order_index INTEGER NOT NULL DEFAULT 0,
      due_date TEXT
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      service_type TEXT NOT NULL CHECK (service_type IN ('LANDING_PAGE', 'SITIO_CORPORATIVO', 'TIENDA_LINEA', 'PERSONALIZADO')),
      service_tier TEXT CHECK (service_tier IN ('ESENCIAL', 'PROFESIONAL', 'PREMIUM')),
      title TEXT NOT NULL,
      objective TEXT NOT NULL DEFAULT '',
      scope_items TEXT NOT NULL DEFAULT '[]',
      included_items TEXT NOT NULL DEFAULT '[]',
      courtesy_items TEXT NOT NULL DEFAULT '[]',
      proyecto_amount INTEGER NOT NULL DEFAULT 0,
      proyecto_discount INTEGER NOT NULL DEFAULT 0,
      proyecto_discount_label TEXT,
      payment_terms TEXT NOT NULL DEFAULT '50% de anticipo y 50% contra entrega.',
      estimated_time TEXT NOT NULL DEFAULT '',
      suscripcion_setup_fee INTEGER NOT NULL DEFAULT 0,
      suscripcion_monthly_base INTEGER NOT NULL DEFAULT 0,
      validity_days INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL CHECK (status IN ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'PAGADA')) DEFAULT 'BORRADOR',
      accepted_modality TEXT CHECK (accepted_modality IN ('PROYECTO', 'SUSCRIPCION')),
      accepted_plan TEXT CHECK (accepted_plan IN ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
      stripe_session_id TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_id);
    CREATE INDEX IF NOT EXISTS idx_users_client ON users(client_id);
  `);

  // Additive migrations for DBs created before newer columns existed.
  const cols = await many<{ name: string }>("PRAGMA table_info(quotations)");
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("accepted_plan")) {
    await run("ALTER TABLE quotations ADD COLUMN accepted_plan TEXT");
  }
  if (!colNames.has("stripe_session_id")) {
    await run("ALTER TABLE quotations ADD COLUMN stripe_session_id TEXT");
  }
  if (!colNames.has("paid_at")) {
    await run("ALTER TABLE quotations ADD COLUMN paid_at TEXT");
  }

  const userCols = await many<{ name: string }>("PRAGMA table_info(users)");
  const userNames = new Set(userCols.map((c) => c.name));
  if (!userNames.has("must_change_password")) {
    await run("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
  }
  if (!userNames.has("invite_token")) {
    await run("ALTER TABLE users ADD COLUMN invite_token TEXT");
  }
  if (!userNames.has("invite_expires_at")) {
    await run("ALTER TABLE users ADD COLUMN invite_expires_at TEXT");
  }
}
