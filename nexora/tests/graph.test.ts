import { describe, expect, it } from 'vitest';
import {
  adjacentIds,
  buildWorkspaceGraph,
  hierarchicalPositions,
  type GraphSnapshot,
} from '../src/lib/graph';
import type { Client, Document, Invoice, Project, Task } from '../src/lib/types';

const stamp = '2026-11-02T12:00:00.000Z';
const client: Client = {
  id: 'client-1',
  workspaceId: 'workspace-1',
  name: 'Example client',
  organization: 'Example studio',
  email: 'client@example.test',
  website: '',
  description: '',
  status: 'active',
  createdAt: stamp,
  updatedAt: stamp,
};
const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Delivery',
  description: '',
  status: 'active',
  priority: 'medium',
  clientId: client.id,
  ownerId: null,
  startDate: null,
  dueDate: '2026-11-20',
  createdAt: stamp,
  updatedAt: stamp,
};
const task: Task = {
  id: 'task-1',
  workspaceId: 'workspace-1',
  projectId: project.id,
  title: 'First task',
  description: '',
  status: 'done',
  priority: 'medium',
  assigneeId: null,
  parentId: null,
  dueDate: null,
  startDate: null,
  estimateMinutes: 0,
  createdAt: stamp,
  updatedAt: stamp,
  completedAt: stamp,
};
const secondTask: Task = {
  ...task,
  id: 'task-2',
  title: 'Second task',
  status: 'todo',
  completedAt: null,
};
const document: Document = {
  id: 'document-1',
  workspaceId: 'workspace-1',
  title: 'Brief',
  content: 'A real saved document',
  projectId: project.id,
  archived: false,
  createdAt: stamp,
  updatedAt: stamp,
};
const invoice: Invoice = {
  id: 'invoice-1',
  workspaceId: 'workspace-1',
  clientId: client.id,
  projectId: project.id,
  number: 'NX-001',
  currency: 'EUR',
  status: 'draft',
  dueDate: null,
  items: [{ description: 'Delivery', quantity: 1, unitPrice: 10000 }],
  taxBasisPoints: 0,
  subtotal: 10000,
  tax: 0,
  total: 10000,
  paid: 0,
  notes: '',
  createdAt: stamp,
  updatedAt: stamp,
};
function fixture(): GraphSnapshot {
  return {
    projects: [project],
    tasks: [task, secondTask],
    clients: [client],
    documents: [document],
    invoices: [invoice],
    dependencies: [{ id: 'dep-1', taskId: secondTask.id, dependsOnId: task.id }],
  };
}

describe('persisted visual workspace relationships', () => {
  it('builds only real domain entities and correctly directed relationships', () => {
    const graph = buildWorkspaceGraph(fixture());
    expect(graph.entities).toHaveLength(6);
    expect(graph.relationships).toHaveLength(7);
    expect(graph.relationships.find((edge) => edge.kind === 'task-dependency')).toMatchObject({
      source: task.id,
      target: secondTask.id,
      label: 'Must finish before',
    });
    expect(graph.relationships.find((edge) => edge.kind === 'client-project')).toMatchObject({
      source: client.id,
      target: project.id,
    });
    expect(graph.entities.find((entity) => entity.id === project.id)).toMatchObject({
      progress: 50,
      subtitle: '1 of 2 tasks complete',
    });
  });

  it('omits archived projects and hidden entities without emitting dangling edges', () => {
    const data = fixture();
    data.projects = [{ ...project, status: 'archived' }];
    data.clients = [{ ...client, status: 'archived' }];
    data.invoices = [{ ...invoice, status: 'void' }];
    const graph = buildWorkspaceGraph(data);
    expect(graph.entities).toHaveLength(0);
    expect(graph.relationships).toHaveLength(0);
  });

  it('does not create edges for missing or cross-snapshot references', () => {
    const data = fixture();
    data.clients = [];
    data.dependencies.push({ id: 'missing', taskId: 'not-visible', dependsOnId: task.id });
    const graph = buildWorkspaceGraph(data);
    const ids = new Set(graph.entities.map((entity) => entity.id));
    expect(graph.relationships.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(
      true,
    );
    expect(graph.relationships.some((edge) => edge.id === 'dependency:missing')).toBe(false);
    expect(graph.relationships.some((edge) => edge.kind === 'client-project')).toBe(false);
  });

  it('represents saved parent-child relationships separately from prerequisites', () => {
    const data = fixture();
    data.tasks = [task, { ...secondTask, parentId: task.id }];
    const graph = buildWorkspaceGraph(data);
    expect(graph.relationships.find((edge) => edge.kind === 'parent-task')).toMatchObject({
      source: task.id,
      target: secondTask.id,
      label: 'Contains subtask · parent completes after child',
    });
    expect(graph.relationships.filter((edge) => edge.kind === 'task-dependency')).toHaveLength(1);
  });

  it('generates stable non-overlapping positions independently of input order', () => {
    const entities = buildWorkspaceGraph(fixture()).entities;
    const layout = hierarchicalPositions(entities);
    const reverse = hierarchicalPositions([...entities].reverse());
    expect([...layout]).toEqual([...reverse]);
    const points = [...layout.values()];
    expect(new Set(points.map(({ x, y }) => `${x}:${y}`)).size).toBe(entities.length);
    expect(layout.get(client.id)!.x).toBeLessThan(layout.get(project.id)!.x);
    expect(layout.get(project.id)!.x).toBeLessThan(layout.get(task.id)!.x);
  });

  it('keeps a representative sixteen-record workspace compact without overlapping cards', () => {
    const data = fixture();
    data.projects = [
      project,
      { ...project, id: 'project-2', name: 'Second delivery' },
      { ...project, id: 'project-3', name: 'Studio operations' },
    ];
    data.tasks = Array.from({ length: 10 }, (_, index) => ({
      ...task,
      id: `task-${index}`,
      title: `Task ${String(index).padStart(2, '0')}`,
      projectId: data.projects[Math.min(2, Math.floor(index / 4))].id,
    }));
    const entities = buildWorkspaceGraph(data).entities;
    expect(entities).toHaveLength(16);
    const points = [...hierarchicalPositions(entities).values()];
    const width =
      Math.max(...points.map((point) => point.x)) -
      Math.min(...points.map((point) => point.x)) +
      252;
    const height =
      Math.max(...points.map((point) => point.y)) -
      Math.min(...points.map((point) => point.y)) +
      140;
    expect(width).toBeLessThanOrEqual(1200);
    expect(height).toBeLessThanOrEqual(700);
    for (let first = 0; first < points.length; first++) {
      for (let second = first + 1; second < points.length; second++) {
        const horizontalGap = Math.abs(points[first].x - points[second].x);
        const verticalGap = Math.abs(points[first].y - points[second].y);
        expect(horizontalGap >= 252 || verticalGap >= 140).toBe(true);
      }
    }
    const taskColumns = new Set(
      entities
        .filter((entity) => entity.kind === 'task')
        .map((entity) => hierarchicalPositions(entities).get(entity.id)!.x),
    );
    expect(taskColumns.size).toBeGreaterThan(1);
  });

  it('focuses direct adjacent connections in both directions without inventing transitive links', () => {
    const graph = buildWorkspaceGraph(fixture());
    const adjacent = adjacentIds(secondTask.id, graph.relationships);
    expect(adjacent).toEqual(new Set([secondTask.id, project.id, task.id]));
    expect(adjacent.has(client.id)).toBe(false);
  });
});
