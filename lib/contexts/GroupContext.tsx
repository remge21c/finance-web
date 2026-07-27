"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Group, GroupInput, PermissionLevel } from "@/types/database";
import {
  getUserGroups,
  createGroup as createGroupApi,
  updateGroup as updateGroupApi,
  deleteGroup as deleteGroupApi,
} from "@/lib/supabase/groups";

export type FinanceMode = "group";

interface GroupContextType {
  groups: Group[];
  loading: boolean;
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  isSuperAdmin: boolean;
  userId: string | null;
  financeMode: FinanceMode;
  hasWritePermission: boolean;
  currentPermissionLevel: PermissionLevel | null;
  createGroup: (input: GroupInput) => Promise<{ success: boolean; error?: string }>;
  updateGroup: (groupId: string, input: Partial<GroupInput>) => Promise<{ success: boolean; error?: string }>;
  deleteGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

interface GroupProviderProps {
  children: ReactNode;
  // 서버에서 미리 가져온 초기값 (SSR) — 첫 paint부터 올바른 그룹 표시
  initialGroups?: Group[];
  initialPrimaryGroupId?: string | null;
  initialIsSuperAdmin?: boolean;
  initialUserId?: string | null;
}

function pickInitialGroup(
  groups: Group[],
  primaryGroupId: string | null,
): Group | null {
  if (groups.length === 0) return null;
  if (primaryGroupId) {
    const primary = groups.find((g) => g.id === primaryGroupId);
    if (primary) return primary;
  }
  return groups[0];
}

export function GroupProvider({
  children,
  initialGroups = [],
  initialPrimaryGroupId = null,
  initialIsSuperAdmin = false,
  initialUserId = null,
}: GroupProviderProps) {
  const [allGroups, setAllGroups] = useState<Group[]>(initialGroups);
  // SSR 데이터가 있으면 첫 렌더부터 loading 아님
  const [loading, setLoading] = useState(initialGroups.length === 0 && !initialUserId);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(() => {
    // SSR에서는 localStorage 접근 불가 → 우선 그룹/첫 그룹으로 임시 결정
    // (마운트 후 localStorage 선택값으로 복원)
    if (initialGroups.length === 0) return null;
    const visibleGroups = initialIsSuperAdmin
      ? initialGroups
      : initialGroups.filter((g) => g.group_type === "department");
    return pickInitialGroup(visibleGroups, initialPrimaryGroupId);
  });
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [initialized, setInitialized] = useState(initialGroups.length > 0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initialIsSuperAdmin);
  const [currentPermissionLevel, setCurrentPermissionLevel] = useState<PermissionLevel | null>(null);
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(initialPrimaryGroupId);
  // localStorage 복원 완료 전엔 우선그룹으로 storage를 덮어쓰지 않음
  const [selectionReady, setSelectionReady] = useState(false);

  // 사용자 ID 및 권한 가져오기 — SSR에서 받지 못한 경우만 client에서 조회
  useEffect(() => {
    if (initialUserId) return;
    async function getUser() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userStatus } = await supabase
            .from("finance_user_status")
            .select("is_super_admin, primary_group_id")
            .eq("user_id", user.id)
            .maybeSingle();

          setUserId(user.id);
          setIsSuperAdmin(userStatus?.is_super_admin || false);
          setPrimaryGroupId(userStatus?.primary_group_id || null);
        }
      } catch (err) {
        console.error("[GroupContext] getUser error:", err);
      }
    }
    getUser();
  }, [initialUserId]);

  // 그룹 목록 가져오기
  const fetchGroups = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getUserGroups();
      setAllGroups(data);
    } catch (error) {
      console.error("[GroupContext] fetchGroups caught:", error);
      setAllGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (userId && !initialized) {
      fetchGroups()
        .then(() => setInitialized(true))
        .catch(() => setInitialized(true));
    } else if (!userId) {
      setLoading(false);
    }
  }, [userId, initialized]);

  // 슈퍼관리자는 모든 그룹, 일반 사용자는 department 타입만
  // filter 결과는 매 렌더 새 배열이므로 useMemo로 참조 안정화
  const groups = useMemo(
    () =>
      isSuperAdmin
        ? allGroups
        : allGroups.filter((g) => g.group_type === "department"),
    [isSuperAdmin, allGroups],
  );

  // 현재 그룹의 permission_level 조회
  // 그룹 전환이 빠르게 일어날 때 이전 쿼리 응답이 늦게 도착해 현재 그룹의
  // 권한을 stale 값으로 덮어쓰지 않도록, currentGroup.id 가 바뀌면 응답 무시.
  useEffect(() => {
    if (!currentGroup || !userId) {
      setCurrentPermissionLevel(null);
      return;
    }
    if (isSuperAdmin) {
      setCurrentPermissionLevel("admin");
      return;
    }
    const groupIdAtRequestTime = currentGroup.id;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("finance_group_members")
      .select("permission_level")
      .eq("group_id", groupIdAtRequestTime)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCurrentPermissionLevel((data?.permission_level as PermissionLevel) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentGroup, userId, isSuperAdmin]);

  const hasWritePermission: boolean =
    isSuperAdmin ||
    currentPermissionLevel === "admin" ||
    currentPermissionLevel === "assistant";

  // 1) 마운트 후 localStorage의 사용자 선택 그룹을 우선 복원
  //    (SSR은 우선그룹으로 시작하므로, 복원 전에 storage를 덮어쓰면 안 됨)
  useEffect(() => {
    if (selectionReady) return;
    if (groups.length === 0) {
      // 그룹 로드가 끝났는데도 비어 있으면 복원 종료
      if (!loading && initialized) setSelectionReady(true);
      return;
    }

    const stored = localStorage.getItem("selectedGroupId");
    if (stored) {
      const match = groups.find((g) => g.id === stored);
      if (match) {
        console.info("[GroupContext] localStorage에서 그룹 복원:", match.name);
        setCurrentGroup(match);
        setSelectionReady(true);
        return;
      }
    }
    setSelectionReady(true);
  }, [groups, selectionReady, loading, initialized]);

  // 2) currentGroup 자동 설정 (복원 완료 후, 없을 때만)
  useEffect(() => {
    if (!selectionReady) return;
    if (groups.length === 0) return;

    // 현재 그룹이 그룹 목록에 없으면(삭제됨 등) 우선 그룹 → 첫 그룹으로 재설정
    if (currentGroup && !groups.find((g) => g.id === currentGroup.id)) {
      const fallback = pickInitialGroup(groups, primaryGroupId);
      console.warn(
        "[GroupContext] currentGroup 이 그룹 목록에 없음 — 재설정:",
        fallback?.name,
      );
      setCurrentGroup(fallback);
      return;
    }

    // currentGroup이 아직 없을 때만 우선 그룹 → 첫 그룹으로 폴백
    if (!currentGroup) {
      const fallback = pickInitialGroup(groups, primaryGroupId);
      console.info("[GroupContext] currentGroup null →", fallback?.name);
      setCurrentGroup(fallback);
    }
  }, [groups, primaryGroupId, selectionReady, currentGroup]);

  // 3) 사용자 선택(또는 복원된 선택)을 localStorage에 동기화
  useEffect(() => {
    if (!selectionReady || !currentGroup) return;
    localStorage.setItem("selectedGroupId", currentGroup.id);
  }, [currentGroup, selectionReady]);

  // 그룹 생성
  const createGroup = async (input: GroupInput) => {
    if (!isSuperAdmin) {
      return { success: false, error: "그룹 생성 권한이 없습니다." };
    }

    const result = await createGroupApi(input);
    if (result.data) {
      await fetchGroups();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  // 그룹 수정
  const updateGroup = async (groupId: string, input: Partial<GroupInput>) => {
    const result = await updateGroupApi(groupId, input);
    if (!result.error) {
      await fetchGroups();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  // 그룹 삭제
  const deleteGroup = async (groupId: string) => {
    const result = await deleteGroupApi(groupId);
    if (!result.error) {
      await fetchGroups();
      if (currentGroup?.id === groupId) {
        setCurrentGroup(allGroups.find(g => g.id !== groupId) || null);
      }
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const handleSetCurrentGroup = (group: Group | null) => {
    console.info("[GroupContext] setCurrentGroup:", { id: group?.id, name: group?.name });
    setCurrentGroup(group);
    if (group) {
      localStorage.setItem("selectedGroupId", group.id);
    } else {
      localStorage.removeItem("selectedGroupId");
    }
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        loading,
        currentGroup,
        setCurrentGroup: handleSetCurrentGroup,
        isSuperAdmin,
        userId,
        financeMode: "group",
        hasWritePermission,
        currentPermissionLevel,
        createGroup,
        updateGroup,
        deleteGroup,
        refetch: fetchGroups,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroupContext() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error("useGroupContext must be used within a GroupProvider");
  }
  return context;
}
