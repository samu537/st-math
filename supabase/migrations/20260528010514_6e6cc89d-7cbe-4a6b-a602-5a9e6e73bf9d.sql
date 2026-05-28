
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  color text NOT NULL DEFAULT '#ef4444',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname text;
BEGIN
  uname := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  IF uname = '' THEN uname := 'user'; END IF;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    uname := uname || floor(random()*1000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name, color)
  VALUES (NEW.id, uname, COALESCE(NEW.raw_user_meta_data->>'display_name', uname), '#ef4444');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FRIENDSHIPS
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "Send friend request" ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id AND status = 'pending');
CREATE POLICY "Accept friend request" ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = addressee_id);
CREATE POLICY "Delete own friendship" ON public.friendships FOR DELETE TO authenticated USING (auth.uid() IN (requester_id, addressee_id));

-- GROUPS
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT true,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

CREATE POLICY "Public or member can view group" ON public.groups FOR SELECT USING (is_public OR public.is_group_member(id, auth.uid()));
CREATE POLICY "Create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates group" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes group" ON public.groups FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "View members of accessible group" ON public.group_members FOR SELECT TO authenticated USING (
  public.is_group_member(group_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.is_public)
);
CREATE POLICY "Join public group" ON public.group_members FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.is_public OR g.owner_id = auth.uid()))
);
CREATE POLICY "Leave group" ON public.group_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.add_group_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END $$;
CREATE TRIGGER on_group_created AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.add_group_owner();

-- GROUP MESSAGES
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read group messages" ON public.group_messages FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members post group messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (
  public.is_group_member(group_id, auth.uid()) AND auth.uid() = user_id AND char_length(body) BETWEEN 1 AND 1000
);
CREATE INDEX group_messages_group_created_idx ON public.group_messages (group_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
