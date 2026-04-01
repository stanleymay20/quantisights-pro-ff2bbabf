-- Remove subscriptions from realtime publication to prevent Stripe ID leaks
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;