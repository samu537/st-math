ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;

DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
DROP POLICY IF EXISTS "Anyone can insert games" ON public.games;
DROP POLICY IF EXISTS "Anyone can delete games" ON public.games;
DROP POLICY IF EXISTS "Anyone can update games" ON public.games;
DROP POLICY IF EXISTS "Published games are viewable by everyone" ON public.games;

CREATE POLICY "Published games are viewable by everyone"
ON public.games
FOR SELECT
TO public
USING (published = true);