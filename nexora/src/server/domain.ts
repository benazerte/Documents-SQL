import type { Dependency, Project, Task } from '../lib/types';

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function wouldCreateCycle(
  dependencies: Pick<Dependency, 'taskId' | 'dependsOnId'>[],
  taskId: string,
  dependsOnId: string,
): boolean {
  if (taskId === dependsOnId) return true;
  const queue = [dependsOnId];
  const visited = new Set<string>();
  while (queue.length) {
    const next = queue.pop()!;
    if (next === taskId) return true;
    if (visited.has(next)) continue;
    visited.add(next);
    for (const edge of dependencies) if (edge.taskId === next) queue.push(edge.dependsOnId);
  }
  return false;
}

export function taskProgress(tasks: Pick<Task, 'status'>[]): number {
  return tasks.length
    ? Math.round((tasks.filter((t) => t.status === 'done').length * 100) / tasks.length)
    : 0;
}

export function projectHealth(
  project: Pick<Project, 'status' | 'dueDate'>,
  tasks: Pick<Task, 'status' | 'dueDate'>[],
  today = new Date().toISOString().slice(0, 10),
): 'complete' | 'at_risk' | 'attention' | 'on_track' {
  if (
    project.status === 'completed' ||
    (tasks.length > 0 && tasks.every((t) => t.status === 'done'))
  )
    return 'complete';
  if (
    tasks.some((t) => t.status !== 'done' && t.dueDate && t.dueDate < today) ||
    (project.dueDate && project.dueDate < today)
  )
    return 'at_risk';
  if (tasks.some((t) => t.status === 'blocked')) return 'attention';
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 7);
  if (
    project.dueDate &&
    project.dueDate <= soon.toISOString().slice(0, 10) &&
    taskProgress(tasks) < 80
  )
    return 'attention';
  return 'on_track';
}

export function canWrite(role: string): boolean {
  return ['owner', 'admin', 'member'].includes(role);
}
export function canAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
}
