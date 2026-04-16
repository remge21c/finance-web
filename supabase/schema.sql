-- ================================================
-- 재정관리 앱 테이블 (Malaysia MH Supabase 프로젝트용)
-- 테이블 접두사: finance_
-- 이 SQL을 Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. 재정관리 사용자 상태 테이블
CREATE TABLE IF NOT EXISTS finance_user_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_super_admin BOOLEAN DEFAULT FALSE,
  approved_by UUID,
  rejected_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE finance_user_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_user_status_insert" ON finance_user_status;
CREATE POLICY "finance_user_status_insert" ON finance_user_status 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "finance_user_status_select" ON finance_user_status;
CREATE POLICY "finance_user_status_select" ON finance_user_status 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "finance_user_status_update" ON finance_user_status;
CREATE POLICY "finance_user_status_update" ON finance_user_status
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_finance_user_status_user_id ON finance_user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_user_status_status ON finance_user_status(status);

-- ================================================

-- 2. 재정관리 거래 내역 테이블
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('수입', '지출')),
  item VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  amount DECIMAL(15,2) NOT NULL,
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_transactions_all" ON finance_transactions;
CREATE POLICY "finance_transactions_all" ON finance_transactions 
  FOR ALL USING (user_id = auth.uid());

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_id ON finance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions(date);

-- ================================================

-- 3. 재정관리 설정 테이블
CREATE TABLE IF NOT EXISTS finance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  app_title VARCHAR(100) DEFAULT '재정관리',
  income_items JSONB DEFAULT '[]',
  expense_items JSONB DEFAULT '[]',
  income_budgets JSONB DEFAULT '[]',
  expense_budgets JSONB DEFAULT '[]',
  author VARCHAR(100) DEFAULT '',
  manager VARCHAR(100) DEFAULT '',
  currency VARCHAR(20) DEFAULT '원',
  memo TEXT DEFAULT '',
  cash_amount DECIMAL(15,2) DEFAULT 0,
  touch_amount DECIMAL(15,2) DEFAULT 0,
  other_amount DECIMAL(15,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_settings_insert" ON finance_settings;
CREATE POLICY "finance_settings_insert" ON finance_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "finance_settings_select" ON finance_settings;
CREATE POLICY "finance_settings_select" ON finance_settings 
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "finance_settings_update" ON finance_settings;
CREATE POLICY "finance_settings_update" ON finance_settings 
  FOR UPDATE USING (user_id = auth.uid());

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_finance_settings_user_id ON finance_settings(user_id);

-- ================================================

-- 4. 재정관리 그룹 테이블
CREATE TABLE IF NOT EXISTS finance_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE finance_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_members" ON finance_groups;
CREATE POLICY "groups_select_members" ON finance_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_groups.id
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "groups_insert_superadmin" ON finance_groups;
CREATE POLICY "groups_insert_superadmin" ON finance_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "groups_update_owner_admin" ON finance_groups;
CREATE POLICY "groups_update_owner_admin" ON finance_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_groups.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "groups_delete_owner_admin" ON finance_groups;
CREATE POLICY "groups_delete_owner_admin" ON finance_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_groups.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_finance_groups_created_by ON finance_groups(created_by);

-- ================================================

-- 5. 재정관리 그룹 멤버 테이블
CREATE TABLE IF NOT EXISTS finance_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES finance_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- RLS 정책
ALTER TABLE finance_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_select" ON finance_group_members;
CREATE POLICY "group_members_select" ON finance_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_members_insert_owner_admin" ON finance_group_members;
CREATE POLICY "group_members_insert_owner_admin" ON finance_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "group_members_update_owner_admin" ON finance_group_members;
CREATE POLICY "group_members_update_owner_admin" ON finance_group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "group_members_delete_owner_admin" ON finance_group_members;
CREATE POLICY "group_members_delete_owner_admin" ON finance_group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM finance_group_members
      WHERE group_id = finance_group_members.group_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_finance_group_members_user_id ON finance_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_group_members_group_id ON finance_group_members(group_id);

-- ================================================

-- 트리거 함수 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_finance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_finance_user_status_updated_at ON finance_user_status;
CREATE TRIGGER update_finance_user_status_updated_at
  BEFORE UPDATE ON finance_user_status
  FOR EACH ROW EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS update_finance_transactions_updated_at ON finance_transactions;
CREATE TRIGGER update_finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS update_finance_settings_updated_at ON finance_settings;
CREATE TRIGGER update_finance_settings_updated_at
  BEFORE UPDATE ON finance_settings
  FOR EACH ROW EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS update_finance_groups_updated_at ON finance_groups;
CREATE TRIGGER update_finance_groups_updated_at
  BEFORE UPDATE ON finance_groups
  FOR EACH ROW EXECUTE FUNCTION update_finance_updated_at();

-- ================================================
-- 그룹 기능 추가를 위한 기존 테이블 수정
-- ================================================

-- finance_transactions에 group_id 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finance_transactions' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE finance_transactions ADD COLUMN group_id UUID REFERENCES finance_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- finance_settings에 group_id 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finance_settings' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE finance_settings ADD COLUMN group_id UUID REFERENCES finance_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- finance_settings UNIQUE 제약 변경 (user_id당 하나에서 group_id당 하나로)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_settings_user_id_key'
  ) THEN
    ALTER TABLE finance_settings DROP CONSTRAINT finance_settings_user_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_settings_group_id_key'
  ) THEN
    ALTER TABLE finance_settings ADD CONSTRAINT finance_settings_group_id_key UNIQUE (group_id);
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_finance_transactions_group_id ON finance_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_finance_settings_group_id ON finance_settings(group_id);

