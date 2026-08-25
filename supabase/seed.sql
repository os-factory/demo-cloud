-- Seed data applied after migrations on `supabase start` and `supabase db reset`.
insert into notes (title, slug)
values
  ('Today I created a Supabase project.', 'today-i-created-a-supabase-project'),
  ('I added some data and queried it from Next.js.', 'i-added-some-data-and-queried-it-from-nextjs'),
  ('It was awesome!', 'it-was-awesome');
