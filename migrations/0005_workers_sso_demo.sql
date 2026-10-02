alter table projects add column if not exists worker_id text;
alter table builds add column if not exists assigned_worker text;
alter table builds add column if not exists claimed_at timestamptz;
alter table users add column if not exists sso_subject text;
create table if not exists demo_requests (
  id serial primary key,
  company text not null,
  contact text not null,
  landscape text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
