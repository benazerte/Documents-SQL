import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../src/server/db';
import {
  createWorkspace,
  executeCommand,
  getContext,
  getSnapshot,
  type OperationContext,
} from '../src/server/core';

let db: Database.Database;
let ctx: OperationContext;
function command(type: string, data: Record<string, unknown>) {
  return executeCommand(ctx, { type, data });
}
function project() {
  return String(command('createProject', { name: 'Integrity project' }).id);
}
function task(projectId: string, title: string, parentId?: string) {
  return String(command('createTask', { projectId, title, ...(parentId ? { parentId } : {}) }).id);
}

beforeEach(() => {
  db = createDatabase(':memory:');
  db.prepare('INSERT INTO user (id,name,email,createdAt,updatedAt) VALUES (?,?,?,?,?)').run(
    'integrity-user',
    'Integrity user',
    'integrity@example.test',
    Date.now(),
    Date.now(),
  );
  const workspaceId = createWorkspace('integrity-user', { name: 'Integrity workspace' }, db).id;
  ctx = getContext('integrity-user', workspaceId, db);
});
afterEach(() => {
  if (db.open) db.close();
});

describe('combined hierarchy and prerequisite integrity', () => {
  it('rejects a child depending on a parent which itself requires that child to finish', () => {
    const p = project(),
      parent = task(p, 'Parent'),
      child = task(p, 'Child', parent);
    const before = getSnapshot(ctx).activity.length;
    expect(() => command('createDependency', { taskId: child, dependsOnId: parent })).toThrow(
      /cycle|parent|prerequisite/i,
    );
    expect(getSnapshot(ctx).dependencies).toHaveLength(0);
    expect(getSnapshot(ctx).activity).toHaveLength(before);
  });

  it('rejects an indirect prerequisite cycle through parent completion rules', () => {
    const p = project(),
      parent = task(p, 'Parent'),
      child = task(p, 'Child', parent),
      third = task(p, 'External delivery');
    command('createDependency', { taskId: third, dependsOnId: parent });
    expect(() => command('createDependency', { taskId: child, dependsOnId: third })).toThrow(
      /cycle|parent|prerequisite/i,
    );
    expect(getSnapshot(ctx).dependencies).toHaveLength(1);
  });

  it('rejects reparenting that would make an existing dependency impossible to complete', () => {
    const p = project(),
      first = task(p, 'First'),
      second = task(p, 'Second');
    command('createDependency', { taskId: first, dependsOnId: second });
    expect(() => command('updateTask', { id: first, parentId: second })).toThrow(
      /cycle|parent|prerequisite/i,
    );
    expect(getSnapshot(ctx).tasks.find((record) => record.id === first)?.parentId).toBeNull();
  });

  it('allows a parent to depend explicitly on a child without inventing a cycle', () => {
    const p = project(),
      parent = task(p, 'Parent'),
      child = task(p, 'Child', parent);
    command('createDependency', { taskId: parent, dependsOnId: child });
    command('updateTask', { id: child, status: 'done' });
    command('updateTask', { id: parent, status: 'done' });
    expect(getSnapshot(ctx).tasks.every((record) => record.status === 'done')).toBe(true);
  });
});

describe('timer and sample data integrity', () => {
  it('can create a second labeled demo workspace without overlapping the first sample session', () => {
    const first = createWorkspace(ctx.userId, { name: 'First sample', demo: true }, db).id;
    const second = createWorkspace(ctx.userId, { name: 'Second sample', demo: true }, db).id;
    const firstSnapshot = getSnapshot(getContext(ctx.userId, first, db));
    const secondSnapshot = getSnapshot(getContext(ctx.userId, second, db));
    expect(firstSnapshot.workspace.isDemo).toBe(true);
    expect(secondSnapshot.workspace.isDemo).toBe(true);
    expect(firstSnapshot.timeEntries).toHaveLength(1);
    expect(secondSnapshot.timeEntries).toHaveLength(1);
    const a = firstSnapshot.timeEntries[0],
      b = secondSnapshot.timeEntries[0];
    expect(
      new Date(a.endedAt!).valueOf() <= new Date(b.startedAt).valueOf() ||
        new Date(b.endedAt!).valueOf() <= new Date(a.startedAt).valueOf(),
    ).toBe(true);
  });

  it('never starts a timer overlapping a manual interval that ends just after the current time', () => {
    const projectId = project();
    const timestamp = Date.now();
    let acceptedManual = false;
    try {
      command('recordTime', {
        projectId,
        description: 'Near-future manual entry',
        startedAt: new Date(timestamp - 60 * 60_000).toISOString(),
        endedAt: new Date(timestamp + 30_000).toISOString(),
      });
      acceptedManual = true;
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/future/);
    }
    if (acceptedManual) {
      expect(() => command('startTimer', { projectId, description: 'Must not overlap' })).toThrow(
        /overlap|future/i,
      );
      expect(getSnapshot(ctx).timeEntries.filter((entry) => entry.endedAt === null)).toHaveLength(
        0,
      );
    } else {
      command('startTimer', { projectId, description: 'Clean interval' });
      expect(getSnapshot(ctx).timeEntries.filter((entry) => entry.endedAt === null)).toHaveLength(
        1,
      );
    }
  });
});
