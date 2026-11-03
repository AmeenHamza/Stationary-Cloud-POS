# Runbook: rotate secrets

For whoever runs operations. Rotate a secret when it may have leaked (a laptop lost, a value pasted
somewhere public, a former helper who knew it) and once a year otherwise. DEPLOYMENT.md §4 lists where each
value lives. Never put a secret in a chat, a ticket, the repository or a screenshot.

Commands marked "CLI" run from a machine with the repository built (`pnpm build`), with production
environment values supplied by the Railway CLI, e.g.
`railway run --service api --environment production pnpm --filter @pos/api cli:<name>`.

## If anything leaked: sign everyone out

After rotating the leaked value, end every session. Staff sign in again on their counters.

```
CLI: cli:revoke-all-sessions --confirm
```

It revokes all sessions in PostgreSQL, stops cached sessions from being accepted, and closes every open
live connection (`session.revoked`). It writes one audit entry, `auth.allSessionsRevoked`.

## Per secret

| Secret | Rotate at | Then update | Notes |
|---|---|---|---|
| Database password (app role) | Neon → Roles → reset password | Railway `api`: `DATABASE_URL`, `DIRECT_DATABASE_URL`; redeploy | Old connections drop; the API reconnects |
| Backup role password | Neon → Roles | GitHub `production` secret `BACKUP_DATABASE_URL` | Run `backup.yml` by hand to confirm |
| Redis password | Railway `redis` variables (`requirepass` / ACL user) | Railway `api`: `REDIS_URL`; restart `redis` then `api` | Only cache and queue state is lost (SYSTEM_DESIGN.md §6.5) |
| `SETTINGS_ENCRYPTION_KEY` | Generate (below) | See "Encryption key" | The Groq key must be re-encrypted |
| Groq API key | Groq console: create a new key, delete the old | The app's Settings → AI Assistant → Replace key | Only its last 4 characters are ever shown |
| `METRICS_TOKEN` | Generate 32+ random characters | Railway `api`; the metrics scraper | |
| R2 access keys | Cloudflare → R2 → API tokens | GitHub secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | |
| Backup age key | `age-keygen` on the owner's offline machine | GitHub secret `BACKUP_AGE_RECIPIENT` (the public key) | Keep the old **private** key until its last backup is removed (12 weeks) |
| A staff password | The admin's Staff screen → Reset password | — | Resetting ends that person's sessions |

Generate a random value: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.

## Encryption key (`SETTINGS_ENCRYPTION_KEY`)

The shop's Groq key is stored encrypted with this key. Until it is re-encrypted, the AI pages ask for the
key to be entered again. Do this outside opening hours; billing is not affected.

1. Generate the new key (above). Keep the old one at hand.
2. Re-encrypt the stored Groq key, giving the CLI both keys:

   ```
   SETTINGS_ENCRYPTION_KEY=<new> PREVIOUS_SETTINGS_ENCRYPTION_KEY=<old> CLI: cli:rotate-settings-key
   ```

   It prints one of: re-encrypted; already under the current key; no key stored. It is safe to run twice.
   It never prints the Groq key, and writes the audit entry `settings.aiKeyReencrypted`.
3. Set `SETTINGS_ENCRYPTION_KEY=<new>` on Railway `api` and redeploy. Never store
   `PREVIOUS_SETTINGS_ENCRYPTION_KEY` on Railway.
4. Open an AI feature to confirm it answers. If it says the key must be entered again, enter the Groq key in
   Settings (the old encryption key may have been wrong; nothing else is affected).
5. Destroy the old value.
