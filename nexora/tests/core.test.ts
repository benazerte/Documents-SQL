import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../src/server/db';
import {
  createWorkspace,
  executeCommand,
  getContext,
  getSnapshot,
  listWorkspaces,
} from '../src/server/core';
import {
  canAdmin,
  canWrite,
  projectHealth,
  taskProgress,
  wouldCreateCycle,
} from '../src/server/domain';

let db: Database.Database;
let directory: string;
function fixtureUser(id: string) {
  db.prepare('INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)').run(
    id,
    `User ${id}`,
    `${id}@example.test`,
    Date.now(),
    Date.now(),
  );
}
function workspace(userId = 'alice', name = 'Studio') {
  return createWorkspace(userId, { name }, db).id;
}
function context(userId = 'alice', workspaceId = workspace()) {
  return getContext(userId, workspaceId, db);
}
function command(ctx: ReturnType<typeof context>, type: string, data: Record<string, unknown>) {
  return executeCommand(ctx, { type, data });
}
function project(ctx: ReturnType<typeof context>, name = 'Launch') {
  return command(ctx, 'createProject', { name }).id as string;
}
function task(ctx: ReturnType<typeof context>, projectId: string, title = 'Design') {
  return command(ctx, 'createTask', { projectId, title }).id as string;
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'nexora-core-'));
  db = createDatabase(join(directory, 'test.sqlite'));
  fixtureUser('alice');
  fixtureUser('bob');
});
afterEach(() => {
  if (db.open) db.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('deterministic domain calculations', () => {
  it('calculates equal-weight task progress including empty projects', () => {
    expect(taskProgress([])).toBe(0);
    expect(taskProgress([{ status: 'done' }, { status: 'todo' }, { status: 'done' }])).toBe(67);
  });
  it('finds indirect cycles and allows converging acyclic paths', () => {
    const edges = [
      { taskId: 'b', dependsOnId: 'a' },
      { taskId: 'c', dependsOnId: 'b' },
      { taskId: 'd', dependsOnId: 'a' },
    ];
    expect(wouldCreateCycle(edges, 'a', 'c')).toBe(true);
    expect(wouldCreateCycle(edges, 'd', 'c')).toBe(false);
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
  });
  it('uses due dates and blockers for project health', () => {
    expect(projectHealth({ status: 'active', dueDate: '2026-01-01' }, [], '2026-02-01')).toBe(
      'at_risk',
    );
    expect(
      projectHealth(
        { status: 'active', dueDate: null },
        [{ status: 'blocked', dueDate: null }],
        '2026-02-01',
      ),
    ).toBe('attention');
    expect(
      projectHealth({ status: 'active', dueDate: null }, [{ status: 'done', dueDate: null }]),
    ).toBe('complete');
  });
  it('defines role permissions explicitly', () => {
    expect(canWrite('viewer')).toBe(false);
    expect(canWrite('member')).toBe(true);
    expect(canAdmin('member')).toBe(false);
    expect(canAdmin('admin')).toBe(true);
  });
});

describe('workspace authorization and relational integrity', () => {
  it('does not disclose another workspace by guessed identifier', () => {
    const alice = workspace('alice', 'Private');
    const bob = workspace('bob', 'Separate');
    expect(() => getContext('alice', bob, db)).toThrow('access denied');
    expect(listWorkspaces('alice', db).map((w) => w.id)).toEqual([alice]);
    expect(getSnapshot(getContext('alice', alice, db)).workspace.name).toBe('Private');
  });
  it('rejects cross-workspace task and client relations', () => {
    const a = context();
    const b = context('bob', workspace('bob'));
    const bp = project(b);
    expect(() => command(a, 'createTask', { projectId: bp, title: 'Leaked' })).toThrow(
      'Project not found',
    );
    const client = command(b, 'createClient', { name: 'Private client' }).id;
    expect(() => command(a, 'createProject', { name: 'Wrong client', clientId: client })).toThrow(
      'Client not found',
    );
  });
  it('enforces viewer permissions on all command families', () => {
    const a = context();
    const p = project(a);
    db.prepare('INSERT INTO workspace_members(workspaceId,userId,role) VALUES(?,?,?)').run(
      a.workspaceId,
      'bob',
      'viewer',
    );
    const viewer = getContext('bob', a.workspaceId, db);
    expect(getSnapshot(viewer).projects).toHaveLength(1);
    for (const [type, data] of [
      ['createTask', { projectId: p, title: 'No' }],
      ['createClient', { name: 'No' }],
      ['saveGraphPositions', { positions: [] }],
    ] as const)
      expect(() => command(viewer, type, data)).toThrow('read-only');
  });
  it('rejects members outside the workspace and admin privilege escalation', () => {
    const a = context();
    const p = project(a);
    expect(() =>
      command(a, 'createTask', { projectId: p, title: 'Invalid', assigneeId: 'bob' }),
    ).toThrow('Assignee');
    command(a, 'addMember', { email: 'bob@example.test', role: 'admin' });
    const b = getContext('bob', a.workspaceId, db);
    fixtureUser('charlie');
    expect(() => command(b, 'addMember', { email: 'charlie@example.test', role: 'admin' })).toThrow(
      'Only an owner',
    );
    expect(() => command(b, 'updateMemberRole', { userId: 'alice', role: 'viewer' })).toThrow(
      'Only an owner',
    );
  });
  it('persists a complete project/task workflow across reopening SQLite', () => {
    const ctx = context();
    const p = project(ctx);
    const t = task(ctx, p);
    command(ctx, 'updateTask', { id: t, status: 'in_progress' });
    db.close();
    db = createDatabase(join(directory, 'test.sqlite'));
    const snapshot = getSnapshot(getContext('alice', ctx.workspaceId, db));
    expect(snapshot.projects[0].name).toBe('Launch');
    expect(snapshot.tasks[0]).toMatchObject({
      id: t,
      title: 'Design',
      status: 'in_progress',
      projectId: p,
    });
    expect(snapshot.activity.some((a) => a.action === 'Updated task')).toBe(true);
  });
});

describe('task state and dependency operations', () => {
  it('prevents self and circular dependencies, and blocks premature completion', () => {
    const ctx = context();
    const p = project(ctx);
    const a = task(ctx, p, 'Discovery');
    const b = task(ctx, p, 'Design');
    command(ctx, 'createDependency', { taskId: b, dependsOnId: a });
    expect(() => command(ctx, 'createDependency', { taskId: a, dependsOnId: b })).toThrow('cycle');
    expect(() => command(ctx, 'createDependency', { taskId: a, dependsOnId: a })).toThrow(
      'themselves',
    );
    expect(() => command(ctx, 'updateTask', { id: b, status: 'done' })).toThrow(
      'dependencies first',
    );
    command(ctx, 'updateTask', { id: a, status: 'done' });
    command(ctx, 'updateTask', { id: b, status: 'done' });
    expect(getSnapshot(ctx).tasks.every((t) => t.status === 'done')).toBe(true);
    expect(() => command(ctx, 'updateTask', { id: a, status: 'todo' })).toThrow(
      'Reopen completed dependent',
    );
  });
  it('rejects cross-workspace dependencies and rolls back failed activity', () => {
    const a = context();
    const b = context('bob', workspace('bob'));
    const at = task(a, project(a));
    const bt = task(b, project(b));
    const before = getSnapshot(a).activity.length;
    expect(() => command(a, 'createDependency', { taskId: at, dependsOnId: bt })).toThrow(
      'Task not found',
    );
    expect(getSnapshot(a).dependencies).toHaveLength(0);
    expect(getSnapshot(a).activity).toHaveLength(before);
  });
  it('prevents parent cycles and completed parents with incomplete subtasks', () => {
    const ctx = context(),
      p = project(ctx),
      a = task(ctx, p, 'Parent');
    const b = command(ctx, 'createTask', { projectId: p, title: 'Child', parentId: a })
      .id as string;
    expect(() => command(ctx, 'updateTask', { id: a, parentId: b })).toThrow('cycle');
    expect(() => command(ctx, 'updateTask', { id: a, status: 'done' })).toThrow('subtasks first');
    expect(() => command(ctx, 'deleteTask', { id: a })).toThrow('subtasks');
    command(ctx, 'updateTask', { id: b, status: 'done' });
    command(ctx, 'updateTask', { id: a, status: 'done' });
    expect(() => command(ctx, 'updateTask', { id: b, status: 'todo' })).toThrow(
      'parent task first',
    );
  });
  it('rejects invalid dates and preserves fields in partial updates', () => {
    const ctx = context(),
      p = project(ctx);
    expect(() =>
      command(ctx, 'createTask', { projectId: p, title: 'Invalid date', dueDate: '2026-02-30' }),
    ).toThrow();
    const t = command(ctx, 'createTask', {
      projectId: p,
      title: 'Design',
      description: 'Keep me',
      priority: 'high',
      dueDate: '2026-12-01',
    }).id;
    command(ctx, 'updateTask', { id: t, status: 'in_progress' });
    expect(getSnapshot(ctx).tasks[0]).toMatchObject({
      title: 'Design',
      description: 'Keep me',
      priority: 'high',
      dueDate: '2026-12-01',
    });
  });
  it('keeps graph positions scoped to real entities and saves atomically', () => {
    const ctx = context(),
      p = project(ctx);
    command(ctx, 'saveGraphPositions', { positions: [{ entityId: p, x: 10, y: 20 }] });
    expect(getSnapshot(ctx).positions).toEqual([{ entityId: p, x: 10, y: 20 }]);
    expect(() =>
      command(ctx, 'saveGraphPositions', {
        positions: [
          { entityId: p, x: 999, y: 999 },
          { entityId: 'unknown', x: 0, y: 0 },
        ],
      }),
    ).toThrow('does not belong');
    expect(getSnapshot(ctx).positions[0].x).toBe(10);
  });
  it('protects projects with linked records from deletion', () => {
    const ctx = context(),
      p = project(ctx);
    task(ctx, p);
    expect(() => command(ctx, 'deleteProject', { id: p })).toThrow('linked records');
    command(ctx, 'updateProject', { id: p, status: 'archived' });
    expect(getSnapshot(ctx).projects[0].status).toBe('archived');
  });
  it('seeds only explicitly requested demo workspaces from real persisted entities', () => {
    const clean = context();
    expect(getSnapshot(clean).projects).toHaveLength(0);
    const demo = createWorkspace('alice', { name: 'Sample studio', demo: true }, db).id;
    const snapshot = getSnapshot(getContext('alice', demo, db));
    expect(snapshot.workspace.isDemo).toBe(true);
    expect(snapshot.projects).toHaveLength(3);
    expect(snapshot.tasks).toHaveLength(10);
    expect(snapshot.dependencies).toHaveLength(3);
    expect(snapshot.clients.length).toBeGreaterThan(0);
    expect(() => command(getContext('alice', demo, db), 'seedDemo', {})).toThrow('empty workspace');
  });
});
