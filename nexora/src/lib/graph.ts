import type { Snapshot, TaskStatus } from './types';

export type EntityKind = 'client' | 'project' | 'task' | 'document' | 'invoice';
export interface GraphEntity {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string;
  status: string;
  projectId: string | null;
  dueDate: string | null;
  progress?: number;
  priority?: string;
}
export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  kind:
    | 'client-project'
    | 'project-task'
    | 'parent-task'
    | 'task-dependency'
    | 'project-document'
    | 'client-invoice'
    | 'project-invoice';
  label: string;
}
export interface WorkGraph {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
}
export type GraphSnapshot = Pick<
  Snapshot,
  'projects' | 'tasks' | 'clients' | 'documents' | 'invoices' | 'dependencies'
>;

/** Every connection is derived from a persisted, authorized domain relationship. */
export function buildWorkspaceGraph(snapshot: GraphSnapshot): WorkGraph {
  const entities: GraphEntity[] = [];
  const relationships: GraphRelationship[] = [];
  const projects = new Map(snapshot.projects.map((project) => [project.id, project]));
  const clients = new Map(snapshot.clients.map((client) => [client.id, client]));
  const tasks = new Map(snapshot.tasks.map((task) => [task.id, task]));
  for (const client of snapshot.clients) {
    if (client.status === 'archived') continue;
    entities.push({
      id: client.id,
      kind: 'client',
      title: client.name,
      subtitle: client.organization || 'Client relationship',
      status: client.status,
      projectId: null,
      dueDate: null,
    });
  }
  for (const project of snapshot.projects) {
    if (project.status === 'archived') continue;
    const projectTasks = snapshot.tasks.filter((task) => task.projectId === project.id);
    const completed = projectTasks.filter((task) => task.status === 'done').length;
    entities.push({
      id: project.id,
      kind: 'project',
      title: project.name,
      subtitle: `${completed} of ${projectTasks.length} tasks complete`,
      status: project.status,
      projectId: project.id,
      dueDate: project.dueDate,
      progress: projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0,
      priority: project.priority,
    });
    if (
      project.clientId &&
      clients.get(project.clientId)?.status !== 'archived' &&
      clients.has(project.clientId)
    ) {
      relationships.push({
        id: `client-project:${project.id}`,
        source: project.clientId,
        target: project.id,
        kind: 'client-project',
        label: 'Client of project',
      });
    }
  }
  for (const task of snapshot.tasks) {
    const project = projects.get(task.projectId);
    if (!project || project.status === 'archived') continue;
    entities.push({
      id: task.id,
      kind: 'task',
      title: task.title,
      subtitle: project.name,
      status: task.status,
      projectId: task.projectId,
      dueDate: task.dueDate,
      priority: task.priority,
    });
    relationships.push({
      id: `project-task:${task.id}`,
      source: task.projectId,
      target: task.id,
      kind: 'project-task',
      label: 'Contains task',
    });
    if (task.parentId && tasks.has(task.parentId)) {
      relationships.push({
        id: `parent-task:${task.id}`,
        source: task.parentId,
        target: task.id,
        kind: 'parent-task',
        label: 'Contains subtask · parent completes after child',
      });
    }
  }
  for (const dependency of snapshot.dependencies) {
    if (!tasks.has(dependency.taskId) || !tasks.has(dependency.dependsOnId)) continue;
    // The prerequisite points to the task it blocks, matching execution order.
    relationships.push({
      id: `dependency:${dependency.id}`,
      source: dependency.dependsOnId,
      target: dependency.taskId,
      kind: 'task-dependency',
      label: 'Must finish before',
    });
  }
  for (const document of snapshot.documents) {
    if (
      document.archived ||
      (document.projectId && projects.get(document.projectId)?.status === 'archived')
    )
      continue;
    entities.push({
      id: document.id,
      kind: 'document',
      title: document.title,
      subtitle: document.projectId
        ? projects.get(document.projectId)?.name || 'Project document'
        : 'Workspace document',
      status: 'saved',
      projectId: document.projectId,
      dueDate: null,
    });
    if (document.projectId && projects.has(document.projectId)) {
      relationships.push({
        id: `project-document:${document.id}`,
        source: document.projectId,
        target: document.id,
        kind: 'project-document',
        label: 'Related document',
      });
    }
  }
  for (const invoice of snapshot.invoices) {
    if (invoice.status === 'void') continue;
    const amount = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: invoice.currency,
    }).format(invoice.total / 100);
    entities.push({
      id: invoice.id,
      kind: 'invoice',
      title: invoice.number,
      subtitle: `${clients.get(invoice.clientId)?.name || 'Client'} · ${amount}`,
      status: invoice.status,
      projectId: invoice.projectId,
      dueDate: invoice.dueDate,
    });
    if (clients.has(invoice.clientId))
      relationships.push({
        id: `client-invoice:${invoice.id}`,
        source: invoice.clientId,
        target: invoice.id,
        kind: 'client-invoice',
        label: 'Invoice for client',
      });
    if (invoice.projectId && projects.has(invoice.projectId))
      relationships.push({
        id: `project-invoice:${invoice.id}`,
        source: invoice.projectId,
        target: invoice.id,
        kind: 'project-invoice',
        label: 'Project invoice',
      });
  }
  const visibleIds = new Set(entities.map((entity) => entity.id));
  return {
    entities,
    relationships: relationships.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    ),
  };
}

/**
 * A compact reading-order layout: keep each project's records together, then wrap.
 * Four columns let a typical sixteen-record workspace stay legible in one desktop
 * canvas instead of shrinking a tall type-based column to fit. Saved coordinates
 * are applied by the view afterwards and never rewritten by this calculation.
 */
export function hierarchicalPositions(
  entities: GraphEntity[],
): Map<string, { x: number; y: number }> {
  const ordered: GraphEntity[] = [];
  const visited = new Set<string>();
  const byName = (a: GraphEntity, b: GraphEntity) =>
    a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const append = (items: GraphEntity[]) => {
    for (const item of [...items].sort(byName)) {
      if (!visited.has(item.id)) {
        visited.add(item.id);
        ordered.push(item);
      }
    }
  };
  append(entities.filter((entity) => entity.kind === 'client'));
  for (const project of entities.filter((entity) => entity.kind === 'project').sort(byName)) {
    append([project]);
    append(entities.filter((entity) => entity.kind === 'task' && entity.projectId === project.id));
    append(
      entities.filter((entity) => entity.kind === 'document' && entity.projectId === project.id),
    );
    append(
      entities.filter((entity) => entity.kind === 'invoice' && entity.projectId === project.id),
    );
  }
  append(entities.filter((entity) => !visited.has(entity.id)));
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(ordered.length))));
  return new Map(
    ordered.map((entity, index) => [
      entity.id,
      {
        x: (index % columns) * 286 + 36,
        y: Math.floor(index / columns) * 154 + 42,
      },
    ]),
  );
}

export function adjacentIds(entityId: string, relationships: GraphRelationship[]): Set<string> {
  const ids = new Set([entityId]);
  for (const edge of relationships) {
    if (edge.source === entityId) ids.add(edge.target);
    if (edge.target === entityId) ids.add(edge.source);
  }
  return ids;
}

export function formatStatus(status: string): string {
  return status.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());
}

export const taskStatusOptions: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'blocked',
  'done',
];
