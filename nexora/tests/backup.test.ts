import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { backupDatabase } from '../src/server/backup';

describe('consistent private SQLite backups', () => {
  it('restores committed WAL data without exposing or overwriting backups', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexora-backup-'));
    const source = join(directory, 'live.sqlite');
    const destination = join(directory, 'backups', 'copy.sqlite');
    const db = new Database(source);
    try {
      db.pragma('journal_mode=WAL');
      db.exec('CREATE TABLE notes(id INTEGER PRIMARY KEY, content TEXT NOT NULL)');
      db.prepare('INSERT INTO notes(content) VALUES(?)').run('Preserve committed private work');
      await backupDatabase(source, destination);
      const restored = new Database(destination, { readonly: true });
      try {
        expect(restored.prepare('SELECT content FROM notes').get()).toEqual({
          content: 'Preserve committed private work',
        });
        expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
      } finally {
        restored.close();
      }
      expect(statSync(destination).mode & 0o777).toBe(0o600);
      const previous = readFileSync(destination);
      await expect(backupDatabase(source, destination)).rejects.toThrow();
      expect(readFileSync(destination)).toEqual(previous);
      await expect(backupDatabase(source, source)).rejects.toThrow('differ');
      const existing = join(directory, 'existing.txt');
      writeFileSync(existing, 'user content');
      await expect(backupDatabase(source, existing)).rejects.toThrow();
      expect(readFileSync(existing, 'utf8')).toBe('user content');
    } finally {
      db.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
