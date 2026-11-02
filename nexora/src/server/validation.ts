import { z } from 'zod';
export const identifier = z.string().min(1).max(100);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid calendar date')
  .nullable();
export const priority = z.enum(['low', 'medium', 'high', 'urgent']);
export const projectStatus = z.enum(['planned', 'active', 'completed', 'archived']);
export const taskStatus = z.enum(['backlog', 'todo', 'in_progress', 'blocked', 'done']);
export const projectInput = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(10000).default(''),
  status: projectStatus.default('active'),
  priority: priority.default('medium'),
  clientId: identifier.nullable().default(null),
  ownerId: identifier.nullable().default(null),
  startDate: dateOnly.default(null),
  dueDate: dateOnly.default(null),
});
// PATCH schemas intentionally have no defaults: omitted values must preserve persisted data.
export const projectPatch = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(10000).optional(),
  status: projectStatus.optional(),
  priority: priority.optional(),
  clientId: identifier.nullable().optional(),
  ownerId: identifier.nullable().optional(),
  startDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
});
export const taskInput = z.object({
  projectId: identifier,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).default(''),
  status: taskStatus.default('todo'),
  priority: priority.default('medium'),
  assigneeId: identifier.nullable().default(null),
  parentId: identifier.nullable().default(null),
  startDate: dateOnly.default(null),
  dueDate: dateOnly.default(null),
  estimateMinutes: z.number().int().min(0).max(525600).default(0),
});
export const taskPatch = z.object({
  id: identifier,
  projectId: identifier.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20000).optional(),
  status: taskStatus.optional(),
  priority: priority.optional(),
  assigneeId: identifier.nullable().optional(),
  parentId: identifier.nullable().optional(),
  startDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
  estimateMinutes: z.number().int().min(0).max(525600).optional(),
});
export const workspaceInput = z.object({
  name: z.string().trim().min(1).max(100),
  demo: z.boolean().default(false),
});
export const roleInput = z.enum(['admin', 'member', 'viewer']);
