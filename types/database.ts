// 데이터베이스 타입 정의 (그룹 기반 앱)

// ================================================
// 그룹 관련 타입
// ================================================

export interface Group {
  id: string;
  name: string;
  description: string;
  group_type: 'personal' | 'department';
  created_by: string;
  permissions: GroupPermissions;
  created_at: string;
  updated_at: string;
}

// 그룹 권한 설정
export interface GroupPermissions {
  can_write: string[];  // 쓰기 권한 (추가/수정)
  can_read: string[];   // 읽기/보기 권한 (조회만)
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user_email?: string; // JOIN 시 가져온 이메일
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  member_count: number;
}

export interface GroupInput {
  name: string;
  description: string;
}

export interface GroupMemberInput {
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

// ================================================
// 거래 내역 타입
// ================================================

export interface Transaction {
  id: string;
  user_id: string;      // 생성자 (기록용)
  group_id: string;     // 그룹 ID (필수)
  date: string;
  type: '수입' | '지출';
  item: string;
  description: string;
  amount: number;
  memo: string;
  created_at: string;
  updated_at: string;
}

// 입력용 타입
export interface TransactionInput {
  date: string;
  type: '수입' | '지출';
  item: string;
  description: string;
  amount: number;
  memo: string;
}

// ================================================
// 설정 타입
// ================================================

export interface Settings {
  id: string;
  user_id: string;      // 생성자 (기록용)
  group_id: string;     // 그룹 ID (UNIQUE)
  app_title: string;
  income_items: string[];
  expense_items: string[];
  income_budgets: number[];
  expense_budgets: number[];
  author: string;
  manager: string;
  auditor: string;
  currency: string;
  memo: string;
  cash_amount: number;
  touch_amount: number;
  other_amount: number;
  account1_name: string;
  account2_name: string;
  account3_name: string;
  updated_at: string;
}

export interface SettingsInput {
  app_title: string;
  income_items: string[];
  expense_items: string[];
  income_budgets: number[];
  expense_budgets: number[];
  author: string;
  manager: string;
  auditor?: string;
  currency: string;
  memo: string;
  cash_amount: number;
  touch_amount: number;
  other_amount: number;
  account1_name?: string;
  account2_name?: string;
  account3_name?: string;
}

// ================================================
// 사용자 관련 타입
// ================================================

// 사용자 정보
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// 사용자 승인 상태
export type UserStatusType = 'pending' | 'approved' | 'rejected';

export interface UserStatus {
  id: string;
  user_id: string;
  email: string;
  name: string;
  status: UserStatusType;
  is_super_admin: boolean;
  is_finance_admin: boolean;      // 재정관리자 여부
  finance_admin_approved_by: string | null;  // 재정관리자 승인자
  finance_admin_approved_at: string | null;  // 재정관리자 승인일시
  requested_group_id: string | null;  // 요청한 그룹 ID
  requested_role: 'finance_admin' | 'user';  // 가입 시 요청 역할
  approved_by: string | null;
  rejected_reason: string;
  created_at: string;
  updated_at: string;
}

export type GroupJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface GroupJoinRequest {
  id: string;
  user_id: string;
  group_id: string;
  status: GroupJoinRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  // join용
  group_name?: string;
  user_name?: string;
  user_email?: string;
}
