-- 그룹 참여 요청 테이블
CREATE TABLE IF NOT EXISTS finance_group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES finance_groups(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, group_id)  -- 그룹당 하나의 요청만 허용
);

-- RLS 활성화
ALTER TABLE finance_group_join_requests ENABLE ROW LEVEL SECURITY;

-- 본인 요청 조회/삽입/삭제
CREATE POLICY "users_manage_own_requests" ON finance_group_join_requests
  FOR ALL USING (auth.uid() = user_id);

-- 재정관리자: 자신이 생성한 그룹의 요청 조회 및 수정
CREATE POLICY "finance_admin_manage_requests" ON finance_group_join_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM finance_groups
      WHERE finance_groups.id = finance_group_join_requests.group_id
        AND finance_groups.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM finance_user_status
      WHERE finance_user_status.user_id = auth.uid()
        AND finance_user_status.is_super_admin = TRUE
    )
  );
