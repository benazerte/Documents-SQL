'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { Project, Snapshot, Task, ViewProps } from '@/lib/types';
import { authClient } from './auth-screen';
import { projectHealth } from '@/server/domain';
import { csvCell, downloadFile, exportWorkspace, tasksCsv } from '@/lib/export';
import {
  DateLabel,
  EmptyState,
  ErrorMessage,
  Field,
  Modal,
  Priority,
  Status,
  SuccessMessage,
  priorityLabels,
  progress,
  statusLabels,
  statuses,
  today,
} from './ui';

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}
function formData(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}
function editable(s: Snapshot) {
  return s.workspace.role !== 'viewer';
}
export function ProjectForm({
  snapshot,
  command,
  project,
  onClose,
  onSaved,
}: ViewProps & { project?: Project; onClose: () => void; onSaved: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = await command(project ? 'updateProject' : 'createProject', {
        ...data,
        ...(project ? { id: project.id } : {}),
        clientId: data.clientId || null,
        ownerId: data.ownerId || null,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
      });
      onSaved(String(result.id ?? project?.id));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={project ? 'Edit project' : 'Create project'} onClose={onClose}>
      <form onSubmit={submit} className="stack-form">
        <Field label="Project name">
          <input
            className="input"
            name="name"
            autoFocus
            required
            maxLength={160}
            defaultValue={project?.name}
            placeholder="What are we building?"
          />
        </Field>
        <Field label="Description">
          <textarea
            className="textarea"
            name="description"
            maxLength={10000}
            defaultValue={project?.description}
            placeholder="A little context goes a long way."
            rows={3}
          />
        </Field>
        <div className="form-grid">
          <Field label="Project status">
            <select className="select" name="status" defaultValue={project?.status ?? 'active'}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Priority">
            <select className="select" name="priority" defaultValue={project?.priority ?? 'medium'}>
              {Object.entries(priorityLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              className="input"
              type="date"
              name="startDate"
              defaultValue={project?.startDate ?? ''}
            />
          </Field>
          <Field label="Target date">
            <input
              className="input"
              type="date"
              name="dueDate"
              defaultValue={project?.dueDate ?? ''}
            />
          </Field>
          <Field label="Client">
            <select className="select" name="clientId" defaultValue={project?.clientId ?? ''}>
              <option value="">No client</option>
              {snapshot.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project owner">
            <select
              className="select"
              name="ownerId"
              defaultValue={project?.ownerId ?? snapshot.user.id}
            >
              <option value="">Unassigned</option>
              {snapshot.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : project ? 'Save project' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TaskForm({
  snapshot,
  command,
  task,
  projectId,
  onClose,
  onSaved,
}: ViewProps & {
  task?: Task;
  projectId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = await command(task ? 'updateTask' : 'createTask', {
        ...data,
        ...(task ? { id: task.id } : {}),
        dueDate: data.dueDate || null,
        startDate: data.startDate || null,
        assigneeId: data.assigneeId || null,
        parentId: data.parentId || null,
        estimateMinutes: Number(data.estimateMinutes || 0),
      });
      onSaved(String(result.id ?? task?.id));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!snapshot.projects.length)
    return (
      <Modal title="Create a project first" onClose={onClose}>
        <EmptyState
          title="Work needs a home."
          detail="Create your first project, then add tasks to it."
          action={
            <button className="btn btn-primary" onClick={onClose}>
              Got it
            </button>
          }
        />
      </Modal>
    );
  return (
    <Modal title={task ? 'Edit task' : 'Create task'} onClose={onClose}>
      <form onSubmit={submit} className="stack-form">
        <Field label="Task title">
          <input
            className="input"
            name="title"
            autoFocus
            required
            maxLength={200}
            defaultValue={task?.title}
            placeholder="What needs to happen?"
          />
        </Field>
        <Field label="Project">
          <select
            className="select"
            name="projectId"
            defaultValue={task?.projectId ?? projectId ?? snapshot.projects[0]?.id}
            required
          >
            {snapshot.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            className="textarea"
            name="description"
            rows={3}
            maxLength={10000}
            defaultValue={task?.description}
            placeholder="Add details, context, or acceptance criteria."
          />
        </Field>
        <div className="form-grid">
          <Field label="Task status">
            <select className="select" name="status" defaultValue={task?.status ?? 'todo'}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Task priority">
            <select className="select" name="priority" defaultValue={task?.priority ?? 'medium'}>
              {Object.entries(priorityLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              className="input"
              name="startDate"
              type="date"
              defaultValue={task?.startDate ?? ''}
            />
          </Field>
          <Field label="Due date">
            <input
              className="input"
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ''}
            />
          </Field>
          <Field label="Assignee">
            <select className="select" name="assigneeId" defaultValue={task?.assigneeId ?? ''}>
              <option value="">Unassigned</option>
              {snapshot.members.map((m) => (
                <option value={m.userId} key={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estimate (minutes)">
            <input
              className="input"
              name="estimateMinutes"
              type="number"
              min={0}
              max={1000000}
              defaultValue={task?.estimateMinutes ?? 0}
            />
          </Field>
          <Field label="Parent task">
            <select className="select" name="parentId" defaultValue={task?.parentId ?? ''}>
              <option value="">No parent task</option>
              {snapshot.tasks
                .filter((t) => t.id !== task?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : task ? 'Save task' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TaskInspector({
  snapshot,
  command,
  navigate,
  task,
  onClose,
  onEdit,
}: ViewProps & { task: Task; onClose: () => void; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dependency, setDependency] = useState('');
  const project = snapshot.projects.find((p) => p.id === task.projectId);
  const dependencies = snapshot.dependencies.filter((d) => d.taskId === task.id);
  const comments = snapshot.comments.filter((c) => c.taskId === task.id);
  async function run(type: string, data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await command(type, data);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="inspector-meta">
        <button
          className="text-btn"
          onClick={() => {
            onClose();
            navigate('projects', task.projectId);
          }}
        >
          <FolderKanban size={14} />
          {project?.name}
        </button>
        <Priority value={task.priority} />
        <span className="mono muted">{task.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <p className="task-description">{task.description || 'No description added.'}</p>
      <div className="inspector-properties">
        <Field label="Status">
          <select
            className="select"
            aria-label="Change task status"
            value={task.status}
            disabled={!editable(snapshot) || busy}
            onChange={(e) => void run('updateTask', { id: task.id, status: e.target.value })}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <span className="property-label">DUE DATE</span>
          <p>
            <DateLabel value={task.dueDate} />
          </p>
        </div>
        <div>
          <span className="property-label">ASSIGNEE</span>
          <p>{snapshot.members.find((m) => m.userId === task.assigneeId)?.name ?? 'Unassigned'}</p>
        </div>
      </div>
      <ErrorMessage error={error} />
      <section className="inspector-section">
        <h3>
          <GitBranch size={16} /> Dependencies <span className="count">{dependencies.length}</span>
        </h3>
        <p className="muted small">This task can be completed once its prerequisites are done.</p>
        {dependencies.map((d) => {
          const t = snapshot.tasks.find((t) => t.id === d.dependsOnId);
          return (
            <div className="dependency-row" key={d.id}>
              <button className="text-btn" onClick={() => navigate('tasks', d.dependsOnId)}>
                {t?.title ?? 'Task'}
              </button>
              <Status value={t?.status ?? 'todo'} />
              {editable(snapshot) && (
                <button
                  className="icon-btn"
                  aria-label={`Remove dependency ${t?.title}`}
                  disabled={busy}
                  onClick={() => void run('removeDependency', { id: d.id })}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
        {editable(snapshot) && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run('createDependency', { taskId: task.id, dependsOnId: dependency }).then(
                (ok) => {
                  if (ok) setDependency('');
                },
              );
            }}
          >
            <select
              className="select"
              aria-label="Depends on task"
              value={dependency}
              onChange={(e) => setDependency(e.target.value)}
              required
            >
              <option value="">Choose prerequisite…</option>
              {snapshot.tasks
                .filter(
                  (t) => t.id !== task.id && !dependencies.some((d) => d.dependsOnId === t.id),
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
            <button className="btn" disabled={!dependency || busy}>
              <Plus size={14} />
              Add dependency
            </button>
          </form>
        )}
      </section>
      <section className="inspector-section">
        <h3>
          <MessageSquare size={16} /> Conversation <span className="count">{comments.length}</span>
        </h3>
        {comments.map((c) => (
          <article className="comment" key={c.id}>
            <div>
              <strong>{c.authorName}</strong>
              <time>{new Date(c.createdAt).toLocaleString()}</time>
            </div>
            <p>{c.content}</p>
          </article>
        ))}
        {!comments.length && (
          <p className="muted small">Keep decisions and context close to the work.</p>
        )}
        {editable(snapshot) && (
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const content = new FormData(form).get('content');
              void run('addComment', { taskId: task.id, content }).then((ok) => {
                if (ok) form.reset();
              });
            }}
          >
            <textarea
              className="textarea"
              name="content"
              aria-label="Comment"
              rows={2}
              maxLength={5000}
              placeholder="Add a comment…"
              required
            />
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                Post comment
              </button>
            </div>
          </form>
        )}
      </section>
      <div className="form-actions">
        {editable(snapshot) && (
          <>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Delete this task and its dependencies?'))
                  void run('deleteTask', { id: task.id }).then((ok) => {
                    if (ok) onClose();
                  });
              }}
            >
              <Trash2 size={14} />
              Delete task
            </button>
            <button className="btn btn-primary" onClick={onEdit}>
              Edit task
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function Overview({ snapshot: s, navigate }: ViewProps) {
  const todayDate = today();
  const active = s.projects.filter((p) => p.status === 'active');
  const open = s.tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.dueDate && t.dueDate < todayDate);
  const completed = s.tasks.filter((t) => t.status === 'done');
  const attention = [...open]
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .slice(0, 5);
  const tracked = s.timeEntries.reduce((n, t) => n + (t.durationMinutes ?? 0), 0);
  const pct = progress(s.tasks);
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <>
      <div className="overview-heading">
        <div>
          <span className="eyebrow">YOUR WORK, IN PERSPECTIVE</span>
          <h1>
            Good{' '}
            {new Date().getHours() < 12
              ? 'morning'
              : new Date().getHours() < 18
                ? 'afternoon'
                : 'evening'}
            , {s.user.name.split(' ')[0]}
            <span className="accent">.</span>
          </h1>
          <p>Here’s where things stand. Let’s move something forward.</p>
        </div>
        <span className="date-chip">
          <CalendarDays size={15} />
          {date}
        </span>
      </div>
      <div className="metric-grid">
        {[
          {
            label: 'Active projects',
            value: active.length,
            unit: 'projects in motion',
            icon: FolderKanban,
            view: 'projects',
            id: undefined,
          },
          {
            label: 'Open tasks',
            value: open.length,
            unit: `${completed.length} completed across your workspace`,
            icon: Circle,
            view: 'tasks',
            id: 'filter:open',
          },
          {
            label: 'Need attention',
            value: overdue.length,
            unit: 'tasks past their due date',
            icon: Clock3,
            view: 'tasks',
            id: 'filter:overdue',
          },
          {
            label: 'Time invested',
            value: (tracked / 60).toFixed(1),
            unit: 'hours recorded',
            icon: Clock3,
            view: 'time',
            id: undefined,
          },
        ].map((m, i) => (
          <button
            className={`metric-card metric-${i}`}
            key={m.label}
            onClick={() => navigate(m.view, m.id)}
          >
            <span className="metric-label">
              {m.label}
              <m.icon size={16} />
            </span>
            <strong>
              {m.value}
              <ArrowUpRight size={18} />
            </strong>
            <span className="metric-foot">{m.unit}</span>
          </button>
        ))}
      </div>
      <div className="dashboard-main">
        <section className="panel dashboard-projects">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MOMENTUM</span>
              <h2>
                Projects in motion <span className="count">{active.length}</span>
              </h2>
            </div>
            <button className="text-btn" onClick={() => navigate('projects')}>
              All projects <ArrowRight size={14} />
            </button>
          </div>
          {active.length ? (
            <div className="project-lines">
              {active.slice(0, 4).map((p, i) => {
                const tasks = s.tasks.filter((t) => t.projectId === p.id);
                const percent = progress(tasks);
                return (
                  <button
                    className="project-line"
                    key={p.id}
                    onClick={() => navigate('projects', p.id)}
                  >
                    <span className={`project-symbol symbol-${i % 4}`}>
                      <FolderKanban size={18} />
                    </span>
                    <span className="project-line-name">
                      <strong>{p.name}</strong>
                      <span>
                        {s.clients.find((c) => c.id === p.clientId)?.name || 'Internal project'} ·{' '}
                        {tasks.length} tasks
                      </span>
                    </span>
                    <span className="project-line-progress">
                      <span>{percent}%</span>
                      <span className="progress-track">
                        <i style={{ width: `${percent}%` }} />
                      </span>
                    </span>
                    <span className="project-line-date">
                      <DateLabel value={p.dueDate} />
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Start something great."
              detail="Your active projects will appear here, with progress calculated from real tasks."
              action={
                <button className="btn btn-primary" onClick={() => navigate('projects', 'new')}>
                  <Plus size={14} />
                  Create project
                </button>
              }
            />
          )}
        </section>
        <section className="panel completion-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE BIG PICTURE</span>
              <h2>Workload balance</h2>
            </div>
          </div>
          <div
            className="donut"
            role="img"
            aria-label={`${pct}% of ${s.tasks.length} tasks completed`}
            style={{
              background: `conic-gradient(var(--accent) 0% ${pct}%, var(--border) ${pct}% 100%)`,
            }}
          >
            <div>
              <strong>
                {pct}
                <small>%</small>
              </strong>
              <span>COMPLETED</span>
            </div>
          </div>
          <div className="donut-legend">
            <span>
              <i className="legend-dot" />
              Done<strong>{completed.length}</strong>
            </span>
            <span>
              <i className="legend-dot muted-dot" />
              Remaining<strong>{open.length}</strong>
            </span>
          </div>
        </section>
        <section className="panel action-center">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WHAT’S NEXT</span>
              <h2>Your action center</h2>
            </div>
            <button className="text-btn" onClick={() => navigate('tasks')}>
              View tasks <ArrowRight size={14} />
            </button>
          </div>
          {attention.length ? (
            attention.map((t) => (
              <button className="action-row" key={t.id} onClick={() => navigate('tasks', t.id)}>
                <span className={`task-status-dot dot-${t.status}`}>
                  <Circle size={16} />
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <small>{s.projects.find((p) => p.id === t.projectId)?.name}</small>
                </span>
                <Priority value={t.priority} />
                <span className={t.dueDate && t.dueDate < todayDate ? 'overdue' : 'muted'}>
                  <DateLabel value={t.dueDate} />
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <EmptyState
              title="A little breathing room."
              detail="No open tasks. Create your next priority when you’re ready."
            />
          )}
        </section>
        <section className="panel activity-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WORK IN REAL TIME</span>
              <h2>Recent activity</h2>
            </div>
            <span className="live-dot">LIVE RECORDS</span>
          </div>
          {s.activity.length ? (
            <div className="activity-feed">
              {s.activity.slice(0, 5).map((a, i) => (
                <div className="activity-item" key={a.id}>
                  <span className={`activity-icon ${i === 0 ? 'activity-new' : ''}`}>
                    <Check size={12} />
                  </span>
                  <div>
                    <p>
                      <strong>{a.actorName}</strong> {a.action}
                    </p>
                    <time>
                      {new Date(a.createdAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted activity-empty">
              Your workspace story starts with your first action.
            </p>
          )}
        </section>
      </div>
      <div className="overview-footer">
        <GitBranch size={14} />
        <span>Everything connected. Nothing overlooked.</span>
        <button className="text-btn" onClick={() => navigate('graph')}>
          Explore your visual workspace <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

function TaskTable({
  tasks,
  snapshot,
  command,
  navigate,
  onAdd,
  board = false,
}: ViewProps & { tasks: Task[]; onAdd: () => void; board?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function status(id: string, status: string) {
    setError(null);
    try {
      await command('updateTask', { id, status });
    } catch (e) {
      setError(message(e));
    }
  }
  if (!tasks.length)
    return (
      <EmptyState
        title="Clear the way for good work."
        detail="Add a task, or adjust your filters to see more work."
        action={
          editable(snapshot) ? (
            <button className="btn btn-primary" onClick={onAdd}>
              <Plus size={14} />
              Create task
            </button>
          ) : undefined
        }
      />
    );
  if (board)
    return (
      <>
        <ErrorMessage error={error} />
        <div className="kanban">
          {statuses.map((state) => (
            <section
              className="kanban-column"
              key={state}
              onDragOver={(e) => {
                if (editable(snapshot)) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/task-id');
                if (id && tasks.some((t) => t.id === id)) void status(id, state);
              }}
            >
              <div className="kanban-heading">
                <span>
                  <i className={`column-dot dot-${state}`} />
                  {statusLabels[state]}
                </span>
                <span className="count">{tasks.filter((t) => t.status === state).length}</span>
              </div>
              {tasks
                .filter((t) => t.status === state)
                .map((t) => (
                  <article
                    className="kanban-card"
                    key={t.id}
                    draggable={editable(snapshot)}
                    onDragStart={(e) => e.dataTransfer.setData('text/task-id', t.id)}
                  >
                    <span className="eyebrow">
                      {snapshot.projects.find((p) => p.id === t.projectId)?.name}
                    </span>
                    <button className="task-card-title" onClick={() => navigate('tasks', t.id)}>
                      {t.title}
                    </button>
                    <Priority value={t.priority} />
                    <div className="kanban-card-footer">
                      <span>
                        <CalendarDays size={12} />
                        <DateLabel value={t.dueDate} />
                      </span>
                      <select
                        aria-label={`Status for ${t.title}`}
                        value={t.status}
                        disabled={!editable(snapshot)}
                        onChange={(e) => void status(t.id, e.target.value)}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabels[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
            </section>
          ))}
        </div>
      </>
    );
  return (
    <>
      <ErrorMessage error={error} />
      <div className="table-scroll">
        <table className="data-table task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Project</th>
              <th>Due date</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <button className="table-title" onClick={() => navigate('tasks', t.id)}>
                    <span className={`task-status-dot dot-${t.status}`}>
                      {t.status === 'done' ? <Check size={15} /> : <Circle size={15} />}
                    </span>
                    {t.title}
                  </button>
                </td>
                <td>
                  <select
                    className={`inline-select status-${t.status}`}
                    aria-label={`Status for ${t.title}`}
                    value={t.status}
                    disabled={!editable(snapshot)}
                    onChange={(e) => void status(t.id, e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Priority value={t.priority} />
                </td>
                <td>
                  <button
                    className="text-btn muted small"
                    onClick={() => navigate('projects', t.projectId)}
                  >
                    {snapshot.projects.find((p) => p.id === t.projectId)?.name}
                  </button>
                </td>
                <td
                  className={
                    t.dueDate && t.dueDate < today() && t.status !== 'done' ? 'overdue' : ''
                  }
                >
                  <DateLabel value={t.dueDate} />
                </td>
                <td>
                  {snapshot.members.find((m) => m.userId === t.assigneeId)?.name ?? (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CoreViews(props: ViewProps & { view: string; entityId?: string }) {
  const { snapshot: s, command, navigate, view, entityId } = props;
  const [projectForm, setProjectForm] = useState<Project | 'new' | null>(null);
  const [taskForm, setTaskForm] = useState<Task | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [board, setBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProject = s.projects.find((p) => p.id === entityId);
  const selectedTask = s.tasks.find((t) => t.id === entityId);
  const tasks = useMemo(
    () =>
      s.tasks
        .filter(
          (t) =>
            (!selectedProject || t.projectId === selectedProject.id) &&
            (projectFilter === 'all' || t.projectId === projectFilter) &&
            (statusFilter === 'all' || t.status === statusFilter) &&
            (!query || t.title.toLowerCase().includes(query.toLowerCase())) &&
            (entityId !== 'filter:overdue' ||
              (t.dueDate && t.dueDate < today() && t.status !== 'done')) &&
            (entityId !== 'filter:open' || t.status !== 'done'),
        )
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
    [s.tasks, selectedProject, projectFilter, statusFilter, query, entityId],
  );
  async function projectAction(type: string, data: Record<string, unknown>) {
    setError(null);
    try {
      await command(type, data);
      if (type === 'deleteProject') navigate('projects');
    } catch (e) {
      setError(message(e));
    }
  }
  const taskActions = (
    <div className="view-tools">
      <div className="search-field">
        <Search size={15} />
        <input
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <select
        className="select compact-select"
        aria-label="Filter task status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="all">All statuses</option>
        {statuses.map((x) => (
          <option key={x} value={x}>
            {statusLabels[x]}
          </option>
        ))}
      </select>
      {!selectedProject && (
        <button
          className="btn"
          onClick={() =>
            downloadFile('nexora-tasks.csv', tasksCsv({ ...s, tasks }), 'text/csv;charset=utf-8')
          }
        >
          Export CSV
        </button>
      )}
      {!selectedProject && (
        <select
          className="select compact-select"
          aria-label="Filter project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          {s.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <div className="segmented">
        <button
          className={!board ? 'selected' : ''}
          aria-label="List view"
          aria-pressed={!board}
          onClick={() => setBoard(false)}
        >
          <List size={16} />
        </button>
        <button
          className={board ? 'selected' : ''}
          aria-label="Board view"
          aria-pressed={board}
          onClick={() => setBoard(true)}
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
  return (
    <>
      {view === 'overview' ? (
        <Overview {...props} />
      ) : view === 'calendar' ? (
        <CalendarView {...props} />
      ) : view === 'analytics' ? (
        <AnalyticsView {...props} />
      ) : view === 'settings' ? (
        <SettingsView {...props} />
      ) : (
        <>
          <div className="page-header">
            <div>
              {selectedProject && (
                <button className="text-btn breadcrumb" onClick={() => navigate('projects')}>
                  <ChevronLeft size={13} />
                  All projects
                </button>
              )}
              <span className="eyebrow">
                {view === 'tasks' ? 'MAKE THE NEXT MOVE' : 'IDEAS INTO IMPACT'}
              </span>
              <h1 className="page-title">
                {selectedProject?.name ?? (view === 'tasks' ? 'Tasks' : 'Projects')}
                <span className="accent">.</span>
              </h1>
              <p className="page-subtitle">
                {selectedProject?.description ||
                  (view === 'tasks'
                    ? 'Find your focus. Keep the important things moving.'
                    : 'A shared direction for everything you’re building.')}
              </p>
            </div>
            <div className="header-actions">
              {selectedProject && editable(s) && (
                <>
                  <button className="btn" onClick={() => setProjectForm(selectedProject)}>
                    Edit project
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={
                      selectedProject.status === 'archived' ? 'Restore project' : 'Archive project'
                    }
                    onClick={() =>
                      void projectAction('updateProject', {
                        id: selectedProject.id,
                        status: selectedProject.status === 'archived' ? 'active' : 'archived',
                      })
                    }
                  >
                    <FolderKanban size={17} />
                  </button>
                </>
              )}
              {editable(s) && (
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    view === 'projects' && !selectedProject
                      ? setProjectForm('new')
                      : setTaskForm('new')
                  }
                >
                  <Plus size={16} />
                  {view === 'projects' && !selectedProject ? 'Create project' : 'Create task'}
                </button>
              )}
            </div>
          </div>
          <ErrorMessage error={error} />
          {view === 'projects' && !selectedProject ? (
            <>
              <div className="view-tools">
                <div className="search-field">
                  <Search size={15} />
                  <input
                    aria-label="Search projects"
                    placeholder="Search projects…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <span className="muted small">
                  {s.projects.length} projects ·{' '}
                  {s.projects.filter((p) => p.status === 'active').length} active
                </span>
              </div>
              <div className="projects-grid">
                {s.projects
                  .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
                  .map((p, i) => {
                    const ts = s.tasks.filter((t) => t.projectId === p.id);
                    const pct = progress(ts);
                    const overdue = ts.filter(
                      (t) => t.status !== 'done' && t.dueDate && t.dueDate < today(),
                    ).length;
                    const health = projectHealth(p, ts, today());
                    return (
                      <article className="panel project-card" key={p.id}>
                        <div className="project-card-top">
                          <span className={`project-symbol symbol-${i % 4}`}>
                            <FolderKanban size={20} />
                          </span>
                          <Status value={p.status} />
                        </div>
                        <button
                          className="project-card-name"
                          onClick={() => navigate('projects', p.id)}
                        >
                          {p.name}
                          <ArrowUpRight size={18} />
                        </button>
                        <p>{p.description || 'A new direction, ready to take shape.'}</p>
                        <div className="project-card-client">
                          {s.clients.find((c) => c.id === p.clientId)?.name || 'Internal project'}
                          <Priority value={p.priority} />
                        </div>
                        <div className="project-card-progress">
                          <span>
                            {ts.filter((t) => t.status === 'done').length} / {ts.length} tasks
                            complete
                          </span>
                          <strong>{pct}%</strong>
                        </div>
                        <div className="progress-track">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                        <footer>
                          <span className={health === 'at_risk' ? 'overdue' : 'muted'}>
                            {health === 'complete'
                              ? 'Complete'
                              : overdue
                                ? `${overdue} overdue`
                                : health === 'at_risk'
                                  ? 'At risk'
                                  : health === 'attention'
                                    ? 'Needs attention'
                                    : ts.length
                                      ? 'On track'
                                      : 'Not started'}
                          </span>
                          <span>
                            <CalendarDays size={13} />
                            <DateLabel value={p.dueDate} />
                          </span>
                        </footer>
                      </article>
                    );
                  })}
              </div>
              {!s.projects.length && (
                <div className="panel">
                  <EmptyState
                    title="Your next big thing starts here."
                    detail="Create a project, break it into tasks, and watch the connections take shape."
                    action={
                      <button className="btn btn-primary" onClick={() => setProjectForm('new')}>
                        Create project
                      </button>
                    }
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {selectedProject && (
                <>
                  <div className="project-detail-metrics">
                    <div>
                      <span>PROGRESS</span>
                      <strong>{progress(tasks)}%</strong>
                    </div>
                    <div>
                      <span>TOTAL TASKS</span>
                      <strong>{tasks.length}</strong>
                    </div>
                    <div>
                      <span>TARGET DATE</span>
                      <strong className="date-value">
                        <DateLabel value={selectedProject.dueDate} />
                      </strong>
                    </div>
                    <div>
                      <span>STATUS</span>
                      <Status value={selectedProject.status} />
                    </div>
                  </div>
                  <div className="project-detail-nav">
                    <strong>Work overview</strong>
                    <button
                      className="text-btn"
                      onClick={() => navigate('graph', selectedProject.id)}
                    >
                      <GitBranch size={14} />
                      Visual workspace
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => navigate('documents', selectedProject.id)}
                    >
                      Related documents
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => navigate('time', selectedProject.id)}
                    >
                      Tracked time
                    </button>
                    {editable(s) && (
                      <button
                        className="text-btn danger"
                        onClick={() => {
                          if (
                            confirm(
                              'Delete this project? Projects with related records must be cleared first.',
                            )
                          )
                            void projectAction('deleteProject', { id: selectedProject.id });
                        }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
              {taskActions}
              <div className={board ? '' : 'panel'}>
                <TaskTable
                  {...props}
                  tasks={tasks}
                  board={board}
                  onAdd={() => setTaskForm('new')}
                />
              </div>
            </>
          )}
        </>
      )}
      {(projectForm || (view === 'projects' && entityId === 'new')) && (
        <ProjectForm
          {...props}
          project={projectForm && projectForm !== 'new' ? projectForm : undefined}
          onClose={() => {
            setProjectForm(null);
            if (entityId === 'new') navigate('projects');
          }}
          onSaved={(id) => {
            setProjectForm(null);
            navigate('projects', id);
          }}
        />
      )}
      {(taskForm || (view === 'tasks' && entityId === 'new')) && (
        <TaskForm
          {...props}
          task={taskForm && taskForm !== 'new' ? taskForm : undefined}
          projectId={selectedProject?.id}
          onClose={() => {
            setTaskForm(null);
            if (entityId === 'new') navigate('tasks');
          }}
          onSaved={(id) => {
            setTaskForm(null);
            navigate('tasks', id);
          }}
        />
      )}
      {selectedTask && !taskForm && (
        <TaskInspector
          key={selectedTask.id}
          {...props}
          task={selectedTask}
          onClose={() => navigate('tasks')}
          onEdit={() => setTaskForm(selectedTask)}
        />
      )}
    </>
  );
}

function CalendarView({ snapshot: s, navigate }: ViewProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mode, setMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [project, setProject] = useState('all');
  const all = [
    ...s.tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.dueDate!,
        kind: 'Task deadline',
        view: 'tasks',
        status: t.status,
        projectId: t.projectId,
      })),
    ...s.projects
      .filter((p) => p.dueDate)
      .map((p) => ({
        id: p.id,
        title: p.name,
        date: p.dueDate!,
        kind: 'Project target',
        view: 'projects',
        status: p.status,
        projectId: p.id,
      })),
  ]
    .filter((e) => project === 'all' || e.projectId === project)
    .sort((a, b) => a.date.localeCompare(b.date));
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const visible = all.filter((e) => e.date.startsWith(prefix));
  const first = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: Math.ceil((first + count) / 7) * 7 }, (_, i) => i - first + 1);
  const weekStart = Math.floor((new Date().getDate() + first - 1) / 7) * 7;
  const weekDays = days.slice(weekStart, weekStart + 7);
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">MAKE SPACE FOR WHAT MATTERS</span>
          <h1 className="page-title">
            Calendar<span className="accent">.</span>
          </h1>
          <p className="page-subtitle">Task deadlines and project targets, in one clear picture.</p>
        </div>
        {editable(s) && (
          <button className="btn btn-primary" onClick={() => navigate('tasks', 'new')}>
            <Plus size={16} />
            Create task
          </button>
        )}
      </div>
      <div className="calendar-tools">
        <div className="calendar-navigation">
          <h2>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-btn"
            aria-label="Next month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={17} />
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Today
          </button>
        </div>
        <div className="header-actions">
          <select
            className="select compact-select"
            aria-label="Calendar project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="all">All projects</option>
            {s.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="segmented">
            {(['month', 'week', 'agenda'] as const).map((m) => (
              <button
                className={mode === m ? 'selected' : ''}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                key={m}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
      {mode === 'agenda' ? (
        <section className="panel">
          {visible.length ? (
            visible.map((e) => (
              <button
                className="agenda-row"
                key={`${e.view}-${e.id}`}
                onClick={() => navigate(e.view, e.id)}
              >
                <span className="agenda-date">
                  <DateLabel value={e.date} />
                </span>
                <span>
                  <strong>{e.title}</strong>
                  <small>{e.kind}</small>
                </span>
                <Status value={e.status} />
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <EmptyState
              title="A clear calendar."
              detail="Set task due dates or project targets to bring your plans into view."
            />
          )}
        </section>
      ) : (
        <div className="panel calendar-grid">
          <div className="calendar-weekdays">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {(mode === 'week' ? weekDays : days).map((day, i) => {
              const date = `${prefix}-${String(day).padStart(2, '0')}`;
              const valid = day > 0 && day <= count;
              const items = all.filter((e) => e.date === date);
              return (
                <div
                  className={`calendar-day ${valid ? '' : 'day-outside'} ${date === today() ? 'day-today' : ''}`}
                  key={i}
                >
                  <span className="day-number">{valid ? day : ''}</span>
                  {valid &&
                    items.slice(0, 3).map((e) => (
                      <button
                        className={`calendar-event event-${e.view}`}
                        key={`${e.view}-${e.id}`}
                        onClick={() => navigate(e.view, e.id)}
                        title={`${e.kind}: ${e.title}`}
                      >
                        {e.title}
                      </button>
                    ))}
                  {items.length > 3 && (
                    <button className="text-btn small" onClick={() => setMode('agenda')}>
                      +{items.length - 3} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="muted small calendar-note">
        Dates are stored as date-only values. Tasks without a due date remain in the task list.
      </p>
    </>
  );
}

function AnalyticsView({ snapshot: s, navigate }: ViewProps) {
  const [project, setProject] = useState('all');
  const tasks = s.tasks.filter((t) => project === 'all' || t.projectId === project);
  const projectRows = s.projects.filter((p) => project === 'all' || p.id === project);
  const totals = statuses.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  }));
  const max = Math.max(...totals.map((t) => t.count), 1);
  function exportCsv() {
    const rows = [
      ['Project', 'Tasks', 'Completed', 'Progress (%)', 'Tracked minutes'],
      ...projectRows.map((p) => {
        const ts = s.tasks.filter((t) => t.projectId === p.id);
        return [
          p.name,
          ts.length,
          ts.filter((t) => t.status === 'done').length,
          progress(ts),
          s.timeEntries
            .filter((t) => t.projectId === p.id)
            .reduce((n, t) => n + (t.durationMinutes ?? 0), 0),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'nexora-project-report.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">SIGNAL, WITHOUT THE NOISE</span>
          <h1 className="page-title">
            Analytics<span className="accent">.</span>
          </h1>
          <p className="page-subtitle">
            Understand delivery and effort through your recorded work.
          </p>
        </div>
        <button className="btn" onClick={exportCsv}>
          <ArrowDown size={15} />
          Export report
        </button>
      </div>
      <div className="view-tools">
        <select
          className="select compact-select"
          aria-label="Analytics project"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="all">All projects</option>
          {s.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="muted small">All-time · Calculated from persisted records</span>
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DELIVERY</span>
              <h2>Task distribution</h2>
            </div>
            <span className="count">{tasks.length} total</span>
          </div>
          <div className="status-chart">
            {totals.map(({ status, count }) => (
              <div className="status-chart-row" key={status}>
                <span>
                  <Status value={status} />
                </span>
                <div className="bar-track">
                  <i className={`bar-${status}`} style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {!tasks.length && (
            <p className="muted small chart-note">Create tasks to start measuring your workflow.</p>
          )}
        </section>
        <section className="panel analytics-explainer">
          <span className="eyebrow">HOW WE MEASURE</span>
          <h2>Clarity you can trust.</h2>
          <p>Progress is completed tasks divided by all tasks. Every task has equal weight.</p>
          <p>
            Overdue work or a missed project target means at risk. Blocked tasks, or a target within
            seven days with less than 80% completion, means attention. Completed projects or
            projects with every task done are complete.
          </p>
          <button className="text-btn" onClick={() => navigate('tasks', 'filter:overdue')}>
            Review overdue work <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PROJECT PERFORMANCE</span>
            <h2>Effort & outcomes</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Tasks</th>
                <th>Completed</th>
                <th>Progress</th>
                <th>Recorded time</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map((p) => {
                const ts = s.tasks.filter((t) => t.projectId === p.id);
                const minutes = s.timeEntries
                  .filter((t) => t.projectId === p.id)
                  .reduce((n, t) => n + (t.durationMinutes ?? 0), 0);
                const health = projectHealth(p, ts, today());
                const healthLabels = {
                  complete: 'Complete',
                  at_risk: 'At risk',
                  attention: 'Needs attention',
                  on_track: 'On track',
                };
                return (
                  <tr key={p.id}>
                    <td>
                      <button className="table-title" onClick={() => navigate('projects', p.id)}>
                        {p.name}
                      </button>
                    </td>
                    <td>{ts.length}</td>
                    <td>{ts.filter((t) => t.status === 'done').length}</td>
                    <td>{progress(ts)}%</td>
                    <td>{(minutes / 60).toFixed(1)} h</td>
                    <td>
                      <span
                        className={`badge ${health === 'at_risk' ? 'status-blocked' : health === 'attention' ? 'status-todo' : 'status-done'}`}
                      >
                        {healthLabels[health]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!projectRows.length && (
            <EmptyState
              title="Your project story starts here."
              detail="Create a project and add tasks to begin tracking delivery."
            />
          )}
        </div>
      </section>
    </>
  );
}

function SettingsView({ snapshot: s, command }: ViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = ['owner', 'admin'].includes(s.workspace.role);
  async function run(type: string, data: Record<string, unknown>) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await command(type, data);
      setSuccess('Changes saved.');
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1 className="page-title">
            Settings<span className="accent">.</span>
          </h1>
          <p className="page-subtitle">A thoughtful workspace starts with the right foundations.</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => exportWorkspace(s)}>
            Export workspace
          </button>
          <span className="badge">{s.workspace.role}</span>
        </div>
      </div>
      <ErrorMessage error={error} />
      <SuccessMessage message={success} />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <span className="eyebrow">WORKSPACE</span>
          <h2>Workspace identity</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run('renameWorkspace', { name: new FormData(e.currentTarget).get('name') });
            }}
          >
            <Field label="Workspace name">
              <input
                className="input"
                name="name"
                defaultValue={s.workspace.name}
                required
                maxLength={100}
                disabled={!isAdmin}
              />
            </Field>
            <p className="muted small">
              Your workspace is private to its members. Projects, finances, and documents are scoped
              to this workspace.
            </p>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={!isAdmin || busy}>
                Save workspace
              </button>
            </div>
          </form>
        </section>
        <section className="panel settings-panel">
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h2>Account security</h2>
          <div className="account-summary">
            <span className="avatar">{s.user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{s.user.name}</strong>
              <span>{s.user.email}</span>
            </div>
          </div>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const d = new FormData(form);
              setError(null);
              setSuccess(null);
              setBusy(true);
              try {
                const result = await authClient.changePassword({
                  currentPassword: String(d.get('currentPassword')),
                  newPassword: String(d.get('newPassword')),
                  revokeOtherSessions: true,
                });
                if (result.error)
                  throw new Error(result.error.message || 'Unable to change password.');
                setSuccess('Password updated. Other sessions have been revoked.');
                form.reset();
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Current password">
              <input
                className="input"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password" hint="At least 12 characters.">
              <input
                className="input"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </Field>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                Change password
              </button>
            </div>
          </form>
        </section>
        <section className="panel settings-members">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BETTER, TOGETHER</span>
              <h2>Workspace members</h2>
            </div>
            <span className="count">{s.members.length}</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {s.members.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <span className="member-name">
                        <span className="avatar avatar-small">
                          {m.name.slice(0, 2).toUpperCase()}
                        </span>
                        {m.name}
                        {m.userId === s.user.id && <span className="muted small">You</span>}
                      </span>
                    </td>
                    <td>{m.email}</td>
                    <td>
                      {isAdmin && m.role !== 'owner' ? (
                        <select
                          className="select compact-select"
                          value={m.role}
                          aria-label={`Role for ${m.name}`}
                          disabled={busy}
                          onChange={(e) =>
                            void run('updateMemberRole', { userId: m.userId, role: e.target.value })
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <Status value={m.role} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <form
              className="member-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const d = new FormData(form);
                void run('addMember', { email: d.get('email'), role: d.get('role') }).then((ok) => {
                  if (ok) form.reset();
                });
              }}
            >
              <Field label="Registered member email">
                <input
                  className="input"
                  name="email"
                  type="email"
                  required
                  placeholder="colleague@company.com"
                />
              </Field>
              <Field label="Member role">
                <select className="select" name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                  {s.workspace.role === 'owner' && <option value="admin">Admin</option>}
                </select>
              </Field>
              <button className="btn btn-primary" disabled={busy}>
                <Plus size={15} />
                Add member
              </button>
              <p className="muted small">
                Add an existing registered account. No external email is sent.
              </p>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
