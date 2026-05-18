"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    // SSR에서 우선 그룹을 즉시 결정 → 첫 paint부터 올바른 그룹 표시
    if (initialGroups.length === 0) return null;
    const visibleGroups = initialIsSuperAdmin
      ? initialGroups
      : initialGroups.filter(g => g.group_type === "department");
    if (visibleGroups.length === 0) return null;
    if (initialPrimaryGroupId) {
      const primary = visibleGroups.find(g => g.id === initialPrimaryGroupId);
      if (primary) {
        if (typeof window !== "undefined") {
          console.info("[GroupContext] SSR 초기 그룹 = 우선 그룹:", primary.name, "(id:", primary.id, ")");
        }
        return primary;
      }
    }
    if (typeof window !== "undefined") {
      console.info("[GroupContext] SSR 초기 그룹 = 첫 그룹(우선 그룹 부재/필터됨):", visibleGroups[0].name);
    }
    return visibleGroups[0];
  });
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [initialized, setInitialized] = useState(initialGroups.length > 0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initialIsSuperAdmin);
  const [currentPermissionLevel, setCurrentPermissionLevel] = useState<PermissionLevel | null>(null);
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(initialPrimaryGroupId);

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
  const groups = isSuperAdmin
    ? allGroups
    : allGroups.filter(g => g.group_type === "department");

  // 현재 그룹의 permission_level 조회
  useEffect(() => {
    if (!currentGroup || !userId) {
      setCurrentPermissionLevel(null);
      return;
    }
    if (isSuperAdmin) {
      setCurrentPermissionLevel('admin');
      return;
    }
    const supabase = createClient();
    supabase
      .from("finance_group_members")
      .select("permission_level")
      .eq("group_id", currentGroup.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setCurrentPermissionLevel((data?.permission_level as PermissionLevel) ?? null);
      });
  }, [currentGroup, userId, isSuperAdmin]);

  const hasWritePermission: boolean =
    isSuperAdmin ||
    currentPermissionLevel === 'admin' ||
    currentPermissionLevel === 'assistant';

  // currentGroup 자동 설정
  // SSR로 이미 currentGroup이 결정된 경우, localStorage가 있으면 그 쪽으로 한 번만 보정
  useEffect(() => {
    if (groups.length === 0) return;

    // 현재 그룹이 그룹 목록에 없으면(삭제됨 등) 우선 그룹/첫 그룹으로 재설정
    if (currentGroup && !groups.find(g => g.id === currentGroup.id)) {
      const primary = primaryGroupId ? groups.find(g => g.id === primaryGroupId) : null;
      setCurrentGroup(primary || groups[0]);
      return;
    }

    // currentGroup이 아직 없으면 우선 그룹 → 첫 그룹
    if (!currentGroup) {
      const storedGroupId = typeof window !== "undefined"
        ? localStorage.getItem("selectedGroupId")
        : null;
      if (storedGroupId) {
        const stored = groups.find(g => g.id === storedGroupId);
        if (stored) {
          setCurrentGroup(stored);
          return;
        }
      }
      if (primaryGroupId) {
        const primary = groups.find(g => g.id === primaryGroupId);
        if (primary) {
          setCurrentGroup(primary);
          return;
        }
      }
      setCurrentGroup(groups[0]);
    }
  }, [groups, primaryGroupId]);

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
