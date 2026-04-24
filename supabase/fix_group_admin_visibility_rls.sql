-- ================================================
-- 그룹 관리자를 위한 RLS 정책 보강
-- 1. finance_group_members: 그룹 관리자가 그룹원의 멤버십을 조회 가능하게 함
-- 2. finance_group_join_requests: 그룹 관리자가 본인 그룹의 가입 요청을 조회/수정 가능하게 함
-- ================================================

-- 1. finance_group_members SELECT 정책 수정 (그룹 관리자 추가)
DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;
CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (
    -- 자기 자신의 멤버십
    user_id = auth.uid()
    OR
    -- 전체관리자/재정관리자
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    -- 해당 그룹의 관리 권한(admin)을 가진 경우, 해당 그룹 전체 멤버 조회 가능
    EXISTS (
      SELECT 1 FROM finance_group_members gm
      WHERE gm.group_id = finance_group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.permission_level = 'admin'
    )
  );

-- 2. finance_group_join_requests 정책 수정 (그룹 관리자 추가)
-- 기존 finance_admin_manage_requests 정책은 유지하거나 갱신
DROP POLICY IF EXISTS "finance_admin_manage_requests" ON finance_group_join_requests;
CREATE POLICY "finance_admin_manage_requests" ON finance_group_join_requests
  FOR ALL USING (
    -- 최고관리자
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 그룹 생성자(created_by)
    EXISTS (
      SELECT 1 FROM finance_groups
      WHERE id = finance_group_join_requests.group_id
        AND created_by = auth.uid()
    )
    OR
    -- 해당 그룹의 관리 권한(admin)을 가진 멤버
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_join_requests.group_id
        AND user_id = auth.uid()
        AND permission_level = 'admin'
    )
  );
