-- ================================================
-- Google Drive 자동 백업: 토큰 + 이력 테이블
-- Supabase Dashboard → SQL Editor 에서 실행
-- ================================================
--
-- 설계:
--   - finance_backup_config: 슈퍼관리자 1명의 OAuth refresh_token (싱글톤 row)
--   - finance_backup_log: 그룹별 백업 이력 (그룹 멤버 SELECT 가능)
--
-- 사전 조건:
--   fix_privilege_escalation.sql 의 is_caller_super_admin() 함수가 이미 존재해야 함.
-- ================================================


-- ================================================
-- 1. finance_backup_config (전역 싱글톤)
-- ================================================
CREATE TABLE IF NOT EXISTS finance_backup_config (
  id TEXT PRIMARY KEY CHECK (id = 'singleton'),
  refresh_token TEXT NOT NULL,
  google_email TEXT,
  scope TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_backup_at TIMESTAMPTZ,
  last_backup_error TEXT
);

ALTER TABLE finance_backup_config ENABLE ROW LEVEL SECURITY;

-- 전체 권한: 슈퍼관리자만
DROP POLICY IF EXISTS "backup_config_select" ON finance_backup_config;
CREATE POLICY "backup_config_select" ON finance_backup_config
  FOR SELECT USING (is_caller_super_admin());

DROP POLICY IF EXISTS "backup_config_insert" ON finance_backup_config;
CREATE POLICY "backup_config_insert" ON finance_backup_config
  FOR INSERT WITH CHECK (is_caller_super_admin());

DROP POLICY IF EXISTS "backup_config_update" ON finance_backup_config;
CREATE POLICY "backup_config_update" ON finance_backup_config
  FOR UPDATE USING (is_caller_super_admin())
  WITH CHECK (is_caller_super_admin());

DROP POLICY IF EXISTS "backup_config_delete" ON finance_backup_config;
CREATE POLICY "backup_config_delete" ON finance_backup_config
  FOR DELETE USING (is_caller_super_admin());

-- connected_by 자동 설정 트리거 (INSERT 시점)
DROP FUNCTION IF EXISTS set_backup_config_connected_by() CASCADE;
CREATE OR REPLACE FUNCTION set_backup_config_connected_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.connected_by := auth.uid();
    NEW.connected_at := NOW();
  ELSIF TG_OP = 'UPDATE' THEN
    -- connected_by 와 connected_at 은 변경 불가
    NEW.connected_by := OLD.connected_by;
    NEW.connected_at := OLD.connected_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_backup_config_connected_by ON finance_backup_config;
CREATE TRIGGER trg_set_backup_config_connected_by
  BEFORE INSERT OR UPDATE ON finance_backup_config
  FOR EACH ROW EXECUTE FUNCTION set_backup_config_connected_by();


-- ================================================
-- 2. finance_backup_log (그룹별 백업 이력)
-- ================================================
CREATE TABLE IF NOT EXISTS finance_backup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES finance_groups(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'cron')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  file_id TEXT,
  file_name TEXT,
  web_view_link TEXT,
  rotated_deleted INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_log_group_created
  ON finance_backup_log(group_id, created_at DESC);

ALTER TABLE finance_backup_log ENABLE ROW LEVEL SECURITY;

-- SELECT: 슈퍼관리자 + 해당 그룹 멤버
DROP POLICY IF EXISTS "backup_log_select" ON finance_backup_log;
CREATE POLICY "backup_log_select" ON finance_backup_log
  FOR SELECT USING (
    is_caller_super_admin()
    OR group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: 슈퍼관리자만 (cron 은 service_role 사용)
DROP POLICY IF EXISTS "backup_log_insert" ON finance_backup_log;
CREATE POLICY "backup_log_insert" ON finance_backup_log
  FOR INSERT WITH CHECK (is_caller_super_admin());

DROP POLICY IF EXISTS "backup_log_delete" ON finance_backup_log;
CREATE POLICY "backup_log_delete" ON finance_backup_log
  FOR DELETE USING (is_caller_super_admin());


-- ================================================
-- 검증 쿼리 (선택)
-- ================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('finance_backup_config', 'finance_backup_log')
-- ORDER BY tablename, cmd;
--
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
-- WHERE trigger_name LIKE 'trg_set_backup_config%';
