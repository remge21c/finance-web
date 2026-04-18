"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { useUserStatus } from "@/lib/hooks/useUserStatus";
import { getUserPermissionType, grantPermission, revokeAllPermissions } from "@/lib/supabase/groupPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Shield } from "lucide-react";
import type { GroupWithMembers } from "@/types/database";

export default function GroupPermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { currentGroup } = useGroupContext();
  const { isFinanceAdmin } = useUserStatus();
  const [groupWithMembers, setGroupWithMembers] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const groupId = params.id as string;

  useEffect(() => {
    if (groupId) {
      fetchGroupWithMembers();
    }
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

    // 멤버들의 이메일 정보 가져오기
    const membersWithEmails = await Promise.all(
      (data.members || []).map(async (member: any) => {
        // user_status 테이블에서 이메일 가져오기
        const { data: userData } = await supabase
          .from("finance_user_status")
          .select("email")
          .eq("user_id", member.user_id)
          .maybeSingle();

        return {
          ...member,
          user_email: userData?.email || '',
        };
      })
    );

    setGroupWithMembers({
      ...data,
      members: membersWithEmails,
      member_count: membersWithEmails.length,
    } as GroupWithMembers);
    setLoading(false);
  };

  const getPermissionType = (userId: string): 'write' | 'read' | 'none' => {
    if (!groupWithMembers) return 'none';

    const permissions = groupWithMembers.permissions || { can_write: [], can_read: [] };

    if (permissions.can_write.includes(userId)) {
      return 'write';
    } else if (permissions.can_read.includes(userId)) {
      return 'read';
    }

    return 'none';
  };

  const updatePermission = async (userId: string, permissionType: 'none' | 'write' | 'read') => {
    setUpdating(userId);

    try {
      if (permissionType === 'none') {
        const result = await revokeAllPermissions(groupId, userId);
        if (result.error) {
          toast.error("권한 제거 실패: " + result.error);
        } else {
          toast.success("권한이 제거되었습니다.");
        }
      } else {
        const result = await grantPermission(groupId, userId, permissionType);
        if (result.error) {
          toast.error("권한 업데이트 실패: " + result.error);
        } else {
          toast.success("권한이 업데이트되었습니다.");
        }
      }

      // 그룹 정보 다시 가져오기
      await fetchGroupWithMembers();
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!groupWithMembers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">그룹을 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
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
      </div>

      {/* 권한 안내 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="text-xs sm:text-sm text-blue-800">
            <p className="font-medium mb-2">권한 안내</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li><strong>쓰기 권한:</strong> 그룹 내 데이터를 추가하고 수정할 수 있습니다.</li>
              <li><strong>읽기 권한:</strong> 그룹 내 데이터를 조회만 할 수 있습니다.</li>
              <li><strong>권한 없음:</strong> 그룹 내 데이터에 접근할 수 없습니다.</li>
              <li className="text-gray-600 text-xs mt-2">
                * 소유자(owner)와 관리자(admin) 역할은 별도의 권한 설정 없이 그룹을 관리할 수 있습니다.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 멤버별 권한 설정 */}
      <Card>
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg">멤버 권한 설정</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            {groupWithMembers.members.map((member) => (
              <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{member.user_email || member.user_id}</p>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-xs sm:text-sm text-gray-500">역할:</span>
                    <span className={`badge ${
                      member.role === 'owner' ? 'badge-admin' :
                      member.role === 'admin' ? 'badge-approved' :
                      'badge-pending'
                    }`}>
                      {member.role === 'owner' ? '소유자' :
                       member.role === 'admin' ? '관리자' : '멤버'}
                    </span>
                    <span className="text-xs text-gray-400">
                      가입일: {new Date(member.joined_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Select
                    value={getPermissionType(member.user_id)}
                    onValueChange={(value) => updatePermission(member.user_id, value as 'none' | 'write' | 'read')}
                    disabled={updating === member.user_id || member.role === 'owner' || member.role === 'admin'}
                  >
                    <SelectTrigger className="w-28 sm:w-32 text-xs sm:text-sm h-8 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">권한 없음</SelectItem>
                      <SelectItem value="read">읽기</SelectItem>
                      <SelectItem value="write">쓰기</SelectItem>
                    </SelectContent>
                  </Select>
                  {updating === member.user_id && (
                    <span className="text-xs text-gray-500">업데이트 중...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
