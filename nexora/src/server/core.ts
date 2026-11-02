import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  Activity,
  Command,
  Dependency,
  GraphPosition,
  Member,
  Project,
  Role,
  Snapshot,
  Task,
  TaskComment,
  User,
  Workspace,
} from '../lib/types';
import { getDb } from './db';
import { getAuth } from './auth';
import { AppError, canAdmin, canWrite, wouldCreateCycle } from './domain';
import {
  identifier,
  projectInput,
  projectPatch,
  roleInput,
  taskInput,
  taskPatch,
  workspaceInput,
} from './validation';
import { extendedCommand, extendedSnapshot, seedExtendedDemo } from './extended';

export { AppError } from './domain';
export interface OperationContext {
  db: Database.Database;
  userId: string;
  workspaceId: string;
  role: Role;
}
const now = () => new Date().toISOString();
const id = () => randomUUID();

export async function getUser(request: Request): Promise<User> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new AppError('Sign in to continue.', 401);
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export function getContext(userId: string, workspaceId: string, db = getDb()): OperationContext {
  const member = db
    .prepare('SELECT role FROM workspace_members WHERE workspaceId=? AND userId=?')
    .get(workspaceId, userId) as { role: Role } | undefined;
  if (!member) throw new AppError('Workspace not found or access denied.', 404);
  return { db, userId, workspaceId, role: member.role };
}
export async function requireContext(
  request: Request,
  workspaceId: string,
): Promise<OperationContext> {
  return getContext((await getUser(request)).id, workspaceId);
}
export function listWorkspaces(userId: string, db = getDb()): Workspace[] {
  return (
    db
      .prepare(
        'SELECT w.*,m.role FROM workspaces w JOIN workspace_members m ON m.workspaceId=w.id WHERE m.userId=? ORDER BY w.createdAt ASC',
      )
      .all(userId) as (Omit<Workspace, 'isDemo'> & { isDemo: number })[]
  ).map((w) => ({ ...w, isDemo: !!w.isDemo }));
}
export function activity(
  ctx: OperationContext,
  action: string,
  entityType: string,
  entityId: string,
) {
  ctx.db
    .prepare(
      'INSERT INTO activity(id,workspaceId,actorId,action,entityId,entityType,createdAt) VALUES(?,?,?,?,?,?,?)',
    )
    .run(id(), ctx.workspaceId, ctx.userId, action, entityId, entityType, now());
}
function assertWrite(ctx: OperationContext) {
  if (!canWrite(ctx.role)) throw new AppError('This workspace is read-only for your role.', 403);
}
function requireProject(ctx: OperationContext, projectId: string): Project {
  const p = ctx.db
    .prepare('SELECT * FROM projects WHERE id=? AND workspaceId=?')
    .get(projectId, ctx.workspaceId) as Project | undefined;
  if (!p) throw new AppError('Project not found in this workspace.', 404);
  return p;
}
function requireTask(ctx: OperationContext, taskId: string): Task {
  const t = ctx.db
    .prepare('SELECT * FROM tasks WHERE id=? AND workspaceId=?')
    .get(taskId, ctx.workspaceId) as Task | undefined;
  if (!t) throw new AppError('Task not found in this workspace.', 404);
  return t;
}
function requireMember(ctx: OperationContext, userId: string | null) {
  if (
    userId &&
    !ctx.db
      .prepare('SELECT 1 FROM workspace_members WHERE workspaceId=? AND userId=?')
      .get(ctx.workspaceId, userId)
  )
    throw new AppError('Assignee must belong to this workspace.');
}
function checkProjectRelations(
  ctx: OperationContext,
  p: Pick<Project, 'clientId' | 'ownerId' | 'startDate' | 'dueDate'>,
) {
  requireMember(ctx, p.ownerId);
  if (
    p.clientId &&
    !ctx.db
      .prepare('SELECT 1 FROM clients WHERE id=? AND workspaceId=?')
      .get(p.clientId, ctx.workspaceId)
  )
    throw new AppError('Client not found in this workspace.');
  if (p.startDate && p.dueDate && p.startDate > p.dueDate)
    throw new AppError('Target date must be on or after the start date.');
}
function checkTaskRelations(
  ctx: OperationContext,
  t: Task | z.infer<typeof taskInput>,
  taskId?: string,
) {
  const project = requireProject(ctx, t.projectId);
  requireMember(ctx, t.assigneeId);
  if (project.status === 'completed' && t.status !== 'done')
    throw new AppError('Reopen the project before adding or reopening incomplete tasks.', 409);
  if (t.startDate && t.dueDate && t.startDate > t.dueDate)
    throw new AppError('Due date must be on or after the start date.');
  let ancestor = t.parentId;
  const seen = new Set<string>();
  while (ancestor) {
    if (ancestor === taskId || seen.has(ancestor))
      throw new AppError('Subtasks cannot form a cycle.');
    seen.add(ancestor);
    const parent = requireTask(ctx, ancestor);
    if (parent.projectId !== t.projectId)
      throw new AppError('Parent task must belong to the same project.');
    if (parent.status === 'done' && t.status !== 'done')
      throw new AppError('Reopen the parent task first.', 409);
    ancestor = parent.parentId;
  }
  if (taskId && t.parentId) {
    // A parent's completion requires its children, so these are real prerequisite
    // edges too. Combining them prevents child->parent dependency deadlocks.
    const prerequisites = allPrerequisites(ctx, taskId);
    if (wouldCreateCycle(prerequisites, t.parentId, taskId))
      throw new AppError('This parent would create a cycle with task dependencies.', 409);
  }
  if (taskId && t.status === 'done') {
    const unfinished = ctx.db
      .prepare(
        "SELECT t.id FROM dependencies d JOIN tasks t ON t.id=d.dependsOnId WHERE d.taskId=? AND d.workspaceId=? AND t.status!='done'",
      )
      .all(taskId, ctx.workspaceId);
    if (unfinished.length) throw new AppError('Complete this task’s dependencies first.', 409);
    const subtasks = ctx.db
      .prepare("SELECT 1 FROM tasks WHERE parentId=? AND workspaceId=? AND status!='done' LIMIT 1")
      .get(taskId, ctx.workspaceId);
    if (subtasks) throw new AppError('Complete this task’s subtasks first.', 409);
  }
}

