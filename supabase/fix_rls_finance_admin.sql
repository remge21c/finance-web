-- ================================================
-- RLS 정책 수정 (재정관리자 시스템)
-- finance_user_status 레코드가 없는 사용자도 처리
-- ================================================

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "groups_select" ON finance_groups;
DROP POLICY IF EXISTS "groups_insert" ON finance_groups;
DROP POLICY IF EXISTS "groups_update" ON finance_groups;
DROP POLICY IF EXISTS "groups_delete" ON finance_groups;

DROP POLICY IF EXISTS "transactions_select" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_insert" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete" ON finance_transactions;

DROP POLICY IF EXISTS "settings_select" ON finance_settings;
DROP POLICY IF EXISTS "settings_insert" ON finance_settings;
DROP POLICY IF EXISTS "settings_update" ON finance_settings;

-- 2. finance_groups RLS 정책 (수정됨)

-- SELECT: 인증된 사용자는 자신이 속한 그룹만 조회
CREATE POLICY "groups_select" ON finance_groups
  FOR SELECT USING (
    -- 슈퍼관리자 확인 (user_status 테이블에서)
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 재정관리자 확인
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 그룹 멤버는 자신이 속한 그룹만 조회
    id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
    OR
    -- 자신이 생성한 그룹은 조회 가능
    created_by = auth.uid()
  );

-- INSERT: 슈퍼관리자와 재정관리자만 그룹 생성 가능
CREATE POLICY "groups_insert" ON finance_groups
  FOR INSERT WITH CHECK (
    -- 슈퍼관리자 또는 재정관리자 확인
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid()
      AND (is_super_admin = true OR is_finance_admin = true)
    )
    AND created_by = auth.uid()
  );

-- UPDATE: 그룹 생성자와 재정관리자만 수정 가능
CREATE POLICY "groups_update" ON finance_groups
  FOR UPDATE USING (
    -- 재정관리자는 모든 그룹 수정 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 그룹 생성자만 수정 가능
    created_by = auth.uid()
  );

-- DELETE: 슈퍼관리자와 그룹 생성자만 삭제 가능
CREATE POLICY "groups_delete" ON finance_groups
  FOR DELETE USING (
    -- 슈퍼관리자는 모든 그룹 삭제 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    -- 그룹 생성자만 삭제 가능
    created_by = auth.uid()
  );

-- 3. finance_transactions RLS 정책 (수정됨)

-- SELECT: 재정관리자와 그룹 멤버만 조회
CREATE POLICY "transactions_select" ON finance_transactions
  FOR SELECT USING (
    -- 재정관리자는 모든 데이터 조회 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 그룹 멤버는 자신이 속한 그룹의 데이터만 조회
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
    OR
    -- 자신이 생성한 데이터는 항상 조회 가능
    user_id = auth.uid()
  );

-- INSERT: 재정관리자와 그룹 멤버만 추가 가능
CREATE POLICY "transactions_insert" ON finance_transactions
  FOR INSERT WITH CHECK (
    -- 재정관리자는 모든 그룹에 추가 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 그룹 멤버는 자신이 속한 그룹에만 추가 가능
    (
      group_id IN (
        SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
      )
      AND user_id = auth.uid()
    )
  );

-- UPDATE: 재정관리자, 본인, 그룹 관리자, 쓰기권한자만 수정 가능
CREATE POLICY "transactions_update" ON finance_transactions
  FOR UPDATE USING (
    -- 재정관리자는 모든 데이터 수정 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 본인이 생성한 데이터는 항상 수정 가능
    (user_id = auth.uid())
    OR
    -- 그룹 소유자/관리자는 그룹 내 모든 데이터 수정 가능
    EXISTS (
      SELECT 1 FROM finance_group_members gm
      WHERE gm.group_id = finance_transactions.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
    )
    OR
    -- 쓰기 권한이 있는 사용자는 수정 가능
    EXISTS (
      SELECT 1 FROM finance_groups g
      WHERE g.id = finance_transactions.group_id
      AND g.permissions->'can_write' ? auth.uid()::text
    )
  );

-- DELETE: 재정관리자와 본인만 삭제 가능
CREATE POLICY "transactions_delete" ON finance_transactions
  FOR DELETE USING (
    -- 재정관리자는 모든 데이터 삭제 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 본인이 생성한 데이터만 삭제 가능
    user_id = auth.uid()
  );

-- 4. finance_settings RLS 정책 (수정됨)

-- SELECT: 재정관리자와 그룹 멤버만 조회
CREATE POLICY "settings_select" ON finance_settings
  FOR SELECT USING (
    -- 재정관리자는 모든 설정 조회 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 그룹 멤버는 자신 그룹의 설정만 조회
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
    OR
    -- 본인 설정은 항상 조회 가능
    user_id = auth.uid()
  );

-- INSERT: 재정관리자와 본인만 추가 가능
CREATE POLICY "settings_insert" ON finance_settings
  FOR INSERT WITH CHECK (
    -- 재정관리자는 모든 그룹에 설정 추가 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    user_id = auth.uid()
  );

-- UPDATE: 재정관리자와 본인만 수정 가능
CREATE POLICY "settings_update" ON finance_settings
  FOR UPDATE USING (
    -- 재정관리자는 모든 설정 수정 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 본인 설정만 수정 가능
    user_id = auth.uid()
  );

-- ================================================
-- 결과 확인
-- ================================================

-- 그룹 RLS 정책 확인
SELECT '=== RLS Policies on finance_groups ===' as info;
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'finance_groups';

-- 거래 내역 RLS 정책 확인
SELECT '=== RLS Policies on finance_transactions ===' as info;
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'finance_transactions';
