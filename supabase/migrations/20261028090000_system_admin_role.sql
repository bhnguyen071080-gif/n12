-- Dedicated system administrator role. Kept in its own transaction because
-- PostgreSQL enum additions must be committed before later migrations use them.
begin;
alter type public.eam_role add value if not exists 'QUAN_TRI_HE_THONG';
commit;
