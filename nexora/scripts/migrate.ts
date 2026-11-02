import { loadEnvironment } from './environment';
import { getDb } from '../src/server/db';
loadEnvironment();
const db = getDb();
const migrations = db
  .prepare('SELECT version,appliedAt FROM schema_migrations ORDER BY version')
  .all();
console.log('SQLite migrations applied:', migrations);
db.close();
