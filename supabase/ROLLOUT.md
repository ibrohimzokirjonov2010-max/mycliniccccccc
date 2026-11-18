# Phase 1 rollout

Uzbek qisqa: production bazasiga hozir hech narsa yozilmagan. Avval preview. Keyin zaxira. Keyin pastdagi fayllarni **birma-bir** tasdiqlab ishga tushiring. P0-1, P0-2 va P0-3 qaytarib bo'lmaydi.

Nothing in this branch has been applied to Supabase project `zvyggjldzkxwufpnaatr`. Do not run it against StomaHub `agmkoeuhqrwdvrreamhj`.

## Backup before any SQL

The live project is on the Free plan, so Supabase does not keep automatic daily backups or point-in-time recovery.

1. Dashboard → Database → Backups. Confirm whether a backup add-on is on. It is not, on Free.
2. Take your own dump and store it encrypted, in Germany or Uzbekistan:

```bash
supabase link --project-ref zvyggjldzkxwufpnaatr
supabase db dump -f backup-before-phase1.sql
```

3. Pro plan adds daily backups (7 days on Pro). Point-in-time recovery is a paid add-on on Pro or above and needs the Small compute size or larger. Turn those on before relying on them. Restoring a project from a dump is the fallback until then.
4. Practice a restore on a throwaway project, not on the live one.

If P0-3 rewrites a row that was a real patient, only this dump can bring the text back.

## Deploy the app first, on a preview

1. Merge is not required. Open the preview deployment for this branch.
2. Confirm login with a non-demo clinic user still reaches the dashboard.
3. Confirm the browser network log shows `POST /api/auth?action=login` and no `users?select=*` that returns a `password` field.
4. Confirm a made-up password is rejected and that no Base64 `auth_token` is written.
5. Only after that preview looks right, take the dump above and run the SQL files in order on `zvyggjldzkxwufpnaatr`.

`SUPABASE_SERVICE_ROLE_KEY` must stay on the server only. If it is missing, login returns 503. There is no browser fallback.

## Irreversible steps (approve each file alone)

Run these in the SQL editor, one file per run, after the dump.

| Order | File | What is destroyed | Rollback |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20261118120000_p0_1_drop_execute_sql.sql` | Drops `public.execute_query(text)` and `public.execute_ddl(text)`. The app does not call them. | None. Do not recreate these functions. |
| 2 | `supabase/migrations/20261118120100_p0_2_drop_crm_backup_passwords.sql` | Drops `crm_backup.user_passwords_final` and `crm_backup.clinic_passwords_final`, including every password copy in them. Other `crm_backup` tables stay, with RLS and no policies. `crm_private.user_passwords` is not opened and gets no new policy. | None for the dropped rows. Restore the dump. |
| 3 | `supabase/migrations/20261118120200_p0_3_demo_lock_and_anonymize.sql` | For `default_clinic` and `store-review-demo` only: replaces password hashes with a random hash nobody knows, and rewrites names, phones, addresses, notes, and x-ray URLs to placeholders such as `Demo Bemor 01`. Does not delete rows. Does not touch other clinics. | None for the rewritten text or the old demo password. Restore the dump. |

## Reversible steps (still approve before running)

| Order | File | Effect | Rollback |
| --- | --- | --- | --- |
| 4 | `supabase/migrations/20261118120300_phase1_search_path_password_length.sql` | Sets `search_path` on `update_updated_date_column`. Rejects new plaintext passwords shorter than 8 characters. Does not change existing hashes. | `DROP TRIGGER crm_reject_short_password ON public.users;` |
| 5 | `supabase/migrations/20261118120400_phase1_plan_rls.sql` | Replaces tenant policies. Clinic id comes from JWT `app_metadata`. Basic plans cannot read pro tables. Expenses and user management are admin, or an explicit staff grant. | `supabase/rollbacks/20261118120400_phase1_plan_rls_rollback.sql` |

## Existing users (about 10)

Hashes already live in `crm_private.user_passwords`. Public `users.password` is empty. This rollout does not reset those hashes, except users in `default_clinic` and `store-review-demo`.

Everyone else keeps the same clinic id, username, and password. After the app deploy they must sign in once. The server checks the password and Supabase Auth issues the session (`app_metadata.clinic_id`, `crm_role`, `crm_user_id`). The first successful login creates the shadow Auth user if it does not exist yet.

Short passwords that are already stored still work until that user changes them. New and changed passwords must be at least 8 characters.

## Demo clinic password

P0-3 makes the old demo password stop working. It does not choose a new one, and this repo must not contain one.

After P0-3, set a new password yourself in the SQL editor. Do not paste it into chat or git. The existing capture trigger should move it into `crm_private` and clear the public column:

```sql
UPDATE public.users
SET password = 'type-a-private-password-here'
WHERE lower(clinic_id) = 'default_clinic'
  AND lower(username) = 'admin';
```

Then sign in on the preview. If the public column is still the secret after that update, stop and say so before trying again. Do not leave the secret in `public.users`.

## What the app change does

- Login and handoff only succeed when `/api/auth` returns a Supabase session.
- The unsigned `btoa` JSON token is gone. `auth_token` is removed.
- "Eslab qolish" defaults to off. The signed Supabase session is then kept in `sessionStorage` for that tab. Checked, it stays in `localStorage`. It is still a signed JWT, because the browser must send it to Postgres for row security. An HttpOnly cookie would need a separate API proxy; that is not in this change.
- Plan checks for pro modules use the clinic row, not `localStorage` and not a hardcoded clinic id.
- Password writes go through `/api/auth`. The browser no longer hashes or compares passwords.

## After SQL, check

- Security advisor no longer lists `execute_query` or `execute_ddl`.
- `crm_backup.user_passwords_final` and `clinic_passwords_final` are gone.
- Demo `admin` with the old password is rejected.
- A demo patient list shows `Demo Bemor`, not a real-looking name or phone.
- A 7-character new password is rejected.
- A user from clinic A cannot read clinic B.

## Not in this change

- Leaked-password protection (Needs the Pro plan, then Authentication → Email).
- Two-factor sign-in, receptionist RLS, phone masking, export limits, and the access log.
- StomaHub `agmkoeuhqrwdvrreamhj`. Do not apply these files there.
- HttpOnly session cookies.