function allPrerequisites(
  ctx: OperationContext,
  excludeParentForTask?: string,
): Pick<Dependency, 'taskId' | 'dependsOnId'>[] {
  const explicit = ctx.db
    .prepare('SELECT taskId,dependsOnId FROM dependencies WHERE workspaceId=?')
    .all(ctx.workspaceId) as Dependency[];
  const children = ctx.db
    .prepare('SELECT id,parentId FROM tasks WHERE workspaceId=? AND parentId IS NOT NULL')
    .all(ctx.workspaceId) as { id: string; parentId: string }[];
  return [
    ...explicit,
    ...children
      .filter((t) => t.id !== excludeParentForTask)
      .map((t) => ({ taskId: t.parentId, dependsOnId: t.id })),
  ];
}

export function createWorkspace(userId: string, input: unknown, db = getDb()): { id: string } {
  const data = workspaceInput.parse(input);
  const workspaceId = id();
  const previous = db
    .prepare('SELECT COUNT(*) as count FROM workspace_members WHERE userId=?')
    .get(userId) as { count: number };
  if (previous.count >= 30) throw new AppError('Workspace limit reached.', 409);
  db.transaction(() => {
    db.prepare('INSERT INTO workspaces(id,name,isDemo,createdAt) VALUES(?,?,?,?)').run(
      workspaceId,
      data.name,
      data.demo ? 1 : 0,
      now(),
    );
    db.prepare('INSERT INTO workspace_members(workspaceId,userId,role) VALUES(?,?,?)').run(
      workspaceId,
      userId,
      'owner',
    );
    const ctx: OperationContext = { db, userId, workspaceId, role: 'owner' };
    activity(ctx, 'Created workspace', 'workspace', workspaceId);
    if (data.demo) seedDemo(ctx);
  })();
  return { id: workspaceId };
}

