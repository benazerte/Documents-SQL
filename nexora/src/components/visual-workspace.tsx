'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  Focus,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Maximize2,
  MousePointer2,
  Move,
  Save,
  Search,
  SlidersHorizontal,
  UnfoldVertical,
  Workflow,
  X,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { ViewProps } from '@/lib/types';
import {
  adjacentIds,
  buildWorkspaceGraph,
  formatStatus,
  hierarchicalPositions,
  taskStatusOptions,
  type EntityKind,
  type GraphEntity,
  type GraphRelationship,
} from '@/lib/graph';
import styles from './visual-workspace.module.css';

type EntityNodeData = GraphEntity & Record<string, unknown> & { muted: boolean; connected: number };
type WorkNode = Node<EntityNodeData, 'entity'>;
const icons = {
  client: Building2,
  project: FolderKanban,
  task: CircleDot,
  document: FileText,
  invoice: FileText,
};
const kindNames: Record<EntityKind, string> = {
  client: 'Client',
  project: 'Project',
  task: 'Task',
  document: 'Document',
  invoice: 'Invoice',
};
const routes: Record<EntityKind, string> = {
  client: 'clients',
  project: 'projects',
  task: 'tasks',
  document: 'documents',
  invoice: 'finance',
};
const nodeColors: Record<EntityKind, string> = {
  client: '#ad95f8',
  project: '#76a8ff',
  task: '#82c5b3',
  document: '#e6bd77',
  invoice: '#b79df0',
};

function WorkEntityNode({ data, selected }: NodeProps<WorkNode>) {
  const Icon = icons[data.kind];
  const zoomedOut = useStore((state) => state.transform[2] < 0.54);
  return (
    <div
      className={`${styles.entityNode} ${styles[data.kind]} ${selected ? styles.selectedNode : ''} ${data.muted ? styles.mutedNode : ''}`}
      data-testid={`graph-node-${data.id}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={data.kind === 'task'}
        className={styles.handle}
        aria-label={`Connect prerequisite to ${data.title}`}
      />
      <div className={styles.nodeType}>
        <span className={styles.nodeIcon}>
          <Icon size={13} />
        </span>
        <span>{kindNames[data.kind]}</span>
        <span className={styles.nodeCount}>{data.connected} links</span>
      </div>
      <div className={styles.nodeTitle}>{data.title}</div>
      {!zoomedOut && (
        <>
          <div className={styles.nodeSubtitle}>{data.subtitle}</div>
          <div className={styles.nodeFooter}>
            <span
              className={`${styles.nodeStatus} ${data.status === 'done' || data.status === 'completed' || data.status === 'paid' ? styles.doneStatus : ''}`}
            >
              <span />
              {formatStatus(data.status)}
            </span>
            {data.dueDate && (
              <time dateTime={data.dueDate}>
                {new Intl.DateTimeFormat('en', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${data.dueDate}T12:00:00Z`))}
              </time>
            )}
            {data.progress !== undefined && <span>{data.progress}%</span>}
          </div>
          {data.progress !== undefined && (
            <div className={styles.progress}>
              <span style={{ width: `${data.progress}%` }} />
            </div>
          )}
        </>
      )}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={data.kind === 'task'}
        className={styles.handle}
        aria-label={`Connect ${data.title} as a prerequisite`}
      />
    </div>
  );
}
const nodeTypes = { entity: WorkEntityNode };

function relationshipEdge(edge: GraphRelationship, selected: string | null): Edge {
  const dependency = edge.kind === 'task-dependency';
  const emphasized = selected !== null && (edge.source === selected || edge.target === selected);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    label: emphasized ? edge.label : undefined,
    ariaLabel: edge.label,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: dependency ? '#aa8bef' : '#586c91',
    },
    style: {
      stroke: dependency ? '#aa8bef' : '#586c91',
      strokeWidth: emphasized ? 2 : 1.4,
      opacity: selected && !emphasized ? 0.22 : 0.85,
      strokeDasharray: dependency ? '5 4' : undefined,
    },
    labelStyle: { fill: '#c6d1e5', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: '#18202d', fillOpacity: 0.98 },
    labelBgPadding: [7, 4],
    labelBgBorderRadius: 4,
    data: { kind: edge.kind },
  };
}

