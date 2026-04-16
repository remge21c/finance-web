-- ================================================
-- 그룹 관련 RLS 정책 진단 및 수정
-- ================================================

-- 1. 현재 RLS 정책 확인
SELECT '=== Current RLS Policies ===' as info;
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('finance_groups', 'finance_group_members')
ORDER BY tablename, policyname;

-- 2. finance_group_members RLS 정책 확인
SELECT '=== Group Members RLS ===' as info;
SELECT * FROM finance_group_members LIMIT 5;

-- 3. 사용자별 그룹 멤버 확인
SELECT '=== User Group Memberships ===' as info;
SELECT
  gm.user_id,
  gm.group_id,
  g.name as group_name,
  gm.role
FROM finance_group_members gm
JOIN finance_groups g ON gm.group_id = g.id
ORDER BY gm.user_id, g.name;

-- 4. 그룹별 생성자 확인
SELECT '=== Groups by Creator ===' as info;
SELECT
  id,
  name,
  created_by,
  group_type,
  permissions
FROM finance_groups
ORDER BY created_at DESC;

-- ================================================
-- RLS 정책 수정 (필요한 경우)
-- ================================================

-- finance_group_members 테이블 RLS 정책 수정
DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;

CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
  );

-- 결과 확인
SELECT '=== Fixed Policies ===' as info;
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'finance_group_members';
