-- ============================================================
-- DANGEROUS: полный сброс таблиц приложения в Supabase
-- Запускайте только если вы понимаете последствия (данные удалятся).
-- ============================================================

drop table if exists public.blackjack_history;
drop table if exists public.blackjack_players;
drop table if exists public.blackjack_rooms;
drop table if exists public.profiles;
