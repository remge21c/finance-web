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
  FOR UPDATE USING (true);

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
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "finance_settings_select" ON finance_settings;
CREATE POLICY "finance_settings_select" ON finance_settings 
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "finance_settings_update" ON finance_settings;
CREATE POLICY "finance_settings_update" ON finance_settings 
  FOR UPDATE USING (user_id = auth.uid());

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_finance_settings_user_id ON finance_settings(user_id);

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