export function getSnapshot(ctx: OperationContext): Snapshot {
  const user = ctx.db.prepare('SELECT id,name,email FROM user WHERE id=?').get(ctx.userId) as User;
  const workspaces = listWorkspaces(ctx.userId, ctx.db);
  const workspace = workspaces.find((w) => w.id === ctx.workspaceId)!;
  return {
    user,
    workspace,
    workspaces,
    members: ctx.db
      .prepare(
        'SELECT u.id as userId,u.name,u.email,m.role FROM workspace_members m JOIN user u ON u.id=m.userId WHERE m.workspaceId=? ORDER BY u.name',
      )
      .all(ctx.workspaceId) as Member[],
    projects: ctx.db
      .prepare('SELECT * FROM projects WHERE workspaceId=? ORDER BY createdAt DESC')
      .all(ctx.workspaceId) as Project[],
    tasks: ctx.db
      .prepare('SELECT * FROM tasks WHERE workspaceId=? ORDER BY createdAt ASC')
      .all(ctx.workspaceId) as Task[],
    dependencies: ctx.db
      .prepare('SELECT id,taskId,dependsOnId FROM dependencies WHERE workspaceId=?')
      .all(ctx.workspaceId) as Dependency[],
    positions: ctx.db
      .prepare('SELECT entityId,x,y FROM graph_positions WHERE workspaceId=?')
      .all(ctx.workspaceId) as GraphPosition[],
    activity: ctx.db
      .prepare(
        'SELECT a.id,u.name as actorName,a.action,a.entityId,a.entityType,a.createdAt FROM activity a JOIN user u ON u.id=a.actorId WHERE a.workspaceId=? ORDER BY a.createdAt DESC LIMIT 100',
      )
      .all(ctx.workspaceId) as Activity[],
    comments: ctx.db
      .prepare(
        'SELECT c.id,c.taskId,u.name as authorName,c.content,c.createdAt FROM task_comments c JOIN user u ON u.id=c.authorId WHERE c.workspaceId=? ORDER BY c.createdAt ASC',
      )
      .all(ctx.workspaceId) as TaskComment[],
    ...extendedSnapshot(ctx),
  };
}

