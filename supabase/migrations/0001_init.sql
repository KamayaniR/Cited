-- Cited initial schema (spec v2 Section 8). Additive-only during the hackathon.
create extension if not exists "pgcrypto";

create type source_t as enum ('tavily','hunter','apollo','website','mock');
create type tier_t as enum ('A','B','C');
create type stage_t as enum ('matched','contacted','replied','meeting_booked','closed_lost');
create type outcome_t as enum ('won','lost');
create type actor_t as enum ('agent','rep');
create type email_status_t as enum ('valid','accept_all','invalid','unknown');
create type channel_t as enum ('email','linkedin');
create type message_status_t as enum ('draft','needs_fix','pending_approval','approved','rejected','sent');
create type signal_type_t as enum ('hiring','funding','launch','leadership_change','tech_adoption','expansion','negative');
create type expansion_status_t as enum ('proposed','accepted','adjusted','dismissed');
create type competitor_category_t as enum ('direct','adjacent','status_quo');
create type approval_kind_t as enum ('outreach','schema','icp');
create type approval_status_t as enum ('pending','approved','rejected');

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits_balance numeric not null default 100,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid not null,
  primary key (org_id, user_id)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, description text not null,
  customers text, pricing text, constraints text, team_background text,
  regions text[] not null default '{}', exclude_regions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table icps (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  version int not null,
  data jsonb not null,
  approved_at timestamptz,
  unique (product_id, version)
);

create table expansions (
  id uuid primary key default gen_random_uuid(),
  icp_id uuid not null references icps(id) on delete cascade,
  segment text not null, rationale text not null,
  evidence jsonb not null default '[]',
  status expansion_status_t not null default 'proposed'
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  domain text not null, domain_source source_t not null,
  industry text, naics text, headcount int, region text,
  hq text, hq_source source_t,
  fit_score int, intent_score int, score int, tier tier_t,
  excluded boolean not null default false, exclude_reason text,
  signals_refreshed_at timestamptz,
  unique (org_id, domain),
  check (hq is null or hq_source is not null)
);

create table citations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, entity_id uuid not null,
  url text not null, title text, snippet text,
  fetched_at timestamptz not null default now()
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type signal_type_t not null, summary text not null,
  source_url text not null,
  detected_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null, title text, seniority text,
  email text, email_status email_status_t not null default 'unknown', email_source source_t, mx boolean not null default false,
  linkedin_url text, linkedin_source source_t,
  persona_match numeric,
  unique (company_id, email),
  check (email is null or email_source is not null),
  check (linkedin_url is null or linkedin_source is not null)
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, domain text, category competitor_category_t not null,
  positioning text, pricing text, our_advantage text, source_url text not null
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  stage stage_t not null default 'matched',
  outcome outcome_t,
  owner actor_t not null default 'agent',
  variant char(1) not null default 'A',
  check (stage <> 'closed_lost' or outcome is not null)
);

create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  from_stage stage_t, to_stage stage_t not null,
  actor actor_t not null, note text,
  at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  channel channel_t not null, step int not null, day_offset int not null default 0,
  variant char(1) not null, value_prop text,
  subject text, body text not null,
  signal_ids uuid[] not null default '{}',
  status message_status_t not null default 'draft',
  review jsonb, edited_by_rep boolean not null default false,
  sent_at timestamptz, delivered_to text,
  check (status <> 'sent' or sent_at is not null)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  actor actor_t not null, agent text,
  action text not null, target text, detail text,
  at timestamptz not null default now()
);

create table usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  event_name text not null, quantity int not null default 1, credits numeric not null,
  lead_id uuid references leads(id) on delete set null,
  flexprice_synced boolean not null default false,
  at timestamptz not null default now()
);

create table agent_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  from_role text not null, to_role text, kind text not null, text text not null,
  tokens int not null default 0, cost_usd numeric not null default 0,
  at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind approval_kind_t not null, requested_by text not null,
  payload jsonb not null,
  status approval_status_t not null default 'pending',
  decided_by text, decided_via text check (decided_via in ('band','ui')), note text,
  at timestamptz not null default now()
);

-- Indexes (spec Section 8)
create index on leads (org_id, stage);
create index on messages (status);
create index on signals (company_id);
create index on audit_log (org_id, at desc);
create index on usage_events (org_id, at);
create index on companies (tier, signals_refreshed_at);
create index on citations (entity_type, entity_id);

-- Row Level Security: every org-scoped table readable/writable only by org members.
-- Server routes use the service role key and check the session themselves.
do $$
declare t text;
begin
  foreach t in array array['products','companies','competitors','leads','audit_log','usage_events','agent_events','approvals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I using (org_id in (select org_id from org_members where user_id = auth.uid()))', t || '_member', t);
  end loop;
end $$;
alter table orgs enable row level security;
create policy orgs_member on orgs using (id in (select org_id from org_members where user_id = auth.uid()));
