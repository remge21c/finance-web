-- 재정 접근 권한 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS can_personal_finance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_group_finance BOOLEAN DEFAULT TRUE;

-- 기존 슈퍼관리자/재정관리자에게 개인재정 권한 부여
UPDATE finance_user_status
SET can_personal_finance = TRUE
WHERE is_super_admin = TRUE OR is_finance_admin = TRUE;
