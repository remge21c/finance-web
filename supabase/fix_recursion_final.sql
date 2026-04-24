-- ================================================
-- [최종] 무한 재귀(Recursion) 해결 및 그룹 관리자 권한 완전 보강
-- 모든 finance_group_members 관련 정책을 안전한 함수 방식으로 전환합니다.
-- ================================================

-- 1. 기존 의존성이 있는 정책들을 먼저 삭제 (함수 삭제를 위해)
DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_insert" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_update" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_delete" ON finance_group_members;
DROP POLICY IF EXISTS "finance_admin_manage_requests" ON finance_group_join_requests;

-- 2. 관리 권한 확인 함수 생성 (보안 정의자)
-- 파라미터 이름 충돌 방지를 위해 확실히 삭제 후 생성
DROP FUNCTION IF EXISTS check_is_group_admin(UUID, UUID) CASCADE;

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

-- 3. finance_group_members 정책 재설정 (전부 함수 방식 사용)

-- SELECT: 자기 자신 + 슈퍼/재정관리자 + 같은 그룹 관리자
CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    check_is_group_admin(group_id, auth.uid())
  );

-- INSERT: 슈퍼/재정관리자 + 해당 그룹 관리자
CREATE POLICY "group_members_insert" ON finance_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    check_is_group_admin(group_id, auth.uid())
  );

-- UPDATE: 본인(자기레코드) + 슈퍼/재정관리자 + 해당 그룹 관리자
CREATE POLICY "group_members_update" ON finance_group_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    check_is_group_admin(group_id, auth.uid())
  );

-- DELETE: 본인(탈퇴) + 슈퍼/재정관리자 + 해당 그룹 관리자
CREATE POLICY "group_members_delete" ON finance_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    check_is_group_admin(group_id, auth.uid())
  );

-- 4. finance_group_join_requests 정책 재설정 (함수 방식 사용)

DROP POLICY IF EXISTS "users_manage_own_requests" ON finance_group_join_requests;
CREATE POLICY "users_manage_own_requests" ON finance_group_join_requests
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "finance_admin_manage_requests" ON finance_group_join_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_groups
      WHERE id = finance_group_join_requests.group_id
        AND created_by = auth.uid()
    )
    OR
    check_is_group_admin(group_id, auth.uid())
  );
