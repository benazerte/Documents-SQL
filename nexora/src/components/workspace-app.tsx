'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileText,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { brand, type Snapshot, type User, type Workspace } from '@/lib/types';
import { AuthScreen, authClient } from './auth-screen';
import { CoreViews } from './core-views';
import { OrganizationView } from './organization';
import { ErrorMessage, Field, Logo, Modal } from './ui';

const VisualWorkspace = dynamic(() => import('./visual-workspace').then((m) => m.VisualWorkspace), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <span className="loading-mark" />
      <p>Connecting your workspace…</p>
    </div>
  ),
});
const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'graph', label: 'Visual workspace', icon: GitBranch },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'time', label: 'Time tracking', icon: Timer },
  { id: 'finance', label: 'Finance', icon: CreditCard },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];
function guard() {
  return window.dispatchEvent(new Event('nexora:before-navigate', { cancelable: true }));
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'same-origin',
    cache: 'no-store',
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response. Try again.');
  }
  if (!response.ok) throw new Error(data.error || 'The operation could not be completed.');
  return data as T;
}

function CreateWorkspace({
  first,
  onClose,
  onCreated,
}: {
  first: boolean;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{ id: string }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: form.get('name'), demo }),
      });
      await onCreated(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create workspace.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={first ? 'A home for your best work.' : 'Create a workspace'} onClose={onClose}>
      <p className="onboarding-copy">
        Projects, tasks, clients, and ideas. Connected in a private space that belongs to you.
      </p>
      <form className="stack-form" onSubmit={submit}>
        <Field label="Workspace name">
          <input
            className="input"
            name="name"
            placeholder="Acme Studio"
            maxLength={100}
            required
            autoFocus
          />
        </Field>
        <label className={`demo-option ${demo ? 'demo-selected' : ''}`}>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>
            <strong>Start with a sample workspace</strong>
            <small>
              Explore connected fictional projects, tasks, and clients. All sample content is
              clearly labeled.
            </small>
          </span>
          <GitBranch size={22} />
        </label>
        <ErrorMessage error={error} />
        <div className="form-actions">
          {!first && (
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create workspace'}
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="muted small">
          {demo
            ? 'Your sample workspace stays separate from future clean workspaces.'
            : 'A clean start. Add your first project after creating your workspace.'}
        </p>
      </form>
    </Modal>
  );
}

function CommandPalette({
  snapshot,
  navigate,
  onClose,
}: {
  snapshot: Snapshot;
  navigate: (view: string, id?: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const q = query.trim().toLowerCase();
  const canEdit = snapshot.workspace.role !== 'viewer';
  const records = [
    ...snapshot.projects.map((p) => ({
      id: p.id,
      title: p.name,
      type: 'Project',
      view: 'projects',
    })),
    ...snapshot.tasks.map((t) => ({ id: t.id, title: t.title, type: 'Task', view: 'tasks' })),
    ...snapshot.clients.map((c) => ({ id: c.id, title: c.name, type: 'Client', view: 'clients' })),
    ...snapshot.documents.map((d) => ({
      id: d.id,
      title: d.title,
      type: 'Document',
      view: 'documents',
    })),
  ]
    .filter((r) => !q || r.title.toLowerCase().includes(q))
    .slice(0, 12);
  const actions = [
    ...(canEdit
      ? [
          { id: 'new', title: 'Create task', type: 'Action', view: 'tasks' },
          { id: 'new', title: 'Create project', type: 'Action', view: 'projects' },
        ]
      : []),
    ...navigation.map((n) => ({ id: '', title: n.label, type: 'Navigate', view: n.id })),
  ].filter((r) => !q || r.title.toLowerCase().includes(q));
  const results = [...records, ...actions];
  function select(i: number) {
    const result = results[i];
    if (result) {
      onClose();
      navigate(result.view, result.id || undefined);
    }
  }
  return (
    <Modal title="Find your next move" onClose={onClose}>
      <div className="command-input">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Search your workspace"
          value={query}
          placeholder="Search records or jump to a view…"
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              select(index);
            }
          }}
        />
      </div>
      <div className="command-results">
        {results.length ? (
          results.map((r, i) => (
            <button
              key={`${r.view}-${r.id}-${r.type}`}
              className={`command-result ${index === i ? 'command-active' : ''}`}
              onClick={() => select(i)}
              onMouseEnter={() => setIndex(i)}
            >
              <span>
                {r.type === 'Action' ? (
                  <Plus size={16} />
                ) : r.type === 'Task' ? (
                  <ListTodo size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </span>
              <strong>{r.title}</strong>
              <small>{r.type}</small>
            </button>
          ))
        ) : (
          <p className="command-empty">No matching records. Try a different search.</p>
        )}
      </div>
      <footer className="command-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> Navigate
        </span>
        <span>
          <kbd>↵</kbd> Open
        </span>
        <span>
          <kbd>esc</kbd> Close
        </span>
      </footer>
    </Modal>
  );
}

export function WorkspaceApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState('overview');
  const [entityId, setEntityId] = useState<string | undefined>();
  const [createWorkspace, setCreateWorkspace] = useState(false);
  const [palette, setPalette] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activity, setActivity] = useState(false);
  const requestIndex = useRef(0);
  const activeWorkspace = useRef<string | null>(null);
  const lastUrl = useRef('');
  const loadWorkspace = useCallback(async (id: string) => {
    const request = ++requestIndex.current;
    setRefreshing(true);
    try {
      const data = await api<Snapshot>(`/api/workspaces/${id}`);
      if (request !== requestIndex.current) return;
      activeWorkspace.current = id;
      setSnapshot(data);
      setUser(data.user);
      setWorkspaces(data.workspaces);
      localStorage.setItem('nexora-workspace', id);
      setError(null);
    } finally {
      if (request === requestIndex.current) setRefreshing(false);
    }
  }, []);
  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces', { cache: 'no-store' });
      if (response.status === 401) {
        setUser(null);
        setSnapshot(null);
        return;
      }
      const data = (await response.json()) as {
        user: User;
        workspaces: Workspace[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Unable to load workspaces.');
      setUser(data.user);
      setWorkspaces(data.workspaces);
      if (data.workspaces.length) {
        setCreateWorkspace(false);
        const saved = localStorage.getItem('nexora-workspace');
        const id = data.workspaces.find((w) => w.id === saved)?.id ?? data.workspaces[0].id;
        await loadWorkspace(id);
      } else setCreateWorkspace(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect.');
    } finally {
      setLoading(false);
    }
  }, [loadWorkspace]);
  useEffect(() => {
    let mounted = true;
    // Browser persistence is loaded after hydration; no render reads browser globals.
    queueMicrotask(() => {
      if (!mounted) return;
      void bootstrap();
      const saved = localStorage.getItem('nexora-theme') ?? 'dark';
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
      const params = new URLSearchParams(window.location.search);
      const nextView = params.get('view');
      if (nextView && navigation.some((n) => n.id === nextView)) {
        setView(nextView);
        setEntityId(params.get('record') ?? undefined);
      }
    });
    lastUrl.current = window.location.href;
    const pop = () => {
      if (!guard()) {
        window.history.pushState(null, '', lastUrl.current);
        return;
      }
      lastUrl.current = window.location.href;
      const p = new URLSearchParams(window.location.search);
      const v = p.get('view') ?? 'overview';
      setView(navigation.some((n) => n.id === v) ? v : 'overview');
      setEntityId(p.get('record') ?? undefined);
    };
    window.addEventListener('popstate', pop);
    return () => {
      mounted = false;
      window.removeEventListener('popstate', pop);
    };
  }, [bootstrap]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(nextView: string, id?: string) {
    if (!guard()) return;
    setView(nextView);
    setEntityId(id);
    setSidebar(false);
    setActivity(false);
    const params = new URLSearchParams({ view: nextView });
    if (id) params.set('record', id);
    window.history.pushState(null, '', `?${params}`);
    lastUrl.current = window.location.href;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function command(type: string, data: Record<string, unknown>) {
    if (!snapshot) throw new Error('Select a workspace first.');
    const id = snapshot.workspace.id;
    const result = await api<Record<string, unknown>>(`/api/workspaces/${id}/commands`, {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
    if (activeWorkspace.current === id) {
      await loadWorkspace(id);
      setToast(type === 'saveGraphPositions' ? 'Arrangement saved.' : 'Changes saved.');
    }
    return result;
  }
  async function switchWorkspace(id: string) {
    if (!guard()) return;
    if (id === '__new') {
      setCreateWorkspace(true);
      return;
    }
    try {
      activeWorkspace.current = id;
      await loadWorkspace(id);
      navigate('overview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to switch workspace.');
    }
  }
  async function signOut() {
    if (!guard()) return;
    const result = await authClient.signOut();
    if (result.error) {
      setError(result.error.message || 'Unable to sign out.');
      return;
    }
    activeWorkspace.current = null;
    requestIndex.current++;
    setSnapshot(null);
    setUser(null);
    setWorkspaces([]);
    setCreateWorkspace(false);
    setPalette(false);
    setActivity(false);
    localStorage.removeItem('nexora-workspace');
  }
  if (loading)
    return (
      <main className="loading-screen">
        <Logo />
        <span className="loading-mark" />
        <p>Making room for your work…</p>
      </main>
    );
  if (!user)
    return (
      <>
        <AuthScreen onAuthenticated={() => void bootstrap()} />
        {error && (
          <div className="global-error" role="alert">
            {error}
            <button onClick={() => void bootstrap()}>Retry</button>
          </div>
        )}
      </>
    );
  const current = navigation.find((n) => n.id === view) ?? navigation[0];
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {sidebar && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Logo compact={collapsed} />
          <button
            className="icon-btn desktop-collapse"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <Menu size={16} />
          </button>
          <button
            className="icon-btn mobile-close"
            aria-label="Close navigation"
            onClick={() => setSidebar(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-picker">
          <span className="workspace-emblem">
            {snapshot?.workspace.name.slice(0, 1).toUpperCase() ?? 'W'}
          </span>
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <select
              aria-label="Switch workspace"
              value={snapshot?.workspace.id ?? ''}
              onChange={(e) => void switchWorkspace(e.target.value)}
            >
              {workspaces.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
              <option value="__new">+ Create workspace</option>
            </select>
          </div>
          <ChevronDown size={14} />
        </div>
        <button
          className="sidebar-search"
          aria-label="Search your workspace"
          onClick={() => setPalette(true)}
        >
          <Search size={15} />
          <span>Quick search</span>
          <kbd>⌘ K</kbd>
        </button>
        <span className="nav-group-label">WORKSPACE</span>
        <nav>
          {navigation.map((item, i) => (
            <div key={item.id}>
              {i === 5 && <span className="nav-group-label nav-group-spacer">BUSINESS</span>}
              {i === 10 && <div className="nav-divider" />}
              <button
                className={`nav-item ${view === item.id ? 'nav-active' : ''}`}
                onClick={() => navigate(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === 'tasks' &&
                  snapshot &&
                  snapshot.tasks.some((t) => t.status !== 'done') && (
                    <small>{snapshot.tasks.filter((t) => t.status !== 'done').length}</small>
                  )}
                {item.id === 'graph' && <i className="nav-feature-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="connection-mark">
              <GitBranch size={19} />
            </span>
            <strong>Clarity is a superpower.</strong>
            <p>
              Connect the dots.
              <br />
              Move the work forward.
            </p>
            <button onClick={() => navigate('graph')}>
              Open visual workspace <ArrowRight size={13} />
            </button>
          </div>
          <button className="profile-button" onClick={() => navigate('settings')}>
            <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{snapshot?.workspace.role ?? 'Your account'}</small>
            </span>
            <Settings size={15} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-path">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={19} />
            </button>
            <span className="topbar-workspace">{snapshot?.workspace.name ?? 'Your workspace'}</span>
            <span className="path-divider">/</span>
            <span className="topbar-current">{current.label}</span>
            {snapshot?.workspace.isDemo && <span className="demo-badge">SAMPLE WORKSPACE</span>}
          </div>
          <div className="topbar-actions">
            {refreshing && (
              <span className="saving-indicator" role="status">
                Syncing…
              </span>
            )}
            <button
              className="icon-btn"
              aria-label="Open command palette"
              title="Search (⌘ K)"
              onClick={() => setPalette(true)}
            >
              <Search size={17} />
            </button>
            <button
              className="icon-btn"
              aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                localStorage.setItem('nexora-theme', next);
                document.documentElement.dataset.theme = next;
              }}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className={`icon-btn ${activity ? 'active' : ''}`}
              aria-label="Recent activity"
              onClick={() => setActivity(!activity)}
            >
              <Bell size={17} />
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-btn"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </button>
            <span className="avatar avatar-small topbar-avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        {error && (
          <div className="content-error" role="alert">
            {error}
            <button
              className="text-btn"
              onClick={() => snapshot && void loadWorkspace(snapshot.workspace.id)}
            >
              Retry
            </button>
            <button className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={15} />
            </button>
          </div>
        )}
        <main
          id="main-content"
          className={`main-content ${view === 'graph' ? 'graph-content' : ''}`}
          tabIndex={-1}
        >
          {snapshot ? (
            view === 'graph' ? (
              <VisualWorkspace
                snapshot={snapshot}
                command={command}
                navigate={navigate}
                entityId={entityId}
              />
            ) : ['clients', 'documents', 'time', 'finance'].includes(view) ? (
              <OrganizationView
                snapshot={snapshot}
                command={command}
                navigate={navigate}
                entityId={entityId}
                view={view}
              />
            ) : (
              <CoreViews
                snapshot={snapshot}
                command={command}
                navigate={navigate}
                key={`${snapshot.workspace.id}-${view}`}
                view={view}
                entityId={entityId}
              />
            )
          ) : (
            <div className="workspace-welcome">
              <Logo />
              <h1>Every great thing starts somewhere.</h1>
              <p>Create your workspace to get started.</p>
              <button className="btn btn-primary" onClick={() => setCreateWorkspace(true)}>
                Create workspace
              </button>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <i />
            CONNECTED WORKSPACE
          </span>
          <span>
            {brand.name} <span className="footer-version">/ WORKSPACE EDITION</span>
          </span>
        </footer>
      </div>
      {activity && snapshot && (
        <aside className="activity-drawer" aria-label="Recent activity">
          <header>
            <h2>Activity history</h2>
            <button
              className="icon-btn"
              aria-label="Close activity"
              onClick={() => setActivity(false)}
            >
              <X size={18} />
            </button>
          </header>
          <p className="muted small">A real-time record of your workspace.</p>
          {snapshot.activity.length ? (
            snapshot.activity.slice(0, 30).map((a) => (
              <div className="drawer-activity" key={a.id}>
                <strong>{a.actorName}</strong>
                <p>{a.action}</p>
                <time>{new Date(a.createdAt).toLocaleString()}</time>
              </div>
            ))
          ) : (
            <p className="muted">No activity yet.</p>
          )}
        </aside>
      )}
      {createWorkspace && (
        <CreateWorkspace
          first={!snapshot}
          onClose={() => setCreateWorkspace(false)}
          onCreated={async (id) => {
            await loadWorkspace(id);
            setCreateWorkspace(false);
            navigate('overview');
          }}
        />
      )}
      {palette && snapshot && (
        <CommandPalette snapshot={snapshot} navigate={navigate} onClose={() => setPalette(false)} />
      )}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast">
            <span className="toast-check">✓</span>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
