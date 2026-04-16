"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionInput, Settings, SettingsInput } from "@/types/database";
import { useGroupContext } from "@/lib/contexts/GroupContext";

const defaultSettings: Omit<Settings, "id" | "user_id" | "group_id" | "updated_at"> = {
  app_title: "재정관리",
  income_items: [],
  expense_items: [],
  income_budgets: [],
  expense_budgets: [],
  author: "",
  manager: "",
  auditor: "",
  currency: "원",
  memo: "",
  cash_amount: 0,
  touch_amount: 0,
  other_amount: 0,
  account1_name: "현금",
  account2_name: "터치앤고",
  account3_name: "기타",
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
  refetchAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { currentGroup } = useGroupContext();

  // 사용자 ID 가져오기
  useEffect(() => {
    async function getUser() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error("[DataContext] getUser error:", err);
      }
    }
    getUser();
  }, []);

  // 그룹 변경 시 데이터 재로드
  useEffect(() => {
    if (currentGroup && userId) {
      fetchData();
    } else {
      // 그룹이 없으면 로딩 완료
      setLoading(false);
    }
  }, [currentGroup, userId]);

  // 전체 데이터 가져오기
  const fetchData = async () => {
    if (!userId || !currentGroup) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchTransactions(), fetchSettings()]);
    } catch (error) {
      console.error("fetchData failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // 거래 내역 불러오기 (현재 그룹)
  const fetchTransactions = useCallback(async () => {
    if (!userId || !currentGroup) {
      setTransactions([]);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("*")
      .eq("group_id", currentGroup.id)
      .order("date", { ascending: true });

    if (error) {
      console.error("거래 내역 조회 실패:", error);
      setTransactions([]);
    } else {
      setTransactions(data || []);
    }
  }, [userId, currentGroup]);

  // 설정 불러오기 (현재 그룹)
  const fetchSettings = useCallback(async () => {
    if (!userId || !currentGroup) {
      setSettings(null);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_settings")
      .select("*")
      .eq("group_id", currentGroup.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116는 결과가 없다는 정상 응답
      console.error("설정 조회 실패:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      return;
    }

    if (!data) {
      // 설정이 없으면 기본 설정 생성 시도
      const { data: newSettings, error: insertError } = await supabase
        .from("finance_settings")
        .insert({
          user_id: userId,
          group_id: currentGroup.id,
          ...defaultSettings,
        })
        .select()
        .single();

      if (insertError) {
        // 중복 키 오류인 경우 (이미 설정이 존재), 다시 조회 후 조용히 처리
        if (insertError.code === "23505") {
          const { data: retryData } = await supabase
            .from("finance_settings")
            .select("*")
            .eq("group_id", currentGroup.id)
            .maybeSingle();

          setSettings(retryData ?? {
            id: "",
            user_id: userId,
            group_id: currentGroup.id,
            ...defaultSettings,
            updated_at: new Date().toISOString(),
          } as Settings);
          return;
        }

        console.error("설정 생성 실패:", insertError.message || insertError.code);
        // 설정 생성 실패 시에도 기본 설정 사용
        setSettings({
          id: "",
          user_id: userId,
          group_id: currentGroup.id,
          ...defaultSettings,
          updated_at: new Date().toISOString(),
        } as Settings);
      } else {
        setSettings(newSettings);
      }
    } else {
      setSettings(data);
    }
  }, [userId, currentGroup]);

  // 거래 추가
  const addTransaction = async (input: TransactionInput) => {
    if (!userId || !currentGroup) return { error: "로그인이 필요합니다." };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_transactions")
      .insert({
        user_id: userId,
        group_id: currentGroup.id,
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
    if (!userId || !settings || !currentGroup) return { error: "설정을 찾을 수 없습니다." };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_settings")
      .update(input)
      .eq("group_id", currentGroup.id)
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
        refetchAll: fetchData,
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
