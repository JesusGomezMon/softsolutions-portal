import { db } from "@/lib/db";
import type { Modality, Project, ProjectStatus } from "./types";

export function listProjectsByClient(clientId: number): Project[] {
  return db
    .prepare("SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC")
    .all(clientId) as unknown as Project[];
}

export function listAllProjectsWithClientName(): (Project & { client_name: string })[] {
  return db
    .prepare(
      `SELECT p.*, c.name AS client_name
       FROM projects p JOIN clients c ON c.id = p.client_id
       ORDER BY p.created_at DESC`
    )
    .all() as unknown as (Project & { client_name: string })[];
}

export function getProject(id: number): Project | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as unknown as Project | undefined;
}

export function createProject(input: {
  client_id: number;
  name: string;
  modality: Modality;
  tier: string;
}): number {
  const result = db
    .prepare(
      "INSERT INTO projects (client_id, name, modality, tier) VALUES (?, ?, ?, ?)"
    )
    .run(input.client_id, input.name, input.modality, input.tier);
  return Number(result.lastInsertRowid);
}

export function updateProjectStatus(id: number, status: ProjectStatus): void {
  db.prepare("UPDATE projects SET status = ? WHERE id = ?").run(status, id);
}
