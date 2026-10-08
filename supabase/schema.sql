-- Community Club Matchday: the online database (Supabase / Postgres).
-- Run once in the SQL Editor of the club's Supabase project. Safe to run again after changes.
-- Same pattern as TM Bweyogerere:
--  * The tables can't be reached from the internet at all: the API roles get no rights on them.
--  * The app talks to the database only through the cc_* functions below. Each one checks, inside
--    the database, who is signed in. The public key on its own can read or change nothing.
--  * Sign-ups are switched off in Supabase Auth, so only accounts an admin adds can sign in, and a
--    new account sees nothing until an admin gives it a role here.
--  * Every save, sign-in and account change goes into an audit log nobody can edit or delete.
--
-- Roles
--   admin   everything, plus accounts, restore and delete-all
--   editor  every record (squad, training, games, injuries); no accounts

create extension if not exists pgcrypto with schema extensions;

-- ================================================================ tables
create table if not exists cc_members (            -- who may use the app, and as what
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        text not null check (role in ('admin', 'editor')),
  disabled    boolean not null default false,
  must_change boolean not null default false,      -- signed in with a temporary password
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);

create table if not exists cc_records (            -- every record the app keeps, one row each
  collection  text not null,                       -- players, sessions, matches, comments, skills, injuries, club
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (collection, id)
);

create table if not exists cc_audit (              -- append-only
  id        bigserial primary key,
  ts        timestamptz not null default now(),
  user_id   uuid,
  name      text,
  action    text not null,
  detail    text
);

alter table cc_members enable row level security;
alter table cc_records enable row level security;
alter table cc_audit enable row level security;
-- no policies on purpose: nothing gets in except through the functions below
revoke all on cc_members, cc_records, cc_audit from public, anon, authenticated;
revoke all on sequence cc_audit_id_seq from public, anon, authenticated;

-- ================================================================ helper (not callable from the app)
create or replace function cc_member_row() returns cc_members
language sql stable security definer set search_path = public, pg_temp as $$
  select * from cc_members where user_id = auth.uid() and not disabled
$$;

-- ================================================================ the app's functions
-- Who am I? status: ok | first (no admin yet) | waiting (no role yet) | off (switched off)
create or replace function cc_me() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members; em text;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'signed-out'); end if;
  select email into em from auth.users where id = auth.uid();
  select * into m from cc_members where user_id = auth.uid();
  if not found then
    return jsonb_build_object('status', case when exists (select 1 from cc_members) then 'waiting' else 'first' end, 'email', em);
  end if;
  if m.disabled then return jsonb_build_object('status', 'off', 'email', em); end if;
  update cc_members set last_login = now() where user_id = m.user_id;
  return jsonb_build_object('status', 'ok', 'id', m.user_id, 'name', m.name, 'email', em, 'role', m.role, 'mustChange', m.must_change);
end $$;

-- The very first person to sign in becomes the admin. After that, only an admin gives roles.
create or replace function cc_claim_admin(p_name text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Please give your name.'; end if;
  lock table cc_members in share row exclusive mode;
  if exists (select 1 from cc_members) then raise exception 'There is already an admin. Ask them to give you a role.'; end if;
  insert into cc_members (user_id, name, role) values (auth.uid(), left(trim(p_name), 80), 'admin');
  insert into cc_audit (user_id, name, action, detail) values (auth.uid(), left(trim(p_name), 80), 'setup', 'Became the first admin');
  return cc_me();
end $$;

-- Everything, in one go (admins and editors both see all records)
create or replace function cc_load() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members; recs jsonb;
begin
  m := cc_member_row();
  if m.user_id is null then raise exception 'This account has no access.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('c', collection, 'id', id, 'd', data) order by collection, id), '[]') into recs from cc_records;
  return jsonb_build_object('records', recs, 'at', now());
end $$;

-- Save changes: {changes: [{c, id, d}], note}; d = null deletes. Only known collections are accepted.
create or replace function cc_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m cc_members; ch jsonb; c text; rid text; nd jsonb; saved int := 0; deleted int := 0; rejected jsonb := '[]';
  allowed text[] := array['players', 'sessions', 'matches', 'comments', 'skills', 'injuries', 'club'];
begin
  m := cc_member_row();
  if m.user_id is null then raise exception 'This account has no access.' using errcode = '42501'; end if;
  for ch in select value from jsonb_array_elements(coalesce(p->'changes', '[]')) loop
    c := ch->>'c'; rid := ch->>'id'; nd := ch->'d';
    if nd = 'null'::jsonb then nd := null; end if;
    if c is null or rid is null or length(rid) > 120 or not (c = any(allowed))
       or (nd is not null and pg_column_size(nd) > 300000) then
      rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', rid)); continue;
    end if;
    if nd is null then
      delete from cc_records where collection = c and id = rid; deleted := deleted + 1;
    else
      insert into cc_records (collection, id, data, updated_at, updated_by) values (c, rid, nd, now(), auth.uid())
      on conflict (collection, id) do update set data = excluded.data, updated_at = now(), updated_by = auth.uid();
      saved := saved + 1;
    end if;
  end loop;
  if saved + deleted > 0 then
    insert into cc_audit (user_id, name, action, detail)
    values (auth.uid(), m.name, 'save', left(coalesce(nullif(p->>'note', ''), format('%s saved, %s deleted', saved, deleted)), 500));
  end if;
  return jsonb_build_object('saved', saved, 'deleted', deleted, 'rejected', rejected);
end $$;

-- Wipe every record (admin only): used by "Delete all data" and before a restore
create or replace function cc_wipe() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members; n int;
begin
  m := cc_member_row();
  if m.role is distinct from 'admin' then raise exception 'Only an admin can delete everything.' using errcode = '42501'; end if;
  delete from cc_records; get diagnostics n = row_count;
  insert into cc_audit (user_id, name, action, detail) values (auth.uid(), m.name, 'wipe', format('Deleted all %s records', n));
  return jsonb_build_object('deleted', n);
end $$;

create or replace function cc_audit_log() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members;
begin
  m := cc_member_row();
  if m.role is distinct from 'admin' then raise exception 'Only an admin can see the log.' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('ts', a.ts, 'name', a.name, 'action', a.action, 'detail', a.detail) order by a.id desc), '[]')
          from (select * from cc_audit order by id desc limit 300) a);
