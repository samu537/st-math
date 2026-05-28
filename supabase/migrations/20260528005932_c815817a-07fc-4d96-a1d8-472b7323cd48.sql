CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  body text NOT NULL,
  color text NOT NULL DEFAULT '#ef4444',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat" ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can post chat" ON public.chat_messages
  FOR INSERT TO anon, authenticated WITH CHECK (
    char_length(body) BETWEEN 1 AND 500
    AND char_length(nickname) BETWEEN 1 AND 40
  );

CREATE INDEX chat_messages_created_at_idx ON public.chat_messages (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;