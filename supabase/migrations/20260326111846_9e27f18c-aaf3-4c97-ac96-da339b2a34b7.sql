
-- Allow authenticated users to insert their own org subscription (for signup flow)
CREATE POLICY "Users can create own org subscription" ON public.org_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = user_org_id(auth.uid())
  );
