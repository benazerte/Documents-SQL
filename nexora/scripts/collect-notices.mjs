import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

// Read installed files instead of pnpm's optional license-index database.
const root = resolve(import.meta.dirname, '..');
const tree = JSON.parse(
  execFileSync('pnpm', ['list', '--prod', '--json', '--depth', 'Infinity'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }),
);
const packages = new Map();
function visit(node) {
  if (node.path && existsSync(join(node.path, 'package.json')) && resolve(node.path) !== root) {
    const path = realpathSync(node.path);
    const manifest = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
    const identity = `${manifest.name}@${manifest.version}`;
    if (!packages.has(identity))
      packages.set(identity, { manifest, path, source: node.resolved || null });
  }
  for (const collection of ['dependencies', 'optionalDependencies']) {
    for (const child of Object.values(node[collection] || {})) visit(child);
  }
}
for (const node of tree) visit(node);
const out = join(root, 'docs', 'third-party');
mkdirSync(out, { recursive: true });
const inventory = [];
const texts = [
  'THIRD-PARTY NOTICES',
  '',
  'Generated from installed production dependency manifests and their included top-level license/notice files.',
  'This inventory records the installed graph; it is not an independent legal review or a license grant for NEXORA.',
  'Package authors and copyright holders retain their rights. Review the package source and licenses before redistribution.',
  '',
];
for (const [identity, { manifest, path, source }] of [...packages.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  const files = readdirSync(path).filter(
    (name) =>
      /^(license|licence|copying|notice)([.\-_].*)?$/i.test(name) &&
      statSync(join(path, name)).isFile(),
  );
  // Some binary packages put their complete licensing table in README instead.
  for (const candidate of ['README.md', 'README', 'readme.md']) {
    const file = join(path, candidate);
    if (
      existsSync(file) &&
      /#+\s+licen[sc]ing/i.test(readFileSync(file, 'utf8')) &&
      !files.includes(candidate)
    )
      files.push(candidate);
  }
  inventory.push({
    name: manifest.name,
    version: manifest.version,
    license: manifest.license || manifest.licenses || 'not declared',
    repository: manifest.repository || null,
    source,
    includedNoticeFiles: files,
  });
  texts.push(
    '='.repeat(78),
    identity,
    `Declared license: ${typeof manifest.license === 'string' ? manifest.license : JSON.stringify(manifest.license || manifest.licenses || 'not declared')}`,
    '',
  );
  for (const name of files)
    texts.push(`--- ${name} ---`, readFileSync(join(path, name), 'utf8'), '');
  if (!files.length)
    texts.push(
      'No top-level license/notice text included in this installed package. Consult its source and declared license.',
      '',
    );
}
writeFileSync(join(out, 'dependency-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(join(root, 'THIRD_PARTY_NOTICES.txt'), texts.join('\n'));
console.log(`Recorded ${inventory.length} installed production dependency identities.`);
const unknown = inventory.filter((p) => p.license === 'not declared');
if (unknown.length)
  console.log(
    `License metadata absent for: ${unknown.map((p) => `${p.name}@${p.version}`).join(', ')}`,
  );
