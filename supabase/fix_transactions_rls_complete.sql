-- ================================================
-- finance_transactions RLS 완전 재설정
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- ================================================
--
-- 증상:
--   - isSuperAdmin: true 인데도 DELETE 시 count === 0 반환
--   - 새로고침 후 삭제한 데이터가 다시 보임
--
-- 원인:
--   기존 RLS DELETE 정책에 super_admin override 가 없음.
--   또는 cleanup_deprecated_columns.sql 이 실제로 DB 에 적용되지 않음.
--
-- 이 SQL 은 SELECT / INSERT / UPDATE / DELETE 모든 정책을
--   1) super_admin = true 인 사용자
--   2) 해당 그룹의 admin / assistant 권한 보유자
-- 둘 다 허용하도록 통일합니다.
-- ================================================

-- 1) 기존 정책 모두 제거 (이름이 무엇이든 깨끗이)
DROP POLICY IF EXISTS "transactions_select" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_select_own_group" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_insert" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete" ON finance_transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON finance_transactions;

-- 2) SELECT
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

-- 3) INSERT
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

-- 4) UPDATE (USING + WITH CHECK 양쪽 모두 필요)
CREATE POLICY "transactions_update" ON finance_transactions
  FOR UPDATE
  USING (
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
  )
  WITH CHECK (
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

-- 5) DELETE
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
-- 진단 쿼리 (선택): 위 정책이 잘 적용됐는지 확인
-- ================================================
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'finance_transactions'
-- ORDER BY cmd;
--
-- 본인이 super_admin 인지 확인
-- SELECT user_id, is_super_admin, status
-- FROM finance_user_status
-- WHERE user_id = auth.uid();
