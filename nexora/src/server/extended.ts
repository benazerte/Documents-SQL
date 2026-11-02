import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import type {
  Client,
  Document,
  Expense,
  Invoice,
  InvoiceItem,
  Role,
  TimeEntry,
} from '../lib/types';

export interface ExtendedContext {
  db: Database.Database;
  userId: string;
  workspaceId: string;
  role: Role;
}
const text = z.string().trim().max(5000);
const name = z.string().trim().min(1).max(160);
const id = z.string().min(1).max(100);
const nullableId = z.preprocess((v) => (v === '' || v === undefined ? null : v), id.nullable());
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date');
const nullableDate = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  dateOnly.nullable(),
);
const currency = z.enum(['EUR', 'USD', 'GBP']);
const money = z.number().int().nonnegative().max(1_000_000_000);
const clientSchema = z.object({
  name,
  organization: text.default(''),
  email: z.union([z.literal(''), z.email()]).default(''),
  website: z
    .union([
      z.literal(''),
      z.url().refine((v) => /^https?:\/\//i.test(v), 'Use an http or https URL'),
    ])
    .default(''),
  description: text.default(''),
  status: z.enum(['active', 'lead', 'archived']).default('active'),
});
const documentSchema = z.object({
  title: name,
  content: z.string().max(200_000).default(''),
  projectId: nullableId,
  archived: z.boolean().default(false),
});
const itemSchema = z.object({
  description: name,
  quantity: z.number().int().min(1).max(100_000),
  unitPrice: money,
});
const invoiceSchema = z.object({
  clientId: id,
  projectId: nullableId,
  currency: currency.default('EUR'),
  items: z.array(itemSchema).min(1).max(100),
  taxBasisPoints: z.number().int().min(0).max(10_000).default(0),
  dueDate: nullableDate,
  notes: text.default(''),
});
const expenseSchema = z.object({
  projectId: nullableId,
  description: name,
  amount: money.refine((v) => v > 0, 'Amount must be positive'),
  currency: currency.default('EUR'),
  date: dateOnly,
});
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
function now() {
  return new Date().toISOString();
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    fail(result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  return result.data;
}
function mustWrite(ctx: ExtendedContext) {
  if (ctx.role === 'viewer') fail('This workspace is read-only for your role.', 403);
}
function row(ctx: ExtendedContext, table: string, recordId: string): Record<string, unknown> {
  const allowed = [
    'clients',
    'documents',
    'time_entries',
    'invoices',
    'expenses',
    'projects',
    'tasks',
  ];
  if (!allowed.includes(table)) throw new Error('Unknown entity table');
  const value = ctx.db
    .prepare(`SELECT * FROM ${table} WHERE id = ? AND workspaceId = ?`)
    .get(recordId, ctx.workspaceId) as Record<string, unknown> | undefined;
  if (!value) fail('Record not found in this workspace.', 404);
  return value;
}
function project(ctx: ExtendedContext, projectId: string | null) {
  if (projectId) row(ctx, 'projects', projectId);
}
function taskProject(ctx: ExtendedContext, projectId: string, taskId: string | null) {
  project(ctx, projectId);
  if (taskId && row(ctx, 'tasks', taskId).projectId !== projectId)
    fail('The task must belong to the selected project.');
}
function ownTime(ctx: ExtendedContext, recordId: string) {
  const entry = row(ctx, 'time_entries', recordId);
  if (entry.userId !== ctx.userId)
    fail('Only the person who recorded this time can change it.', 403);
  return entry;
}
function overlap(ctx: ExtendedContext, startedAt: string, endedAt: string) {
  const found = ctx.db
    .prepare(
      'SELECT id FROM time_entries WHERE userId = ? AND startedAt < ? AND (endedAt IS NULL OR endedAt > ?) LIMIT 1',
    )
    .get(ctx.userId, endedAt, startedAt);
  if (found)
    fail(
      'This entry overlaps another time entry. Stop a running timer or choose a different interval.',
      409,
    );
}
function writeDocument(
  ctx: ExtendedContext,
  documentId: string,
  data: z.infer<typeof documentSchema>,
) {
  project(ctx, data.projectId);
  ctx.db
    .prepare(
      'UPDATE documents SET title=?, content=?, projectId=?, archived=?, updatedAt=? WHERE id=? AND workspaceId=?',
    )
    .run(
      data.title,
      data.content,
      data.projectId,
      Number(data.archived),
      now(),
      documentId,
      ctx.workspaceId,
    );
}

/** Calculate exact totals in integer currency minor units; half-up tax rounding. */
export function calculateInvoiceTotals(items: InvoiceItem[], taxBasisPoints: number) {
  parse(z.array(itemSchema).min(1).max(100), items);
  parse(z.number().int().min(0).max(10_000), taxBasisPoints);
  const subtotal = items.reduce(
    (sum, item) => sum + BigInt(item.quantity) * BigInt(item.unitPrice),
    0n,
  );
  const tax = (subtotal * BigInt(taxBasisPoints) + 5000n) / 10_000n;
  const total = subtotal + tax;
  if (total > 9_000_000_000_000n) fail('Invoice total exceeds the supported amount.');
  return { subtotal: Number(subtotal), tax: Number(tax), total: Number(total) };
}

export function ensureExtendedSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL, organization TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('active','lead','archived')), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS clients_workspace ON clients(workspaceId);
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', projectId TEXT REFERENCES projects(id) ON DELETE SET NULL,
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS documents_workspace ON documents(workspaceId);
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
      taskId TEXT REFERENCES tasks(id) ON DELETE SET NULL, description TEXT NOT NULL DEFAULT '', startedAt TEXT NOT NULL,
      endedAt TEXT, durationMinutes INTEGER CHECK(durationMinutes IS NULL OR durationMinutes >= 0),
      CHECK(endedAt IS NULL OR endedAt > startedAt)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_timer_per_user ON time_entries(userId) WHERE endedAt IS NULL;
    CREATE INDEX IF NOT EXISTS time_workspace ON time_entries(workspaceId, startedAt);
    CREATE TABLE IF NOT EXISTS invoice_sequences (workspaceId TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE, nextNumber INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT, projectId TEXT REFERENCES projects(id) ON DELETE SET NULL,
      number TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('EUR','USD','GBP')),
      status TEXT NOT NULL CHECK(status IN ('draft','issued','partially_paid','paid','void')),
      dueDate TEXT, taxBasisPoints INTEGER NOT NULL CHECK(taxBasisPoints BETWEEN 0 AND 10000),
      subtotal INTEGER NOT NULL CHECK(subtotal >= 0), tax INTEGER NOT NULL CHECK(tax >= 0), total INTEGER NOT NULL CHECK(total >= 0),
      paid INTEGER NOT NULL DEFAULT 0 CHECK(paid >= 0 AND paid <= total), notes TEXT NOT NULL DEFAULT '',
      clientSnapshot TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(workspaceId,number)
    );
    CREATE INDEX IF NOT EXISTS invoices_workspace ON invoices(workspaceId);
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY, invoiceId TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unitPrice INTEGER NOT NULL CHECK(unitPrice >= 0), position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, invoiceId TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, amount INTEGER NOT NULL CHECK(amount > 0), recordedBy TEXT NOT NULL REFERENCES user(id), createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      projectId TEXT REFERENCES projects(id) ON DELETE SET NULL, description TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL CHECK(currency IN ('EUR','USD','GBP')), date TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS expenses_workspace ON expenses(workspaceId);
  `);
}

export function extendedSnapshot(ctx: ExtendedContext): {
  clients: Client[];
  documents: Document[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  expenses: Expense[];
} {
  const select = (table: string) =>
    ctx.db
      .prepare(`SELECT * FROM ${table} WHERE workspaceId = ? ORDER BY createdAt DESC`)
      .all(ctx.workspaceId);
  const invoices = (select('invoices') as Omit<Invoice, 'items'>[]).map((invoice) => ({
    ...invoice,
    items: ctx.db
      .prepare(
        'SELECT description,quantity,unitPrice FROM invoice_items WHERE invoiceId = ? ORDER BY position',
      )
      .all(invoice.id) as InvoiceItem[],
  }));
  return {
    clients: select('clients') as Client[],
    documents: (select('documents') as (Omit<Document, 'archived'> & { archived: number })[]).map(
      (d) => ({ ...d, archived: !!d.archived }),
    ),
    timeEntries: ctx.db
      .prepare('SELECT * FROM time_entries WHERE workspaceId = ? ORDER BY startedAt DESC')
      .all(ctx.workspaceId) as TimeEntry[],
    invoices,
    expenses: select('expenses') as Expense[],
  };
}

export function extendedCommand(
  ctx: ExtendedContext,
  type: string,
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const supported = [
    'createClient',
    'updateClient',
    'deleteClient',
    'createDocument',
    'updateDocument',
    'deleteDocument',
    'startTimer',
    'stopTimer',
    'recordTime',
    'deleteTime',
    'createInvoice',
    'updateInvoice',
    'issueInvoice',
    'recordPayment',
    'voidInvoice',
    'createExpense',
    'deleteExpense',
  ];
  if (!supported.includes(type)) return undefined;
  mustWrite(ctx);
  const stamp = now();
  if (type === 'createClient') {
    const d = parse(clientSchema, raw),
      clientId = randomUUID();
    ctx.db
      .prepare(
        'INSERT INTO clients (id,workspaceId,name,organization,email,website,description,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        clientId,
        ctx.workspaceId,
        d.name,
        d.organization,
        d.email,
        d.website,
        d.description,
        d.status,
        stamp,
        stamp,
      );
    return { id: clientId };
  }
  if (type === 'updateClient') {
    const recordId = parse(id, raw.id);
    const old = row(ctx, 'clients', recordId);
    const d = parse(clientSchema, { ...old, ...raw });
    ctx.db
      .prepare(
        'UPDATE clients SET name=?,organization=?,email=?,website=?,description=?,status=?,updatedAt=? WHERE id=? AND workspaceId=?',
      )
      .run(
        d.name,
        d.organization,
        d.email,
        d.website,
        d.description,
        d.status,
        stamp,
        recordId,
        ctx.workspaceId,
      );
    return { id: recordId };
  }
  if (type === 'deleteClient') {
    const recordId = parse(id, raw.id);
    row(ctx, 'clients', recordId);
    if (
      ctx.db.prepare('SELECT id FROM projects WHERE clientId=? LIMIT 1').get(recordId) ||
      ctx.db.prepare('SELECT id FROM invoices WHERE clientId=? LIMIT 1').get(recordId)
    )
      fail('This client has projects or invoices. Archive it instead.', 409);
    ctx.db
      .prepare('DELETE FROM clients WHERE id=? AND workspaceId=?')
      .run(recordId, ctx.workspaceId);
    return { id: recordId };
  }
  if (type === 'createDocument') {
    const d = parse(documentSchema, raw),
      documentId = randomUUID();
    project(ctx, d.projectId);
    ctx.db
      .prepare(
        'INSERT INTO documents (id,workspaceId,title,content,projectId,archived,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        documentId,
        ctx.workspaceId,
        d.title,
        d.content,
        d.projectId,
        Number(d.archived),
        stamp,
        stamp,
      );
    return { id: documentId };
  }
  if (type === 'updateDocument') {
    const recordId = parse(id, raw.id),
      old = row(ctx, 'documents', recordId);
    const d = parse(documentSchema, { ...old, archived: !!old.archived, ...raw });
    writeDocument(ctx, recordId, d);
    return { id: recordId };
  }
  if (type === 'deleteDocument') {
    const recordId = parse(id, raw.id);
    row(ctx, 'documents', recordId);
    ctx.db
      .prepare('DELETE FROM documents WHERE id=? AND workspaceId=?')
      .run(recordId, ctx.workspaceId);
    return { id: recordId };
  }
  if (type === 'startTimer') {
    const d = parse(
      z.object({ projectId: id, taskId: nullableId, description: text.default('') }),
      raw,
    );
    taskProject(ctx, d.projectId, d.taskId);
    if (
      ctx.db
        .prepare('SELECT id FROM time_entries WHERE userId=? AND (endedAt IS NULL OR endedAt > ?)')
        .get(ctx.userId, stamp)
    )
      fail(
        'You already have a running timer or an overlapping time entry. Stop it before starting another.',
        409,
      );
    const entryId = randomUUID();
    ctx.db
      .prepare(
        'INSERT INTO time_entries (id,workspaceId,userId,projectId,taskId,description,startedAt) VALUES (?,?,?,?,?,?,?)',
      )
      .run(entryId, ctx.workspaceId, ctx.userId, d.projectId, d.taskId, d.description, stamp);
    return { id: entryId };
  }
  if (type === 'stopTimer') {
    const recordId = parse(id, raw.id),
      entry = ownTime(ctx, recordId);
    if (entry.endedAt) fail('This timer has already stopped.', 409);
    const end = stamp;
    if (end <= String(entry.startedAt))
      fail('This timer has just started. Try stopping it again in a moment.', 409);
    const duration = Math.floor(
      (new Date(end).valueOf() - new Date(String(entry.startedAt)).valueOf()) / 60000,
    );
    ctx.db
      .prepare('UPDATE time_entries SET endedAt=?,durationMinutes=? WHERE id=?')
      .run(end, duration, recordId);
    return { id: recordId };
  }
  if (type === 'recordTime') {
    const d = parse(
      z.object({
        projectId: id,
        taskId: nullableId,
        description: text.default(''),
        startedAt: z.iso.datetime({ offset: true }),
        endedAt: z.iso.datetime({ offset: true }),
      }),
      raw,
    );
    taskProject(ctx, d.projectId, d.taskId);
    const start = new Date(d.startedAt),
      end = new Date(d.endedAt);
    if (end <= start) fail('End time must be after start time.');
    if (end.valueOf() > Date.now()) fail('Time entries cannot end in the future.');
    const startIso = start.toISOString(),
      endIso = end.toISOString();
    overlap(ctx, startIso, endIso);
    const entryId = randomUUID(),
      duration = Math.floor((end.valueOf() - start.valueOf()) / 60000);
    ctx.db
      .prepare(
        'INSERT INTO time_entries (id,workspaceId,userId,projectId,taskId,description,startedAt,endedAt,durationMinutes) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(
        entryId,
        ctx.workspaceId,
        ctx.userId,
        d.projectId,
        d.taskId,
        d.description,
        startIso,
        endIso,
        duration,
      );
    return { id: entryId };
  }
  if (type === 'deleteTime') {
    const recordId = parse(id, raw.id);
    ownTime(ctx, recordId);
    ctx.db
      .prepare('DELETE FROM time_entries WHERE id=? AND workspaceId=?')
      .run(recordId, ctx.workspaceId);
    return { id: recordId };
  }
  if (type === 'createInvoice' || type === 'updateInvoice') {
    const recordId = type === 'updateInvoice' ? parse(id, raw.id) : randomUUID();
    let old: Record<string, unknown> | undefined;
    if (type === 'updateInvoice') {
      old = row(ctx, 'invoices', recordId);
      if (old.status !== 'draft')
        fail(
          'Issued invoices cannot be edited. Void an unpaid invoice and create a replacement.',
          409,
        );
    }
    const oldItems = old
      ? ctx.db
          .prepare(
            'SELECT description,quantity,unitPrice FROM invoice_items WHERE invoiceId=? ORDER BY position',
          )
          .all(recordId)
      : [];
    const d = parse(invoiceSchema, { ...old, items: oldItems, ...raw }),
      totals = calculateInvoiceTotals(d.items, d.taxBasisPoints);
    row(ctx, 'clients', d.clientId);
    project(ctx, d.projectId);
    if (type === 'createInvoice') {
      ctx.db
        .prepare('INSERT OR IGNORE INTO invoice_sequences(workspaceId,nextNumber) VALUES (?,1)')
        .run(ctx.workspaceId);
      const sequence = ctx.db
        .prepare('SELECT nextNumber FROM invoice_sequences WHERE workspaceId=?')
        .get(ctx.workspaceId) as { nextNumber: number };
      const number = `NX-${new Date().getUTCFullYear()}-${String(sequence.nextNumber).padStart(4, '0')}`;
      ctx.db
        .prepare('UPDATE invoice_sequences SET nextNumber=nextNumber+1 WHERE workspaceId=?')
        .run(ctx.workspaceId);
      ctx.db
        .prepare(
          "INSERT INTO invoices (id,workspaceId,clientId,projectId,number,currency,status,dueDate,taxBasisPoints,subtotal,tax,total,paid,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,'draft',?,?,?,?,?,0,?,?,?)",
        )
        .run(
          recordId,
          ctx.workspaceId,
          d.clientId,
          d.projectId,
          number,
          d.currency,
          d.dueDate,
          d.taxBasisPoints,
          totals.subtotal,
          totals.tax,
          totals.total,
          d.notes,
          stamp,
          stamp,
        );
    } else
      ctx.db
        .prepare(
          'UPDATE invoices SET clientId=?,projectId=?,currency=?,dueDate=?,taxBasisPoints=?,subtotal=?,tax=?,total=?,notes=?,updatedAt=? WHERE id=? AND workspaceId=?',
        )
        .run(
          d.clientId,
          d.projectId,
          d.currency,
          d.dueDate,
          d.taxBasisPoints,
          totals.subtotal,
          totals.tax,
          totals.total,
          d.notes,
          stamp,
          recordId,
          ctx.workspaceId,
        );
    ctx.db.prepare('DELETE FROM invoice_items WHERE invoiceId=?').run(recordId);
    const insert = ctx.db.prepare(
      'INSERT INTO invoice_items(id,invoiceId,description,quantity,unitPrice,position) VALUES (?,?,?,?,?,?)',
    );
    d.items.forEach((item, index) =>
      insert.run(randomUUID(), recordId, item.description, item.quantity, item.unitPrice, index),
    );
    return { id: recordId };
  }
  if (type === 'issueInvoice') {
    const recordId = parse(id, raw.id),
      invoice = row(ctx, 'invoices', recordId);
    if (invoice.status !== 'draft') fail('Only a draft invoice can be issued.', 409);
    if (Number(invoice.total) <= 0) fail('An issued invoice must have a positive total.');
    const client = row(ctx, 'clients', String(invoice.clientId));
    ctx.db
      .prepare(
        "UPDATE invoices SET status='issued',clientSnapshot=?,updatedAt=? WHERE id=? AND workspaceId=?",
      )
      .run(
        JSON.stringify({
          name: client.name,
          organization: client.organization,
          email: client.email,
        }),
        stamp,
        recordId,
        ctx.workspaceId,
      );
    return { id: recordId };
  }
  if (type === 'recordPayment') {
    const d = parse(
        z.object({ id, amount: money.refine((v) => v > 0, 'Payment must be positive') }),
        raw,
      ),
      invoice = row(ctx, 'invoices', d.id);
    if (!['issued', 'partially_paid'].includes(String(invoice.status)))
      fail('Payments require an issued, unpaid invoice.', 409);
    const paid = Number(invoice.paid) + d.amount;
    if (paid > Number(invoice.total)) fail('Payment exceeds the outstanding balance.');
    ctx.db
      .prepare(
        'INSERT INTO payments(id,invoiceId,workspaceId,amount,recordedBy,createdAt) VALUES (?,?,?,?,?,?)',
      )
      .run(randomUUID(), d.id, ctx.workspaceId, d.amount, ctx.userId, stamp);
    ctx.db
      .prepare('UPDATE invoices SET paid=?,status=?,updatedAt=? WHERE id=? AND workspaceId=?')
      .run(paid, paid === invoice.total ? 'paid' : 'partially_paid', stamp, d.id, ctx.workspaceId);
    return { id: d.id };
  }
  if (type === 'voidInvoice') {
    const recordId = parse(id, raw.id),
      invoice = row(ctx, 'invoices', recordId);
    if (!['draft', 'issued'].includes(String(invoice.status)) || Number(invoice.paid) > 0)
      fail('Only an unpaid draft or issued invoice can be voided.', 409);
    ctx.db.prepare("UPDATE invoices SET status='void',updatedAt=? WHERE id=?").run(stamp, recordId);
    return { id: recordId };
  }
  if (type === 'createExpense') {
    const d = parse(expenseSchema, raw);
    project(ctx, d.projectId);
    const recordId = randomUUID();
    ctx.db
      .prepare(
        'INSERT INTO expenses(id,workspaceId,projectId,description,amount,currency,date,createdAt) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        recordId,
        ctx.workspaceId,
        d.projectId,
        d.description,
        d.amount,
        d.currency,
        d.date,
        stamp,
      );
    return { id: recordId };
  }
  if (type === 'deleteExpense') {
    const recordId = parse(id, raw.id);
    row(ctx, 'expenses', recordId);
    ctx.db
      .prepare('DELETE FROM expenses WHERE id=? AND workspaceId=?')
      .run(recordId, ctx.workspaceId);
    return { id: recordId };
  }
  return undefined;
}

export function seedExtendedDemo(ctx: ExtendedContext, projectIds: string[]) {
  const client = extendedCommand(ctx, 'createClient', {
    name: 'Elena Moreau',
    organization: 'Forma Studio',
    email: 'elena@example.com',
    website: '',
    description: 'Fictional client for this sample workspace.',
    status: 'active',
  })!;
  const clientId = String(client.id);
  if (projectIds[0])
    ctx.db
      .prepare('UPDATE projects SET clientId=? WHERE id=? AND workspaceId=?')
      .run(clientId, projectIds[0], ctx.workspaceId);
  extendedCommand(ctx, 'createDocument', {
    title: 'Project north star',
    content:
      '# A clearer connected workspace\n\nThis is fictional sample content. Replace it with your own project brief.\n\n## Outcomes\n- Align the team around a shared goal\n- Make dependencies visible\n- Ship a focused, useful first release\n\n> Clarity is a design decision.\n',
    projectId: projectIds[0] ?? null,
  });
  if (projectIds[0]) {
    let end = new Date(Date.now() - 86_400_000);
    // Find a genuinely free historical interval; repeat demo creation never overlaps user work.
    while (
      ctx.db
        .prepare(
          'SELECT id FROM time_entries WHERE userId=? AND startedAt<? AND (endedAt IS NULL OR endedAt>?) LIMIT 1',
        )
        .get(ctx.userId, end.toISOString(), new Date(end.valueOf() - 90 * 60_000).toISOString())
    )
      end = new Date(end.valueOf() - 86_400_000);
    const start = new Date(end.valueOf() - 90 * 60_000);
    extendedCommand(ctx, 'recordTime', {
      projectId: projectIds[0],
      description: 'Sample discovery workshop',
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
    });
    extendedCommand(ctx, 'createExpense', {
      projectId: projectIds[0],
      description: 'Sample research materials',
      amount: 4500,
      currency: 'EUR',
      date: end.toISOString().slice(0, 10),
    });
    extendedCommand(ctx, 'createInvoice', {
      clientId,
      projectId: projectIds[0],
      currency: 'EUR',
      items: [{ description: 'Sample discovery sprint', quantity: 1, unitPrice: 125000 }],
      taxBasisPoints: 2000,
      dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      notes: 'Fictional sample invoice. Not for external use.',
    });
  }
}
