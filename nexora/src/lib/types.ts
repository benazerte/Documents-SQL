export const brand = { name: 'NEXORA', tagline: 'The visual operating system for modern work' };
export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'blocked' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Workspace {
  id: string;
  name: string;
  role: Role;
  isDemo: boolean;
  createdAt: string;
}
export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
}
export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: 'planned' | 'active' | 'completed' | 'archived';
  priority: Priority;
  clientId: string | null;
  ownerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  parentId: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimateMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export interface Dependency {
  id: string;
  taskId: string;
  dependsOnId: string;
}
export interface Activity {
  id: string;
  actorName: string;
  action: string;
  entityId: string;
  entityType: string;
  createdAt: string;
}
export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  organization: string;
  email: string;
  website: string;
  description: string;
  status: 'active' | 'lead' | 'archived';
  createdAt: string;
  updatedAt: string;
}
export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  projectId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface TimeEntry {
  id: string;
  workspaceId: string;
  userId: string;
  projectId: string;
  taskId: string | null;
  description: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}
export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}
export interface Invoice {
  id: string;
  workspaceId: string;
  clientId: string;
  projectId: string | null;
  number: string;
  currency: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  dueDate: string | null;
  items: InvoiceItem[];
  taxBasisPoints: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface Expense {
  id: string;
  workspaceId: string;
  projectId: string | null;
  description: string;
  amount: number;
  currency: string;
  date: string;
  createdAt: string;
}
export interface GraphPosition {
  entityId: string;
  x: number;
  y: number;
}
export interface TaskComment {
  id: string;
  taskId: string;
  authorName: string;
  content: string;
  createdAt: string;
}
export interface Snapshot {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
  members: Member[];
  projects: Project[];
  tasks: Task[];
  dependencies: Dependency[];
  activity: Activity[];
  clients: Client[];
  documents: Document[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  expenses: Expense[];
  positions: GraphPosition[];
  comments: TaskComment[];
}
export type Command = { type: string; data: Record<string, unknown> };
export interface ViewProps {
  entityId?: string;
  snapshot: Snapshot;
  command: (type: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  navigate: (view: string, entityId?: string) => void;
}
