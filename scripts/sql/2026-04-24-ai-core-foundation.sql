-- AI Core Foundation database additions
-- Apply in Supabase SQL editor (or migration pipeline) before enabling AI logs/cache in production.

create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  response text not null,
  cost numeric default 0,
  school_id uuid null references public.schools(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_logs_school_id_idx on public.ai_logs(school_id);
create index if not exists ai_logs_created_at_idx on public.ai_logs(created_at desc);

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  response jsonb not null,
  expiry timestamptz not null,
  school_id uuid null references public.schools(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete cascade,
  subject text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_cache_expiry_idx on public.ai_cache(expiry);
create index if not exists ai_cache_scope_idx on public.ai_cache(school_id, class_id, subject);

create or replace function public.touch_ai_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_cache_touch_updated_at on public.ai_cache;
create trigger ai_cache_touch_updated_at
before update on public.ai_cache
for each row
execute function public.touch_ai_cache_updated_at();
