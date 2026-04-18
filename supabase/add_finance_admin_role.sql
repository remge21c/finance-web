-- ================================================
-- 그룹 멤버 역할에 finance_admin 추가
-- ================================================
-- finance_group_members 테이블의 role 컬럼 제약조건에 'finance_admin' 추가

-- 1. 기존 제약조건 삭제
ALTER TABLE finance_group_members DROP CONSTRAINT IF EXISTS finance_group_members_role_check;

-- 2. 새 제약조건 생성 (finance_admin 포함)
ALTER TABLE finance_group_members
ADD CONSTRAINT finance_group_members_role_check
CHECK (role IN ('owner', 'admin', 'finance_admin', 'member'));

-- ================================================
-- 확인을 위한 쿼리
-- ================================================
-- 제약조건 확인
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'finance_group_members'::regclass
AND conname = 'finance_group_members_role_check';