-- finance_transactions RLS 정책 수정 (그룹 접근 권한 추가)
DROP POLICY IF EXISTS "finance_transactions_all" ON finance_transactions;
CREATE POLICY "finance_transactions_all" ON finance_transactions
  FOR ALL USING (
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

-- finance_settings RLS 정책 수정
DROP POLICY IF EXISTS "finance_settings_select" ON finance_settings;
CREATE POLICY "finance_settings_select" ON finance_settings
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "finance_settings_insert" ON finance_settings;
CREATE POLICY "finance_settings_insert" ON finance_settings
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "finance_settings_update" ON finance_settings;
CREATE POLICY "finance_settings_update" ON finance_settings
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM finance_group_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ================================================
-- 데이터 마이그레이션: 기존 사용자별 그룹 생성 및 데이터 연결
-- ================================================

-- 각 사용자를 위한 기본 그룹 생성 (그룹명: 사용자 이메일)
WITH user_groups AS (
  INSERT INTO finance_groups (name, description, created_by)
  SELECT
    u.email || '의 재정' as name,
    '개인 재정 관리를 위한 그룹' as description,
    u.id as created_by
  FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM finance_transactions WHERE user_id = u.id)
  ON CONFLICT DO NOTHING
  RETURNING id, created_by
)
INSERT INTO finance_group_members (group_id, user_id, role)
SELECT id, created_by, 'owner'
FROM user_groups
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 기존 transactions에 group_id 연결
WITH personal_groups AS (
  SELECT g.id as group_id, gm.user_id
  FROM finance_groups g
  JOIN finance_group_members gm ON g.id = gm.group_id
  WHERE g.name LIKE '%의 재정'
)
UPDATE finance_transactions t
SET group_id = pg.group_id
FROM personal_groups pg
WHERE t.user_id = pg.user_id AND t.group_id IS NULL;

-- 기존 settings에 group_id 연결
UPDATE finance_settings s
SET group_id = (
  SELECT gm.group_id
  FROM finance_group_members gm
  WHERE gm.user_id = s.user_id AND gm.role = 'owner'
  LIMIT 1
)
WHERE group_id IS NULL;










