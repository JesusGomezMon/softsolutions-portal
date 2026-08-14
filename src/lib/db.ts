import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Persisted with Node's built-in `node:sqlite` module rather than Prisma.
// Reason: Prisma downloads its schema/query engine binaries from an external
// CDN at install time, which is unreachable from this sandboxed environment.
// node:sqlite ships with Node 22+ and needs no external download. See
// docs/02-project-plan.md for the full note.

// DATA_DIR is overridable via env so it can point at a mounted persistent
// volume in production (e.g. Railway: set DATA_DIR=/data and attach a volume
// there). Defaults to ./data for local development.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __softsolutionsDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  // DATA_DIR may be an absolute volume path in prod (/data on Railway).
  if (!fs.existsSync(/* turbopackIgnore: true */ DATA_DIR)) {
    fs.mkdirSync(/* turbopackIgnore: true */ DATA_DIR, { recursive: true });
  }
  const database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA foreign_keys = ON;");
  return database;
}

// Reuse a single connection across hot reloads in dev.
export const db = globalThis.__softsolutionsDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalThis.__softsolutionsDb = db;
}

let initialized = false;

/** Creates all tables if they don't exist yet. Safe to call multiple times. */
export function ensureSchema() {
  if (initialized) return;
  initialized = true;

  db.exec(`
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

  // Lightweight migration guard: if a local data/app.db was created before the
  // catalog-driven quotations redesign, its `quotations` table won't have the
  // new columns. CREATE TABLE IF NOT EXISTS silently no-ops on an existing
  // table, so detect the old shape here and rebuild just that table. This is
  // demo data (gitignored), so dropping it is safe — there's no production
  // data behind this check.
  const columns = db.prepare("PRAGMA table_info(quotations)").all() as { name: string }[];
  const hasNewSchema = columns.some((c) => c.name === "service_type");
  if (!hasNewSchema) {
    db.exec("DROP TABLE IF EXISTS quotations;");
    db.exec(`
      CREATE TABLE quotations (
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
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_id);
    `);
  }

  // Additive migration: `accepted_plan` records which subscription plan the
  // client accepted (permanencia). Older local DBs already have the rest of the
  // new schema but not this column, so add it in place — existing rows get NULL.
  const cols = db.prepare("PRAGMA table_info(quotations)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "accepted_plan")) {
    db.exec("ALTER TABLE quotations ADD COLUMN accepted_plan TEXT");
  }

  // Additive migration: `must_change_password` forces a client to set their own
  // password on first login (temp password issued by an admin). Older DBs lack it.
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "must_change_password")) {
    db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
  }
  // Additive migration: email-invitation onboarding (token + expiry).
  if (!userCols.some((c) => c.name === "invite_token")) {
    db.exec("ALTER TABLE users ADD COLUMN invite_token TEXT");
  }
  if (!userCols.some((c) => c.name === "invite_expires_at")) {
    db.exec("ALTER TABLE users ADD COLUMN invite_expires_at TEXT");
  }

  // Additive migration: Stripe payment tracking on quotations.
  if (!cols.some((c) => c.name === "stripe_session_id")) {
    db.exec("ALTER TABLE quotations ADD COLUMN stripe_session_id TEXT");
  }
  if (!cols.some((c) => c.name === "paid_at")) {
    db.exec("ALTER TABLE quotations ADD COLUMN paid_at TEXT");
  }
}

ensureSchema();
