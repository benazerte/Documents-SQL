import { join } from 'node:path';
import { loadEnvironment } from './environment';
import { backupDatabase } from '../src/server/backup';
loadEnvironment();
const source = process.env.DATABASE_PATH || './data/nexora.sqlite';
const timestamp = new Date().toISOString().replaceAll(':', '-');
const destination =
  process.env.BACKUP_PATH || join('data', 'backups', `nexora-${timestamp}.sqlite`);
console.log('Consistent private backup created:', await backupDatabase(source, destination));
