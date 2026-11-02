import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Next standalone changes cwd. Load configuration and resolve data paths first.
process.env.NODE_ENV = 'production';
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DATABASE_PATH = resolve(process.env.DATABASE_PATH || './data/nexora.sqlite');
process.env.HOSTNAME = process.env.NEXORA_HOST || '0.0.0.0';
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if ((arg === '--port' || arg === '-p') && process.argv[index + 1])
    process.env.PORT = process.argv[++index];
  else throw new Error(`Unknown start option: ${arg}. Use --port <number> or PORT.`);
}
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer between 1 and 65535.');
const entry = resolve('.next/standalone/server.js');
if (!existsSync(entry)) throw new Error('Production output is missing. Run pnpm build first.');
await import(pathToFileURL(entry).href);
