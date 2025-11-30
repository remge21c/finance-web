// 데이터베이스 타입 정의 (개인용 앱)

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  type: '수입' | '지출';
  item: string;
  description: string;
  amount: number;
  memo: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  income_items: string[];
  expense_items: string[];
  income_budgets: number[];
  expense_budgets: number[];
  author: string;
  manager: string;
  currency: string;
  memo: string;
  cash_amount: number;
  touch_amount: number;
  other_amount: number;
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

export interface SettingsInput {
  income_items: string[];
  expense_items: string[];
  income_budgets: number[];
  expense_budgets: number[];
  author: string;
  manager: string;
  currency: string;
  memo: string;
  cash_amount: number;
  touch_amount: number;
  other_amount: number;
}

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
  status: UserStatusType;
  is_super_admin: boolean;
  approved_by: string | null;
  rejected_reason: string;
  created_at: string;
  updated_at: string;
}



