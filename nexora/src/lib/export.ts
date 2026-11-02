import type { Snapshot } from './types';

/** Escape CSV while preventing spreadsheet formula injection on exported text. */
export function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[\t\r\n ]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function tasksCsv(snapshot: Snapshot): string {
  const names = new Map(snapshot.projects.map((project) => [project.id, project.name]));
  const rows: unknown[][] = [
    ['Task ID', 'Title', 'Project', 'Status', 'Priority', 'Due date', 'Created at'],
  ];
  for (const task of snapshot.tasks) {
    rows.push([
      task.id,
      task.title,
      names.get(task.projectId) ?? '',
      task.status,
      task.priority,
      task.dueDate,
      task.createdAt,
    ]);
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Snapshot export is data portability, not a raw credential-bearing DB backup. */
export function exportWorkspace(snapshot: Snapshot): void {
  const { user: _user, workspaces: _workspaces, ...workspaceData } = snapshot;
  void _user;
  void _workspaces;
  downloadFile(
    'nexora-workspace.json',
    JSON.stringify(
      {
        format: 'nexora-workspace',
        version: 1,
        exportedAt: new Date().toISOString(),
        ...workspaceData,
      },
      null,
      2,
    ),
    'application/json',
  );
}
