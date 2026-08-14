import { many, one, run } from "@/lib/db";
import type { AppUser, Role } from "./types";

export async function getUserByEmail(email: string): Promise<AppUser | undefined> {
  return one<AppUser>("SELECT * FROM users WHERE email = ?", [email]);
}

export async function getUserById(id: number): Promise<AppUser | undefined> {
  return one<AppUser>("SELECT * FROM users WHERE id = ?", [id]);
}

export async function listUsersByClient(clientId: number): Promise<AppUser[]> {
  return many<AppUser>(
    "SELECT * FROM users WHERE client_id = ? ORDER BY created_at ASC",
    [clientId]
  );
}

export async function getUserByInviteToken(token: string): Promise<AppUser | undefined> {
  return one<AppUser>("SELECT * FROM users WHERE invite_token = ?", [token]);
}

export async function createUser(input: {
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  client_id?: number | null;
  must_change_password?: boolean;
  invite_token?: string | null;
  invite_expires_at?: string | null;
}): Promise<number> {
  const result = await run(
    `INSERT INTO users (email, password_hash, name, role, client_id, must_change_password, invite_token, invite_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.email,
      input.password_hash,
      input.name,
      input.role,
      input.client_id ?? null,
      input.must_change_password ? 1 : 0,
      input.invite_token ?? null,
      input.invite_expires_at ?? null,
    ]
  );
  return Number(result.lastInsertRowid);
}

export async function activateUser(userId: number, passwordHash: string, name?: string): Promise<void> {
  if (name && name.trim()) {
    await run(
      "UPDATE users SET password_hash = ?, name = ?, invite_token = NULL, invite_expires_at = NULL, must_change_password = 0 WHERE id = ?",
      [passwordHash, name.trim(), userId]
    );
  } else {
    await run(
      "UPDATE users SET password_hash = ?, invite_token = NULL, invite_expires_at = NULL, must_change_password = 0 WHERE id = ?",
      [passwordHash, userId]
    );
  }
}

export async function countUsers(): Promise<number> {
  const row = await one<{ n: number }>("SELECT COUNT(*) as n FROM users");
  return Number(row?.n ?? 0);
}

export async function countUsersByRole(role: Role): Promise<number> {
  const row = await one<{ n: number }>("SELECT COUNT(*) as n FROM users WHERE role = ?", [role]);
  return Number(row?.n ?? 0);
}

export async function setPassword(userId: number, passwordHash: string): Promise<void> {
  await run("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", [
    passwordHash,
    userId,
  ]);
}
