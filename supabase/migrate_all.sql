-- ================================================
-- 통합 마이그레이션 스크립트 (자동 생성)
-- 실행 순서: 의존성 기반 정렬
-- 생성일: 2026-04-16
-- 모든 ALTER TABLE은 IF NOT EXISTS 사용 (멱등성 보장)
-- ================================================

-- ================================================
-- STEP 1: finance_user_status 컬럼 추가
-- ================================================

-- 재정 권한 컬럼
ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS can_group_finance BOOLEAN DEFAULT TRUE;

-- 이름 및 요청 그룹 컬럼
ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS requested_group_id UUID;

-- 재정관리자 컬럼
ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS is_finance_admin BOOLEAN DEFAULT FALSE;

ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS finance_admin_approved_by UUID;

ALTER TABLE finance_user_status
  ADD COLUMN IF NOT EXISTS finance_admin_approved_at TIMESTAMPTZ;

-- can_personal_finance 컬럼 제거 (개인재정 모드 제거)
ALTER TABLE finance_user_status
  DROP COLUMN IF EXISTS can_personal_finance;

-- 기존 레코드 이름 업데이트
UPDATE finance_user_status
SET name = COALESCE(name, email)
WHERE name IS NULL OR name = '';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_finance_user_status_requested_group
  ON finance_user_status(requested_group_id);

-- ================================================
-- STEP 2: finance_groups 컬럼 추가
-- ================================================

ALTER TABLE finance_groups
  ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) DEFAULT 'department';

-- 기존 그룹 type 업데이트 (NULL인 경우 department로)
UPDATE finance_groups
SET group_type = 'department'
WHERE group_type IS NULL;

-- 제약 조건 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'finance_groups_group_type_check'
  ) THEN
    ALTER TABLE finance_groups
      ADD CONSTRAINT finance_groups_group_type_check
      CHECK (group_type IN ('personal', 'department'));
  END IF;
END $$;

ALTER TABLE finance_groups
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_write": [], "can_read": []}'::jsonb;

-- ================================================
-- STEP 3: 개인재정 데이터 정리 (personal 타입 그룹 삭제)
-- ================================================

DELETE FROM finance_settings
WHERE group_id IN (
  SELECT id FROM finance_groups WHERE group_type = 'personal'
);

DELETE FROM finance_transactions
WHERE group_id IN (
  SELECT id FROM finance_groups WHERE group_type = 'personal'
);

DELETE FROM finance_group_members
WHERE group_id IN (
  SELECT id FROM finance_groups WHERE group_type = 'personal'
);

DELETE FROM finance_groups
WHERE group_type = 'personal';

-- ================================================
-- STEP 4: RLS 정책 - finance_groups
-- ================================================

DROP POLICY IF EXISTS "groups_select" ON finance_groups;
DROP POLICY IF EXISTS "groups_insert" ON finance_groups;
DROP POLICY IF EXISTS "groups_update" ON finance_groups;
DROP POLICY IF EXISTS "groups_delete" ON finance_groups;
DROP POLICY IF EXISTS "groups_select_members" ON finance_groups;
DROP POLICY IF EXISTS "groups_select_public" ON finance_groups;

-- SELECT: 슈퍼관리자/재정관리자/멤버/생성자 + 비인증 사용자 (회원가입용 그룹 목록 조회)
CREATE POLICY "groups_select_public" ON finance_groups
  FOR SELECT USING (true);

-- INSERT: 슈퍼관리자 또는 재정관리자만 그룹 생성
CREATE POLICY "groups_insert" ON finance_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid()
      AND (is_super_admin = true OR is_finance_admin = true)
    )
    AND created_by = auth.uid()
  );

-- UPDATE: 재정관리자 또는 그룹 생성자
CREATE POLICY "groups_update" ON finance_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    created_by = auth.uid()
  );

-- DELETE: 슈퍼관리자 또는 그룹 생성자
CREATE POLICY "groups_delete" ON finance_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
    OR
    created_by = auth.uid()
  );

-- ================================================
-- STEP 5: RLS 정책 - finance_group_members
-- ================================================

