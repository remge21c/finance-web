"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserStatus } from "@/types/database";

export function useUserStatus() {
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [allUsers, setAllUsers] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // 현재 사용자의 상태 조회
  const fetchUserStatus = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("finance_user_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        // 테이블이 없거나 RLS 문제인 경우 - 무시하고 계속 진행
        console.warn("사용자 상태 조회 실패 (테이블 미존재 또는 권한 문제):", error.message || error.code || "알 수 없는 에러");
      } else if (data) {
        setUserStatus(data);
      }
      // data가 null인 경우 (레코드 없음) - 에러가 아님, 새 사용자로 처리
    } catch (err) {
      console.warn("사용자 상태 조회 중 예외 발생:", err);
    }
    setLoading(false);
  }, []);

  // 모든 사용자 상태 조회 (관리자용)
  const fetchAllUsers = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("finance_user_status")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("사용자 목록 조회 실패:", error);
    } else {
      setAllUsers(data || []);
    }
  }, []);

  useEffect(() => {
    fetchUserStatus();
  }, [fetchUserStatus]);

  // 사용자 승인
  const approveUser = async (userId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("finance_user_status")
      .update({ 
        status: "approved",
        approved_by: user?.id,
        rejected_reason: ""
      })
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    await fetchAllUsers();
    return { success: true };
  };

  // 사용자 거절
  const rejectUser = async (userId: string, reason: string = "") => {
    const supabase = createClient();

    const { error } = await supabase
      .from("finance_user_status")
      .update({ 
        status: "rejected",
        rejected_reason: reason
      })
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    await fetchAllUsers();
    return { success: true };
  };

  // 재신청 (거절된 사용자가 다시 pending으로 변경)
  const reapply = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "로그인이 필요합니다." };

    const { error } = await supabase
      .from("finance_user_status")
      .update({ 
        status: "pending",
        rejected_reason: ""
      })
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    await fetchUserStatus();
    return { success: true };
  };

  return {
    userStatus,
    allUsers,
    loading,
    isSuperAdmin: userStatus?.is_super_admin || false,
    isApproved: userStatus?.status === "approved",
    isPending: userStatus?.status === "pending",
    isRejected: userStatus?.status === "rejected",
    fetchUserStatus,
    fetchAllUsers,
    approveUser,
    rejectUser,
    reapply,
  };
}






