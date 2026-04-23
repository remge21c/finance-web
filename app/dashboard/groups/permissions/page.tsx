"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { setMemberPermissionLevel } from "@/lib/supabase/groupPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Shield } from "lucide-react";
import type { GroupWithMembers, PermissionLevel } from "@/types/database";

const LEVEL_LABEL: Record<PermissionLevel, string> = { admin: '관리', assistant: '보조', general: '일반' };
const LEVEL_ACTIVE: Record<PermissionLevel, string> = {
  admin: 'bg-purple-600 text-white',
  assistant: 'bg-blue-600 text-white',
  general: 'bg-gray-600 text-white',
};
const LEVEL_BADGE: Record<PermissionLevel, string> = {
  admin: 'bg-purple-100 text-purple-700',
  assistant: 'bg-blue-100 text-blue-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function GroupPermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { currentPermissionLevel } = useGroupContext();
  const [groupWithMembers, setGroupWithMembers] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const groupId = params.id as string;

  useEffect(() => {
    if (groupId) fetchGroupWithMembers();
  }, [groupId]);

  const fetchGroupWithMembers = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("finance_groups")
      .select(`
        *,
        members:finance_group_members(
          id,
          user_id,
          role,
          permission_level,
          joined_at
        )
      `)
      .eq("id", groupId)
      .single();

    if (error) {
      toast.error("그룹 정보를 가져오지 못했습니다.");
      setLoading(false);
      return;
    }

    const membersWithEmails = await Promise.all(
      (data.members || []).map(async (member: any) => {
        const { data: userData } = await supabase
          .from("finance_user_status")
          .select("email, name")
          .eq("user_id", member.user_id)
          .maybeSingle();
        return { ...member, user_email: userData?.email || '', user_name: userData?.name || '' };
      })
    );

    setGroupWithMembers({ ...data, members: membersWithEmails, member_count: membersWithEmails.length } as GroupWithMembers);
    setLoading(false);
  };

  const handleSetLevel = async (userId: string, level: PermissionLevel) => {
    setUpdating(userId);
    const result = await setMemberPermissionLevel(groupId, userId, level);
    if (result.error) {
      toast.error("권한 변경 실패: " + result.error);
    } else {
      toast.success("권한이 변경되었습니다.");
      await fetchGroupWithMembers();
    }
    setUpdating(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">로딩 중...</div></div>;
  }

  if (!groupWithMembers) {
    return <div className="flex items-center justify-center h-64"><div className="text-red-500">그룹을 찾을 수 없습니다.</div></div>;
  }

  const canManage = currentPermissionLevel === 'admin';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs sm:text-sm">뒤로</span>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
            <span className="text-base sm:text-xl">그룹 권한 설정</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{groupWithMembers.name}</p>
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="text-xs sm:text-sm text-blue-800">
            <p className="font-medium mb-2">권한 안내</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li><strong>관리:</strong> 쓰기/수정/삭제 + 그룹 멤버 권한 설정 가능</li>
              <li><strong>보조:</strong> 쓰기/수정/삭제 가능 (권한 설정 불가)</li>
              <li><strong>일반:</strong> 읽기 전용</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg">멤버 권한 설정</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-3">
            {groupWithMembers.members.map((member: any) => {
              const level: PermissionLevel = (member.permission_level as PermissionLevel) || 'general';
              return (
                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{member.user_name || member.user_email || member.user_id}</p>
                    <p className="text-xs text-gray-500">{member.user_email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_BADGE[level]}`}>
                        {LEVEL_LABEL[level]}
                      </span>
                      <span className="text-xs text-gray-400">가입일: {new Date(member.joined_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {(['admin', 'assistant', 'general'] as PermissionLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          disabled={updating === member.user_id}
                          onClick={() => handleSetLevel(member.user_id, lvl)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                            level === lvl ? LEVEL_ACTIVE[lvl] : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {LEVEL_LABEL[lvl]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
