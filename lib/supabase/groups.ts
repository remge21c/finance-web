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
    // 슈퍼관리자인지 확인
    const { data: userStatus } = await supabase
      .from("finance_user_status")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = userStatus?.is_super_admin || false;

    console.log("[getUserGroups] User isSuperAdmin:", isSuperAdmin);

    // 슈퍼관리자는 모든 그룹 조회
    if (isSuperAdmin) {
      const { data: allGroups, error: allGroupsError } = await supabase
        .from("finance_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (allGroupsError) {
        console.error("[getUserGroups] All groups query error:", allGroupsError);
        return [];
      }

      console.log("[getUserGroups] All groups (super admin):", allGroups?.length || 0);
      return (allGroups || []) as Group[];
    }

    // 일반 사용자: 멤버로 속한 그룹만 조회
    const { data: memberData, error: memberError } = await supabase
      .from("finance_group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (memberError) {
      console.error("[getUserGroups] Member query error:", memberError.message, "(code:", memberError.code, ")");
      return [];
    }

    // 멤버로 속한 그룹의 상세 정보 조회
    let memberGroups: any[] = [];
    if (memberData && memberData.length > 0) {
      const groupIds = memberData.map((m: any) => m.group_id);
      const { data: memberGroupsData, error: memberGroupsError } = await supabase
        .from("finance_groups")
        .select("*")
        .in("id", groupIds);

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
        permission_level,
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

  // 생성자를 admin 권한으로 추가
  const { error: memberError } = await supabase
    .from("finance_group_members")
    .insert({
      group_id: data.id,
      user_id: user.id,
      permission_level: "admin"
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
    .insert({
      ...input,
      permission_level: input.permission_level ?? 'general',
    });

  return { error: error?.message };
}

/**
 * 그룹 멤버 역할 업데이트
 */
export async function updateGroupMember(
  memberId: string,
  role: 'owner' | 'admin' | 'finance_admin' | 'member'
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

/**
 * 재정관리 권한 넘기기
 * 현재 재정관리자의 권한을 다른 회원에게 넘기고, 현재 사용자는 일반 회원으로 변경 후 로그아웃
 */
export async function transferFinanceAdminRole(
  groupId: string,
  currentUserId: string,
  newFinanceAdminId: string
): Promise<{ error?: string }> {
  const supabase = createClient();

  try {
    // 1. 현재 관리자의 멤버 정보 찾기
    const { data: currentMember } = await supabase
      .from("finance_group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", currentUserId)
      .single();

    if (!currentMember) {
      return { error: "현재 사용자가 이 그룹의 멤버가 아닙니다." };
    }

    // 2. 새로운 관리자의 멤버 정보 찾기
    const { data: newMember } = await supabase
      .from("finance_group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", newFinanceAdminId)
      .single();

    if (!newMember) {
      return { error: "선택한 사용자가 이 그룹의 멤버가 아닙니다." };
    }

    // 3. 현재 관리자의 권한을 general로 변경
    const { error: updateError1 } = await supabase
      .from("finance_group_members")
      .update({ permission_level: "general" })
      .eq("id", currentMember.id);

    if (updateError1) {
      return { error: "현재 관리자 역할 변경 실패: " + updateError1.message };
    }

    // 4. 새로운 관리자의 권한을 admin으로 변경
    const { error: updateError2 } = await supabase
      .from("finance_group_members")
      .update({ permission_level: "admin" })
      .eq("id", newMember.id);

    if (updateError2) {
      // 롤백: 현재 관리자 권한 복구
      await supabase
        .from("finance_group_members")
        .update({ permission_level: "admin" })
        .eq("id", currentMember.id);

      return { error: "새 관리자 역할 변경 실패: " + updateError2.message };
    }

    return {};
  } catch (error: any) {
    return { error: error?.message || "권한 넘기기 실패" };
  }
}
