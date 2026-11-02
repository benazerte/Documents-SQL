# Security model and deployment assumptions

NEXORA is an initial self-hosted application, not a claim of independent security certification. Production operators own TLS, host access, backups, secrets, updates, and abuse monitoring.

## Identity and sessions

Credential authentication uses Better Auth. Passwords are handled by the authentication library; plaintext passwords are not persisted in NEXORA tables. Sessions use HTTP-only cookies and expire according to the server configuration. Production must use HTTPS, the exact `BETTER_AUTH_URL`, and a unique randomly generated `BETTER_AUTH_SECRET`.

Do not commit environment files, use development secrets in production, or log credentials and session tokens. A local HTTP origin is suitable only for local development. Authentication and mutation requests must pass origin checks, and sensitive authentication endpoints are rate limited. Rate limits are process-local in this initial single-instance deployment and do not replace an edge-level abuse policy.

## Workspace authorization

Every workspace snapshot and command checks the authenticated user and membership on the server. A record identifier is never authorization. Related projects, clients, tasks, and other references are checked within the same authorized workspace.

| Role   | Read records | Change operational records | Manage membership and workspace settings                 |
| ------ | ------------ | -------------------------- | -------------------------------------------------------- |
| Owner  | Yes          | Yes                        | Yes, subject to owner safeguards                         |
| Admin  | Yes          | Yes                        | Allowed administrative actions, without owner escalation |
| Member | Yes          | Yes                        | No                                                       |
| Viewer | Yes          | No                         | No                                                       |

The implementation record and authorization tests are the authoritative account of supported membership actions. Adding a collaborator requires an existing registered account; invitation emails are not implemented. A newly registered user does not receive access to another user's workspace.

## Input, persistence, and rendering

- Validate mutations on the server, including enum values, lengths, dates, money bounds, and relationships.
- Use prepared SQL statements and transactions for atomic changes.
- Check task cycles and completion prerequisites on the server.
- Keep graph placement separate from domain relationships.
- Render document content through a safe Markdown renderer; do not execute submitted scripts or arbitrary HTML.
- Reject unsupported commands and disclose useful validation messages without exposing SQL or database internals.
- Do not expose database files as static assets or permit arbitrary filesystem paths from browser requests.

The application does not implement attachment upload. There is no implied secure file-sharing feature.

## Deployment

Use a single application instance with local durable SQLite storage. Restrict filesystem permissions and database access to the application operator. Put an HTTPS reverse proxy in front of the server and preserve the intended host/origin. Keep direct backend ports private where possible.

Security headers prevent framing, MIME sniffing, and unnecessary camera/microphone/geolocation permissions. A strict content security policy and edge-level transport policy require deployment-specific configuration and should be reviewed before public exposure. Keep dependency and container images patched and review their licenses and advisories.

## Account recovery

There is no email-delivery dependency or public reset link. A trusted deployment operator can run `node --import tsx scripts/reset-password.ts` after securely setting `RECOVERY_EMAIL` and `RECOVERY_PASSWORD` in the process environment. The script uses the maintained authentication library's password hashing and invalidates that account's sessions. It does not print the supplied password. Verify the person's identity outside the application before using this operator capability.

Set sensitive recovery values through a secure operator environment; avoid plaintext shell history, logs, chat, and support tickets. Remove them after use. Do not edit password hashes or disable authentication ad hoc.

## Incident response and backups

If credentials, session secrets, or database backups may have been exposed, restrict access, preserve necessary audit evidence, rotate affected secrets, and invalidate affected sessions. Backups contain personal and operational data: encrypt them, limit retention and access, and test restoration on a separate instance.

Financial exports reflect persisted operational data. Required legal fields and tax rules vary by jurisdiction. Review them before issuing documents to real customers. No invoices or emails are sent externally without a separately implemented, explicit user action.

## Authentication limits and proxy trust

The application enables authentication throttling in development and production. Per rolling 60-second window, sign-in allows 10 requests, registration allows 10 requests, password changes allow 5 requests, and the general authentication limit is 100 requests per path. These are attempted requests, including invalid credentials. A rejected request returns HTTP 429 and a `Retry-After` header. Registration accommodates a small team joining from a shared address.

By default NEXORA ignores forwarded-IP headers. The limits use a shared per-path bucket, so a caller cannot bypass them by changing `X-Forwarded-For`. The shared bucket is conservative and may throttle unrelated users during bursts. The current store is process-local; use one application process, and add edge-level limits for a public deployment. Restarting a process clears its in-memory quota.

Set `TRUST_PROXY_HEADERS=true` only after the origin is reachable exclusively through your trusted reverse proxy, and that proxy **replaces** incoming `X-Forwarded-For` with one verified client address. For example, an Nginx proxy can set `proxy_set_header X-Forwarded-For $remote_addr;`; merely appending untrusted client-supplied values is insufficient. Block direct access to the application port. With that explicit opt-in, Better Auth keys limits by the forwarded client IP. This configuration cannot establish who sent a header or secure an exposed origin by itself.

Never use an arbitrary client-provided forwarded header as proof of identity, and never disable rate limiting to address a test or shared-address limit. Browser tests can reuse registered accounts or wait for the rolling window without weakening production configuration.
