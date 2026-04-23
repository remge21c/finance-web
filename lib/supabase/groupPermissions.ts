import { createClient } from "@/lib/supabase/client";
import type { PermissionLevel } from "@/types/database";

export async function setMemberPermissionLevel(
  groupId: string,
  userId: string,
  level: PermissionLevel
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error, count } = await supabase
    .from("finance_group_members")
    .update({ permission_level: level }, { count: "exact" })
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  // RLS가 UPDATE를 차단하면 에러 없이 count=0이 반환됨
  if (count === 0) {
    return { error: "권한이 없거나 대상 레코드를 찾을 수 없습니다. (RLS 차단 가능성)" };
  }

  return {};
}

export async function getMemberPermissionLevel(
  groupId: string,
  userId: string
): Promise<PermissionLevel | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("finance_group_members")
    .select("permission_level")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.permission_level as PermissionLevel) ?? null;
}
