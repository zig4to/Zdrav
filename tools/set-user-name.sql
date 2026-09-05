-- Enkraten popravek: nastavi ime in priimek uporabniku, ki mu manjkata
-- v metapodatkih (npr. ker sta se ob registraciji nista zbirala).
-- Zazeni v Supabase -> SQL Editor -> New query -> Run.
--
-- displayName() v js/auth.js bere iz user_metadata po vrsti:
--   full_name / name / display_name, sicer first_name + last_name.
-- Zato zapisemo vse tri kljuce.

update auth.users
set raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'first_name', 'Žiga',
           'last_name',  'Tomše',
           'full_name',  'Žiga Tomše'
         )
where email = 'ziga.skater@gmail.com';

-- Preveri rezultat:
select id, email,
       raw_user_meta_data ->> 'first_name' as ime,
       raw_user_meta_data ->> 'last_name'  as priimek,
       raw_user_meta_data ->> 'full_name'  as polno_ime
from auth.users
where email = 'ziga.skater@gmail.com';
