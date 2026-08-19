# Supabase Store

The agent can persist decision records in Supabase Postgres by setting:

```text
DECISION_STORE_BACKEND=supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

Apply the migration in `migrations/202608190001_decision_records.sql` before
starting the agent. The service-role key belongs only on the agent host. Never
place it in Vercel or a `NEXT_PUBLIC_*` variable.

The table has RLS enabled and no public policies. The agent uses the service
role for server-side reads and writes, with retention and record-count limits
enforced by the application.
