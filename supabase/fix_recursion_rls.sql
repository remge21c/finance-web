-- ================================================
-- 무한 재귀(Infinite Recursion) 해결을 위한 RLS 정책 수정
-- 1. 무한 재귀 방지를 위한 보안 함수(SECURITY DEFINER) 생성
-- 2. 해당 함수를 사용하여 finance_group_members 및 finance_group_join_requests 정책 재설정
-- ================================================

-- 1. 관리 권한 확인 함수 생성
-- 파라미터 이름 변경 시 오류가 발생할 수 있으므로 먼저 삭제합니다.
DROP FUNCTION IF EXISTS check_is_group_admin(UUID, UUID);

-- SECURITY DEFINER를 사용하여 RLS를 우회하고 권한을 확인하므로 무한 재귀를 방지합니다.
CREATE OR REPLACE FUNCTION check_is_group_admin(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM finance_group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND permission_level = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. finance_group_members SELECT 정책 수정
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
    -- 해당 그룹의 관리 권한(admin)을 가진 경우 (함수 호출로 재귀 방지)
    check_is_group_admin(group_id, auth.uid())
  );

-- 3. finance_group_join_requests 정책 수정
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
    -- 해당 그룹의 관리 권한(admin)을 가진 멤버 (함수 호출)
    check_is_group_admin(group_id, auth.uid())
  );
