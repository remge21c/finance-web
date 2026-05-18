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
}

export function GroupProvider({ children }: GroupProviderProps) {
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentPermissionLevel, setCurrentPermissionLevel] = useState<PermissionLevel | null>(null);
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null);

  // 사용자 ID 및 권한 가져오기
  // userId를 userStatus 조회 완료 후 한꺼번에 설정: React 18 auto-batching 덕분에
  // setUserId/setIsSuperAdmin/setPrimaryGroupId가 같은 틱에 처리되어
  // fetchGroups 시작 시점에 primaryGroupId가 이미 준비된 상태
  useEffect(() => {
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
  }, []);

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
  useEffect(() => {
    if (groups.length === 0) return;

    const storedGroupId = localStorage.getItem("selectedGroupId");

    // 사용자가 직접 선택해 저장한 그룹이 있으면 최우선
    if (storedGroupId) {
      const stored = groups.find(g => g.id === storedGroupId);
      if (stored) {
        if (currentGroup?.id !== stored.id) setCurrentGroup(stored);
        return;
      }
    }

    // 우선 접속 그룹(primary_group_id)이 있으면 사용
    if (primaryGroupId) {
      const primary = groups.find(g => g.id === primaryGroupId);
      if (primary) {
        if (currentGroup?.id !== primary.id) setCurrentGroup(primary);
        return;
      }
    }

    // 위 두 경우가 없으면 첫 번째 그룹
    if (!currentGroup || !groups.find(g => g.id === currentGroup.id)) {
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
