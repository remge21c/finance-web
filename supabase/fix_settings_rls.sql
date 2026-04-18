-- finance_settings INSERT/UPDATE 정책 수정
-- 그룹 owner/admin 또는 재정관리자(is_finance_admin)가 설정 생성/수정 가능

DROP POLICY IF EXISTS "finance_settings_insert" ON finance_settings;
CREATE POLICY "finance_settings_insert" ON finance_settings
  FOR INSERT WITH CHECK (
    -- 그룹의 owner 또는 admin 역할인 경우
    group_id IN (
      SELECT group_id FROM finance_group_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    -- 재정관리자인 경우
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    -- 슈퍼관리자인 경우
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "finance_settings_update" ON finance_settings;
CREATE POLICY "finance_settings_update" ON finance_settings
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM finance_group_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_finance_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );
