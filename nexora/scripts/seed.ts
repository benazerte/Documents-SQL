import { loadEnvironment } from './environment';
import { getAuth } from '../src/server/auth';
import { getDb } from '../src/server/db';
import { createWorkspace } from '../src/server/core';
loadEnvironment();
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
const name = process.env.SEED_NAME || 'Workspace owner';
const workspaceName = process.env.SEED_WORKSPACE || 'Sample studio';
if (!email || !password || password.length < 12 || password.length > 128)
  throw new Error(
    'Set SEED_EMAIL and SEED_PASSWORD (12–128 characters) securely in your environment. SEED_NAME and SEED_WORKSPACE are optional.',
  );
const db = getDb();
const existing = db.prepare('SELECT id FROM user WHERE email=? COLLATE NOCASE').get(email) as
  { id: string } | undefined;
const result = existing
  ? await getAuth().api.signInEmail({ body: { email, password } })
  : await getAuth().api.signUpEmail({ body: { name, email, password } });
try {
  const already = db
    .prepare(
      'SELECT w.id FROM workspaces w JOIN workspace_members m ON m.workspaceId=w.id WHERE m.userId=? AND w.isDemo=1 AND w.name=? LIMIT 1',
    )
    .get(result.user.id, workspaceName) as { id: string } | undefined;
  if (already) console.log('Existing sample workspace preserved. No records replayed.');
  else {
    createWorkspace(result.user.id, { name: workspaceName, demo: true }, db);
    console.log(
      'Created explicitly labeled sample workspace. Sign in with the configured account.',
    );
  }
} finally {
  // The CLI has no browser; discard only the temporary session it created.
  if (result.token) db.prepare('DELETE FROM session WHERE token=?').run(result.token);
  db.close();
}
