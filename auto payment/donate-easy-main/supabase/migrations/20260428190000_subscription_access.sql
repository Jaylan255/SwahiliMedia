CREATE TABLE public.user_subscriptions (
  user_id TEXT NOT NULL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unpaid',
  plan TEXT,
  amount NUMERIC(12,2),
  phone TEXT,
  days_assigned INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  expiry_date TIMESTAMP WITH TIME ZONE,
  last_payment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donation_id UUID NOT NULL UNIQUE REFERENCES public.donations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  phone TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_expiry_date ON public.user_subscriptions(expiry_date);
CREATE INDEX idx_subscription_payments_user_id ON public.subscription_payments(user_id);
CREATE INDEX idx_subscription_payments_status ON public.subscription_payments(payment_status);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_subscription_statuses()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET
    status = 'unpaid',
    days_assigned = 0,
    updated_at = now()
  WHERE expiry_date IS NOT NULL
    AND expiry_date <= now()
    AND status <> 'unpaid';
END;
$$;

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
