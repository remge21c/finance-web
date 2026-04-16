import { createClient } from "@/lib/supabase/client";
import type { Group, GroupInput, GroupMember, GroupMemberInput, GroupWithMembers } from "@/types/database";

/**
 * 현재 사용자가 속한 그룹 목록 가져오기
 */
export async function getUserGroups(): Promise<Group[]> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log("[getUserGroups] No user found");
      return [];
    }

    console.log("[getUserGroups] Fetching groups for user:", user.id);
    // 먼저 슈퍼관리자 또는 재정관리자인지 확인
    const { data: userStatus } = await supabase
      .from("finance_user_status")
      .select("is_super_admin, is_finance_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = userStatus?.is_super_admin || false;
    const isFinanceAdmin = userStatus?.is_finance_admin || false;

    console.log("[getUserGroups] User isSuperAdmin:", isSuperAdmin, "isFinanceAdmin:", isFinanceAdmin);

    // 슈퍼관리자는 모든 department 그룹 조회
    if (isSuperAdmin) {
      const { data: allGroups, error: allGroupsError } = await supabase
        .from("finance_groups")
        .select("*")
        .eq("group_type", "department")
        .order("created_at", { ascending: false });

      if (allGroupsError) {
        console.error("[getUserGroups] All groups query error:", allGroupsError);
        return [];
      }

      console.log("[getUserGroups] All groups (super admin):", allGroups?.length || 0);
      return (allGroups || []) as Group[];
    }

    // 재정관리자: 자신이 생성한 department 그룹만 조회
    if (isFinanceAdmin) {
      const { data: ownedGroups, error: ownedError } = await supabase
        .from("finance_groups")
        .select("*")
        .eq("created_by", user.id)
        .eq("group_type", "department")
        .order("created_at", { ascending: false });

      if (ownedError) {
        console.error("[getUserGroups] Owned groups query error:", ownedError);
        return [];
      }

      console.log("[getUserGroups] Owned groups (finance admin):", ownedGroups?.length || 0);
      return (ownedGroups || []) as Group[];
    }

    // 일반 사용자: 멤버로 속한 department 그룹만 조회
    const { data: memberData, error: memberError } = await supabase
      .from("finance_group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (memberError) {
      console.error("[getUserGroups] Member query error:", memberError);
      return [];
    }

    // 멤버로 속한 그룹의 상세 정보 조회
    let memberGroups: any[] = [];
    if (memberData && memberData.length > 0) {
      const groupIds = memberData.map((m: any) => m.group_id);
      const { data: memberGroupsData, error: memberGroupsError } = await supabase
        .from("finance_groups")
        .select("*")
        .in("id", groupIds)
        .eq("group_type", "department");

      if (memberGroupsError) {
        console.error("[getUserGroups] Member groups query error:", memberGroupsError);
      } else {
        memberGroups = memberGroupsData || [];
      }
    }

    console.log("[getUserGroups] Member groups (regular user):", memberGroups.length);
    return memberGroups as Group[];
  } catch (error: any) {
    console.error("[getUserGroups] Unexpected error:", error);
    console.error("[getUserGroups] Error name:", error?.name);
    console.error("[getUserGroups] Error message:", error?.message);
    // 에러 발생 시 빈 배열 반환
    return [];
  }
}

/**
 * 그룹 ID로 그룹 정보와 멤버 목록 가져오기
 */
export async function getGroupWithMembers(groupId: string): Promise<GroupWithMembers | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("finance_groups")
    .select(`
      *,
      members:finance_group_members(
        id,
        user_id,
        role,
        joined_at
      )
    `)
    .eq("id", groupId)
    .single();

  if (error) throw error;

  // 멤버들의 이메일 정보 가져오기
  const membersWithEmails = await Promise.all(
    (data.members || []).map(async (member: any) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return {
        ...member,
        user_email: userData.user?.email || '',
      };
    })
  );

  return {
    ...data,
    members: membersWithEmails,
    member_count: membersWithEmails.length,
  } as GroupWithMembers;
}

/**
 * 그룹 생성
 */
export async function createGroup(input: GroupInput): Promise<{ data?: Group; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증되지 않은 사용자입니다." };
  }

  const { data, error } = await supabase
    .from("finance_groups")
    .insert({ ...input, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  // 생성자를 owner로 추가
  const { error: memberError } = await supabase
    .from("finance_group_members")
    .insert({
      group_id: data.id,
      user_id: user.id,
      role: "owner"
    });

  if (memberError) {
    return { error: memberError.message };
  }

  // 기본 settings 생성
  const { error: settingsError } = await supabase
    .from("finance_settings")
    .insert({
      user_id: user.id,
      group_id: data.id,
      app_title: input.name,
    });

  if (settingsError) {
    return { error: settingsError.message };
  }

  return { data };
}

/**
 * 그룹 멤버 추가
 */
export async function addGroupMember(input: GroupMemberInput): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("finance_group_members")
    .insert(input);

  return { error: error?.message };
}

/**
 * 그룹 멤버 역할 업데이트
 */
export async function updateGroupMember(
  memberId: string,
  role: 'owner' | 'admin' | 'member'
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("finance_group_members")
    .update({ role })
    .eq("id", memberId);

  return { error: error?.message };
}

/**
 * 그룹 멤버 제거
 */
export async function removeGroupMember(memberId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("finance_group_members")
    .delete()
    .eq("id", memberId);

  return { error: error?.message };
}

/**
 * 그룹 정보 업데이트
 */
export async function updateGroup(
  groupId: string,
  input: Partial<GroupInput>
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("finance_groups")
    .update(input)
    .eq("id", groupId);

  return { error: error?.message };
}

/**
 * 그룹 삭제
 */
export async function deleteGroup(groupId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("finance_groups")
    .delete()
    .eq("id", groupId);

  return { error: error?.message };
}

/**
 * 사용자 이메일로 사용자 ID 찾기
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createClient();

  // Supabase Auth에서 사용자 찾기
  const { data, error } = await supabase
    .from("finance_user_status")
    .select("user_id")
    .eq("email", email)
    .single();

  if (error || !data) {
    return null;
  }

  return data.user_id;
}
