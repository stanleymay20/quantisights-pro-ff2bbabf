-- Enable realtime on the metrics table for live streaming
ALTER PUBLICATION supabase_realtime ADD TABLE public.metrics;