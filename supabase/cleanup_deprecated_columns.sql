-- Cleanup deprecated columns after permission_level migration
-- Run in Supabase SQL Editor

-- ================================================
-- 1. finance_groups 관련 정책 재작성
-- ================================================

DROP POLICY IF EXISTS "groups_select" ON finance_groups;
DROP POLICY IF EXISTS "groups_insert" ON finance_groups;
DROP POLICY IF EXISTS "groups_update" ON finance_groups;
DROP POLICY IF EXISTS "groups_delete" ON finance_groups;

CREATE POLICY "groups_select" ON finance_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- 그룹 생성: 슈퍼관리자만 가능
CREATE POLICY "groups_insert" ON finance_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    AND created_by = auth.uid()
  );

-- 그룹 수정: 슈퍼관리자 또는 그룹 내 admin 권한 보유자
CREATE POLICY "groups_update" ON finance_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_groups.id
      AND user_id = auth.uid()
      AND permission_level = 'admin'
    )
  );

CREATE POLICY "groups_delete" ON finance_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR created_by = auth.uid()
  );

-- ================================================
-- 2. finance_group_members 관련 정책 재작성
-- ================================================

DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_insert" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_update" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_delete" ON finance_group_members;

CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR user_id = auth.uid()
    OR group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "group_members_insert" ON finance_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND permission_level = 'admin'
    )
  );

CREATE POLICY "group_members_update" ON finance_group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members gm2
      WHERE gm2.group_id = finance_group_members.group_id
      AND gm2.user_id = auth.uid()
      AND gm2.permission_level = 'admin'
    )
  );

CREATE POLICY "group_members_delete" ON finance_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members gm2
      WHERE gm2.group_id = finance_group_members.group_id
      AND gm2.user_id = auth.uid()
      AND gm2.permission_level = 'admin'
    )
  );

-- ================================================
-- 3. finance_transactions 관련 정책 재작성
-- ================================================

DROP POLICY IF EXISTS "transactions_select" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_insert" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete" ON finance_transactions;

CREATE POLICY "transactions_select" ON finance_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_insert" ON finance_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_transactions.group_id
      AND user_id = auth.uid()
      AND permission_level IN ('admin', 'assistant')
    )
  );

CREATE POLICY "transactions_update" ON finance_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_transactions.group_id
      AND user_id = auth.uid()
      AND permission_level IN ('admin', 'assistant')
    )
  );

CREATE POLICY "transactions_delete" ON finance_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_transactions.group_id
      AND user_id = auth.uid()
      AND permission_level IN ('admin', 'assistant')
    )
  );

-- ================================================
-- 4. finance_settings 관련 정책 재작성
-- ================================================

DROP POLICY IF EXISTS "settings_select" ON finance_settings;
DROP POLICY IF EXISTS "settings_insert" ON finance_settings;
DROP POLICY IF EXISTS "settings_update" ON finance_settings;

CREATE POLICY "settings_select" ON finance_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "settings_insert" ON finance_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_settings.group_id
      AND user_id = auth.uid()
      AND permission_level = 'admin'
    )
  );

CREATE POLICY "settings_update" ON finance_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_settings.group_id
      AND user_id = auth.uid()
      AND permission_level IN ('admin', 'assistant')
    )
  );

-- ================================================
-- 5. 컬럼 삭제
-- ================================================

ALTER TABLE finance_groups DROP COLUMN IF EXISTS permissions;
ALTER TABLE finance_group_members DROP COLUMN IF EXISTS role;

ALTER TABLE finance_user_status DROP COLUMN IF EXISTS is_finance_admin;
ALTER TABLE finance_user_status DROP COLUMN IF EXISTS finance_admin_approved_by;
ALTER TABLE finance_user_status DROP COLUMN IF EXISTS finance_admin_approved_at;
ALTER TABLE finance_user_status DROP COLUMN IF EXISTS can_group_finance;
ALTER TABLE finance_user_status DROP COLUMN IF EXISTS requested_role;
