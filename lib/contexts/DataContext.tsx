"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionInput, Settings, SettingsInput } from "@/types/database";

const defaultSettings: Omit<Settings, "id" | "user_id" | "updated_at"> = {
  app_title: "재정관리",
  income_items: [],
  expense_items: [],
  income_budgets: [],
  expense_budgets: [],
  author: "",
  manager: "",
  currency: "원",
  memo: "",
  cash_amount: 0,
  touch_amount: 0,
  other_amount: 0,
};

interface DataContextType {
  transactions: Transaction[];
  settings: Settings | null;
  loading: boolean;
  addTransaction: (input: TransactionInput) => Promise<{ data?: Transaction; error?: string }>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<{ data?: Transaction; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  deleteMultipleTransactions: (ids: string[]) => Promise<{ success?: boolean; error?: string }>;
  updateSettings: (input: Partial<SettingsInput>) => Promise<{ data?: Settings; error?: string }>;
  refetchTransactions: () => Promise<void>;
  refetchSettings: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 사용자 ID 가져오기
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUser();
  }, []);

  // 거래 내역 불러오기
  const fetchTransactions = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (error) {
      console.error("거래 내역 조회 실패:", error);
    } else {
      setTransactions(data || []);
    }
  }, [userId]);

  // 설정 불러오기
  const fetchSettings = useCallback(async () => {
    if (!userId) {
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("설정 조회 실패:", error);
      // 설정이 없으면 기본 설정 생성
      const { data: newSettings, error: insertError } = await supabase
        .from("finance_settings")
        .insert({
          user_id: userId,
          ...defaultSettings,
        })
        .select()
        .single();

      if (insertError) {
        console.error("설정 생성 실패:", insertError);
      } else {
        setSettings(newSettings);
      }
    } else {
      setSettings(data);
    }
  }, [userId]);

  // 초기 데이터 로드 (한 번만 실행)
  useEffect(() => {
    if (userId && !initialized) {
      setLoading(true);
      Promise.all([fetchTransactions(), fetchSettings()]).then(() => {
        setInitialized(true);
        setLoading(false);
      });
    } else if (!userId) {
      setLoading(false);
    }
  }, [userId, initialized, fetchTransactions, fetchSettings]);

  // 거래 추가
  const addTransaction = async (input: TransactionInput) => {
    if (!userId) return { error: "로그인이 필요합니다." };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_transactions")
      .insert({
        user_id: userId,
        ...input,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    setTransactions((prev) => [...prev, data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
    return { data };
  };

  // 거래 수정
  const updateTransaction = async (id: string, input: TransactionInput) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_transactions")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? data : t)).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
    return { data };
  };

  // 거래 삭제
  const deleteTransaction = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("finance_transactions")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    return { success: true };
  };

  // 여러 거래 삭제
  const deleteMultipleTransactions = async (ids: string[]) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("finance_transactions")
      .delete()
      .in("id", ids);

    if (error) {
      return { error: error.message };
    }

    setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
    return { success: true };
  };

  // 설정 업데이트
  const updateSettings = async (input: Partial<SettingsInput>) => {
    if (!userId || !settings) return { error: "설정을 찾을 수 없습니다." };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_settings")
      .update(input)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    setSettings(data);
    return { data };
  };

  return (
    <DataContext.Provider
      value={{
        transactions,
        settings,
        loading,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        deleteMultipleTransactions,
        updateSettings,
        refetchTransactions: fetchTransactions,
        refetchSettings: fetchSettings,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useDataContext must be used within a DataProvider");
  }
  return context;
}

