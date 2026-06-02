CREATE TABLE public.voice_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'answered', 'declined', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  CHECK (caller_id <> callee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_calls TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calls"
ON public.voice_calls
FOR SELECT
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can start calls"
ON public.voice_calls
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = caller_id AND status = 'ringing');

CREATE POLICY "Users can update their own calls"
ON public.voice_calls
FOR UPDATE
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id)
WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can delete their own calls"
ON public.voice_calls
FOR DELETE
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX idx_voice_calls_callee_status ON public.voice_calls (callee_id, status, created_at DESC);
CREATE INDEX idx_voice_calls_caller_status ON public.voice_calls (caller_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.protect_voice_call_parties()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.caller_id <> OLD.caller_id OR NEW.callee_id <> OLD.callee_id OR NEW.room_id <> OLD.room_id THEN
    RAISE EXCEPTION 'Call participants cannot be changed';
  END IF;
  IF NEW.status = 'answered' AND OLD.answered_at IS NULL THEN
    NEW.answered_at := now();
  END IF;
  IF NEW.status IN ('declined', 'ended') AND OLD.ended_at IS NULL THEN
    NEW.ended_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_voice_call_parties_before_update
BEFORE UPDATE ON public.voice_calls
FOR EACH ROW
EXECUTE FUNCTION public.protect_voice_call_parties();

ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_calls;