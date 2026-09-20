-- Creates the private records expected by the app for users created before
-- the on_auth_user_created trigger was installed.
insert into public.profiles (id, display_name)
select
  id,
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    split_part(email, '@', 1)
  )
from auth.users
on conflict (id) do nothing;

insert into public.business_settings (owner_id)
select id
from auth.users
on conflict (owner_id) do nothing;