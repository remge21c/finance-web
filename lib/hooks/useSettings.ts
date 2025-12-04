"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Settings, SettingsInput } from "@/types/database";

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

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
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

  const fetchSettings = useCallback(async () => {
    if (!userId) {
      setLoading(false);
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
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchSettings();
    }
  }, [userId, fetchSettings]);

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

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}









