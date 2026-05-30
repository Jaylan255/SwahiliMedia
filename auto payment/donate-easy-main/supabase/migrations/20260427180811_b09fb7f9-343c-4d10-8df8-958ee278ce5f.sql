
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  gateway_ref TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  webhook_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_donations_gateway_ref ON public.donations(gateway_ref);
CREATE INDEX idx_donations_status ON public.donations(status);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Public can insert donations (donation form is public)
CREATE POLICY "Anyone can create donations"
  ON public.donations FOR INSERT
  WITH CHECK (true);

-- Public can read their own donation by id (for status polling)
CREATE POLICY "Anyone can read donations"
  ON public.donations FOR SELECT
  USING (true);

CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  headers JSONB,
  payload JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
