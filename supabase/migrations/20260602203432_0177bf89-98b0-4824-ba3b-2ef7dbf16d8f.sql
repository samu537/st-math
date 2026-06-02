DROP POLICY "Users can start calls" ON public.voice_calls;

CREATE POLICY "Users can start calls with accepted friends"
ON public.voice_calls
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = caller_id
  AND status = 'ringing'
  AND EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = caller_id AND f.addressee_id = callee_id)
        OR (f.requester_id = callee_id AND f.addressee_id = caller_id)
      )
  )
);