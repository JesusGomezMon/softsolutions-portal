import { db } from "@/lib/db";
import type { Milestone, MilestoneStatus } from "./types";

export function listMilestonesByProject(projectId: number): Milestone[] {
  return db
    .prepare("SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index ASC, id ASC")
    .all(projectId) as unknown as Milestone[];
}

export function listMilestonesByProjectIds(projectIds: number[]): Milestone[] {
  if (projectIds.length === 0) return [];
  const placeholders = projectIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT * FROM milestones WHERE project_id IN (${placeholders}) ORDER BY order_index ASC, id ASC`
    )
    .all(...projectIds) as unknown as Milestone[];
}

export function createMilestone(input: {
  project_id: number;
  title: string;
  due_date?: string | null;
  order_index?: number;
}): number {
  const result = db
    .prepare(
      "INSERT INTO milestones (project_id, title, due_date, order_index) VALUES (?, ?, ?, ?)"
    )
    .run(input.project_id, input.title, input.due_date ?? null, input.order_index ?? 0);
  return Number(result.lastInsertRowid);
}

export function updateMilestoneStatus(id: number, status: MilestoneStatus): void {
  db.prepare("UPDATE milestones SET status = ? WHERE id = ?").run(status, id);
}

/** Progress as a 0-100 integer based on completed vs total milestones. */
export function projectProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.status === "COMPLETADO").length;
  return Math.round((done / milestones.length) * 100);
}
