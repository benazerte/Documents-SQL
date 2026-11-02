import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Match Next's file precedence while preserving variables already supplied by the operator. */
export function loadEnvironment() {
  const mode = process.env.NODE_ENV || 'development';
  for (const name of [
    `.env.${mode}.local`,
    ...(mode === 'test' ? [] : ['.env.local']),
    `.env.${mode}`,
    '.env',
  ]) {
    const filename = resolve(name);
    if (existsSync(filename)) process.loadEnvFile(filename);
  }
}
