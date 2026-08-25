alter table notes
  add column slug text;

update notes
set slug = 'today-i-created-a-supabase-project'
where title = 'Today I created a Supabase project.';

update notes
set slug = 'i-added-some-data-and-queried-it-from-nextjs'
where title = 'I added some data and queried it from Next.js.';

update notes
set slug = 'it-was-awesome'
where title = 'It was awesome!';

alter table notes
  alter column slug set not null;

create unique index notes_slug_key on notes (slug);

create table note_shares (
  id bigserial primary key,
  note_id bigint not null references notes (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index note_shares_note_email_key
  on note_shares (note_id, lower(email));

alter table note_shares enable row level security;

create policy "Allow recording note shares" on note_shares
for insert
with check (true);

grant insert on table note_shares to anon, authenticated;
grant usage, select on sequence note_shares_id_seq to anon, authenticated;
