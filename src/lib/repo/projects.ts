import { many, one, run } from "@/lib/db";
import type { Modality, Project, ProjectStatus } from "./types";

export async function listProjectsByClient(clientId: number): Promise<Project[]> {
  return many<Project>(
    "SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC",
    [clientId]
  );
}

export async function listAllProjectsWithClientName(): Promise<(Project & { client_name: string })[]> {
  return many<Project & { client_name: string }>(
    `SELECT p.*, c.name AS client_name
     FROM projects p JOIN clients c ON c.id = p.client_id
     ORDER BY p.created_at DESC`
  );
}

export async function getProject(id: number): Promise<Project | undefined> {
  return one<Project>("SELECT * FROM projects WHERE id = ?", [id]);
}

export async function createProject(input: {
  client_id: number;
  name: string;
  modality: Modality;
  tier: string;
}): Promise<number> {
  const result = await run(
    "INSERT INTO projects (client_id, name, modality, tier) VALUES (?, ?, ?, ?)",
    [input.client_id, input.name, input.modality, input.tier]
  );
  return Number(result.lastInsertRowid);
}

export async function updateProjectStatus(id: number, status: ProjectStatus): Promise<void> {
  await run("UPDATE projects SET status = ? WHERE id = ?", [status, id]);
}
