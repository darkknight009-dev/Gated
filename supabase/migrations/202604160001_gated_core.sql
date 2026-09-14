-- Gated core schema. Apply with `supabase db push` in each environment.
-- Private mailbox content is protected by row-level security and never exposed anonymously.

create extension if not exists pgcrypto;

create type public.account_role as enum ('owner', 'admin', 'member');
create type public.email_category as enum ('WORTH_READING', 'MAYBE_LATER', 'LOW_VALUE', 'PROMOTIONAL', 'TRANSACTIONAL', 'IMPORTANT');
create type public.feedback_action as enum ('IMPORTANT', 'NOT_IMPORTANT', 'WORTH_READING', 'MAYBE_LATER', 'LOW_VALUE', 'ALWAYS_PRIORITIZE_SENDER', 'NEVER_PRIORITIZE_SENDER');
create type public.job_status as enum ('queued', 'processing', 'succeeded', 'failed', 'dead');
create type public.relationship_type as enum ('unknown', 'customer', 'investor', 'candidate', 'colleague', 'partner', 'personal', 'vendor');
create type public.subscription_plan as enum ('free', 'pro', 'team');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role_title text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.account_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('gmail')),
  provider_account_id text not null,
  email_address text not null,
  scopes text[] not null default '{}',
  connection_status text not null default 'connected' check (connection_status in ('connected', 'reauthorization_required', 'disconnected', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider, provider_account_id)
);

-- No authenticated-client policies are created for this table. Only service_role can read it.
create table public.oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  email_account_id uuid not null unique references public.email_accounts(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  key_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_account_id uuid not null references public.email_accounts(id) on delete cascade,
  provider_thread_id text not null,
  subject text,
  message_count integer not null default 0 check (message_count >= 0),
  participant_emails text[] not null default '{}',
  last_message_at timestamptz,
  user_has_replied boolean not null default false,
  is_active_conversation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_account_id, provider_thread_id)
);

create table public.senders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email text not null,
  domain text not null,
  display_name text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  message_count integer not null default 1 check (message_count >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, email)
);

create table public.sender_relationships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  sender_id uuid not null references public.senders(id) on delete cascade,
  relationship_type public.relationship_type not null default 'unknown',
  historical_importance numeric(4,3) not null default 0.5 check (historical_importance between 0 and 1),
  response_rate numeric(4,3) not null default 0 check (response_rate between 0 and 1),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  updated_at timestamptz not null default now(),
  unique (account_id, sender_id)
);

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_account_id uuid not null references public.email_accounts(id) on delete cascade,
  thread_id uuid references public.email_threads(id) on delete set null,
  sender_id uuid references public.senders(id) on delete set null,
  provider_message_id text not null,
  provider_history_id text,
  rfc_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text not null,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  snippet text,
  body_text text,
  sanitized_html text,
  label_ids text[] not null default '{}',
  is_read boolean not null default false,
  is_deleted boolean not null default false,
  has_attachments boolean not null default false,
  content_hash text not null,
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  sent_at timestamptz not null,
  received_at timestamptz,
  indexed_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(from_name, '') || ' ' || from_email), 'B') ||
    setweight(to_tsvector('english', coalesce(snippet, '') || ' ' || coalesce(body_text, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_account_id, provider_message_id)
);

create table public.email_analyses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_id uuid not null references public.emails(id) on delete cascade,
  content_hash text not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'deterministic_only')),
  intent text not null,
  category public.email_category not null,
  relevance numeric(4,3) not null check (relevance between 0 and 1),
  specificity numeric(4,3) not null check (specificity between 0 and 1),
  context numeric(4,3) not null check (context between 0 and 1),
  intent_clarity numeric(4,3) not null check (intent_clarity between 0 and 1),
  relationship numeric(4,3) not null check (relationship between 0 and 1),
  humanity_signals numeric(4,3) not null check (humanity_signals between 0 and 1),
  quality numeric(4,3) not null check (quality between 0 and 1),
  urgency numeric(4,3) not null check (urgency between 0 and 1),
  genericness numeric(4,3) not null check (genericness between 0 and 1),
  repetition numeric(4,3) not null check (repetition between 0 and 1),
  ai_assistance_probability numeric(4,3),
  injection_signals text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  concern text,
  provider text,
  model_name text,
  model_version text,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12,6),
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (email_id, content_hash, prompt_version)
);