end $$;

-- ---------------------------------------------------------------- accounts (admin only)
create or replace function cc_accounts() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members;
begin
  m := cc_member_row();
  if m.role is distinct from 'admin' then raise exception 'Only an admin can see accounts.' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'created', u.created_at, 'lastSignIn', u.last_sign_in_at,
      'member', case when t.user_id is null then null else jsonb_build_object('name', t.name, 'role', t.role,
        'disabled', t.disabled, 'mustChange', t.must_change) end) order by coalesce(t.name, u.email)), '[]')
    from auth.users u left join cc_members t on t.user_id = u.id);
end $$;

-- give an account its name and role (or change them); p: {name, role, disabled, mustChange}
create or replace function cc_account_set(p_user uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members; old cc_members; r text := p->>'role';
begin
  m := cc_member_row();
  if m.role is distinct from 'admin' then raise exception 'Only an admin can change accounts.' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'No such account.'; end if;
  if r not in ('admin', 'editor') then raise exception 'Unknown role.'; end if;
  if length(trim(coalesce(p->>'name', ''))) < 2 then raise exception 'Please give their name.'; end if;
  select * into old from cc_members where user_id = p_user;
  -- never leave the system without an active admin
  if old.role = 'admin' and (r <> 'admin' or coalesce((p->>'disabled')::boolean, false))
     and not exists (select 1 from cc_members where role = 'admin' and not disabled and user_id <> p_user) then
    raise exception 'This is the only admin. Make someone else an admin first.';
  end if;
  insert into cc_members (user_id, name, role, disabled, must_change)
  values (p_user, left(trim(p->>'name'), 80), r, coalesce((p->>'disabled')::boolean, false), coalesce((p->>'mustChange')::boolean, false))
  on conflict (user_id) do update set name = excluded.name, role = excluded.role, disabled = excluded.disabled, must_change = excluded.must_change;
  insert into cc_audit (user_id, name, action, detail)
  values (auth.uid(), m.name, case when old.user_id is null then 'user.add' else 'user.edit' end,
          format('%s: %s%s', left(trim(p->>'name'), 80), r, case when coalesce((p->>'disabled')::boolean, false) then ' (switched off)' else '' end));
  return jsonb_build_object('ok', true);
end $$;

-- temporary password for someone who forgot theirs; they choose a new one when they sign in
create or replace function cc_reset_password(p_user uuid, p_password text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members; who text;
begin
  m := cc_member_row();
  if m.role is distinct from 'admin' then raise exception 'Only an admin can reset passwords.' using errcode = '42501'; end if;
  if length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
  if not found then raise exception 'No such account.'; end if;
  delete from auth.sessions where user_id = p_user;              -- signs them out everywhere
  update cc_members set must_change = true where user_id = p_user returning name into who;
  insert into cc_audit (user_id, name, action, detail) values (auth.uid(), m.name, 'user.reset', 'Temporary password for ' || coalesce(who, p_user::text));
  return jsonb_build_object('ok', true);
end $$;

create or replace function cc_password_changed() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m cc_members;
begin
  m := cc_member_row();
  if m.user_id is null then raise exception 'This account has no access.' using errcode = '42501'; end if;
  update cc_members set must_change = false where user_id = m.user_id;
  insert into cc_audit (user_id, name, action, detail) values (m.user_id, m.name, 'password', 'Changed own password');
  return jsonb_build_object('ok', true);
end $$;

-- A harmless "are you there?" for the daily keep-alive (tools/keepalive): Supabase pauses free
-- projects after a week without use. It reads no records and returns only 'ok'.
create or replace function cc_ping() returns text
language sql stable set search_path = public, pg_temp as $$ select 'ok'::text $$;
revoke execute on function cc_ping() from public;
grant execute on function cc_ping() to anon, authenticated;

-- ================================================================ who may call what
revoke execute on function cc_member_row() from public, anon, authenticated;
revoke execute on function cc_me(), cc_claim_admin(text), cc_load(), cc_save(jsonb), cc_wipe(), cc_audit_log(),
  cc_accounts(), cc_account_set(uuid, jsonb), cc_reset_password(uuid, text), cc_password_changed() from public, anon;
grant execute on function cc_me(), cc_claim_admin(text), cc_load(), cc_save(jsonb), cc_wipe(), cc_audit_log(),
  cc_accounts(), cc_account_set(uuid, jsonb), cc_reset_password(uuid, text), cc_password_changed() to authenticated;

notify pgrst, 'reload schema';
