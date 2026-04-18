-- finance_user_status 테이블에 requested_role 컬럼 추가
-- 가입 시 역할 선택: 'user' (일반사용자) | 'finance_admin' (재정관리자 신청)

ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS requested_role TEXT DEFAULT 'user'
  CHECK (requested_role IN ('finance_admin', 'user'));