export function executeCommand(ctx: OperationContext, input: Command): Record<string, unknown> {
  const parsed = z
    .object({ type: z.string().min(1).max(100), data: z.record(z.string(), z.unknown()) })
    .parse(input);
  assertWrite(ctx);
  return ctx.db.transaction(() => runCommand(ctx, parsed.type, parsed.data))();
}
function runCommand(
  ctx: OperationContext,
  type: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const db = ctx.db;
  if (type === 'createProject') {
    const data = projectInput.parse(input);
    checkProjectRelations(ctx, data);
    const projectId = id(),
      timestamp = now();
    db.prepare(
      'INSERT INTO projects(id,workspaceId,name,description,status,priority,clientId,ownerId,startDate,dueDate,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      projectId,
      ctx.workspaceId,
      data.name,
      data.description,
      data.status,
      data.priority,
      data.clientId,
      data.ownerId,
      data.startDate,
      data.dueDate,
      timestamp,
      timestamp,
    );
    activity(ctx, 'Created project', 'project', projectId);
    return { id: projectId };
  }
  if (type === 'updateProject') {
    const data = projectPatch.parse(input),
      previous = requireProject(ctx, data.id),
      p = { ...previous, ...data };
    checkProjectRelations(ctx, p);
    if (
      p.status === 'completed' &&
      db.prepare("SELECT 1 FROM tasks WHERE projectId=? AND status!='done' LIMIT 1").get(p.id)
    )
      throw new AppError('Complete the project’s tasks first.', 409);
    db.prepare(
      'UPDATE projects SET name=?,description=?,status=?,priority=?,clientId=?,ownerId=?,startDate=?,dueDate=?,updatedAt=? WHERE id=? AND workspaceId=?',
    ).run(
      p.name,
      p.description,
      p.status,
      p.priority,
      p.clientId,
      p.ownerId,
      p.startDate,
      p.dueDate,
      now(),
      p.id,
      ctx.workspaceId,
    );
    activity(
      ctx,
      p.status === 'archived' ? 'Archived project' : 'Updated project',
      'project',
      p.id,
    );
    return { id: p.id };
  }
  if (type === 'deleteProject') {
    const projectId = identifier.parse(input.id);
    requireProject(ctx, projectId);
    if (!canAdmin(ctx.role))
      throw new AppError('Only workspace owners and admins can delete projects.', 403);
    const relations = [
      ['tasks', 'projectId'],
      ['documents', 'projectId'],
      ['time_entries', 'projectId'],
      ['invoices', 'projectId'],
      ['expenses', 'projectId'],
    ];
    for (const [table, column] of relations)
      if (
        db
          .prepare(`SELECT 1 FROM ${table} WHERE ${column}=? AND workspaceId=? LIMIT 1`)
          .get(projectId, ctx.workspaceId)
      )
        throw new AppError('This project has linked records. Archive it instead.', 409);
    db.prepare('DELETE FROM projects WHERE id=? AND workspaceId=?').run(projectId, ctx.workspaceId);
    db.prepare('DELETE FROM graph_positions WHERE workspaceId=? AND entityId=?').run(
      ctx.workspaceId,
      projectId,
    );
    activity(ctx, 'Deleted project', 'project', projectId);
    return { id: projectId };
  }
  if (type === 'createTask') {
    const data = taskInput.parse(input);
    checkTaskRelations(ctx, data);
    const taskId = id(),
      timestamp = now();
    db.prepare(
      'INSERT INTO tasks(id,workspaceId,projectId,title,description,status,priority,assigneeId,parentId,dueDate,startDate,estimateMinutes,createdAt,updatedAt,completedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      taskId,
      ctx.workspaceId,
      data.projectId,
      data.title,
      data.description,
      data.status,
      data.priority,
      data.assigneeId,
      data.parentId,
      data.dueDate,
      data.startDate,
      data.estimateMinutes,
      timestamp,
      timestamp,
      data.status === 'done' ? timestamp : null,
    );
    activity(ctx, 'Created task', 'task', taskId);
    return { id: taskId };
  }
  if (type === 'updateTask') {
    const data = taskPatch.parse(input),
      previous = requireTask(ctx, data.id),
      t = { ...previous, ...data };
    checkTaskRelations(ctx, t, t.id);
    if (
      t.projectId !== previous.projectId &&
      db.prepare('SELECT 1 FROM tasks WHERE parentId=? LIMIT 1').get(t.id)
    )
      throw new AppError('Move subtasks first.');
    if (previous.status === 'done' && t.status !== 'done') {
      const completedDependents = db
        .prepare(
          "SELECT 1 FROM dependencies d JOIN tasks t ON t.id=d.taskId WHERE d.dependsOnId=? AND t.status='done' LIMIT 1",
        )
        .get(t.id);
      if (completedDependents) throw new AppError('Reopen completed dependent tasks first.', 409);
      if (t.parentId && requireTask(ctx, t.parentId).status === 'done')
        throw new AppError('Reopen the parent task first.', 409);
    }
    db.prepare(
      'UPDATE tasks SET projectId=?,title=?,description=?,status=?,priority=?,assigneeId=?,parentId=?,dueDate=?,startDate=?,estimateMinutes=?,updatedAt=?,completedAt=? WHERE id=? AND workspaceId=?',
    ).run(
      t.projectId,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.assigneeId,
      t.parentId,
      t.dueDate,
      t.startDate,
      t.estimateMinutes,
      now(),
      t.status === 'done' ? previous.completedAt || now() : null,
      t.id,
      ctx.workspaceId,
    );
    activity(
      ctx,
      t.status === 'done' && previous.status !== 'done' ? 'Completed task' : 'Updated task',
      'task',
      t.id,
    );
    return { id: t.id };
  }
  if (type === 'deleteTask') {
    const taskId = identifier.parse(input.id);
    requireTask(ctx, taskId);
    if (db.prepare('SELECT 1 FROM tasks WHERE parentId=? LIMIT 1').get(taskId))
      throw new AppError('Delete or reparent subtasks first.', 409);
    if (db.prepare('SELECT 1 FROM time_entries WHERE taskId=? LIMIT 1').get(taskId))
      throw new AppError('This task has time entries. Preserve or reassign them first.', 409);
    db.prepare('DELETE FROM tasks WHERE id=? AND workspaceId=?').run(taskId, ctx.workspaceId);
    db.prepare('DELETE FROM graph_positions WHERE workspaceId=? AND entityId=?').run(
      ctx.workspaceId,
      taskId,
    );
    activity(ctx, 'Deleted task', 'task', taskId);
    return { id: taskId };
  }
  if (type === 'createDependency') {
    const data = z.object({ taskId: identifier, dependsOnId: identifier }).parse(input);
    const task = requireTask(ctx, data.taskId),
      required = requireTask(ctx, data.dependsOnId);
    const edges = db
      .prepare('SELECT taskId,dependsOnId FROM dependencies WHERE workspaceId=?')
      .all(ctx.workspaceId) as Dependency[];
    if (wouldCreateCycle(allPrerequisites(ctx), data.taskId, data.dependsOnId))
      throw new AppError(
        'Dependencies cannot point to themselves or form a cycle, including subtask completion prerequisites.',
        409,
      );
    if (task.status === 'done' && required.status !== 'done')
      throw new AppError('Reopen the task before adding an incomplete dependency.', 409);
    if (edges.some((d) => d.taskId === data.taskId && d.dependsOnId === data.dependsOnId))
      throw new AppError('This dependency already exists.', 409);
    const edgeId = id();
    db.prepare('INSERT INTO dependencies(id,workspaceId,taskId,dependsOnId) VALUES(?,?,?,?)').run(
      edgeId,
      ctx.workspaceId,
      data.taskId,
      data.dependsOnId,
    );
    activity(ctx, 'Added task dependency', 'task', data.taskId);
    return { id: edgeId };
  }
  if (type === 'removeDependency') {
    const edgeId = identifier.parse(input.id);
    const edge = db
      .prepare('SELECT taskId FROM dependencies WHERE id=? AND workspaceId=?')
      .get(edgeId, ctx.workspaceId) as { taskId: string } | undefined;
    if (!edge) throw new AppError('Dependency not found.', 404);
    db.prepare('DELETE FROM dependencies WHERE id=? AND workspaceId=?').run(
      edgeId,
      ctx.workspaceId,
    );
    activity(ctx, 'Removed task dependency', 'task', edge.taskId);
    return { id: edgeId };
  }
  if (type === 'saveGraphPositions') {
    const data = z
      .object({
        positions: z
          .array(
            z.object({
              entityId: identifier,
              x: z.number().finite().min(-100000).max(100000),
              y: z.number().finite().min(-100000).max(100000),
            }),
          )
          .max(5000),
      })
      .parse(input);
    const ids = new Set<string>(
      [
        ...db.prepare('SELECT id FROM projects WHERE workspaceId=?').all(ctx.workspaceId),
        ...db.prepare('SELECT id FROM tasks WHERE workspaceId=?').all(ctx.workspaceId),
        ...db.prepare('SELECT id FROM clients WHERE workspaceId=?').all(ctx.workspaceId),
        ...db.prepare('SELECT id FROM documents WHERE workspaceId=?').all(ctx.workspaceId),
        ...db.prepare('SELECT id FROM invoices WHERE workspaceId=?').all(ctx.workspaceId),
      ].map((r) => (r as { id: string }).id),
    );
    for (const p of data.positions) {
      if (!ids.has(p.entityId)) throw new AppError('Graph node does not belong to this workspace.');
      db.prepare(
        'INSERT INTO graph_positions(workspaceId,entityId,x,y) VALUES(?,?,?,?) ON CONFLICT(workspaceId,entityId) DO UPDATE SET x=excluded.x,y=excluded.y',
      ).run(ctx.workspaceId, p.entityId, p.x, p.y);
    }
    return { saved: data.positions.length };
  }
  if (type === 'addComment') {
    const data = z
      .object({ taskId: identifier, content: z.string().trim().min(1).max(10000) })
      .parse(input);
    requireTask(ctx, data.taskId);
    const commentId = id();
    db.prepare(
      'INSERT INTO task_comments(id,workspaceId,taskId,authorId,content,createdAt) VALUES(?,?,?,?,?,?)',
    ).run(commentId, ctx.workspaceId, data.taskId, ctx.userId, data.content, now());
    activity(ctx, 'Commented on task', 'task', data.taskId);
    return { id: commentId };
  }
  if (type === 'renameWorkspace') {
    if (!canAdmin(ctx.role))
      throw new AppError('Only owners and admins can rename this workspace.', 403);
    const name = z.string().trim().min(1).max(100).parse(input.name);
    db.prepare('UPDATE workspaces SET name=? WHERE id=?').run(name, ctx.workspaceId);
    activity(ctx, 'Renamed workspace', 'workspace', ctx.workspaceId);
    return { id: ctx.workspaceId };
  }
  if (type === 'addMember') {
    if (!canAdmin(ctx.role)) throw new AppError('Only owners and admins can add members.', 403);
    const data = z.object({ email: z.email(), role: roleInput.default('member') }).parse(input);
    const user = db.prepare('SELECT id FROM user WHERE email=? COLLATE NOCASE').get(data.email) as
      { id: string } | undefined;
    if (!user)
      throw new AppError('That person must register an account before they can be added.', 404);
    if (
      db
        .prepare('SELECT 1 FROM workspace_members WHERE workspaceId=? AND userId=?')
        .get(ctx.workspaceId, user.id)
    )
      throw new AppError('This person is already a member.', 409);
    if (ctx.role === 'admin' && data.role === 'admin')
      throw new AppError('Only an owner can appoint an admin.', 403);
    db.prepare('INSERT INTO workspace_members(workspaceId,userId,role) VALUES(?,?,?)').run(
      ctx.workspaceId,
      user.id,
      data.role,
    );
    activity(ctx, 'Added workspace member', 'member', user.id);
    return { id: user.id };
  }
  if (type === 'updateMemberRole') {
    if (ctx.role !== 'owner') throw new AppError('Only an owner can change member roles.', 403);
    const data = z.object({ userId: identifier, role: roleInput }).parse(input);
    const member = db
      .prepare('SELECT role FROM workspace_members WHERE workspaceId=? AND userId=?')
      .get(ctx.workspaceId, data.userId) as { role: string } | undefined;
    if (!member) throw new AppError('Member not found.', 404);
    if (member.role === 'owner') throw new AppError('Owner roles cannot be changed here.');
    db.prepare('UPDATE workspace_members SET role=? WHERE workspaceId=? AND userId=?').run(
      data.role,
      ctx.workspaceId,
      data.userId,
    );
    activity(ctx, 'Changed workspace member role', 'member', data.userId);
    return { id: data.userId };
  }
  if (type === 'seedDemo') {
    if (!canAdmin(ctx.role))
      throw new AppError('Only owners and admins can seed sample data.', 403);
    if (db.prepare('SELECT 1 FROM projects WHERE workspaceId=? LIMIT 1').get(ctx.workspaceId))
      throw new AppError('Use an empty workspace for sample data.', 409);
    seedDemo(ctx);
    return { id: ctx.workspaceId };
  }
  const extension = extendedCommand(ctx, type, input);
  if (extension !== undefined) {
    const events: Record<string, [string, string]> = {
      createClient: ['Created client', 'client'],
      updateClient: ['Updated client', 'client'],
      deleteClient: ['Deleted client', 'client'],
      createDocument: ['Created document', 'document'],
      updateDocument: ['Updated document', 'document'],
      deleteDocument: ['Deleted document', 'document'],
      startTimer: ['Started focus timer', 'time'],
      stopTimer: ['Stopped focus timer', 'time'],
      recordTime: ['Recorded time', 'time'],
      deleteTime: ['Deleted time entry', 'time'],
      createInvoice: ['Created invoice', 'invoice'],
      updateInvoice: ['Updated draft invoice', 'invoice'],
      issueInvoice: ['Issued invoice', 'invoice'],
      recordPayment: ['Recorded invoice payment', 'invoice'],
      voidInvoice: ['Voided invoice', 'invoice'],
      createExpense: ['Recorded expense', 'expense'],
      deleteExpense: ['Deleted expense', 'expense'],
    };
    const event = events[type];
    if (event && typeof extension.id === 'string') activity(ctx, event[0], event[1], extension.id);
    return extension;
  }
  throw new AppError('Unsupported operation.', 400);
}

