-- 개인재정 모드 제거 마이그레이션 스크립트
-- 실행 전에 반드시 데이터베이스 백업을 하세요.

-- 1. 개인재정 관련 데이터 삭제
-- 개인재정 그룹의 설정 삭제
DELETE FROM finance_settings
WHERE group_id IN (
  SELECT id FROM finance_groups WHERE group_type = 'personal'
);

-- 개인재정 그룹의 거래 내역 삭제
DELETE FROM finance_transactions
WHERE group_id IN (
  SELECT id FROM finance_groups WHERE group_type = 'personal'
);

-- 개인재정 그룹의 멤버 삭제
DELETE FROM finance_group_members
WHERE group_id IN (
  SELECT id FROM finance_groups WHERE group_type = 'personal'
);

-- 개인재정 그룹 삭제
DELETE FROM finance_groups
WHERE group_type = 'personal';

-- 2. can_personal_finance 컬럼 제거 (선택 사항)
-- 주의: 컬럼 제거는 되돌릴 수 없습니다. 신중하게 진행하세요.
ALTER TABLE finance_user_status
DROP COLUMN IF EXISTS can_personal_finance;

-- 3. 확인 쿼리
-- 개인재정 그룹이 모두 삭제되었는지 확인
SELECT COUNT(*) as remaining_personal_groups
FROM finance_groups
WHERE group_type = 'personal';

-- can_personal_finance 컬럼이 제거되었는지 확인
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'finance_user_status'
  AND column_name = 'can_personal_finance';
