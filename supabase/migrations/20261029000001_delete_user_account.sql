-- ============================================================================
-- Account deletion (App Store Guideline 5.1.1(v), Google Play account deletion)
--
-- delete_user_account(p_user_id) removes a user's data so the auth user can be
-- deleted afterwards by the `delete-account` edge function
-- (auth.admin.deleteUser). It is only callable with the service role.
--
-- Tutor accounts:
--   Every row in a table whose `tutor_id` references parents(id) is deleted
--   (students, lessons, payments, sessions, templates, settings, ...). Deleting
--   students cascades their lessons, notes and assignments. Family `parents`
--   rows are NOT deleted: those belong to other users with their own logins.
--   Their parents.tutor_id becomes NULL via its ON DELETE SET NULL FK.
--   Finally the tutor's own parents row is deleted.
--
-- Parent (family) accounts:
--   The login is unlinked from the family record (user_id -> NULL) and the
--   personal account fields are cleared. The family record, students, lesson
--   history and payment records stay with the tutor, because the tutor created
--   them and needs them for their business records. This mirrors the state a
--   family is in before accepting an invitation.
--
-- Both:
--   Any FK that points at parents(id) or auth.users(id) with NO ACTION /
--   RESTRICT would block the delete. Those references are set to NULL when the
--   column is nullable, otherwise the referencing rows are deleted.
--
-- The function is idempotent: calling it again for a user with no parents row
-- only clears the blocking auth.users references.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent RECORD;
  v_fk RECORD;
  v_pass INT;
  v_failed INT := 0;
  v_last_error TEXT;
  v_role TEXT := NULL;
  v_parent_ids UUID[] := '{}';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  FOR v_parent IN
    SELECT id, role FROM public.parents WHERE user_id = p_user_id
  LOOP
    v_role := v_parent.role;
    v_parent_ids := v_parent_ids || v_parent.id;

    IF v_parent.role = 'tutor' THEN
      -- 1. Delete tutor-owned business data. Tables can reference each other
      --    with NO ACTION FKs, so retry in passes until every delete succeeds.
      FOR v_pass IN 1..8 LOOP
        v_failed := 0;
        FOR v_fk IN
          SELECT c.conrelid::regclass AS tbl, a.attname AS col
          FROM pg_constraint c
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          WHERE c.contype = 'f'
            AND c.confrelid = 'public.parents'::regclass
            AND array_length(c.conkey, 1) = 1
            AND a.attname = 'tutor_id'
            AND c.conrelid <> 'public.parents'::regclass
        LOOP
          BEGIN
            EXECUTE format('DELETE FROM %s WHERE %I = $1', v_fk.tbl, v_fk.col)
              USING v_parent.id;
          EXCEPTION WHEN foreign_key_violation THEN
            v_failed := v_failed + 1;
            v_last_error := SQLERRM;
          END;
        END LOOP;
        EXIT WHEN v_failed = 0;
      END LOOP;

      IF v_failed > 0 THEN
        RAISE EXCEPTION 'Could not delete tutor data: %', v_last_error;
      END IF;

      -- 2. Detach remaining blocking references to this parents row.
      FOR v_fk IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col, a.attnotnull AS notnull
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND c.confrelid = 'public.parents'::regclass
          AND array_length(c.conkey, 1) = 1
          AND c.confdeltype IN ('a', 'r')   -- NO ACTION / RESTRICT
      LOOP
        IF v_fk.notnull THEN
          EXECUTE format('DELETE FROM %s WHERE %I = $1', v_fk.tbl, v_fk.col)
            USING v_parent.id;
        ELSE
          EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', v_fk.tbl, v_fk.col, v_fk.col)
            USING v_parent.id;
        END IF;
      END LOOP;

      -- 3. Delete the tutor's own record (CASCADE / SET NULL FKs do the rest).
      DELETE FROM public.parents WHERE id = v_parent.id;
    ELSE
      -- Family account: unlink the login, keep the tutor's records.
      UPDATE public.parents
      SET user_id = NULL,
          avatar_url = NULL,
          invitation_token = NULL,
          invitation_accepted_at = NULL,
          onboarding_completed_at = NULL,
          telegram_chat_id = NULL,
          telegram_username = NULL,
          telegram_linked_at = NULL,
          updated_at = NOW()
      WHERE id = v_parent.id;
    END IF;
  END LOOP;

  -- Detach blocking references to the auth user itself (e.g. admin audit rows).
  FOR v_fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col, a.attnotnull AS notnull
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND array_length(c.conkey, 1) = 1
      AND c.confdeltype IN ('a', 'r')
      AND c.connamespace = 'public'::regnamespace
  LOOP
    IF v_fk.notnull THEN
      EXECUTE format('DELETE FROM %s WHERE %I = $1', v_fk.tbl, v_fk.col)
        USING p_user_id;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', v_fk.tbl, v_fk.col, v_fk.col)
        USING p_user_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('role', v_role, 'parent_ids', to_jsonb(v_parent_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO service_role;

COMMENT ON FUNCTION public.delete_user_account(UUID) IS
  'Deletes or unlinks all app data for an auth user before auth.admin.deleteUser. Service role only. Called by the delete-account edge function.';
