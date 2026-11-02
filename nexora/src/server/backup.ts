import Database from 'better-sqlite3';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Consistent online SQLite backup, including committed WAL records. Never overwrites a backup. */
export async function backupDatabase(source: string, destination: string): Promise<string> {
  const from = resolve(source);
  const to = resolve(destination);
  if (from === to) throw new Error('Backup destination must differ from the live database.');
  if (!existsSync(from)) throw new Error('The source database does not exist.');
  mkdirSync(dirname(to), { recursive: true, mode: 0o700 });
  // Reserve the filename with restrictive permissions before SQLite opens it.
  closeSync(openSync(to, 'wx', 0o600));
  let db: Database.Database | undefined;
  try {
    db = new Database(from, { readonly: true, fileMustExist: true });
    await db.backup(to);
    chmodSync(to, 0o600);
    return to;
  } catch (error) {
    unlinkSync(to);
    throw error;
  } finally {
    db?.close();
  }
}
