-- Replace PASTE_YOUR_USER_ID_HERE with your own UUID from:
-- Supabase > Authentication > Users > your StoryTuner account > User UID
insert into public.community_moderators (user_id, role)
values ('PASTE_YOUR_USER_ID_HERE', 'admin')
on conflict (user_id) do update set role = excluded.role;
