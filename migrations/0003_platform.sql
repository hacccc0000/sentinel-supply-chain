-- BuildBouncer platform schema: auth, real scan data, workers, tokens, policy versions.
-- Rows that exist when this migration runs are the bundled NorthBank sample workspace.

alter table workers add column if not exists sample boolean not null default false;
alter table projects add column if not exists sample boolean not null default false;
alter table builds add column if not exists sample boolean not null default false;
alter table quarantine_items add column if not exists sample boolean not null default false;
alter table findings add column if not exists sample boolean not null default false;
alter table sboms add column if not exists sample boolean not null default false;
alter table audit_events add column if not exists sample boolean not null default false;
alter table allowlist_entries add column if not exists sample boolean not null default false;
update workers set sample = true;
update projects set sample = true;
update builds set sample = true;
update quarantine_items set sample = true;
update findings set sample = true;
update sboms set sample = true;
update audit_events set sample = true;
update allowlist_entries set sample = true;

-- workers
alter table workers add column if not exists token_hash text;
alter table workers add column if not exists last_heartbeat_at timestamptz;
alter table workers add column if not exists builtin boolean not null default false;
alter table workers add column if not exists created_at timestamptz not null default now();
alter table workers add column if not exists created_by text;
alter table workers add column if not exists meta jsonb not null default '{}'::jsonb;

-- projects
alter table projects add column if not exists branch text not null default 'main';
alter table projects add column if not exists manifest text;
alter table projects add column if not exists lockfile text;
alter table projects add column if not exists created_at timestamptz not null default now();
alter table projects add column if not exists created_by text;

-- builds
alter table builds add column if not exists created_at timestamptz not null default now();
alter table builds add column if not exists finished_at timestamptz;
alter table builds add column if not exists trigger text not null default 'manual';
alter table builds add column if not exists requested_by text;
alter table builds add column if not exists policy_mode text;
alter table builds add column if not exists policy_version text;
alter table builds add column if not exists events jsonb not null default '[]'::jsonb;
alter table builds add column if not exists forensic jsonb;
alter table builds add column if not exists hosts jsonb not null default '[]'::jsonb;
alter table builds add column if not exists summary jsonb not null default '{}'::jsonb;
alter table builds add column if not exists error text;
alter table builds add column if not exists override_by text;
alter table builds add column if not exists analysis_mode text not null default 'static';

update builds set created_at = now() - interval '4 minutes' where id = '47128';
update builds set created_at = now() - interval '12 minutes' where id = '47127';
update builds set created_at = now() - interval '1 hour' where id = '47126';
update builds set created_at = now() - interval '32 minutes' where id = '47125';
update builds set created_at = now() - interval '2 hours' where id = '47124';
update builds set created_at = now() - interval '5 hours' where id = '47123';
update builds set created_at = now() - interval '7 hours' where id = '47122';
update builds set created_at = now() - interval '9 hours' where id = '47121';
update builds set finished_at = created_at + interval '3 minutes' where finished_at is null;
update builds set analysis_mode = 'sample';

-- quarantine
alter table quarantine_items add column if not exists build_id text;
alter table quarantine_items add column if not exists project_id text;
alter table quarantine_items add column if not exists created_at timestamptz not null default now();
alter table quarantine_items add column if not exists risk_factors jsonb not null default '[]'::jsonb;
alter table quarantine_items add column if not exists scripts jsonb;
alter table quarantine_items add column if not exists analysis jsonb;
alter table quarantine_items add column if not exists decided_by text;
alter table quarantine_items add column if not exists decided_at timestamptz;
alter table quarantine_items add column if not exists note text;
alter table quarantine_items add column if not exists weekly_downloads integer;
update quarantine_items set created_at = now() - interval '4 minutes' where name = 'sap-helper-utils';
update quarantine_items set created_at = now() - interval '18 minutes' where name = 'node-cap-toolkit';
update quarantine_items set created_at = now() - interval '1 hour' where name = '@cdsx/forms';
update quarantine_items set created_at = now() - interval '2 hours' where name = 'passport-saml-helper';
update quarantine_items set created_at = now() - interval '3 hours' where name = 'axios-retry-cap';
update quarantine_items set build_id = '47128', project_id = 'btp-order-extension' where name = 'sap-helper-utils';

