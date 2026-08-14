import { db } from "@/lib/db";
import type { AppUser, Role } from "./types";

export function getUserByEmail(email: string): AppUser | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as unknown as
    | AppUser
    | undefined;
}

export function getUserById(id: number): AppUser | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as AppUser | undefined;
}

export function listUsersByClient(clientId: number): AppUser[] {
  return db
    .prepare("SELECT * FROM users WHERE client_id = ? ORDER BY created_at ASC")
    .all(clientId) as unknown as AppUser[];
}

export function getUserByInviteToken(token: string): AppUser | undefined {
  return db.prepare("SELECT * FROM users WHERE invite_token = ?").get(token) as unknown as
    | AppUser
    | undefined;
}

export function createUser(input: {
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  client_id?: number | null;
  must_change_password?: boolean;
  invite_token?: string | null;
  invite_expires_at?: string | null;
}): number {
  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, client_id, must_change_password, invite_token, invite_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.email,
      input.password_hash,
      input.name,
      input.role,
      input.client_id ?? null,
      input.must_change_password ? 1 : 0,
      input.invite_token ?? null,
      input.invite_expires_at ?? null
    );
  return Number(result.lastInsertRowid);
}

/** Activates an invited account: sets the chosen password/name and clears the invite. */
export function activateUser(userId: number, passwordHash: string, name?: string): void {
  if (name && name.trim()) {
    db.prepare(
      "UPDATE users SET password_hash = ?, name = ?, invite_token = NULL, invite_expires_at = NULL, must_change_password = 0 WHERE id = ?"
    ).run(passwordHash, name.trim(), userId);
  } else {
    db.prepare(
      "UPDATE users SET password_hash = ?, invite_token = NULL, invite_expires_at = NULL, must_change_password = 0 WHERE id = ?"
    ).run(passwordHash, userId);
  }
}

export function countUsers(): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
  return row.n;
}

export function countUsersByRole(role: Role): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM users WHERE role = ?").get(role) as { n: number };
  return row.n;
}

/** Sets a new password and clears the must-change flag. Used by the forced-change flow. */
export function setPassword(userId: number, passwordHash: string): void {
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(
    passwordHash,
    userId
  );
}
