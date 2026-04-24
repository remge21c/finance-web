-- ================================================
-- finance_group_members UPDATE RLS 정책 수정
-- 전체관리자(super admin)가 permission_level을 변경할 수 있도록 허용
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. 기존 update/insert/delete 정책 삭제
DROP POLICY IF EXISTS "group_members_update" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_insert" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_delete" ON finance_group_members;

-- 2. SELECT 정책도 전체관리자 포함으로 갱신 (혹시 이전 버전이면 교체)
DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;

CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (
    -- 자기 자신의 멤버십
    user_id = auth.uid()
    OR
    -- 전체관리자는 모두 조회
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 재정관리자도 조회
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
  );

-- 3. INSERT: 전체관리자, 재정관리자, 그룹 admin/owner 허용
CREATE POLICY "group_members_insert" ON finance_group_members
  FOR INSERT WITH CHECK (
    -- 전체관리자는 모두 추가 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 재정관리자도 추가 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 해당 그룹의 admin/owner 권한자
    EXISTS (
      SELECT 1 FROM finance_group_members existing
      WHERE existing.group_id = finance_group_members.group_id
        AND existing.user_id = auth.uid()
        AND existing.permission_level = 'admin'
    )
  );

-- 4. UPDATE: 전체관리자, 재정관리자, 그룹 admin 권한자 허용
--    ★ 핵심 수정: 전체관리자(is_super_admin)가 permission_level 업데이트 가능
CREATE POLICY "group_members_update" ON finance_group_members
  FOR UPDATE USING (
    -- 전체관리자는 모든 멤버의 권한 변경 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 재정관리자도 변경 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 자기 자신의 레코드 (자기 권한은 스스로 수정 불가하게 하려면 이 항목 삭제)
    user_id = auth.uid()
    OR
    -- 해당 그룹에서 admin 권한인 유저는 같은 그룹 멤버 수정 가능
    EXISTS (
      SELECT 1 FROM finance_group_members gm
      WHERE gm.group_id = finance_group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.permission_level = 'admin'
    )
  );

-- 5. DELETE: 전체관리자, 재정관리자, 자기 자신, 그룹 admin 허용
CREATE POLICY "group_members_delete" ON finance_group_members
  FOR DELETE USING (
    -- 전체관리자는 모두 삭제 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 재정관리자도 삭제 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 자기 자신은 그룹에서 나갈 수 있음
    user_id = auth.uid()
    OR
    -- 그룹 admin도 멤버 제거 가능
    EXISTS (
      SELECT 1 FROM finance_group_members gm
      WHERE gm.group_id = finance_group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.permission_level = 'admin'
    )
  );

-- ================================================
-- 결과 확인
-- ================================================
SELECT '=== Updated RLS Policies on finance_group_members ===' as info;
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'finance_group_members'
ORDER BY policyname;