function seedDemo(ctx: OperationContext) {
  ctx.db.prepare('UPDATE workspaces SET isDemo=1 WHERE id=?').run(ctx.workspaceId);
  const date = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const projectNames = ['Orbit — Brand platform', 'Atlas — Product launch', 'Studio operations'];
  const projectIds = projectNames.map(
    (name, i) =>
      runCommand(ctx, 'createProject', {
        name,
        description: [
          'A connected identity system for an ambitious new chapter.',
          'Coordinate the next release, from discovery to delivery.',
          'Keep the studio running with clear, repeatable processes.',
        ][i],
        status: i === 2 ? 'planned' : 'active',
        priority: i === 0 ? 'high' : 'medium',
        ownerId: ctx.userId,
        startDate: date(-10),
        dueDate: date([21, 35, 60][i]),
      }).id as string,
  );
  const taskData = [
    [0, 'Map the brand landscape', 'done', 'high', -5],
    [0, 'Define creative direction', 'in_progress', 'high', 3],
    [0, 'Build the identity toolkit', 'todo', 'medium', 10],
    [0, 'Review and share guidelines', 'backlog', 'medium', 18],
    [1, 'Align launch milestones', 'done', 'high', -3],
    [1, 'Design the onboarding journey', 'in_progress', 'high', 5],
    [1, 'Prepare launch assets', 'blocked', 'medium', 12],
    [1, 'Review release checklist', 'todo', 'medium', 20],
    [2, 'Update studio playbook', 'todo', 'low', 7],
    [2, 'Review partner agreements', 'todo', 'medium', -1],
  ] as const;
  const tasks = taskData.map(
    ([index, title, status, priority, due]) =>
      runCommand(ctx, 'createTask', {
        projectId: projectIds[index],
        title,
        status,
        priority,
        assigneeId: ctx.userId,
        dueDate: date(due),
        estimateMinutes: 120,
      }).id as string,
  );
  runCommand(ctx, 'createDependency', { taskId: tasks[2], dependsOnId: tasks[1] });
  runCommand(ctx, 'createDependency', { taskId: tasks[3], dependsOnId: tasks[2] });
  runCommand(ctx, 'createDependency', { taskId: tasks[6], dependsOnId: tasks[5] });
  seedExtendedDemo(ctx, projectIds);
  activity(ctx, 'Loaded explicitly labeled sample workspace', 'workspace', ctx.workspaceId);
}