ALTER TABLE finance_group_members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_insert" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_insert_owner_admin" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_update" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_update_owner_admin" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_delete" ON finance_group_members;
DROP POLICY IF EXISTS "group_members_delete_owner_admin" ON finance_group_members;

ALTER TABLE finance_group_members ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 멤버십 + 슈퍼관리자 + 재정관리자
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

-- INSERT: 그룹 owner/admin만 멤버 추가 가능 (또는 재정관리자)
CREATE POLICY "group_members_insert" ON finance_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_group_members gm2
      WHERE gm2.group_id = finance_group_members.group_id
      AND gm2.user_id = auth.uid()
      AND gm2.role IN ('owner', 'admin')
    )
  );

-- UPDATE
CREATE POLICY "group_members_update" ON finance_group_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_group_members gm2
      WHERE gm2.group_id = finance_group_members.group_id
      AND gm2.user_id = auth.uid()
      AND gm2.role IN ('owner', 'admin')
    )
  );

-- DELETE
CREATE POLICY "group_members_delete" ON finance_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND (is_super_admin = true OR is_finance_admin = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_group_members gm2
      WHERE gm2.group_id = finance_group_members.group_id
      AND gm2.user_id = auth.uid()
      AND gm2.role IN ('owner', 'admin')
    )
  );

-- ================================================
-- STEP 6: RLS 정책 - finance_transactions
-- ================================================

DROP POLICY IF EXISTS "finance_transactions_all" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_select" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_select_own_group" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_insert" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON finance_transactions;

-- SELECT
CREATE POLICY "transactions_select" ON finance_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- INSERT
CREATE POLICY "transactions_insert" ON finance_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    (
      group_id IN (
        SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
      )
      AND user_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY "transactions_update" ON finance_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_group_members gm
      WHERE gm.group_id = finance_transactions.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_groups g
      WHERE g.id = finance_transactions.group_id
      AND g.permissions->'can_write' ? auth.uid()::text
    )
  );

-- DELETE
CREATE POLICY "transactions_delete" ON finance_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    user_id = auth.uid()
  );

-- ================================================
-- STEP 7: RLS 정책 - finance_settings
-- ================================================

DROP POLICY IF EXISTS "finance_settings_insert" ON finance_settings;
DROP POLICY IF EXISTS "settings_select" ON finance_settings;
DROP POLICY IF EXISTS "settings_select_own" ON finance_settings;
DROP POLICY IF EXISTS "settings_insert" ON finance_settings;
DROP POLICY IF EXISTS "settings_insert_own" ON finance_settings;
DROP POLICY IF EXISTS "settings_update" ON finance_settings;
DROP POLICY IF EXISTS "settings_update_own" ON finance_settings;

-- SELECT
CREATE POLICY "settings_select" ON finance_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- INSERT
CREATE POLICY "settings_insert" ON finance_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    user_id = auth.uid()
  );

-- UPDATE
CREATE POLICY "settings_update" ON finance_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    user_id = auth.uid()
  );

-- ================================================
-- STEP 8: RLS 정책 - finance_user_status (기존 유지)
-- ================================================

-- 기존 정책이 있는 경우만 수정
DROP POLICY IF EXISTS "finance_user_status_insert" ON finance_user_status;
DROP POLICY IF EXISTS "finance_user_status_select" ON finance_user_status;
DROP POLICY IF EXISTS "finance_user_status_update" ON finance_user_status;

CREATE POLICY "finance_user_status_insert" ON finance_user_status
  FOR INSERT WITH CHECK (true);

CREATE POLICY "finance_user_status_select" ON finance_user_status
  FOR SELECT USING (true);

CREATE POLICY "finance_user_status_update" ON finance_user_status
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- ================================================
-- 완료 확인 쿼리
-- ================================================

SELECT '=== Migration Complete ===' as status;

SELECT '=== finance_user_status columns ===' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'finance_user_status'
ORDER BY ordinal_position;

SELECT '=== RLS Policies Summary ===' as info;
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'finance_user_status',
  'finance_groups',
  'finance_group_members',
  'finance_transactions',
  'finance_settings'
)
GROUP BY tablename
ORDER BY tablename;
