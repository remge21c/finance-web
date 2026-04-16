-- ================================================
-- 그룹 기능 RLS 정책 수정 및 데이터 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. finance_group_members 테이블의 모든 RLS 정책 삭제를 위한 준비
ALTER TABLE finance_group_members DISABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 삭제 (정책이 존재하는 경우)
DO $$
BEGIN
  -- 정책이 존재하면 삭제
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_group_members' AND policyname = 'group_members_select') THEN
    EXECUTE 'DROP POLICY "group_members_select" ON finance_group_members';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_group_members' AND policyname = 'group_members_insert_owner_admin') THEN
    EXECUTE 'DROP POLICY "group_members_insert_owner_admin" ON finance_group_members';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_group_members' AND policyname = 'group_members_update_owner_admin') THEN
    EXECUTE 'DROP POLICY "group_members_update_owner_admin" ON finance_group_members';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_group_members' AND policyname = 'group_members_delete_owner_admin') THEN
    EXECUTE 'DROP POLICY "group_members_delete_owner_admin" ON finance_group_members';
  END IF;
END $$;

-- 3. RLS 다시 활성화
ALTER TABLE finance_group_members ENABLE ROW LEVEL SECURITY;

-- 4. 새 RLS 정책 생성 (간단한 버전)
CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "group_members_insert" ON finance_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "group_members_update" ON finance_group_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "group_members_delete" ON finance_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ================================================
-- 사용자별 개인 그룹 생성 (없는 경우만)
-- ================================================

-- remge@naver.com 사용자를 위한 그룹 생성
INSERT INTO finance_groups (name, description, created_by)
VALUES (
  'remge@naver.com의 재정',
  '개인 재정 관리를 위한 그룹',
  'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
)
ON CONFLICT DO NOTHING;

-- 그룹 멤버 추가
INSERT INTO finance_group_members (group_id, user_id, role)
SELECT
  g.id as group_id,
  'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7' as user_id,
  'owner' as role
FROM finance_groups g
WHERE g.created_by = 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
AND g.name = 'remge@naver.com의 재정'
AND NOT EXISTS (
  SELECT 1 FROM finance_group_members
  WHERE group_id = g.id
  AND user_id = 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
);

-- 기존 transactions에 group_id 연결
UPDATE finance_transactions
SET group_id = (
  SELECT g.id FROM finance_groups g
  WHERE g.created_by = 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
  AND g.name = 'remge@naver.com의 재정'
  LIMIT 1
)
WHERE user_id = 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
AND group_id IS NULL;

-- 기존 settings에 group_id 연결
UPDATE finance_settings
SET group_id = (
  SELECT g.id FROM finance_groups g
  WHERE g.created_by = 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
  AND g.name = 'remge@naver.com의 재정'
  LIMIT 1
)
WHERE user_id = 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7'
AND group_id IS NULL;

-- ================================================
-- 결과 확인
-- ================================================

-- 그룹 확인
SELECT '=== Groups ===' as info;
SELECT * FROM finance_groups;

-- 그룹 멤버 확인
SELECT '=== Group Members ===' as info;
SELECT gm.*, g.name as group_name
FROM finance_group_members gm
JOIN finance_groups g ON gm.group_id = g.id;

-- 거래 내역 확인
SELECT '=== Transactions ===' as info;
SELECT id, user_id, group_id, date, type, amount
FROM finance_transactions
ORDER BY date DESC
LIMIT 5;