export function VisualWorkspace(props: ViewProps) {
  return (
    <ReactFlowProvider key={props.snapshot.workspace.id}>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvas({ snapshot, command, navigate }: ViewProps) {
  const { fitView, setCenter, getNode } = useReactFlow<WorkNode>();
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [neighborOnly, setNeighborOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [listMode, setListMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [prerequisiteId, setPrerequisiteId] = useState('');
  const [dependentId, setDependentId] = useState('');
  const [statusPending, setStatusPending] = useState(false);
  const positionCache = useRef(
    new Map(
      snapshot.positions.map((position) => [position.entityId, { x: position.x, y: position.y }]),
    ),
  );
  const graph = useMemo(() => buildWorkspaceGraph(snapshot), [snapshot]);
  const automaticPositions = useMemo(() => hierarchicalPositions(graph.entities), [graph.entities]);
  const hasDefaultPositions = graph.entities.some(
    (entity) => !snapshot.positions.some((position) => position.entityId === entity.id),
  );
  const arrangementPending = dirty || hasDefaultPositions;
  const adjacent = useMemo(
    () => (selectedId ? adjacentIds(selectedId, graph.relationships) : new Set<string>()),
    [selectedId, graph.relationships],
  );
  const canEdit = snapshot.workspace.role !== 'viewer';
  const selected = graph.entities.find((entity) => entity.id === selectedId);
  const selectedTask = snapshot.tasks.find((task) => task.id === selectedId);
  const selectedRelationships = graph.relationships.filter(
    (edge) => edge.source === selectedId || edge.target === selectedId,
  );
  const selectedTaskDependencies = selectedTask
    ? snapshot.dependencies.filter((dependency) => dependency.taskId === selectedTask.id)
    : [];
  const entities = useMemo(() => {
    const match = query.trim().toLowerCase();
    const hidden = new Set<string>();
    for (const projectId of collapsed) {
      for (const entity of graph.entities)
        if (entity.projectId === projectId && entity.id !== projectId) hidden.add(entity.id);
    }
    return graph.entities.filter((entity) => {
      if (hidden.has(entity.id)) return false;
      if (kindFilter !== 'all' && entity.kind !== kindFilter) return false;
      if (neighborOnly && selectedId && !adjacent.has(entity.id)) return false;
      if (
        match &&
        !`${entity.title} ${entity.subtitle} ${entity.status} ${kindNames[entity.kind]}`
          .toLowerCase()
          .includes(match)
      )
        return false;
      if (projectFilter !== 'all') {
        const project = snapshot.projects.find((item) => item.id === projectFilter);
        if (
          entity.projectId !== projectFilter &&
          !(entity.kind === 'client' && project?.clientId === entity.id)
        )
          return false;
      }
      return true;
    });
  }, [
    query,
    graph.entities,
    collapsed,
    kindFilter,
    neighborOnly,
    selectedId,
    adjacent,
    projectFilter,
    snapshot.projects,
  ]);
  const visibleIds = useMemo(() => new Set(entities.map((entity) => entity.id)), [entities]);
  const relationships = useMemo(
    () =>
      graph.relationships.filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      ),
    [graph.relationships, visibleIds],
  );
  const edges = useMemo(
    () => relationships.map((edge) => relationshipEdge(edge, selectedId)),
    [relationships, selectedId],
  );
  const [nodes, setNodes] = useState<WorkNode[]>([]);

  useEffect(() => {
    setNodes((previous) => {
      const prior = new Map(previous.map((node) => [node.id, node]));
      return entities.map((entity): WorkNode => ({
        id: entity.id,
        type: 'entity',
        position: positionCache.current.get(entity.id) ||
          prior.get(entity.id)?.position ||
          automaticPositions.get(entity.id) || { x: 0, y: 0 },
        selected: selectedId === entity.id || Boolean(prior.get(entity.id)?.selected),
        data: {
          ...entity,
          muted: Boolean(selectedId && !adjacent.has(entity.id)),
          connected: graph.relationships.filter(
            (edge) => edge.source === entity.id || edge.target === entity.id,
          ).length,
        },
        ariaLabel: `${kindNames[entity.kind]}: ${entity.title}, ${formatStatus(entity.status)}`,
      }));
    });
  }, [entities, automaticPositions, selectedId, adjacent, graph.relationships]);

  const onNodesChange = useCallback((changes: NodeChange<WorkNode>[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        positionCache.current.set(change.id, change.position);
        setDirty(true);
        setMessage('');
      }
    }
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const saveLayout = async () => {
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const positions = graph.entities.map((entity) => ({
        entityId: entity.id,
        ...(positionCache.current.get(entity.id) ||
          automaticPositions.get(entity.id) || { x: 0, y: 0 }),
      }));
      await command('saveGraphPositions', { positions });
      setDirty(false);
      setMessage('Arrangement saved to your workspace.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not save this arrangement. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const resetLayout = () => {
    positionCache.current = new Map(automaticPositions);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        position: automaticPositions.get(node.id) || node.position,
      })),
    );
    setDirty(true);
    setMessage('Automatic layout applied. Save to keep this arrangement.');
    requestAnimationFrame(() => {
      void fitView({ padding: 0.1, minZoom: 0.65, maxZoom: 1, duration: 250 });
    });
  };

  const focusEntity = (id: string) => {
    setSelectedId(id);
    const node = getNode(id);
    if (node)
      void setCenter(node.position.x + 126, node.position.y + 60, { zoom: 1.05, duration: 250 });
  };

  const createDependency = async (source: string, target: string) => {
    if (
      !snapshot.tasks.some((task) => task.id === source) ||
      !snapshot.tasks.some((task) => task.id === target)
    ) {
      setError(
        'Only task prerequisites can be connected. Other links follow saved record relationships.',
      );
      return;
    }
    setError('');
    setMessage('');
    try {
      await command('createDependency', { taskId: target, dependsOnId: source });
      setMessage('Task prerequisite saved.');
      setPrerequisiteId('');
      setDependentId('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The dependency could not be created.');
    }
  };

  const onConnect = (connection: Connection) => {
    if (connection.source && connection.target)
      void createDependency(connection.source, connection.target);
  };
  const changeTaskStatus = async (status: string) => {
    if (!selectedTask) return;
    setError('');
    setStatusPending(true);
    try {
      await command('updateTask', { id: selectedTask.id, status });
      setMessage('Task status updated across your workspace.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this task.');
    } finally {
      setStatusPending(false);
    }
  };
  const removeDependency = async (id: string) => {
    setError('');
    try {
      await command('removeDependency', { id });
      setMessage('Task prerequisite removed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this prerequisite.');
    }
  };

  return (
    <section className={styles.workspace} aria-label="Visual workspace">
      <div className={styles.introduction}>
        <div>
          <div className={styles.eyebrow}>
            <Workflow size={12} /> Connected work
          </div>
          <h2>
            Your work, in perspective<span>.</span>
          </h2>
          <p>Explore the relationships behind every next step.</p>
        </div>
        <div className={styles.introActions}>
          <button
            type="button"
            onClick={() => setListMode(!listMode)}
            className={styles.button}
            aria-pressed={listMode}
          >
            {listMode ? <Workflow size={15} /> : <List size={15} />}
            {listMode ? 'Canvas view' : 'List view'}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void saveLayout()}
            disabled={!canEdit || saving || !arrangementPending || graph.entities.length === 0}
          >
            {saving ? (
              <span className={styles.spinner} />
            ) : arrangementPending ? (
              <Save size={15} />
            ) : (
              <Check size={15} />
            )}
            {saving
              ? 'Saving…'
              : arrangementPending
                ? 'Save arrangement'
                : graph.entities.length
                  ? 'Arrangement saved'
                  : 'Default arrangement'}
          </button>
        </div>
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={15} />
          <input
            aria-label="Search graph"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a connection…"
          />
        </label>
        <label className={styles.selectWrap}>
          <FolderKanban size={14} />
          <select
            aria-label="Filter graph by project"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="all">All projects</option>
            {snapshot.projects
              .filter((project) => project.status !== 'archived')
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
          <ChevronDown size={12} />
        </label>
        <label className={styles.selectWrap}>
          <SlidersHorizontal size={14} />
          <select
            aria-label="Filter graph by entity type"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
          >
            <option value="all">All record types</option>
            {Object.entries(kindNames).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}s
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
        </label>
        <span className={styles.graphCount}>
          {entities.length} records <span>·</span> {relationships.length} connections
        </span>
      </div>
      {(error || message) && (
        <div className={error ? styles.error : styles.feedback} role={error ? 'alert' : 'status'}>
          {error || message}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => {
              setError('');
              setMessage('');
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className={`${styles.stage} ${selected ? styles.withInspector : ''}`}>
        <div className={styles.canvas}>
          {listMode ? (
            <div className={styles.accessibleList}>
              <div className={styles.listHeading}>
                <List size={15} /> Workspace hierarchy <span>{entities.length} records</span>
              </div>
              {entities.map((entity) => {
                const Icon = icons[entity.kind];
                return (
                  <button
                    type="button"
                    key={entity.id}
                    onClick={() => setSelectedId(entity.id)}
                    className={`${styles.listRow} ${selectedId === entity.id ? styles.activeRow : ''}`}
                  >
                    <span className={styles.listIcon} style={{ color: nodeColors[entity.kind] }}>
                      <Icon size={16} />
                    </span>
                    <span>
                      <strong>{entity.title}</strong>
                      <small>
                        {kindNames[entity.kind]} · {entity.subtitle}
                      </small>
                    </span>
                    <span className={styles.listStatus}>{formatStatus(entity.status)}</span>
                    <ArrowUpRight size={14} />
                  </button>
                );
              })}
              {!entities.length && (
                <div className={styles.emptyList}>
                  No records match these filters. Try another search or create a project.
                </div>
              )}
            </div>
          ) : (
            <ReactFlow<WorkNode>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              onConnect={onConnect}
              nodesDraggable={canEdit}
              nodesConnectable={canEdit}
              edgesReconnectable={false}
              deleteKeyCode={null}
              fitView
              fitViewOptions={{ padding: 0.1, minZoom: 0.65, maxZoom: 1 }}
              minZoom={0.15}
              maxZoom={1.8}
              selectionOnDrag
              panOnScroll
              selectionKeyCode="Shift"
              multiSelectionKeyCode="Shift"
              proOptions={{ hideAttribution: false }}
              aria-label="Connected workspace canvas. Use arrow keys to move a focused node, or switch to list view."
              colorMode="system"
            >
              <Background variant={BackgroundVariant.Dots} color="#39445a" gap={20} size={1} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => nodeColors[(node.data as EntityNodeData).kind]}
                maskColor="color-mix(in srgb, var(--graph-bg) 82%, transparent)"
                className={styles.minimap}
              />
              <Controls
                showInteractive={false}
                position="bottom-left"
                className={styles.controls}
              />
              <div className={styles.canvasBadge}>
                <span className={styles.liveDot} /> Live workspace{' '}
                <span className={styles.canvasBadgeDivider} /> {snapshot.workspace.name}
              </div>
              <div className={styles.canvasTools}>
                <button
                  type="button"
                  title="Fit all visible records"
                  aria-label="Fit all visible records"
                  onClick={() =>
                    void fitView({ padding: 0.1, minZoom: 0.65, maxZoom: 1, duration: 250 })
                  }
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  type="button"
                  title="Apply automatic layout"
                  aria-label="Apply automatic layout"
                  onClick={resetLayout}
                  disabled={!canEdit}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
              {!entities.length && (
                <div className={styles.emptyCanvas}>
                  <GitBranch size={32} />
                  <h3>
                    {graph.entities.length
                      ? 'No matching connections'
                      : 'Make your first connection'}
                  </h3>
                  <p>
                    {graph.entities.length
                      ? 'Adjust the filters to bring your records back into view.'
                      : 'Create a project and a task. Their relationship will appear here automatically.'}
                  </p>
                  <button type="button" onClick={() => navigate('projects')}>
                    Open projects <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              <div className={styles.canvasHint}>
                <Move size={12} /> Drag to arrange <span>·</span>
                <MousePointer2 size={12} /> Select to inspect <span>·</span> Shift + drag to select
              </div>
            </ReactFlow>
          )}
        </div>
        {selected && (
          <aside className={styles.inspector} aria-label="Selected record details">
            <div className={styles.inspectorTop}>
              <span>Record inspector</span>
              <button
                type="button"
                aria-label="Close record inspector"
                onClick={() => setSelectedId(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className={styles.inspectorIdentity}>
              <span className={styles.inspectorKind} style={{ color: nodeColors[selected.kind] }}>
                {kindNames[selected.kind]}
              </span>
              <h3>{selected.title}</h3>
              <p>{selected.subtitle}</p>
              <span className={styles.inspectorStatus}>{formatStatus(selected.status)}</span>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>Connections</dt>
                <dd>{selectedRelationships.length} linked records</dd>
              </div>
              {selected.priority && (
                <div>
                  <dt>Priority</dt>
                  <dd>{formatStatus(selected.priority)}</dd>
                </div>
              )}
              {selected.dueDate && (
                <div>
                  <dt>Due date</dt>
                  <dd>{selected.dueDate}</dd>
                </div>
              )}
              {selected.progress !== undefined && (
                <div>
                  <dt>Task completion</dt>
                  <dd>{selected.progress}%</dd>
                </div>
              )}
            </dl>
            {selectedTask && (
              <label className={styles.inspectorField}>
                Task status
                <select
                  value={selectedTask.status}
                  onChange={(event) => void changeTaskStatus(event.target.value)}
                  disabled={!canEdit || statusPending}
                >
                  {taskStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className={styles.openRecord}
              onClick={() => navigate(routes[selected.kind], selected.id)}
            >
              Open {kindNames[selected.kind].toLowerCase()}
              <ArrowUpRight size={15} />
            </button>
            <div className={styles.inspectorActions}>
              <button type="button" onClick={() => focusEntity(selected.id)}>
                <Focus size={14} /> Focus record
              </button>
              <button
                type="button"
                onClick={() => setNeighborOnly(!neighborOnly)}
                aria-pressed={neighborOnly}
              >
                <GitBranch size={14} />
                {neighborOnly ? 'Show all links' : 'Only neighbors'}
              </button>
              {selected.kind === 'project' && (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(selected.id)) next.delete(selected.id);
                      else next.add(selected.id);
                      return next;
                    })
                  }
                >
                  <UnfoldVertical size={14} />
                  {collapsed.has(selected.id) ? 'Expand project' : 'Collapse project'}
                </button>
              )}
            </div>
            <div className={styles.relationships}>
              <h4>Connected records</h4>
              {selectedRelationships.length ? (
                selectedRelationships.map((edge) => {
                  const otherId = edge.source === selected.id ? edge.target : edge.source;
                  const other = graph.entities.find((entity) => entity.id === otherId);
                  return other ? (
                    <button type="button" key={edge.id} onClick={() => focusEntity(other.id)}>
                      <ArrowDownRight size={13} />
                      <span>
                        {other.title}
                        <small>{edge.label}</small>
                      </span>
                      <span className={styles.connectionType}>{kindNames[other.kind]}</span>
                    </button>
                  ) : null;
                })
              ) : (
                <p>No linked records yet.</p>
              )}
            </div>
            {selectedTask && selectedTaskDependencies.length > 0 && (
              <div className={styles.prerequisites}>
                <h4>Task prerequisites</h4>
                {selectedTaskDependencies.map((dependency) => (
                  <div key={dependency.id}>
                    <span>
                      {snapshot.tasks.find((task) => task.id === dependency.dependsOnId)?.title ||
                        'Task'}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Remove prerequisite ${snapshot.tasks.find((task) => task.id === dependency.dependsOnId)?.title || ''}`}
                        onClick={() => void removeDependency(dependency.id)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
      <div className={styles.legend}>
        <div>
          {Object.entries(kindNames).map(([kind, label]) => (
            <span key={kind}>
              <i style={{ background: nodeColors[kind as EntityKind] }} />
              {label}
            </span>
          ))}
          <span>
            <i className={styles.dependencyLegend} />
            Prerequisite
          </span>
        </div>
        <span>
          Connections follow saved records. Task links point from prerequisite to dependent.
        </span>
      </div>
      {canEdit && snapshot.tasks.length > 1 && (
        <details className={styles.connectionEditor}>
          <summary>
            <GitBranch size={15} /> Connect task prerequisites{' '}
            <span>Keyboard-accessible relationship editor</span>
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (prerequisiteId && dependentId) void createDependency(prerequisiteId, dependentId);
            }}
          >
            <label>
              Must finish first
              <select
                required
                value={prerequisiteId}
                onChange={(event) => setPrerequisiteId(event.target.value)}
              >
                <option value="">Choose prerequisite</option>
                {snapshot.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <ArrowUpRight size={16} />
            <label>
              Unblocks this task
              <select
                required
                value={dependentId}
                onChange={(event) => setDependentId(event.target.value)}
              >
                <option value="">Choose dependent task</option>
                {snapshot.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={styles.button}
              disabled={!prerequisiteId || !dependentId}
            >
              Save prerequisite
            </button>
          </form>
          <p>Self-links and circular dependencies are rejected by the server.</p>
        </details>
      )}
    </section>
  );
}
