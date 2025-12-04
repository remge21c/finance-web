"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionInput } from "@/types/database";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchTransactions();
    }
  }, [userId, fetchTransactions]);

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

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteMultipleTransactions,
    refetch: fetchTransactions,
  };
}









