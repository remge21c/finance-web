-- ================================================
-- 사용자 이름 및 요청 그룹 필드 추가
-- ================================================

-- 1. finance_user_status 테이블에 필드 추가
ALTER TABLE finance_user_status
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE finance_user_status
ADD COLUMN IF NOT EXISTS requested_group_id UUID;

-- 2. 기존 레코드에 빈 이름 업데이트
UPDATE finance_user_status
SET name = COALESCE(name, email)
WHERE name IS NULL OR name = '';

-- 3. 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_finance_user_status_requested_group
ON finance_user_status(requested_group_id);

-- ================================================
-- 결과 확인
-- ================================================

SELECT '=== User Status Columns ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'finance_user_status'
ORDER BY ordinal_position;
