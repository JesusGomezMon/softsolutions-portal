import { many, run } from "@/lib/db";
import type { Milestone, MilestoneStatus } from "./types";

export async function listMilestonesByProject(projectId: number): Promise<Milestone[]> {
  return many<Milestone>(
    "SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index ASC, id ASC",
    [projectId]
  );
}

export async function listMilestonesByProjectIds(projectIds: number[]): Promise<Milestone[]> {
  if (projectIds.length === 0) return [];
  const placeholders = projectIds.map(() => "?").join(",");
  return many<Milestone>(
    `SELECT * FROM milestones WHERE project_id IN (${placeholders}) ORDER BY order_index ASC, id ASC`,
    projectIds
  );
}

export async function createMilestone(input: {
  project_id: number;
  title: string;
  due_date?: string | null;
  order_index?: number;
}): Promise<number> {
  const result = await run(
    "INSERT INTO milestones (project_id, title, due_date, order_index) VALUES (?, ?, ?, ?)",
    [input.project_id, input.title, input.due_date ?? null, input.order_index ?? 0]
  );
  return Number(result.lastInsertRowid);
}

export async function updateMilestoneStatus(id: number, status: MilestoneStatus): Promise<void> {
  await run("UPDATE milestones SET status = ? WHERE id = ?", [status, id]);
}

/** Progress as a 0-100 integer based on completed vs total milestones. */
export function projectProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.status === "COMPLETADO").length;
  return Math.round((done / milestones.length) * 100);
}