-- findings
alter table findings add column if not exists package text;
alter table findings add column if not exists description text;
alter table findings add column if not exists created_at timestamptz not null default now();
alter table findings add column if not exists updated_by text;
alter table findings add column if not exists updated_at timestamptz;
alter table findings add column if not exists note text;
alter table findings add column if not exists project_id text;

-- sboms
alter table sboms add column if not exists created_at timestamptz not null default now();
alter table sboms add column if not exists signature text;
alter table sboms add column if not exists key_id text;
alter table sboms add column if not exists project_id text;
create table if not exists sbom_docs (
  id text primary key references sboms(id) on delete cascade,
  doc jsonb not null
);
update sboms set created_at = now() - interval '4 minutes' where id = 'sbom_8b21a4';
update sboms set created_at = now() - interval '12 minutes' where id = 'sbom_8b219f';
update sboms set created_at = now() - interval '1 hour' where id = 'sbom_8b219a';
update sboms set created_at = now() - interval '32 minutes' where id = 'sbom_8b2195';
update sboms set created_at = now() - interval '2 hours' where id = 'sbom_8b218e';
update sboms set created_at = now() - interval '5 hours' where id = 'sbom_8b2188';

-- audit
alter table audit_events add column if not exists ip text;
alter table audit_events add column if not exists actor_id text;
create index if not exists audit_events_created_idx on audit_events (created_at desc);

-- allowlist / denylist
alter table allowlist_entries add column if not exists created_by text;
alter table allowlist_entries add column if not exists created_at timestamptz not null default now();
create unique index if not exists allowlist_unique on allowlist_entries (kind, value);

-- policy
alter table policy_settings add column if not exists updated_at timestamptz;
alter table policy_settings add column if not exists updated_by text;
create table if not exists policy_versions (
  id serial primary key,
  version text not null,
  mode text not null,
  rules jsonb not null,
  published_by text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
insert into policy_versions (version, mode, rules, published_by, note)
select '4.2', 'block', coalesce(jsonb_agg(jsonb_build_object('id', id, 'enabled', enabled) order by id), '[]'::jsonb), 'system', 'Initial policy bundle'
from policy_rules;
insert into policy_rules (id, category, label, description, enabled, sort_order) values
  ('EGR-01', 'egress', 'Deny non-allowlisted egress', 'Lifecycle scripts that reference hosts outside the egress allowlist are flagged.', true, 1),
  ('EGR-02', 'egress', 'Deny known exfiltration targets', 'Scripts referencing denylisted hosts or patterns (*.cn, pastebin, cloud metadata) are blocked.', true, 2)
on conflict (id) do nothing;

-- integrations
alter table integrations add column if not exists config jsonb not null default '{}'::jsonb;
alter table integrations add column if not exists secret_enc text;
alter table integrations add column if not exists updated_at timestamptz;
alter table integrations add column if not exists updated_by text;
update integrations set connected = false;

-- tenant
alter table tenant_settings add column if not exists signing_key_id text;

-- identity
create table if not exists users (
  id text primary key,
  email text not null,
  name text not null,
  role text not null check (role in ('admin','operator','reviewer','auditor')),
  password_hash text not null,
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists users_email_unique on users (lower(email));

create table if not exists sessions (
  id text primary key,            -- sha256 of the session token
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists api_tokens (
  id text primary key,
  name text not null,
  token_hash text not null unique,
  prefix text not null,
  scope text not null default 'ci',
  created_by text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked boolean not null default false
);

create table if not exists notifications (
  id serial primary key,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  severity text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create sequence if not exists build_seq start 47200;
create index if not exists builds_created_idx on builds (created_at desc);
create index if not exists findings_build_idx on findings (build_id);

create table if not exists app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

insert into allowlist_entries (kind, value, note) values
  ('egress-deny', '*.cn', 'Geo · China origin'),
  ('egress-deny', '169.254.169.254', 'Cloud metadata endpoint'),
  ('egress-deny', 'pastebin.com', 'Known exfiltration target'),
  ('egress-deny', '*.onion', 'Tor hidden services'),
  ('egress-deny', '*.ngrok.io', 'Tunnelling service'),
  ('egress-deny', 'webhook.site', 'Request-capture service')
on conflict (kind, value) do nothing;
