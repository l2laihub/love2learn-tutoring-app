-- Fix: "Database error saving new user" on parent self sign-up
--
-- handle_new_user() runs as supabase_auth_admin, whose search_path is `auth`.
-- For parent rows it inserts into public.parents, which fires
-- set_parent_tutor_id() (20260520000001). That function calls
-- get_current_tutor_id() unqualified and has no search_path of its own, so the
-- lookup fails with "function get_current_tutor_id() does not exist" and the
-- whole sign-up rolls back. Tutor sign-ups were unaffected because the guard
-- skips role = 'tutor'.
--
-- Pin search_path on every function in the sign-up path (also Supabase's
-- recommendation for SECURITY DEFINER functions).

ALTER FUNCTION public.set_parent_tutor_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_tutor_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