create table public.scoring_versions (
  id text primary key,
  weights jsonb not null,
  category_thresholds jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.attention_scores (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_id uuid not null references public.emails(id) on delete cascade,
  analysis_id uuid not null references public.email_analyses(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  category public.email_category not null,
  scoring_version text not null references public.scoring_versions(id),
  model_version text,
  reasoning_signals jsonb not null,
  override_reason text,
  created_at timestamptz not null default now(),
  unique (email_id, scoring_version, analysis_id)
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  high_priority_topics text[] not null default '{}',
  low_priority_topics text[] not null default '{}',
  custom_context text,
  retention_content_days integer check (retention_content_days in (30, 90, 365) or retention_content_days is null),
  retain_analysis_after_content_deletion boolean not null default true,
  analytics_opt_in boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create table public.user_interests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null,
  weight numeric(4,3) not null default 0.5 check (weight between -1 and 1),
  source text not null default 'onboarding' check (source in ('onboarding', 'explicit', 'feedback')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id, label)
);

create table public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  email_id uuid references public.emails(id) on delete set null,
  sender_id uuid references public.senders(id) on delete set null,
  action public.feedback_action not null,
  previous_category public.email_category,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sender_preferences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sender_id uuid not null references public.senders(id) on delete cascade,
  priority_adjustment smallint not null default 0 check (priority_adjustment between -100 and 100),
  always_prioritize boolean not null default false,
  never_prioritize boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (account_id, user_id, sender_id),
  check (not (always_prioritize and never_prioritize))
);

create table public.outgoing_drafts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  email_account_id uuid references public.email_accounts(id) on delete set null,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  body_text text not null default '',
  purpose text,
  recipient_context text,
  status text not null default 'draft' check (status in ('draft', 'analyzed', 'sent', 'discarded')),
  gmail_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outgoing_analyses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  draft_id uuid not null references public.outgoing_drafts(id) on delete cascade,
  communication_score smallint not null check (communication_score between 0 and 100),
  specificity numeric(4,3) not null,
  context numeric(4,3) not null,
  intent_clarity numeric(4,3) not null,
  relevance numeric(4,3) not null,
  genericness numeric(4,3) not null,
  ask_quality numeric(4,3) not null,
  evidence jsonb not null,
  suggested_body text,
  provider text,
  model_name text,
  model_version text,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table public.sync_states (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_account_id uuid not null unique references public.email_accounts(id) on delete cascade,
  history_id text,
  next_page_token text,
  phase text not null default 'pending' check (phase in ('pending', 'initial', 'incremental', 'idle', 'error')),
  watch_expires_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_account_id uuid references public.email_accounts(id) on delete cascade,
  type text not null check (type in ('initial_sync', 'incremental_sync', 'ingest_message', 'analyze_email', 'renew_watch', 'retention_cleanup')),
  payload jsonb not null default '{}'::jsonb,
  deduplication_key text,
  status public.job_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text,
  request_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index processing_jobs_active_dedupe_idx on public.processing_jobs(deduplication_key)
where deduplication_key is not null and status in ('queued', 'processing');

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  ip_hash text,
  user_agent_family text,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status text not null default 'active',
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  metric text not null,
  quantity bigint not null check (quantity >= 0),
  period_start date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (account_id, metric, period_start)
);

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  name text not null check (name in ('onboarding_started','gmail_connected','sync_completed','email_opened','email_feedback','category_changed','sender_prioritized','outgoing_analysis_started','outgoing_analysis_completed','search_used')),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limit_buckets (
  key_hash text primary key,
  count integer not null default 1,
  window_started_at timestamptz not null default now()
);

create index emails_account_sent_idx on public.emails(account_id, sent_at desc) where is_deleted = false;
create index emails_thread_idx on public.emails(thread_id, sent_at asc);
create index emails_search_idx on public.emails using gin(indexed_document);
create index email_analyses_email_idx on public.email_analyses(email_id, created_at desc);
create index attention_scores_email_idx on public.attention_scores(email_id, created_at desc);
create index feedback_account_idx on public.feedback_events(account_id, created_at desc);
create index jobs_ready_idx on public.processing_jobs(status, available_at) where status in ('queued', 'processing');
create index audit_account_idx on public.audit_events(account_id, created_at desc);

insert into public.scoring_versions(id, weights, category_thresholds, active)
values (
  'attention-v1',
  '{"relevance":0.22,"specificity":0.13,"context":0.16,"intent_clarity":0.09,"relationship":0.16,"humanity_signals":0.04,"quality":0.08,"urgency":0.07,"genericness":-0.10,"repetition":-0.05,"user_preference":0.10,"historical_behavior":0.10}'::jsonb,
  '{"important":88,"worth_reading":70,"maybe_later":42,"low_value":0}'::jsonb,
  true
) on conflict do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_account_id uuid;
begin
  insert into public.users(id, email, display_name, avatar_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'avatar_url');
  insert into public.accounts(name, slug, created_by)
  values (coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s account', new.id::text, new.id)
  returning id into new_account_id;
  insert into public.account_members(account_id, user_id, role) values (new_account_id, new.id, 'owner');
  insert into public.user_preferences(account_id, user_id) values (new_account_id, new.id);
  insert into public.subscriptions(account_id) values (new_account_id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.user_account_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select account_id from public.account_members where user_id = (select auth.uid());
$$;

revoke all on function public.user_account_ids() from public;
grant execute on function public.user_account_ids() to authenticated;

create or replace function public.consume_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare bucket public.rate_limit_buckets%rowtype;
begin
  insert into public.rate_limit_buckets(key_hash, count, window_started_at)
  values (p_key_hash, 1, now())
  on conflict (key_hash) do update set
    count = case when public.rate_limit_buckets.window_started_at < now() - make_interval(secs => p_window_seconds) then 1 else public.rate_limit_buckets.count + 1 end,
    window_started_at = case when public.rate_limit_buckets.window_started_at < now() - make_interval(secs => p_window_seconds) then now() else public.rate_limit_buckets.window_started_at end
  returning * into bucket;
  return query select bucket.count <= p_limit, greatest(p_limit - bucket.count, 0), greatest(ceil(extract(epoch from bucket.window_started_at + make_interval(secs => p_window_seconds) - now()))::integer, 0);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create or replace function public.claim_processing_jobs(p_worker text, p_limit integer default 10)
returns setof public.processing_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select id from public.processing_jobs
    where (status = 'queued' and available_at <= now())
       or (status = 'processing' and locked_at < now() - interval '10 minutes')
    order by available_at, created_at
    for update skip locked limit least(p_limit, 25)
  )
  update public.processing_jobs j set
    status = 'processing', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
  from candidates where j.id = candidates.id returning j.*;
end;
$$;

revoke all on function public.claim_processing_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_processing_jobs(text, integer) to service_role;

create or replace function public.search_emails(p_query text, p_account_id uuid, p_limit integer default 50)
returns table(email_id uuid, rank real) language sql stable set search_path = '' as $$
  select e.id, ts_rank_cd(e.indexed_document, websearch_to_tsquery('english', p_query))
  from public.emails e
  where e.account_id = p_account_id
    and e.account_id in (select public.user_account_ids())
    and not e.is_deleted
    and e.indexed_document @@ websearch_to_tsquery('english', p_query)
  order by 2 desc, e.sent_at desc limit least(p_limit, 100);
$$;

grant execute on function public.search_emails(text, uuid, integer) to authenticated;

-- RLS: users can only access rows belonging to accounts they are members of.
alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.email_accounts enable row level security;
alter table public.oauth_credentials enable row level security;
alter table public.email_threads enable row level security;
alter table public.senders enable row level security;
alter table public.sender_relationships enable row level security;
alter table public.emails enable row level security;
alter table public.email_analyses enable row level security;
alter table public.attention_scores enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_interests enable row level security;
alter table public.feedback_events enable row level security;
alter table public.sender_preferences enable row level security;
alter table public.outgoing_drafts enable row level security;
alter table public.outgoing_analyses enable row level security;
alter table public.sync_states enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.audit_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
alter table public.product_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy users_self_select on public.users for select to authenticated using (id = (select auth.uid()));
create policy users_self_update on public.users for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy account_member_select on public.accounts for select to authenticated using (id in (select public.user_account_ids()));
create policy memberships_self_select on public.account_members for select to authenticated using (user_id = (select auth.uid()));

-- Uniform account isolation for product tables. Mutations also require explicit account membership.
create policy email_accounts_member_all on public.email_accounts for all to authenticated using (account_id in (select public.user_account_ids())) with check (account_id in (select public.user_account_ids()) and user_id = (select auth.uid()));
create policy threads_member_all on public.email_threads for all to authenticated using (account_id in (select public.user_account_ids())) with check (account_id in (select public.user_account_ids()));
create policy senders_member_all on public.senders for all to authenticated using (account_id in (select public.user_account_ids())) with check (account_id in (select public.user_account_ids()));
create policy relationships_member_all on public.sender_relationships for all to authenticated using (account_id in (select public.user_account_ids())) with check (account_id in (select public.user_account_ids()));
create policy emails_member_all on public.emails for all to authenticated using (account_id in (select public.user_account_ids())) with check (account_id in (select public.user_account_ids()));
create policy analyses_member_select on public.email_analyses for select to authenticated using (account_id in (select public.user_account_ids()));
create policy scores_member_select on public.attention_scores for select to authenticated using (account_id in (select public.user_account_ids()));
create policy preferences_owner_all on public.user_preferences for all to authenticated using (user_id = (select auth.uid()) and account_id in (select public.user_account_ids())) with check (user_id = (select auth.uid()) and account_id in (select public.user_account_ids()));
create policy interests_owner_all on public.user_interests for all to authenticated using (user_id = (select auth.uid()) and account_id in (select public.user_account_ids())) with check (user_id = (select auth.uid()) and account_id in (select public.user_account_ids()));
create policy feedback_owner_all on public.feedback_events for all to authenticated using (user_id = (select auth.uid()) and account_id in (select public.user_account_ids())) with check (user_id = (select auth.uid()) and account_id in (select public.user_account_ids()));
create policy sender_preferences_owner_all on public.sender_preferences for all to authenticated using (user_id = (select auth.uid()) and account_id in (select public.user_account_ids())) with check (user_id = (select auth.uid()) and account_id in (select public.user_account_ids()));
create policy drafts_owner_all on public.outgoing_drafts for all to authenticated using (user_id = (select auth.uid()) and account_id in (select public.user_account_ids())) with check (user_id = (select auth.uid()) and account_id in (select public.user_account_ids()));
create policy outgoing_analyses_member_select on public.outgoing_analyses for select to authenticated using (account_id in (select public.user_account_ids()));
create policy sync_member_select on public.sync_states for select to authenticated using (account_id in (select public.user_account_ids()));
create policy jobs_member_insert on public.processing_jobs for insert to authenticated with check (account_id in (select public.user_account_ids()));
create policy jobs_member_select on public.processing_jobs for select to authenticated using (account_id in (select public.user_account_ids()));
create policy audit_member_select on public.audit_events for select to authenticated using (account_id in (select public.user_account_ids()));
create policy subscriptions_member_select on public.subscriptions for select to authenticated using (account_id in (select public.user_account_ids()));
create policy usage_member_select on public.usage_records for select to authenticated using (account_id in (select public.user_account_ids()));
create policy events_owner_insert on public.product_events for insert to authenticated with check (user_id = (select auth.uid()) and account_id in (select public.user_account_ids()));

-- Scoring versions contain no tenant data and are readable by authenticated users.
alter table public.scoring_versions enable row level security;
create policy scoring_versions_read on public.scoring_versions for select to authenticated using (true);

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
-- Browser sessions are read-only for provider-managed and derived records. Mutations go through authorized route handlers.
grant select on public.users, public.accounts, public.account_members, public.email_accounts, public.email_threads, public.senders, public.sender_relationships, public.emails, public.email_analyses, public.attention_scores, public.user_preferences, public.user_interests, public.feedback_events, public.sender_preferences, public.outgoing_drafts, public.outgoing_analyses, public.sync_states, public.processing_jobs, public.audit_events, public.subscriptions, public.usage_records, public.scoring_versions to authenticated;
grant update on public.users, public.user_preferences to authenticated;
