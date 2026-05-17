// 데이터베이스 타입 정의 (그룹 기반 앱)

// ================================================
// 그룹 관련 타입
// ================================================

export type PermissionLevel = 'admin' | 'assistant' | 'general';

export interface Group {
  id: string;
  name: string;
  description: string;
  group_type: 'department';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  permission_level: PermissionLevel;
  joined_at: string;
  user_email?: string;
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
  permission_level?: PermissionLevel;
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
  ui_sign_1: string;
  ui_sign_2: string;
  ui_sign_3: string;
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
  ui_sign_1?: string;
  ui_sign_2?: string;
  ui_sign_3?: string;
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
  requested_group_id: string | null;
  approved_by: string | null;
  rejected_reason: string;
  created_at: string;
  updated_at: string;
  primary_group_id?: string | null;
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

// ================================================
// Google Drive 백업 타입
// ================================================

export interface BackupConfig {
  id: 'singleton';
  refresh_token: string;
  google_email: string | null;
  scope: string | null;
  connected_by: string | null;
  connected_at: string;
  last_backup_at: string | null;
  last_backup_error: string | null;
  target_folder_id: string | null;
  target_folder_name: string | null;
  target_picked_at: string | null;
}

export type BackupTriggerType = 'manual' | 'cron';
export type BackupStatus = 'success' | 'failure';

export interface BackupLog {
  id: string;
  group_id: string;
  triggered_by: string | null;
  trigger_type: BackupTriggerType;
  status: BackupStatus;
  file_id: string | null;
  file_name: string | null;
  web_view_link: string | null;
  rotated_deleted: number;
  error_message: string | null;
  created_at: string;
}
