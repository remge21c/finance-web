-- ================================================
-- 사용자 삭제 시 그룹이 함께 삭제되는 문제 수정
-- ================================================
-- 문제: finance_groups.created_by가 ON DELETE CASCADE로 설정되어
-- 사용자 삭제 시 해당 사용자가 생성한 모든 그룹이 삭제됨

-- 해결: ON DELETE CASCADE를 ON DELETE SET NULL로 변경

-- 1. 기존 제약조건 삭제
ALTER TABLE finance_groups DROP CONSTRAINT IF EXISTS finance_groups_created_by_fkey;

-- 2. 새 제약조건 생성 (SET NULL)
ALTER TABLE finance_groups
ADD CONSTRAINT finance_groups_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. created_by를 NULL 허용하도록 수정
ALTER TABLE finance_groups ALTER COLUMN created_by DROP NOT NULL;

-- ================================================
-- 확인을 위한 쿼리
-- ================================================
-- 제약조건 확인
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'finance_groups'::regclass
AND conname LIKE '%created_by%';
