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
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("finance_user_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("사용자 상태 조회 실패:", error.message || error.code || "알 수 없는 에러");
      } else if (data) {
        setUserStatus(data);
      }
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
  const approveUser = async (userId: string, options: {
    grantFinanceAdmin?: boolean;
  } = {}) => {
    const { grantFinanceAdmin = false } = options;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("finance_user_status")
      .update({
        status: "approved",
        approved_by: user?.id,
        rejected_reason: "",
        is_finance_admin: grantFinanceAdmin,
        finance_admin_approved_by: grantFinanceAdmin ? user?.id : null,
        finance_admin_approved_at: grantFinanceAdmin ? new Date().toISOString() : null,
      })
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    // 재정관리자로 지정된 경우, 속한 그룹에 쓰기 권한 부여
    if (grantFinanceAdmin) {
      const { data: memberships } = await supabase
        .from("finance_group_members")
        .select("group_id")
        .eq("user_id", userId);

      if (memberships && memberships.length > 0) {
        for (const membership of memberships) {
          const { data: group } = await supabase
            .from("finance_groups")
            .select("permissions")
            .eq("id", membership.group_id)
            .single();

          if (group) {
            const permissions = (group.permissions as any) || { can_write: [], can_read: [] };

            // 기존 권한에서 사용자 제거
            const newCanWrite = (permissions.can_write || []).filter((id: string) => id !== userId);
            const newCanRead = (permissions.can_read || []).filter((id: string) => id !== userId);

            // 쓰기 권한 추가
            newCanWrite.push(userId);

            await supabase
              .from("finance_groups")
              .update({
                permissions: {
                  can_write: newCanWrite,
                  can_read: newCanRead,
                }
              })
              .eq("id", membership.group_id);
          }
        }
      }
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

  // 재정관리자 권한 부여
  const grantFinanceAdmin = async (userId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("finance_user_status")
      .update({
        is_finance_admin: true,
        finance_admin_approved_by: user?.id,
        finance_admin_approved_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    // 사용자가 속한 그룹 조회
    const { data: memberships } = await supabase
      .from("finance_group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (memberships && memberships.length > 0) {
      // 각 그룹에 쓰기 권한 부여
      for (const membership of memberships) {
        const { data: group } = await supabase
          .from("finance_groups")
          .select("permissions")
          .eq("id", membership.group_id)
          .single();

        if (group) {
          const permissions = (group.permissions as any) || { can_write: [], can_read: [] };

          // 기존 권한에서 사용자 제거
          const newCanWrite = (permissions.can_write || []).filter((id: string) => id !== userId);
          const newCanRead = (permissions.can_read || []).filter((id: string) => id !== userId);

          // 쓰기 권한 추가
          newCanWrite.push(userId);

          await supabase
            .from("finance_groups")
            .update({
              permissions: {
                can_write: newCanWrite,
                can_read: newCanRead,
              }
            })
            .eq("id", membership.group_id);
        }
      }
    }

    await fetchAllUsers();
    return { success: true };
  };

  // 재정관리자 권한 박탈
  const revokeFinanceAdmin = async (userId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("finance_user_status")
      .update({
        is_finance_admin: false,
        finance_admin_approved_by: null,
        finance_admin_approved_at: null,
      })
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    await fetchAllUsers();
    return { success: true };
  };

  return {
    userStatus,
    allUsers,
    loading,
    isSuperAdmin: userStatus?.is_super_admin || false,
    isFinanceAdmin: userStatus?.is_finance_admin || false,
    isApproved: userStatus?.status === "approved",
    isPending: userStatus?.status === "pending",
    isRejected: userStatus?.status === "rejected",
    fetchUserStatus,
    fetchAllUsers,
    approveUser,
    rejectUser,
    reapply,
    grantFinanceAdmin,
    revokeFinanceAdmin,
  };
}
