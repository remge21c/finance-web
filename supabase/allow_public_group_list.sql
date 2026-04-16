-- ================================================
-- 회원가입 시 그룹 목록 조회를 위한 RLS 정책 추가
-- ================================================

-- 기존 정책 확인
SELECT '=== Current groups_select policy ===' as info;
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'finance_groups' AND policyname = 'groups_select';

-- 새 정책: 인증되지 않은 사용자도 그룹 목록 조회 가능 (회원가입용)
-- 기존 정책을 유지하면서 새로운 정책 추가
CREATE POLICY "groups_select_public" ON finance_groups
  FOR SELECT USING (true);

-- 이 정책은 모두에게 적용되지만, 실제로는 필요한 컬럼만 노출하도록 애플리케이션에서 제어

-- 결과 확인
SELECT '=== Updated policies ===' as info;
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'finance_groups';

-- 테스트: 그룹 목록 조회
SELECT '=== Groups list test ===' as info;
SELECT id, name, description
FROM finance_groups
ORDER BY name;
