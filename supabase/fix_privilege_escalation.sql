-- ================================================
-- 권한 승격(Privilege Escalation) 차단 보안 패치
-- Supabase Dashboard → SQL Editor 에서 실행
-- ================================================
--
-- 차단하는 공격 시나리오:
--
-- [1] finance_user_status 자기 row UPDATE 로 슈퍼관리자 등극
--     POST /rest/v1/finance_user_status?user_id=eq.<me>
--     { "is_super_admin": true, "status": "approved" }
--     → 트리거로 차단
--
-- [2] finance_user_status INSERT 시 슈퍼관리자/승인 상태로 가입
--     → INSERT WITH CHECK 강화 + 트리거로 차단 (단, 첫 사용자 예외)
--
-- [3] finance_group_members 자기 row UPDATE 로 admin 승격
--     → 트리거로 차단
--
-- [4] finance_transactions INSERT 시 타 사용자 user_id 위장
--     → INSERT WITH CHECK 에 user_id = auth.uid() 추가
--
-- ================================================
-- 0. SECURITY DEFINER 함수 — 호출자가 슈퍼관리자인지 확인 (RLS 우회)
-- ================================================
DROP FUNCTION IF EXISTS is_caller_super_admin() CASCADE;
CREATE OR REPLACE FUNCTION is_caller_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT COALESCE(is_super_admin, false) INTO result
  FROM finance_user_status
  WHERE user_id = auth.uid();
  RETURN COALESCE(result, false);
END;
$$;

-- ================================================
-- 1. finance_user_status 보호 트리거
--    is_super_admin / status / user_id 변경은 슈퍼관리자만
-- ================================================
DROP FUNCTION IF EXISTS protect_user_status_critical() CASCADE;
CREATE OR REPLACE FUNCTION protect_user_status_critical()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_caller_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    RAISE EXCEPTION 'is_super_admin 은 슈퍼관리자만 변경할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status 는 슈퍼관리자만 변경할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id 는 변경할 수 없습니다.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_status_critical ON finance_user_status;
CREATE TRIGGER trg_protect_user_status_critical
  BEFORE UPDATE ON finance_user_status
  FOR EACH ROW EXECUTE FUNCTION protect_user_status_critical();

-- ================================================
-- 2. finance_user_status INSERT 정책 강화
--    - 자기 user_id 로만 INSERT
--    - 일반: is_super_admin=false, status='pending'
--    - 예외: 시스템 최초 사용자(아직 row 없음) → 첫 슈퍼관리자 가능
-- ================================================
DROP POLICY IF EXISTS "finance_user_status_insert" ON finance_user_status;
CREATE POLICY "finance_user_status_insert" ON finance_user_status
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      (is_super_admin = false AND status = 'pending')
      OR NOT EXISTS (SELECT 1 FROM finance_user_status)
    )
  );

-- ================================================
-- 3. finance_group_members 보호 트리거
--    본인 row 의 permission_level / group_id 변경 차단
--    (슈퍼관리자 / 해당 그룹 admin 은 자유 — RLS USING 으로 이미 통제됨)
-- ================================================
DROP FUNCTION IF EXISTS protect_group_members_critical() CASCADE;
CREATE OR REPLACE FUNCTION protect_group_members_critical()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_caller_super_admin() THEN
    RETURN NEW;
  END IF;

  -- 본인 row 를 수정하는 경우, 권한/그룹 변경 차단
  IF OLD.user_id = auth.uid() THEN
    IF NEW.permission_level IS DISTINCT FROM OLD.permission_level THEN
      RAISE EXCEPTION 'permission_level 은 본인이 직접 변경할 수 없습니다.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'group_id 는 변경할 수 없습니다.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id 는 변경할 수 없습니다.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_group_members_critical ON finance_group_members;
CREATE TRIGGER trg_protect_group_members_critical
  BEFORE UPDATE ON finance_group_members
  FOR EACH ROW EXECUTE FUNCTION protect_group_members_critical();

-- ================================================
-- 4. finance_transactions INSERT — user_id 위장 차단
--    슈퍼관리자도 자기 user_id 로만 INSERT (감사 추적 보존)
-- ================================================
DROP POLICY IF EXISTS "transactions_insert" ON finance_transactions;
CREATE POLICY "transactions_insert" ON finance_transactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
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
  );

-- ================================================
-- 검증 쿼리 (선택)
-- ================================================
-- 1) 트리거 등록 확인
-- SELECT event_object_table, trigger_name, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_name IN ('trg_protect_user_status_critical', 'trg_protect_group_members_critical');
--
-- 2) 정책 확인
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('finance_user_status', 'finance_transactions')
-- ORDER BY tablename, cmd;
--
-- 3) 권한 승격 시도가 차단되는지 직접 테스트 (일반 사용자 세션에서)
-- UPDATE finance_user_status SET is_super_admin = true WHERE user_id = auth.uid();
--   → ERROR: is_super_admin 은 슈퍼관리자만 변경할 수 있습니다.
