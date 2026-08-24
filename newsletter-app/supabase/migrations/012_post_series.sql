-- Recurring editorial series are independent of the normal article taxonomy.
-- A post can remain in Culture, Style, Life, or Guides while also belonging to
-- one recurring series with edition-specific metadata.
alter table public.blog_posts
  add column if not exists series text not null default '',
  add column if not exists series_month text not null default '',
  add column if not exists series_year text not null default '',
  add column if not exists series_season text not null default '',
  add column if not exists series_issue_number text not null default '',
  add column if not exists series_edition_date text not null default '',
  add column if not exists featured_on_homepage boolean not null default false,
  add column if not exists show_in_latest boolean not null default true,
  add column if not exists show_in_series_section boolean not null default true,
  add column if not exists author text not null default 'Chévere';

create index if not exists blog_posts_series_idx
  on public.blog_posts(series, series_year desc, series_month desc, published_on desc)
  where status = 'published' and series <> '';

-- Seed two existing guides so the public Series hub has useful continuity as
-- soon as this migration is applied. No article is duplicated.
update public.blog_posts
set category = case
      when category like '%seasonal-recommendations%' then category
      else category || ',seasonal-recommendations'
    end,
    series = 'the-month-ahead',
    series_month = '08',
    series_year = '2026',
    show_in_series_section = true,
    updated_at = now()
where slug = 'the-chevere-guide-to-making-the-most-of-august';

update public.blog_posts
set series = 'seasonal-guides',
    series_season = 'Summer',
    series_year = '2026',
    show_in_series_section = true,
    updated_at = now()
where slug = 'chevere-summer-reading-edit';
