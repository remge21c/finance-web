-- 권한 시스템 통합 마이그레이션
-- 기존 role + JSONB permissions → permission_level 단일 필드

-- 1. 새 컬럼 추가
ALTER TABLE finance_group_members
  ADD COLUMN IF NOT EXISTS permission_level VARCHAR(20)
  CHECK (permission_level IN ('admin', 'assistant', 'general'));

-- 2. 기존 데이터 백필
UPDATE finance_group_members gm
SET permission_level = CASE
  WHEN gm.role IN ('finance_admin', 'owner', 'admin') THEN 'admin'
  WHEN EXISTS (
    SELECT 1 FROM finance_groups g
    WHERE g.id = gm.group_id
    AND g.permissions->'can_write' ? gm.user_id::text
  ) THEN 'assistant'
  ELSE 'general'
END
WHERE permission_level IS NULL;

-- 3. NOT NULL + DEFAULT
ALTER TABLE finance_group_members
  ALTER COLUMN permission_level SET NOT NULL,
  ALTER COLUMN permission_level SET DEFAULT 'general';

-- 검증 쿼리 (마이그레이션 후 실행)
-- SELECT permission_level, count(*) FROM finance_group_members GROUP BY permission_level;
-- SELECT count(*) FROM finance_group_members WHERE permission_level IS NULL; -- 0이어야 함
