ALTER TABLE public.known_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access" ON public.known_devices
  FOR ALL USING (false);

CREATE POLICY "No direct access" ON public.notification_tracking
  FOR ALL USING (false);