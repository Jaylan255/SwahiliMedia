
-- Remove permissive insert; edge function uses service role and bypasses RLS
DROP POLICY IF EXISTS "Anyone can create donations" ON public.donations;
DROP POLICY IF EXISTS "Anyone can read donations" ON public.donations;

-- Allow anyone to read a donation (status polling by id). Sensitive fields are not exposed in the UI.
CREATE POLICY "Public can read donations for status polling"
  ON public.donations FOR SELECT
  USING (true);

-- webhook_logs: no public access at all (only service role writes/reads)
-- (No policies = no access for anon/authenticated, which is what we want.)

-- Fix function search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
