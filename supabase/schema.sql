-- Shema za Zdrav — vsak uporabnik ima svoje jedi.
-- Prilepi v Supabase -> SQL Editor -> New query -> Run.
-- Skripta je varna za veckratni zagon.
--
-- Za razliko od Iskre tu OBSTAJA prijava (Supabase Auth, e-posta + geslo),
-- zato je vsaka vrstica vezana na uporabnika prek user_id = auth.uid(),
-- RLS pa poskrbi, da uporabnik vidi in spreminja samo svoje jedi.

-- ============================================================ tabela: jedi
create table if not exists public.jedi (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  kategorija text        not null
                         check (kategorija in ('zajtrk', 'kosilo', 'vecerja', 'malica')),
  ime        text        not null,
  sestavine  text        not null default '',
  slika_pot  text,                              -- pot v Storage bucketu 'jedi-slike', ali NULL
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jedi_user_kategorija_idx
  on public.jedi (user_id, kategorija, created_at desc);

-- Samodejno osvezi updated_at ob vsakem update-u.
create or replace function public.jedi_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jedi_touch on public.jedi;
create trigger jedi_touch before update on public.jedi
  for each row execute function public.jedi_touch();

-- ---------------------------------------------------------------- RLS: jedi
alter table public.jedi enable row level security;

grant select, insert, update, delete on table public.jedi to authenticated;

drop policy if exists "jedi_select_own" on public.jedi;
create policy "jedi_select_own" on public.jedi
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jedi_insert_own" on public.jedi;
create policy "jedi_insert_own" on public.jedi
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "jedi_update_own" on public.jedi;
create policy "jedi_update_own" on public.jedi
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "jedi_delete_own" on public.jedi;
create policy "jedi_delete_own" on public.jedi
  for delete to authenticated
  using (auth.uid() = user_id);

-- ==================================================== Storage: slike jedi
-- Zaseben bucket. Datoteke so shranjene po mapah: <user_id>/<jed_id>.jpg
insert into storage.buckets (id, name, public)
values ('jedi-slike', 'jedi-slike', false)
on conflict (id) do nothing;

-- Uporabnik lahko dela samo z datotekami v svoji mapi (prvi segment poti = auth.uid()).
drop policy if exists "jedi_slike_select_own" on storage.objects;
create policy "jedi_slike_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'jedi-slike'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "jedi_slike_insert_own" on storage.objects;
create policy "jedi_slike_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'jedi-slike'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "jedi_slike_update_own" on storage.objects;
create policy "jedi_slike_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'jedi-slike'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "jedi_slike_delete_own" on storage.objects;
create policy "jedi_slike_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'jedi-slike'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Osvezi PostgREST shema predpomnilnik, da je tabela `jedi` takoj vidna prek API.
notify pgrst, 'reload schema';
