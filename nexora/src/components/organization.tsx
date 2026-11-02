'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Archive,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Pause,
  Play,
  Plus,
  Printer,
  Receipt,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { Client, Document, Invoice, InvoiceItem, ViewProps } from '../lib/types';
import { csvCell, downloadFile } from '../lib/export';
import { Modal } from './ui';
import s from './organization.module.css';

type Props = ViewProps & { view: string };
const money = (minor: number, currency = 'EUR') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(value.length === 10 ? value + 'T12:00:00' : value),
      )
    : 'No date';
const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const optional = (value: string) => value || null;
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'The change could not be saved. Please try again.';
const minor = (value: string) => {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};
function Empty({
  icon: Icon = FileText,
  title,
  children,
}: {
  icon?: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Header({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className={s.eyebrow}>{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}
function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className={s.error} role="alert">
      {error}
    </p>
  ) : null;
}
function Submit({
  busy,
  children = 'Save changes',
}: {
  busy: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button className="btn btn-primary" type="submit" disabled={busy}>
      {busy ? 'Saving…' : children}
    </button>
  );
}
function ProjectSelect({
  snapshot,
  defaultValue = '',
  name = 'projectId',
  required = false,
}: {
  snapshot: Props['snapshot'];
  defaultValue?: string;
  name?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      Project
      <select
        aria-label="Project"
        className="select"
        name={name}
        defaultValue={defaultValue}
        required={required}
      >
        <option value="">{required ? 'Choose a project' : 'No linked project'}</option>
        {snapshot.projects
          .filter((p) => p.status !== 'archived')
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
    </label>
  );
}

export function OrganizationView(props: Props) {
  if (props.view === 'clients')
    return <Clients key={`${props.snapshot.workspace.id}:${props.entityId || ''}`} {...props} />;
  if (props.view === 'documents')
    return <Documents key={`${props.snapshot.workspace.id}:${props.entityId || ''}`} {...props} />;
  if (props.view === 'time')
    return (
      <TimeTracking key={`${props.snapshot.workspace.id}:${props.entityId || ''}`} {...props} />
    );
  if (props.view === 'finance')
    return <Finance key={`${props.snapshot.workspace.id}:${props.entityId || ''}`} {...props} />;
  return null;
}

function Clients({ snapshot, command, navigate, entityId }: Props) {
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState<string | null>(entityId || null),
    [editing, setEditing] = useState<Client | 'new' | null>(null),
    [error, setError] = useState('');
  const readonly = snapshot.workspace.role === 'viewer';
  const clients = snapshot.clients.filter((c) =>
    `${c.name} ${c.organization} ${c.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const client = snapshot.clients.find((c) => c.id === selected);
  async function archive(c: Client) {
    try {
      setError('');
      await command('updateClient', {
        id: c.id,
        status: c.status === 'archived' ? 'active' : 'archived',
      });
    } catch (e) {
      setError(message(e));
    }
  }
  async function remove(c: Client) {
    if (!window.confirm(`Delete ${c.name}? Clients with projects or invoices cannot be deleted.`))
      return;
    try {
      await command('deleteClient', { id: c.id });
      setSelected(null);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <Header
        eyebrow="RELATIONSHIPS"
        title="Clients & contacts"
        description="The people behind your projects. Keep every connection in view."
        action={
          !readonly && (
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={16} />
              New client
            </button>
          )
        }
      />
      <ErrorText error={error} />
      <div className={s.stats}>
        <div className={s.stat}>
          <span>Active clients</span>
          <strong>{snapshot.clients.filter((c) => c.status === 'active').length}</strong>
          <Users size={20} />
        </div>
        <div className={s.stat}>
          <span>Prospective clients</span>
          <strong>{snapshot.clients.filter((c) => c.status === 'lead').length}</strong>
          <ArrowUpRight size={20} />
        </div>
        <div className={s.stat}>
          <span>Connected projects</span>
          <strong>{snapshot.projects.filter((p) => p.clientId).length}</strong>
          <Building2 size={20} />
        </div>
      </div>
      <div className={s.twoColumns}>
        <section className="panel">
          <div className={s.panelHeader}>
            <h2>
              Client directory <span className={s.count}>{clients.length}</span>
            </h2>
            <label className={s.search}>
              <Search size={15} />
              <input
                aria-label="Search clients"
                placeholder="Find a client…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {clients.length ? (
            <div className={s.directory}>
              {clients.map((c) => (
                <button
                  key={c.id}
                  className={`${s.contactRow} ${selected === c.id ? s.contactSelected : ''}`}
                  onClick={() => setSelected(c.id)}
                >
                  <span className={s.avatar}>
                    {c.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className={s.contactName}>
                    <strong>{c.name}</strong>
                    <small>{c.organization || c.email || 'Independent contact'}</small>
                  </span>
                  <span className="badge">{c.status}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <Empty icon={Users} title="Build your circle">
              Add a client to connect their projects and invoices.
            </Empty>
          )}
        </section>
        <aside className={`panel ${s.detail}`}>
          {client ? (
            <>
              <div className={s.detailLead}>
                <span className={`${s.avatar} ${s.avatarLarge}`}>
                  {client.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="badge">{client.status}</span>
              </div>
              <h2>{client.name}</h2>
              <p className="muted">{client.organization || 'Independent contact'}</p>
              <div className={s.contactMeta}>
                {client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}
                {client.website && (
                  <a href={client.website} target="_blank" rel="noopener noreferrer">
                    {client.website}
                    <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
              <p className={s.description}>{client.description || 'No notes yet.'}</p>
              <h3>Connected projects</h3>
              {snapshot.projects
                .filter((p) => p.clientId === client.id)
                .map((p) => (
                  <button
                    className={s.related}
                    key={p.id}
                    onClick={() => navigate('projects', p.id)}
                  >
                    <span>{p.name}</span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              {!snapshot.projects.some((p) => p.clientId === client.id) && (
                <p className="muted">
                  No projects connected. Associate this client when editing a project.
                </p>
              )}
              <h3>Invoices</h3>
              <p className="muted">
                {snapshot.invoices.filter((i) => i.clientId === client.id).length} invoice records
              </p>
              {!readonly && (
                <div className={s.actions}>
                  <button className="btn" onClick={() => setEditing(client)}>
                    Edit client
                  </button>
                  <button className="btn btn-quiet" onClick={() => void archive(client)}>
                    <Archive size={14} />
                    {client.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    className="btn btn-danger"
                    aria-label="Delete client"
                    onClick={() => void remove(client)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty icon={Building2} title="Every relationship, connected">
              Select a client to see contact details and related work.
            </Empty>
          )}
        </aside>
      </div>
      {editing && (
        <ClientForm
          client={editing === 'new' ? undefined : editing}
          command={command}
          close={() => setEditing(null)}
          onSaved={setSelected}
        />
      )}
    </>
  );
}
function ClientForm({
  client,
  command,
  close,
  onSaved,
}: {
  client?: Client;
  command: Props['command'];
  close: () => void;
  onSaved: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={client ? 'Edit client' : 'Create a client'} onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const fd = new FormData(e.currentTarget);
          try {
            const result = await command(client ? 'updateClient' : 'createClient', {
              ...(client ? { id: client.id } : {}),
              name: field(fd, 'name'),
              organization: field(fd, 'organization'),
              email: field(fd, 'email'),
              website: field(fd, 'website'),
              description: field(fd, 'description'),
              status: field(fd, 'status'),
            });
            onSaved(String(result.id));
            close();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Contact name
            <input
              className="input"
              name="name"
              required
              maxLength={160}
              defaultValue={client?.name}
              placeholder="e.g. Elena Moreau"
              autoFocus
            />
          </label>
          <label className="field">
            Organization
            <input
              className="input"
              name="organization"
              defaultValue={client?.organization}
              placeholder="Company or studio"
            />
          </label>
          <label className="field">
            Email
            <input
              className="input"
              type="email"
              name="email"
              defaultValue={client?.email}
              placeholder="name@company.com"
            />
          </label>
          <label className="field">
            Website
            <input
              className="input"
              type="url"
              name="website"
              defaultValue={client?.website}
              placeholder="https://example.com"
            />
          </label>
          <label className="field">
            Relationship
            <select className="select" name="status" defaultValue={client?.status || 'active'}>
              <option value="active">Active client</option>
              <option value="lead">Prospective client</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className={`field ${s.full}`}>
            Notes
            <textarea
              className="textarea"
              name="description"
              rows={4}
              defaultValue={client?.description}
            />
          </label>
        </div>
        <ErrorText error={error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>{client ? 'Save client' : 'Create client'}</Submit>
        </div>
      </form>
    </Modal>
  );
}

function Documents({ snapshot, command, entityId }: Props) {
  const [selected, setSelected] = useState<string | null>(entityId || null),
    [filter, setFilter] = useState(''),
    [archived, setArchived] = useState(false),
    [creating, setCreating] = useState(false),
    [createError, setCreateError] = useState(''),
    [createBusy, setCreateBusy] = useState(false);
  const readonly = snapshot.workspace.role === 'viewer';
  const linkedProjectId = snapshot.projects.some((p) => p.id === entityId) ? entityId : null;
  const docs = snapshot.documents.filter(
    (d) =>
      d.archived === archived &&
      (!linkedProjectId || d.projectId === linkedProjectId) &&
      d.title.toLowerCase().includes(filter.toLowerCase()),
  );
  const document = snapshot.documents.find((d) => d.id === selected);
  const canLeave = () =>
    window.dispatchEvent(new Event('nexora:before-navigate', { cancelable: true }));
  return (
    <>
      <Header
        eyebrow="KNOWLEDGE"
        title="Documents"
        description="Give your ideas a place. Connect the context to the work."
        action={
          !readonly && (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (canLeave()) {
                  setCreateError('');
                  setCreating(true);
                }
              }}
            >
              <Plus size={16} />
              New document
            </button>
          )
        }
      />
      <div className={s.documentsLayout}>
        <section className={`panel ${s.documentList}`}>
          <div className={s.panelHeader}>
            <h2>{archived ? 'Archive' : 'Workspace library'}</h2>
            <button
              className="btn btn-quiet"
              aria-label={archived ? 'Show active documents' : 'Show archived documents'}
              onClick={() => setArchived(!archived)}
            >
              <Archive size={15} />
            </button>
          </div>
          <label className={`${s.search} ${s.searchPadded}`}>
            <Search size={15} />
            <input
              aria-label="Search documents"
              value={filter}
              placeholder="Search documents…"
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          {docs.length ? (
            docs.map((d) => (
              <button
                className={`${s.documentRow} ${selected === d.id ? s.contactSelected : ''}`}
                key={d.id}
                onClick={() => {
                  if (canLeave()) setSelected(d.id);
                }}
              >
                <FileText size={18} />
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {snapshot.projects.find((p) => p.id === d.projectId)?.name ||
                      'Workspace document'}{' '}
                    · {date(d.updatedAt)}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))
          ) : (
            <Empty icon={BookOpen} title={archived ? 'Archive is clear' : 'A blank page awaits'}>
              {archived
                ? 'Archived documents appear here.'
                : 'Create a brief, decision log, or project note.'}
            </Empty>
          )}
        </section>
        <section className={`panel ${s.documentEditor}`}>
          {document ? (
            <DocumentEditor
              key={document.id}
              document={document}
              snapshot={snapshot}
              command={command}
              onDelete={() => setSelected(null)}
            />
          ) : (
            <Empty icon={BookOpen} title="Ideas become direction">
              Choose a document, or start a new one. Your notes stay linked to the project.
            </Empty>
          )}
        </section>
      </div>
      {creating && (
        <Modal title="New document" onClose={() => setCreating(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreateBusy(true);
              setCreateError('');
              const fd = new FormData(e.currentTarget);
              try {
                const result = await command('createDocument', {
                  title: field(fd, 'title'),
                  projectId: optional(field(fd, 'projectId')),
                  content: '',
                });
                setSelected(String(result.id));
                setCreating(false);
              } catch (e) {
                setCreateError(message(e));
              } finally {
                setCreateBusy(false);
              }
            }}
          >
            <label className="field">
              Title
              <input
                name="title"
                className="input"
                required
                autoFocus
                maxLength={160}
                placeholder="A new direction"
              />
            </label>
            <ProjectSelect snapshot={snapshot} defaultValue={linkedProjectId || ''} />
            <ErrorText error={createError} />
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={createBusy}>
                {createBusy ? 'Creating…' : 'Create document'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function DocumentEditor({
  document,
  snapshot,
  command,
  onDelete,
}: {
  document: Document;
  snapshot: Props['snapshot'];
  command: Props['command'];
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(document.title),
    [content, setContent] = useState(document.content),
    [projectId, setProjectId] = useState(document.projectId || ''),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const readonly = snapshot.workspace.role === 'viewer',
    dirty =
      title !== document.title ||
      content !== document.content ||
      projectId !== (document.projectId || '');
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const navigate = (e: Event) => {
      if (!window.confirm('You have unsaved document changes. Leave without saving?'))
        e.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('nexora:before-navigate', navigate);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('nexora:before-navigate', navigate);
    };
  }, [dirty]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await command('updateDocument', {
        id: document.id,
        title,
        content,
        projectId: optional(projectId),
      });
      setSaved(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeArchive() {
    if (
      dirty &&
      !window.confirm('Discard your unsaved edits and archive or restore this document?')
    )
      return;
    try {
      await command('updateDocument', { id: document.id, archived: !document.archived });
    } catch (e) {
      setError(message(e));
    }
  }
  async function remove() {
    if (!window.confirm('Permanently delete this document?')) return;
    try {
      await command('deleteDocument', { id: document.id });
      onDelete();
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <div className={s.editorToolbar}>
        <span className={s.saveState} aria-live="polite">
          {dirty ? (
            'Unsaved changes'
          ) : saved ? (
            <>
              <Check size={13} />
              Saved
            </>
          ) : (
            `Edited ${date(document.updatedAt)}`
          )}
        </span>
        <div className={s.actions}>
          <button className="btn btn-quiet" onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
          {!readonly && (
            <>
              <button
                className="btn btn-quiet"
                aria-label={document.archived ? 'Restore document' : 'Archive document'}
                onClick={() => void changeArchive()}
              >
                <Archive size={15} />
              </button>
              <button
                className="btn btn-quiet"
                aria-label="Delete document"
                onClick={() => void remove()}
              >
                <Trash2 size={15} />
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void save()}
                disabled={busy || !dirty}
              >
                <Save size={14} />
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className={s.editorBody}>
        <label className="field">
          <span className={s.srOnly}>Document title</span>
          <input
            aria-label="Document title"
            className={s.titleInput}
            value={title}
            readOnly={readonly}
            maxLength={160}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className={`field ${s.inlineProject}`}>
          Linked project
          <select
            className="select"
            value={projectId}
            disabled={readonly}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Workspace document</option>
            {snapshot.projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <ErrorText error={error} />
        {preview || readonly ? (
          <article className={s.markdown}>
            <ReactMarkdown>{content || '*This document is empty.*'}</ReactMarkdown>
          </article>
        ) : (
          <>
            <p className={s.editorHint}>
              Markdown supports headings, lists, quotes, links, and code blocks. Use Preview to
              read.
            </p>
            <textarea
              aria-label="Document content"
              className={s.contentInput}
              value={content}
              maxLength={200000}
              onChange={(e) => {
                setContent(e.target.value);
                setSaved(false);
              }}
              placeholder="Write something worth remembering…"
            />
          </>
        )}
      </div>
    </>
  );
}

function TimeTracking({ snapshot, command, entityId }: Props) {
  const [adding, setAdding] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(() => Date.now()),
    [projectFilter, setProjectFilter] = useState(
      snapshot.projects.some((p) => p.id === entityId) ? entityId! : 'all',
    );
  const readonly = snapshot.workspace.role === 'viewer',
    running = snapshot.timeEntries.find((t) => t.userId === snapshot.user.id && !t.endedAt);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const elapsed = running
    ? Math.max(0, Math.floor((tick - new Date(running.startedAt).valueOf()) / 1000))
    : 0;
  const duration = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const visibleEntries = snapshot.timeEntries.filter(
    (t) => projectFilter === 'all' || t.projectId === projectFilter,
  );
  const completed = visibleEntries.filter((t) => t.endedAt),
    minutes = completed.reduce((n, t) => n + (t.durationMinutes || 0), 0);
  async function remove(entryId: string) {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await command('deleteTime', { id: entryId });
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <Header
        eyebrow="FOCUS"
        title="Time, intentionally spent"
        description="Connect your focus to the work that matters. Timers persist across refreshes."
        action={
          !readonly && (
            <button className="btn" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add time
            </button>
          )
        }
      />
      <ErrorText error={error} />
      <div className={s.currencyRow}>
        <label>
          View project
          <select
            className="select"
            aria-label="Time project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            {snapshot.projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={s.focusLayout}>
        <section className={`panel ${s.timer}`}>
          <div className={s.timerLabel}>
            <span className={running ? s.liveDot : s.idleDot} />
            {running ? 'SESSION IN PROGRESS' : 'READY WHEN YOU ARE'}
          </div>
          <div className={s.timerDigits} aria-label={`Elapsed time ${duration}`}>
            {duration}
          </div>
          {running ? (
            <>
              <h2>{running.description || 'Focused work'}</h2>
              <p className="muted">
                {snapshot.projects.find((p) => p.id === running.projectId)?.name}
              </p>
              <button
                className="btn btn-primary"
                disabled={busy || readonly}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await command('stopTimer', { id: running.id });
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Pause size={16} />
                Stop & save session
              </button>
            </>
          ) : readonly ? (
            <p className="muted">View workspace time below.</p>
          ) : (
            <form
              className={s.timerForm}
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const fd = new FormData(e.currentTarget);
                try {
                  await command('startTimer', {
                    projectId: field(fd, 'projectId'),
                    description: field(fd, 'description'),
                    taskId: null,
                  });
                  setTick(Date.now());
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                What are you working on?
                <input
                  className="input"
                  name="description"
                  placeholder="A little clarity goes a long way"
                  maxLength={300}
                />
              </label>
              <ProjectSelect
                snapshot={snapshot}
                defaultValue={projectFilter === 'all' ? '' : projectFilter}
                required
              />
              <button className="btn btn-primary" disabled={busy || !snapshot.projects.length}>
                <Play size={16} />
                Start focus session
              </button>
              {!snapshot.projects.length && (
                <p className="muted">Create a project before recording time.</p>
              )}
            </form>
          )}
        </section>
        <section className={`panel ${s.timeSummary}`}>
          <Clock3 size={24} />
          <span className={s.eyebrow}>RECORDED WORKSPACE TIME</span>
          <strong>
            {(minutes / 60).toFixed(1)}
            <small> hrs</small>
          </strong>
          <p className="muted">
            {completed.length} completed sessions · whole minutes; exact timestamps retained
          </p>
          <div className={s.timeBars}>
            {snapshot.projects.map((p) => {
              const total = completed
                .filter((t) => t.projectId === p.id)
                .reduce((n, t) => n + (t.durationMinutes || 0), 0);
              return total ? (
                <div key={p.id}>
                  <div>
                    <span>{p.name}</span>
                    <strong>{(total / 60).toFixed(1)}h</strong>
                  </div>
                  <progress
                    max={minutes || 1}
                    value={total}
                    aria-label={`${p.name}: ${total} minutes`}
                  />
                </div>
              ) : null;
            })}
          </div>
        </section>
      </div>
      <section className={`panel ${s.section}`}>
        <div className={s.panelHeader}>
          <h2>Session history</h2>
          <span className={s.count}>{visibleEntries.length} entries</span>
        </div>
        {visibleEntries.length ? (
          <div className={s.tableScroll}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Project</th>
                  <th>Person</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>
                    <span className={s.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.description || 'Focused work'}</strong>
                      {!t.endedAt && <span className="badge">Running</span>}
                    </td>
                    <td>{snapshot.projects.find((p) => p.id === t.projectId)?.name}</td>
                    <td>{snapshot.members.find((m) => m.userId === t.userId)?.name || 'Member'}</td>
                    <td>{date(t.startedAt)}</td>
                    <td>
                      {t.endedAt
                        ? t.durationMinutes
                          ? `${t.durationMinutes} min`
                          : '<1 min'
                        : 'In progress'}
                    </td>
                    <td>
                      {!readonly && t.userId === snapshot.user.id && (
                        <button
                          className="btn btn-quiet"
                          aria-label={`Delete ${t.description || 'time entry'}`}
                          onClick={() => void remove(t.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Clock3} title="Make room for focus">
            Start a timer or add a previous session to understand where time goes.
          </Empty>
        )}
      </section>
      {adding && (
        <ManualTimeForm snapshot={snapshot} command={command} close={() => setAdding(false)} />
      )}
    </>
  );
}
function ManualTimeForm({
  snapshot,
  command,
  close,
}: Pick<Props, 'snapshot' | 'command'> & { close: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Record a work session" onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const fd = new FormData(e.currentTarget);
          try {
            await command('recordTime', {
              projectId: field(fd, 'projectId'),
              description: field(fd, 'description'),
              taskId: null,
              startedAt: new Date(field(fd, 'startedAt')).toISOString(),
              endedAt: new Date(field(fd, 'endedAt')).toISOString(),
            });
            close();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <ProjectSelect snapshot={snapshot} required />
        <label className="field">
          Description
          <input name="description" className="input" placeholder="What did you work on?" />
        </label>
        <div className="form-grid">
          <label className="field">
            Started (your local time)
            <input className="input" name="startedAt" type="datetime-local" required />
          </label>
          <label className="field">
            Ended (your local time)
            <input className="input" name="endedAt" type="datetime-local" required />
          </label>
        </div>
        <p className="muted">
          Time is stored in UTC. Overlapping and future sessions are rejected.
        </p>
        <ErrorText error={error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>Record session</Submit>
        </div>
      </form>
    </Modal>
  );
}

function Finance({ snapshot, command, navigate, entityId }: Props) {
  const [currency, setCurrency] = useState('EUR'),
    [creating, setCreating] = useState(false),
    [expense, setExpense] = useState(false),
    [selected, setSelected] = useState<string | null>(entityId || null),
    [editing, setEditing] = useState<Invoice | null>(null),
    [error, setError] = useState('');
  const readonly = snapshot.workspace.role === 'viewer',
    invoices = snapshot.invoices.filter((i) => i.currency === currency),
    expenses = snapshot.expenses.filter((e) => e.currency === currency),
    issued = invoices.filter((i) => !['draft', 'void'].includes(i.status));
  const total = issued.reduce((sum, i) => sum + i.total, 0),
    paid = issued.reduce((sum, i) => sum + i.paid, 0),
    costs = expenses.reduce((sum, e) => sum + e.amount, 0),
    invoice = snapshot.invoices.find((i) => i.id === selected);
  function exportCsv() {
    const rows = [
      [
        'Number',
        'Client',
        'Status',
        'Currency',
        'Total minor units',
        'Paid minor units',
        'Due date',
      ],
      ...invoices.map((i) => [
        i.number,
        snapshot.clients.find((c) => c.id === i.clientId)?.name || '',
        i.status,
        i.currency,
        String(i.total),
        String(i.paid),
        i.dueDate || '',
      ]),
    ];
    downloadFile(
      `nexora-invoices-${currency}.csv`,
      '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'),
      'text/csv;charset=utf-8',
    );
  }
  return (
    <>
      <Header
        eyebrow="FINANCIAL OPERATIONS"
        title="A clear financial picture"
        description="Invoices, payments, and expenses. Real records, exact arithmetic."
        action={
          <div className={s.actions}>
            <button className="btn" onClick={exportCsv}>
              <ArrowDownToLine size={15} />
              Export CSV
            </button>
            {!readonly && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus size={16} />
                New invoice
              </button>
            )}
          </div>
        }
      />
      <ErrorText error={error} />
      <div className={s.currencyRow}>
        <label>
          Reporting currency{' '}
          <select
            className="select"
            aria-label="Reporting currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>EUR</option>
            <option>USD</option>
            <option>GBP</option>
          </select>
        </label>
        <span className="muted">
          Currencies are reported separately. No exchange-rate assumptions.
        </span>
      </div>
      <div className={`${s.stats} ${s.financeStats}`}>
        <div className={s.stat}>
          <span>Issued invoices</span>
          <strong>{money(total, currency)}</strong>
          <Receipt size={19} />
        </div>
        <div className={s.stat}>
          <span>Collected</span>
          <strong>{money(paid, currency)}</strong>
          <Check size={19} />
        </div>
        <div className={s.stat}>
          <span>Outstanding</span>
          <strong>{money(total - paid, currency)}</strong>
          <Clock3 size={19} />
        </div>
        <div className={s.stat}>
          <span>Recorded expenses</span>
          <strong>{money(costs, currency)}</strong>
          <ArrowUpRight size={19} />
        </div>
      </div>
      <section className="panel">
        <div className={s.panelHeader}>
          <h2>
            Invoices <span className={s.count}>{invoices.length}</span>
          </h2>
          <span className="muted">Drafts are excluded from financial totals</span>
        </div>
        {invoices.length ? (
          <div className={s.tableScroll}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button className={s.textButton} onClick={() => setSelected(i.id)}>
                        {i.number}
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                    <td>
                      {snapshot.clients.find((c) => c.id === i.clientId)?.organization ||
                        snapshot.clients.find((c) => c.id === i.clientId)?.name}
                    </td>
                    <td>
                      <span className="badge">{i.status.replaceAll('_', ' ')}</span>
                      {i.dueDate &&
                        i.dueDate < new Date().toISOString().slice(0, 10) &&
                        ['issued', 'partially_paid'].includes(i.status) && (
                          <span className={s.overdue}>Overdue</span>
                        )}
                    </td>
                    <td>{date(i.dueDate)}</td>
                    <td>{money(i.total, i.currency)}</td>
                    <td>
                      {i.status === 'void' || i.status === 'draft'
                        ? '—'
                        : money(i.total - i.paid, i.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Receipt} title="Your next chapter, in numbers">
            Create an invoice after adding a client. Drafts remain editable until issued.
          </Empty>
        )}
      </section>
      <section className={`panel ${s.section}`}>
        <div className={s.panelHeader}>
          <h2>Expenses</h2>
          {!readonly && (
            <button className="btn" onClick={() => setExpense(true)}>
              <Plus size={14} />
              Record expense
            </button>
          )}
        </div>
        {expenses.length ? (
          <div className={s.tableScroll}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>
                    <span className={s.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.description}</td>
                    <td>
                      {snapshot.projects.find((p) => p.id === e.projectId)?.name || 'Workspace'}
                    </td>
                    <td>{date(e.date)}</td>
                    <td>{money(e.amount, e.currency)}</td>
                    <td>
                      {!readonly && (
                        <button
                          className="btn btn-quiet"
                          aria-label={`Delete ${e.description}`}
                          onClick={async () => {
                            if (!window.confirm('Delete this expense?')) return;
                            try {
                              await command('deleteExpense', { id: e.id });
                            } catch (e) {
                              setError(message(e));
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={s.blankRow}>No expenses recorded in {currency}.</p>
        )}
      </section>
      <p className={s.legalNote}>
        Operational tracking, not certified accounting software. Invoice fields and tax requirements
        depend on your jurisdiction.
      </p>
      {(creating || editing) && (
        <InvoiceForm
          invoice={editing || undefined}
          snapshot={snapshot}
          command={command}
          close={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={setSelected}
        />
      )}
      {invoice && !editing && (
        <InvoiceDetail
          invoice={invoice}
          snapshot={snapshot}
          command={command}
          navigate={navigate}
          close={() => setSelected(null)}
          edit={() => setEditing(invoice)}
        />
      )}
      {expense && (
        <ExpenseForm
          snapshot={snapshot}
          command={command}
          currency={currency}
          close={() => setExpense(false)}
        />
      )}
    </>
  );
}
function InvoiceForm({
  invoice,
  snapshot,
  command,
  close,
  onSaved,
}: {
  invoice?: Invoice;
  snapshot: Props['snapshot'];
  command: Props['command'];
  close: () => void;
  onSaved: (id: string) => void;
}) {
  const [items, setItems] = useState(
      (invoice?.items || [{ description: '', quantity: 1, unitPrice: 0 }]).map((i) => ({
        description: i.description,
        quantity: String(i.quantity),
        unitPrice: (i.unitPrice / 100).toFixed(2),
      })),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  function update(index: number, key: string, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }
  return (
    <Modal
      title={invoice ? `Edit ${invoice.number}` : 'Create a draft invoice'}
      onClose={close}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const fd = new FormData(e.currentTarget);
          try {
            const result = await command(invoice ? 'updateInvoice' : 'createInvoice', {
              ...(invoice ? { id: invoice.id } : {}),
              clientId: field(fd, 'clientId'),
              projectId: optional(field(fd, 'projectId')),
              currency: field(fd, 'currency'),
              dueDate: optional(field(fd, 'dueDate')),
              notes: field(fd, 'notes'),
              taxBasisPoints: minor(field(fd, 'tax')),
              items: items.map((i) => ({
                description: i.description,
                quantity: Number(i.quantity),
                unitPrice: minor(i.unitPrice),
              })),
            });
            onSaved(String(result.id));
            close();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Client
            <select
              className="select"
              aria-label="Client"
              name="clientId"
              required
              defaultValue={invoice?.clientId || ''}
            >
              <option value="">Choose a client</option>
              {snapshot.clients
                .filter((c) => c.status !== 'archived')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.organization || c.name}
                  </option>
                ))}
            </select>
          </label>
          <ProjectSelect snapshot={snapshot} defaultValue={invoice?.projectId || ''} />
          <label className="field">
            Currency
            <select className="select" name="currency" defaultValue={invoice?.currency || 'EUR'}>
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </label>
          <label className="field">
            Due date
            <input
              className="input"
              type="date"
              name="dueDate"
              defaultValue={invoice?.dueDate || ''}
            />
          </label>
        </div>
        <div className={s.lineItems}>
          <div className={s.lineHeader}>
            <span>Description</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span />
          </div>
          {items.map((item, index) => (
            <div className={s.lineRow} key={index}>
              <input
                aria-label={`Line ${index + 1} description`}
                className="input"
                required
                maxLength={160}
                placeholder="Service or product"
                value={item.description}
                onChange={(e) => update(index, 'description', e.target.value)}
              />
              <input
                aria-label={`Line ${index + 1} quantity`}
                className="input"
                type="number"
                required
                min={1}
                max={100000}
                step={1}
                value={item.quantity}
                onChange={(e) => update(index, 'quantity', e.target.value)}
              />
              <input
                aria-label={`Line ${index + 1} unit price`}
                className="input"
                required
                type="text"
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(e) => update(index, 'unitPrice', e.target.value)}
              />
              <button
                className="btn btn-quiet"
                type="button"
                disabled={items.length === 1}
                aria-label={`Remove line ${index + 1}`}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() =>
              setItems([...items, { description: '', quantity: '1', unitPrice: '0.00' }])
            }
            disabled={items.length >= 100}
          >
            <Plus size={14} />
            Add line
          </button>
        </div>
        <label className="field">
          Tax rate (%)
          <input
            className="input"
            name="tax"
            required
            inputMode="decimal"
            defaultValue={((invoice?.taxBasisPoints || 0) / 100).toFixed(2)}
          />
        </label>
        <label className="field">
          Notes
          <textarea
            name="notes"
            className="textarea"
            rows={3}
            defaultValue={invoice?.notes}
            placeholder="Payment terms or a note to your client"
          />
        </label>
        <p className="muted">
          Prices use two decimal places. Totals and half-up tax rounding are calculated exactly on
          the server. Issuing locks the invoice.
        </p>
        <ErrorText error={error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>{invoice ? 'Save draft' : 'Create draft'}</Submit>
        </div>
      </form>
    </Modal>
  );
}
function InvoiceDetail({
  invoice,
  snapshot,
  command,
  close,
  edit,
}: {
  invoice: Invoice;
  snapshot: Props['snapshot'];
  command: Props['command'];
  navigate: Props['navigate'];
  close: () => void;
  edit: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [paying, setPaying] = useState(false);
  const readonly = snapshot.workspace.role === 'viewer',
    client = snapshot.clients.find((c) => c.id === invoice.clientId),
    balance = invoice.status === 'void' ? 0 : invoice.total - invoice.paid;
  const frozen = (invoice as Invoice & { clientSnapshot?: string | null }).clientSnapshot;
  const billTo: { name?: string; organization?: string; email?: string } = frozen
    ? JSON.parse(frozen)
    : client || {};
  async function act(type: string, data: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      await command(type, data);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function print() {
    const escape = (v: string) =>
      v
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      setError('Allow pop-ups to open the print-ready invoice.');
      return;
    }
    popup.opener = null;
    popup.document.write(
      `<!doctype html><html><head><title>${escape(invoice.number)}</title><style>body{font:15px system-ui;color:#17202d;padding:60px;max-width:900px;margin:auto}h1{letter-spacing:-1px}header{display:flex;justify-content:space-between}table{border-collapse:collapse;width:100%;margin:36px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #ddd}.amount{text-align:right}footer{margin-top:60px;white-space:pre-wrap;color:#555}small{color:#667}</style></head><body><header><div><small>${escape(snapshot.workspace.name)}</small><h1>Invoice ${escape(invoice.number)}</h1><p>${escape(invoice.status.replaceAll('_', ' '))}</p></div><div><p>Created ${escape(date(invoice.createdAt))}</p><p>Due ${escape(date(invoice.dueDate))}</p></div></header><h3>Bill to</h3><p>${escape(billTo.organization || billTo.name || '')}<br>${escape(billTo.name || '')}<br>${escape(billTo.email || '')}</p><table><thead><tr><th>Description</th><th>Quantity</th><th class="amount">Unit price</th><th class="amount">Amount</th></tr></thead><tbody>${invoice.items.map((i) => `<tr><td>${escape(i.description)}</td><td>${i.quantity}</td><td class="amount">${escape(money(i.unitPrice, invoice.currency))}</td><td class="amount">${escape(money(i.quantity * i.unitPrice, invoice.currency))}</td></tr>`).join('')}</tbody></table><p class="amount">Subtotal ${escape(money(invoice.subtotal, invoice.currency))}</p><p class="amount">Tax (${invoice.taxBasisPoints / 100}%) ${escape(money(invoice.tax, invoice.currency))}</p><h2 class="amount">Total ${escape(money(invoice.total, invoice.currency))}</h2><p class="amount">Paid ${escape(money(invoice.paid, invoice.currency))}</p><p class="amount">Balance ${escape(money(balance, invoice.currency))}</p><footer>${escape(invoice.notes)}<p><small>Required invoice fields and tax rules vary by jurisdiction.</small></p></footer></body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }
  return (
    <Modal title={invoice.number} onClose={close} wide>
      <div className={s.invoiceHeading}>
        <div>
          <span className="badge">{invoice.status.replaceAll('_', ' ')}</span>
          <h2>{billTo.organization || billTo.name}</h2>
          <p className="muted">
            {billTo.email} · Due {date(invoice.dueDate)}
          </p>
        </div>
        <button className="btn" onClick={print}>
          <Printer size={15} />
          Print / PDF
        </button>
      </div>
      <div className={s.tableScroll}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((i: InvoiceItem, index: number) => (
              <tr key={index}>
                <td>{i.description}</td>
                <td>{i.quantity}</td>
                <td>{money(i.unitPrice, invoice.currency)}</td>
                <td>{money(i.quantity * i.unitPrice, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className={s.invoiceTotals}>
        <div>
          <dt>Subtotal</dt>
          <dd>{money(invoice.subtotal, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Tax · {invoice.taxBasisPoints / 100}%</dt>
          <dd>{money(invoice.tax, invoice.currency)}</dd>
        </div>
        <div className={s.invoiceTotal}>
          <dt>Total</dt>
          <dd>{money(invoice.total, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{money(invoice.paid, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Outstanding</dt>
          <dd>{money(balance, invoice.currency)}</dd>
        </div>
      </dl>
      <p className={s.description}>{invoice.notes}</p>
      <ErrorText error={error} />
      {!readonly && (
        <div className={s.actions}>
          {invoice.status === 'draft' && (
            <>
              <button className="btn" onClick={edit}>
                Edit draft
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void act('issueInvoice', { id: invoice.id })}
              >
                Issue invoice
              </button>
            </>
          )}
          {['issued', 'partially_paid'].includes(invoice.status) && (
            <button className="btn btn-primary" onClick={() => setPaying(!paying)}>
              Record payment
            </button>
          )}
          {['draft', 'issued'].includes(invoice.status) && (
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Void this unpaid invoice? This cannot be undone.'))
                  void act('voidInvoice', { id: invoice.id });
              }}
            >
              Void invoice
            </button>
          )}
        </div>
      )}
      {paying && (
        <form
          className={s.paymentForm}
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await act('recordPayment', { id: invoice.id, amount: minor(field(fd, 'amount')) });
              setPaying(false);
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          <label className="field">
            Payment amount ({invoice.currency})
            <input
              className="input"
              name="amount"
              inputMode="decimal"
              required
              defaultValue={((invoice.total - invoice.paid) / 100).toFixed(2)}
            />
          </label>
          <Submit busy={busy}>Save payment</Submit>
        </form>
      )}
    </Modal>
  );
}
function ExpenseForm({
  snapshot,
  command,
  currency,
  close,
}: Pick<Props, 'snapshot' | 'command'> & { currency: string; close: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Record an expense" onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const fd = new FormData(e.currentTarget);
          try {
            await command('createExpense', {
              description: field(fd, 'description'),
              amount: minor(field(fd, 'amount')),
              currency: field(fd, 'currency'),
              date: field(fd, 'date'),
              projectId: optional(field(fd, 'projectId')),
            });
            close();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Description
          <input className="input" name="description" required maxLength={160} autoFocus />
        </label>
        <div className="form-grid">
          <label className="field">
            Amount
            <input
              className="input"
              name="amount"
              required
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <label className="field">
            Currency
            <select className="select" name="currency" defaultValue={currency}>
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </label>
          <label className="field">
            Date
            <input
              className="input"
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <ProjectSelect snapshot={snapshot} />
        </div>
        <ErrorText error={error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>Record expense</Submit>
        </div>
      </form>
    </Modal>
  );
}
