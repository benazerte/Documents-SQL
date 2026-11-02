import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const target = resolve('.next/standalone');
if (!existsSync(resolve(target, 'server.js')))
  throw new Error('Run next build before preparing standalone output.');
mkdirSync(resolve(target, '.next'), { recursive: true });
cpSync('.next/static', resolve(target, '.next/static'), { recursive: true });
if (existsSync('public')) cpSync('public', resolve(target, 'public'), { recursive: true });
console.log('Standalone server prepared with its static and public assets.');
