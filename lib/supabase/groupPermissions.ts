import { createClient } from "@/lib/supabase/client";
import type { GroupPermissions } from "@/types/database";

/**
 * 그룹 권한 설정 업데이트
 */
export async function updateGroupPermissions(
  groupId: string,
  permissions: GroupPermissions
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("finance_groups")
    .update({ permissions })
    .eq("id", groupId);

  return { error: error?.message };
}

/**
 * 사용자에게 특정 권한 부여
 */
export async function grantPermission(
  groupId: string,
  userId: string,
  permissionType: 'write' | 'read'
): Promise<{ error?: string }> {
  const supabase = createClient();

  // 현재 그룹 권한 가져오기
  const { data: group } = await supabase
    .from("finance_groups")
    .select("permissions")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "그룹을 찾을 수 없습니다." };
  }

  const currentPermissions = (group.permissions as GroupPermissions) || { can_write: [], can_read: [] };

  // 기존 권한 제거
  const newPermissions: GroupPermissions = {
    can_write: currentPermissions.can_write.filter((id: string) => id !== userId),
    can_read: currentPermissions.can_read.filter((id: string) => id !== userId),
  };

  // 새 권한 추가
  if (permissionType === 'write') {
    newPermissions.can_write.push(userId);
  } else if (permissionType === 'read') {
    newPermissions.can_read.push(userId);
  }

  // 권한 업데이트
  return updateGroupPermissions(groupId, newPermissions);
}

/**
 * 사용자의 모든 권한 제거
 */
export async function revokeAllPermissions(
  groupId: string,
  userId: string
): Promise<{ error?: string }> {
  const supabase = createClient();

  // 현재 그룹 권한 가져오기
  const { data: group } = await supabase
    .from("finance_groups")
    .select("permissions")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "그룹을 찾을 수 없습니다." };
  }

  const currentPermissions = (group.permissions as GroupPermissions) || { can_write: [], can_read: [] };

  // 사용자의 모든 권한 제거
  const newPermissions: GroupPermissions = {
    can_write: currentPermissions.can_write.filter((id: string) => id !== userId),
    can_read: currentPermissions.can_read.filter((id: string) => id !== userId),
  };

  // 권한 업데이트
  return updateGroupPermissions(groupId, newPermissions);
}

/**
 * 사용자의 권한 유형 확인
 */
export async function getUserPermissionType(
  groupId: string,
  userId: string
): Promise<'write' | 'read' | 'none'> {
  const supabase = createClient();

  const { data: group } = await supabase
    .from("finance_groups")
    .select("permissions")
    .eq("id", groupId)
    .single();

  if (!group) {
    return 'none';
  }

  const permissions = (group.permissions as GroupPermissions) || { can_write: [], can_read: [] };

  if (permissions.can_write.includes(userId)) {
    return 'write';
  } else if (permissions.can_read.includes(userId)) {
    return 'read';
  }

  return 'none';
}
