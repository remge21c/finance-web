-- ================================================
-- 재정관리자 권한 시스템 구현
-- Phase 1: 데이터베이스 스키마 수정
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. finance_user_status 테이블에 재정관리자 필드 추가
ALTER TABLE finance_user_status
ADD COLUMN IF NOT EXISTS is_finance_admin BOOLEAN DEFAULT FALSE;

ALTER TABLE finance_user_status
ADD COLUMN IF NOT EXISTS finance_admin_approved_by UUID;

ALTER TABLE finance_user_status
ADD COLUMN IF NOT EXISTS finance_admin_approved_at TIMESTAMPTZ;

-- 2. finance_groups 테이블에 그룹 권한 필드 추가
ALTER TABLE finance_groups
ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) DEFAULT 'personal';

ALTER TABLE finance_groups
ADD CONSTRAINT finance_groups_group_type_check
CHECK (group_type IN ('personal', 'department'));

ALTER TABLE finance_groups
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_write": [], "can_read": []}'::jsonb;

/*
permissions 구조:
{
  "can_write": ["user_id1", "user_id2"],  // 쓰기 권한 (추가/수정)
  "can_read": ["user_id3", "user_id4"]    // 읽기/보기 권한 (조회만)
}
*/

-- 3. 기존 그룹의 group_type 업데이트 (개인 그룹으로 설정)
UPDATE finance_groups
SET group_type = 'personal'
WHERE group_type IS NULL;

-- ================================================
-- RLS 정책 수정 (재정관리자 권한 추가)
-- ================================================

-- 3.1 finance_transactions RLS 정책 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "finance_transactions_all" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_select_own_group" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_insert" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON finance_transactions;

-- SELECT 정책: 재정관리자는 모든 데이터 조회, 그룹 멤버는 자신 그룹만 조회
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
  );

-- INSERT 정책: 재정관리자는 모든 그룹에 추가, 그룹 멤버는 자신 그룹에만 추가
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

-- UPDATE 정책: 재정관리자는 모든 데이터 수정, 그룹 권한에 따라 수정
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

-- DELETE 정책: 본인만 삭제 가능
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

-- 3.2 finance_settings RLS 정책 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "settings_select_own" ON finance_settings;
DROP POLICY IF EXISTS "settings_insert_own" ON finance_settings;
DROP POLICY IF EXISTS "settings_update_own" ON finance_settings;

-- SELECT 정책
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

-- INSERT 정책
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

-- UPDATE 정책
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

-- 3.3 finance_groups RLS 정책 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "groups_select_members" ON finance_groups;

-- SELECT 정책: 재정관리자는 모든 그룹 조회
CREATE POLICY "groups_select" ON finance_groups
  FOR SELECT USING (
    -- 재정관리자는 모든 그룹 조회 가능
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 그룹 멤버는 자신이 속한 그룹만 조회
    id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

-- INSERT 정책: 슈퍼관리자와 재정관리자만 그룹 생성 가능
CREATE POLICY "groups_insert" ON finance_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid()
      AND (is_super_admin = true OR is_finance_admin = true)
    )
    AND created_by = auth.uid()
  );

-- UPDATE 정책: 그룹 소유자와 재정관리자만 수정 가능
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

-- DELETE 정책: 슈퍼관리자와 그룹 생성자만 삭제 가능
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

-- ================================================
-- 결과 확인
-- ================================================

-- finance_user_status 테이블 구조 확인
SELECT '=== finance_user_status columns ===' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'finance_user_status'
ORDER BY ordinal_position;

-- finance_groups 테이블 구조 확인
SELECT '=== finance_groups columns ===' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'finance_groups'
ORDER BY ordinal_position;

-- RLS 정책 확인
SELECT '=== RLS Policies on finance_transactions ===' as info;
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'finance_transactions';
