
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('url','html')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert games"
  ON public.games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete games"
  ON public.games FOR DELETE
  USING (true);
