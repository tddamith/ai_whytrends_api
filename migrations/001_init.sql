create table if not exists trends (
  id            bigserial primary key,
  key           text not null unique,          -- "YYYY-MM-DD:slug" (US Eastern day)
  title         text not null,
  geo           text not null default 'US',
  approx_traffic integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  triage        jsonb,                          -- Claude Haiku triage result
  state         text not null default 'new'     -- new | skipped | written | failed
);
create index if not exists trends_last_seen_idx on trends (last_seen_at desc);

create table if not exists articles (
  id            bigserial primary key,
  trend_id      bigint not null references trends(id) on delete cascade,
  slug          text not null unique,
  headline      text not null,
  dek           text not null,
  why_trending  text not null,
  body_markdown text not null,
  key_facts     jsonb not null default '[]',
  sources       jsonb not null default '[]',    -- [{n, outlet, title, url}]
  tags          text[] not null default '{}',
  category      text not null default 'other',
  image_url     text,
  image_credit  text,
  image_credit_url text,
  status        text not null default 'review', -- review | published | rejected
  gate_reasons  text[] not null default '{}',
  model         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists articles_published_idx on articles (status, published_at desc);
create index if not exists articles_category_idx on articles (category, published_at desc);
