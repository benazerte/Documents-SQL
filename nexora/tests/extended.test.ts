import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  calculateInvoiceTotals,
  ensureExtendedSchema,
  extendedCommand,
  extendedSnapshot,
  type ExtendedContext,
} from '../src/server/extended';

const databases: Database.Database[] = [];
function fixture() {
  const db = new Database(':memory:');
  databases.push(db);
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE user(id TEXT PRIMARY KEY);
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE projects(id TEXT PRIMARY KEY,workspaceId TEXT NOT NULL,clientId TEXT);
    CREATE TABLE tasks(id TEXT PRIMARY KEY,workspaceId TEXT NOT NULL,projectId TEXT NOT NULL);
    INSERT INTO user VALUES('u1'),('u2');
    INSERT INTO workspaces VALUES('w1'),('w2');
    INSERT INTO projects VALUES('p1','w1',NULL),('p2','w2',NULL);
    INSERT INTO tasks VALUES('t1','w1','p1'),('t2','w2','p2');`);
  ensureExtendedSchema(db);
  const ctx: ExtendedContext = { db, userId: 'u1', workspaceId: 'w1', role: 'owner' };
  const run = (type: string, data: Record<string, unknown>) =>
    db.transaction(() => extendedCommand(ctx, type, data))()!;
  return { db, ctx, run };
}
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe('exact invoice arithmetic and lifecycle', () => {
  it('rounds tax half up in minor units and rejects unsafe/noninteger prices', () => {
    expect(
      calculateInvoiceTotals([{ description: 'Design', quantity: 3, unitPrice: 1001 }], 2000),
    ).toEqual({ subtotal: 3003, tax: 601, total: 3604 });
    expect(
      calculateInvoiceTotals([{ description: 'Small item', quantity: 1, unitPrice: 1 }], 5000),
    ).toEqual({ subtotal: 1, tax: 1, total: 2 });
    expect(() =>
      calculateInvoiceTotals([{ description: 'Invalid', quantity: 1.5, unitPrice: 100 }], 0),
    ).toThrow();
    expect(() =>
      calculateInvoiceTotals(
        [{ description: 'Invalid', quantity: 100_000, unitPrice: 1_000_000_000 }],
        0,
      ),
    ).toThrow('supported amount');
  });
  it('preserves issued totals and client identity and records partial/full payments', () => {
    const { run, db, ctx } = fixture();
    const client = run('createClient', { name: 'Original Client' });
    const invoice = run('createInvoice', {
      clientId: client.id,
      projectId: 'p1',
      currency: 'EUR',
      items: [{ description: 'Design sprint', quantity: 2, unitPrice: 12345 }],
      taxBasisPoints: 2000,
    });
    let saved = extendedSnapshot(ctx).invoices[0];
    expect(saved.total).toBe(29628);
    expect(saved.items).toHaveLength(1);
    expect(saved.status).toBe('draft');
    run('issueInvoice', { id: invoice.id });
    expect(() => run('updateInvoice', { id: invoice.id, notes: 'Edit issued invoice' })).toThrow(
      'cannot be edited',
    );
    run('updateClient', { id: client.id, name: 'New Client Name' });
    const identity = db
      .prepare('SELECT clientSnapshot FROM invoices WHERE id=?')
      .get(invoice.id) as { clientSnapshot: string };
    expect(JSON.parse(identity.clientSnapshot).name).toBe('Original Client');
    run('recordPayment', { id: invoice.id, amount: 10000 });
    saved = extendedSnapshot(ctx).invoices[0];
    expect(saved.status).toBe('partially_paid');
    expect(saved.paid).toBe(10000);
    expect(() => run('recordPayment', { id: invoice.id, amount: 20000 })).toThrow('exceeds');
    expect(() => run('voidInvoice', { id: invoice.id })).toThrow('unpaid');
    run('recordPayment', { id: invoice.id, amount: 19628 });
    expect(extendedSnapshot(ctx).invoices[0].status).toBe('paid');
    expect(db.prepare('SELECT COUNT(*) AS count FROM payments').get()).toEqual({ count: 2 });
  });
  it('allocates stable sequential numbers and does not reuse void invoice numbers', () => {
    const { run, ctx } = fixture();
    const client = run('createClient', { name: 'Client' });
    const make = () =>
      run('createInvoice', {
        clientId: client.id,
        items: [{ description: 'Work', quantity: 1, unitPrice: 100 }],
      });
    const a = make();
    run('voidInvoice', { id: a.id });
    make();
    const numbers = extendedSnapshot(ctx)
      .invoices.map((i) => i.number)
      .sort();
    expect(numbers[0]).toMatch(/0001$/);
    expect(numbers[1]).toMatch(/0002$/);
  });
});

describe('workspace and ownership isolation', () => {
  it('rejects foreign references and viewer writes, scopes snapshots and mutations', () => {
    const { run, ctx } = fixture();
    const client = run('createClient', { name: 'Private Client' });
    expect(() => run('createDocument', { title: 'Hidden', projectId: 'p2' })).toThrow('not found');
    expect(() => run('startTimer', { projectId: 'p1', taskId: 't2' })).toThrow('not found');
    const other = { ...ctx, workspaceId: 'w2' };
    expect(extendedSnapshot(other).clients).toEqual([]);
    expect(() => extendedCommand(other, 'updateClient', { id: client.id, name: 'Stolen' })).toThrow(
      'not found',
    );
    expect(() =>
      extendedCommand({ ...ctx, role: 'viewer' }, 'createClient', { name: 'Denied' }),
    ).toThrow('read-only');
  });
  it('archives documents and blocks deletion of referenced clients', () => {
    const { run, ctx, db } = fixture();
    const client = run('createClient', { name: 'Client' });
    db.prepare('UPDATE projects SET clientId=? WHERE id=?').run(client.id, 'p1');
    expect(() => run('deleteClient', { id: client.id })).toThrow('Archive');
    const doc = run('createDocument', {
      title: 'Project brief',
      content: '# Hello',
      projectId: 'p1',
    });
    run('updateDocument', { id: doc.id, archived: true });
    expect(extendedSnapshot(ctx).documents[0].archived).toBe(true);
    run('updateDocument', { id: doc.id, archived: false, content: 'Updated' });
    expect(extendedSnapshot(ctx).documents[0].content).toBe('Updated');
  });
});

describe('persisted timers', () => {
  it('allows one active timer per user across workspaces and enforces ownership', () => {
    const { run, ctx } = fixture();
    const timer = run('startTimer', { projectId: 'p1', taskId: 't1', description: 'Focus' });
    expect(() => run('startTimer', { projectId: 'p1' })).toThrow('running timer');
    expect(() =>
      extendedCommand({ ...ctx, workspaceId: 'w2' }, 'startTimer', { projectId: 'p2' }),
    ).toThrow('running timer');
    expect(() => extendedCommand({ ...ctx, userId: 'u2' }, 'stopTimer', { id: timer.id })).toThrow(
      'person who recorded',
    );
    expect(extendedSnapshot(ctx).timeEntries[0].endedAt).toBeNull();
    ctx.db
      .prepare('UPDATE time_entries SET startedAt=? WHERE id=?')
      .run(new Date(Date.now() - 2000).toISOString(), timer.id);
    run('stopTimer', { id: timer.id });
    expect(extendedSnapshot(ctx).timeEntries[0].durationMinutes).toBeGreaterThanOrEqual(0);
    expect(() => run('stopTimer', { id: timer.id })).toThrow('already stopped');
  });
  it('rejects future, negative, and overlapping manual intervals', () => {
    const { run, ctx } = fixture();
    const start = new Date(Date.now() - 2 * 3600_000).toISOString(),
      end = new Date(Date.now() - 3600_000).toISOString();
    run('recordTime', { projectId: 'p1', description: 'Workshop', startedAt: start, endedAt: end });
    expect(extendedSnapshot(ctx).timeEntries[0].durationMinutes).toBe(60);
    expect(() => run('recordTime', { projectId: 'p1', startedAt: start, endedAt: end })).toThrow(
      'overlaps',
    );
    expect(() => run('recordTime', { projectId: 'p1', startedAt: end, endedAt: start })).toThrow(
      'after start',
    );
    expect(() =>
      run('recordTime', {
        projectId: 'p1',
        startedAt: end,
        endedAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    ).toThrow('future');
  });
});
