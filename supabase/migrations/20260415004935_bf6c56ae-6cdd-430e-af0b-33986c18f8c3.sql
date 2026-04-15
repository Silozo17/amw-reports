ALTER TABLE public.client_users
ADD CONSTRAINT client_users_user_id_client_id_unique
UNIQUE (user_id, client_id);