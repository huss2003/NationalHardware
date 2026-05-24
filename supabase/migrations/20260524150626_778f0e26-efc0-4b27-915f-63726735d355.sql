
-- Seed 7 staff login accounts directly into auth.users + auth.identities.
-- We bypass the normal signup flow (which blocks gmail.com on this project)
-- and rely on the existing public.handle_new_user trigger to populate
-- public.profiles and public.user_roles (first user => admin, rest => billing).

do $$
declare
  rec record;
  new_id uuid;
  users jsonb := jsonb_build_array(
    jsonb_build_object('email','Admin@gmail.com',   'password','PASS001','name','Admin',   'is_admin', true),
    jsonb_build_object('email','Altaf@gmail.com',   'password','PASS002','name','Altaf',   'is_admin', false),
    jsonb_build_object('email','Naeem@gmail.com',   'password','PASS003','name','Naeem',   'is_admin', false),
    jsonb_build_object('email','Hussain@gmail.com', 'password','PASS004','name','Hussain', 'is_admin', false),
    jsonb_build_object('email','Ayais@gmail.com',   'password','PASS005','name','Ayais',   'is_admin', false),
    jsonb_build_object('email','Talib@gmail.com',   'password','PASS006','name','Talib',   'is_admin', false),
    jsonb_build_object('email','Taiyeb@gmail.com',  'password','PASS007','name','Taiyeb',  'is_admin', false)
  );
begin
  for rec in select * from jsonb_array_elements(users) as u(obj) loop
    -- Skip if email already exists.
    if exists (select 1 from auth.users where lower(email) = lower(rec.obj->>'email')) then
      continue;
    end if;

    new_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_id,
      'authenticated',
      'authenticated',
      rec.obj->>'email',
      crypt(rec.obj->>'password', gen_salt('bf')),
      now(), null, null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', rec.obj->>'name'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      new_id,
      new_id::text,
      jsonb_build_object('sub', new_id::text, 'email', rec.obj->>'email', 'email_verified', true),
      'email',
      now(), now(), now()
    );

    -- Promote Admin@gmail.com to admin (trigger already inserts billing or admin
    -- based on whether they are the first signup; we force admin here explicitly).
    if (rec.obj->>'is_admin')::boolean then
      insert into public.user_roles (user_id, role)
      values (new_id, 'admin'::public.app_role)
      on conflict (user_id, role) do nothing;
    end if;
  end loop;
end $$;
