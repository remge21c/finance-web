-- ================================================
-- finance_groups.group_type 정상화
-- Supabase Dashboard → SQL Editor 에서 실행
-- ================================================
--
-- 증상:
--   - 새로 만든 그룹에 가입했는데 새로고침 후 그룹 목록에 안 보임
--   - 슈퍼관리자에게는 보이지만 일반 사용자에게는 안 보임
--
-- 원인:
--   createGroup() 코드가 group_type 을 명시하지 않아서 DB default 값에
--   따라 NULL 또는 'personal' 로 들어감. 일반 사용자 UI 는 'department'
--   인 그룹만 표시하도록 필터링되어 있어 새 그룹이 숨겨짐.
--
-- 이 SQL:
--   1) 컬럼 default 를 'department' 로 변경 (새 INSERT 안전망)
--   2) 기존 NULL / 'personal' row 를 'department' 로 일괄 변환
-- ================================================

-- 1) default 값 변경 — 코드가 누락해도 'department' 로 들어감
ALTER TABLE finance_groups
  ALTER COLUMN group_type SET DEFAULT 'department';

-- 2) 기존 NULL 또는 personal 인 그룹을 department 로 변환
UPDATE finance_groups
SET group_type = 'department'
WHERE group_type IS NULL OR group_type = 'personal';

-- 3) NOT NULL 강제 (선택 — 이후 NULL INSERT 자체를 막음)
ALTER TABLE finance_groups
  ALTER COLUMN group_type SET NOT NULL;

-- ================================================
-- 검증
-- ================================================
-- SELECT id, name, group_type FROM finance_groups ORDER BY created_at DESC;
-- → 모두 'department' 여야 정상
