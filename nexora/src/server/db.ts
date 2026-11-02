import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ensureExtendedSchema } from './extended';

const coreMigration = `
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS session(id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS session_user_idx ON session(userId);
CREATE TABLE IF NOT EXISTS account(id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS account_user_idx ON account(userId);
CREATE TABLE IF NOT EXISTS verification(id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER, updatedAt INTEGER);
CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, isDemo INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_members(workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('owner','admin','member','viewer')), PRIMARY KEY(workspaceId,userId));
CREATE INDEX IF NOT EXISTS memberships_user_idx ON workspace_members(userId);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('planned','active','completed','archived')), priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','urgent')), clientId TEXT, ownerId TEXT REFERENCES user(id) ON DELETE SET NULL, startDate TEXT, dueDate TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspaceId);
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('backlog','todo','in_progress','blocked','done')), priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','urgent')), assigneeId TEXT REFERENCES user(id) ON DELETE SET NULL, parentId TEXT REFERENCES tasks(id) ON DELETE RESTRICT, dueDate TEXT, startDate TEXT, estimateMinutes INTEGER NOT NULL DEFAULT 0 CHECK(estimateMinutes>=0), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, completedAt TEXT);
CREATE INDEX IF NOT EXISTS tasks_workspace_project_idx ON tasks(workspaceId,projectId);
CREATE TABLE IF NOT EXISTS dependencies(id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, dependsOnId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, UNIQUE(taskId,dependsOnId), CHECK(taskId!=dependsOnId));
CREATE INDEX IF NOT EXISTS dependencies_workspace_idx ON dependencies(workspaceId);
CREATE TABLE IF NOT EXISTS graph_positions(workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, entityId TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, PRIMARY KEY(workspaceId,entityId));
CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, actorId TEXT NOT NULL REFERENCES user(id), action TEXT NOT NULL, entityId TEXT NOT NULL, entityType TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS activity_workspace_date_idx ON activity(workspaceId,createdAt DESC);
CREATE TABLE IF NOT EXISTS task_comments(id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, authorId TEXT NOT NULL REFERENCES user(id), content TEXT NOT NULL, createdAt TEXT NOT NULL);
`;

export function createDatabase(filename: string): Database.Database {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');
  db.transaction(() => {
    db.exec(coreMigration);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version,appliedAt) VALUES(1,?)').run(
      new Date().toISOString(),
    );
    ensureExtendedSchema(db);
  })();
  return db;
}

const globalDb = globalThis as unknown as {
  nexoraDatabase?: { path: string; db: Database.Database };
};
export function getDb(): Database.Database {
  const filename = process.env.DATABASE_PATH || './data/nexora.sqlite';
  if (!globalDb.nexoraDatabase || globalDb.nexoraDatabase.path !== filename)
    globalDb.nexoraDatabase = { path: filename, db: createDatabase(filename) };
  return globalDb.nexoraDatabase.db;
}

// Export migration source for database administration and review; migration 1 is atomic and idempotent.
export { coreMigration };
