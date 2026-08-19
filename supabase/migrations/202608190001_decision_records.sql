create table if not exists public.decision_records (
  decision_id text primary key,
  decision jsonb not null,
  response jsonb not null,
  created_at bigint not null check (created_at > 0)
);

create index if not exists decision_records_created_at_idx
  on public.decision_records (created_at);

alter table public.decision_records enable row level security;

revoke all on table public.decision_records from anon, authenticated;
