import { loadEnvironment } from './environment';
import { hashPassword } from 'better-auth/crypto';
import { getDb } from '../src/server/db';
// Local operator recovery: no web recovery endpoint and no email provider required.
// Supply RECOVERY_EMAIL and RECOVERY_PASSWORD securely in the operator's process.
loadEnvironment();
const email = process.env.RECOVERY_EMAIL;
const password = process.env.RECOVERY_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 128)
  throw new Error('Set RECOVERY_EMAIL and RECOVERY_PASSWORD (12–128 characters).');
const db = getDb();
const user = db.prepare('SELECT id FROM user WHERE email=? COLLATE NOCASE').get(email) as
  { id: string } | undefined;
if (!user) throw new Error('Account not found.');
const hashed = await hashPassword(password);
db.transaction(() => {
  const result = db
    .prepare("UPDATE account SET password=?,updatedAt=? WHERE userId=? AND providerId='credential'")
    .run(hashed, Date.now(), user.id);
  if (!result.changes) throw new Error('Password account not found.');
  db.prepare('DELETE FROM session WHERE userId=?').run(user.id);
})();
console.log('Password updated and all account sessions invalidated.');
db.close();
