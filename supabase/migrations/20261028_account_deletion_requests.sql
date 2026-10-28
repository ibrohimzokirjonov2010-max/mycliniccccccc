-- Hisobni o'chirish so'rovlari (Google Play / App Store "account deletion" talabi)
-- Supabase SQL Editor'da bir marta ishga tushiring.
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  clinic_id    text,
  user_id      text,
  username     text,
  contact      text,
  scope        text not null default 'user' check (scope in ('user','clinic')),
  reason       text,
  source       text not null default 'app' check (source in ('app','web')),
  status       text not null default 'pending' check (status in ('pending','verified','completed','rejected')),
  processed_at timestamptz
);
alter table public.account_deletion_requests enable row level security;
-- Mijoz (anon) faqat yangi so'rov qo'sha oladi; o'qiy/o'zgartira olmaydi.
drop policy if exists "anon can insert deletion request" on public.account_deletion_requests;
create policy "anon can insert deletion request" on public.account_deletion_requests
  for insert to anon, authenticated with check (status = 'pending' and processed_at is null);
grant insert on public.account_deletion_requests to anon, authenticated;

-- Qayta ishlash (faqat service-role / SQL Editor, 30 kun ichida):
--   scope='user'   : delete from public.users where id = <user_id> and clinic_id = <clinic_id>;
--   scope='clinic' : klinikaga tegishli barcha jadvallardan  delete ... where clinic_id = <clinic_id>;
--                    so'ng delete from public.clinics where id/clinic_id = <clinic_id>;
--   update public.account_deletion_requests set status='completed', processed_at=now() where id=<id>;
