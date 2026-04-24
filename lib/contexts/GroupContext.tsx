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

  // 사용자 ID 및 권한 가져오기
  useEffect(() => {
    async function getUser() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);

          const { data: userStatus } = await supabase
            .from("finance_user_status")
            .select("is_super_admin")
            .eq("user_id", user.id)
            .maybeSingle();

          setIsSuperAdmin(userStatus?.is_super_admin || false);
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
    console.log("[GroupContext] currentGroup 설정 - groups.length:", groups.length, "currentGroup:", currentGroup?.name);

    // localStorage에서 선택한 그룹 확인
    if (!currentGroup && groups.length > 0) {
      const storedGroupId = localStorage.getItem("selectedGroupId");
      console.log("[GroupContext] storedGroupId:", storedGroupId);

      if (storedGroupId) {
        const selectedGroup = groups.find(g => g.id === storedGroupId);
        console.log("[GroupContext] selectedGroup from groups:", selectedGroup?.name);

        if (selectedGroup) {
          console.log("[GroupContext] 선택한 그룹으로 currentGroup 설정:", selectedGroup.name);
          setCurrentGroup(selectedGroup);
          return;
        } else {
          console.log("[GroupContext] 선택한 그룹이 groups 배열에 없음");
        }
      }
    }

    // 기본 동작: 첫 번째 그룹 선택
    if (groups.length > 0 && !currentGroup) {
      console.log("[GroupContext] 첫 번째 그룹으로 currentGroup 설정:", groups[0].name);
      setCurrentGroup(groups[0]);
    } else if (currentGroup && !groups.find(g => g.id === currentGroup.id)) {
      // 현재 그룹이 필터된 목록에 없으면 초기화
      console.log("[GroupContext] 현재 그룹이 필터된 목록에 없어서 첫 번째 그룹으로 설정");
      setCurrentGroup(groups[0] || null);
    }
  }, [groups]);

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
