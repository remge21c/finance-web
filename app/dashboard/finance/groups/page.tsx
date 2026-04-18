"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserStatus } from "@/lib/hooks/useUserStatus";
import { updateGroupPermissions } from "@/lib/supabase/groupPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Users, Shield, ArrowLeft, Check, X } from "lucide-react";
import type { Group, GroupMember, UserStatus, GroupPermissions } from "@/types/database";

interface GroupWithMembers extends Group {
  members: (GroupMember & { user_email: string; user_name: string })[];
}

export default function FinanceAdminGroupsPage() {
  const router = useRouter();
  const { isFinanceAdmin, isSuperAdmin, allUsers, loading: userStatusLoading } = useUserStatus();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupWithMembers | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<"write" | "read">("read");
  const [requestedGroupUsers, setRequestedGroupUsers] = useState<UserStatus[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 그룹 참여 요청 관련
  interface JoinRequest { id: string; user_id: string; group_id: string; status: string; requested_at: string; user_name: string; user_email: string; group_name: string; }
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // 승인된 사용자만 필터링
  const approvedUsers = allUsers.filter(u => u.status === "approved" && !u.is_super_admin);

  useEffect(() => {
    // 사용자 상태 로딩 중이면 대기
    if (userStatusLoading) {
      return;
    }
    // 재정관리자가 아니면 리다이렉트
    if (!isFinanceAdmin) {
      router.push("/dashboard");
      return;
    }
    // 현재 사용자 ID 가져오기
    const getCurrentUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchGroups(user.id);
        fetchJoinRequests(user.id);
      }
    };
    getCurrentUser();
  }, [isFinanceAdmin, userStatusLoading]);

  const fetchJoinRequests = async (userId?: string) => {
    const uid = userId ?? currentUserId;
    if (!uid) return;
    const supabase = createClient();

    // 내가 생성한 그룹들
    const { data: myGroups } = await supabase
      .from("finance_groups")
      .select("id")
      .eq("created_by", uid);
    if (!myGroups?.length) return;

    const groupIds = myGroups.map((g: any) => g.id);
    const { data } = await supabase
      .from("finance_group_join_requests")
      .select("id, user_id, group_id, status, requested_at")
      .in("group_id", groupIds)
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (!data?.length) { setJoinRequests([]); return; }

    // 사용자/그룹 이름 보강
    const enriched = await Promise.all(data.map(async (req: any) => {
      const { data: uData } = await supabase
        .from("finance_user_status")
        .select("name, email")
        .eq("user_id", req.user_id)
        .maybeSingle();
      const { data: gData } = await supabase
        .from("finance_groups")
        .select("name")
        .eq("id", req.group_id)
        .maybeSingle();
      return {
        ...req,
        user_name: uData?.name || uData?.email || req.user_id,
        user_email: uData?.email || "",
        group_name: gData?.name || req.group_id,
      };
    }));
    setJoinRequests(enriched);
  };

  const fetchGroups = async (userId?: string) => {
    const uid = userId ?? currentUserId;
    if (!uid) return;
    const supabase = createClient();

    // 본인이 생성한 그룹만 가져오기
    const { data: groupsData, error: groupsError } = await supabase
      .from("finance_groups")
      .select("*")
      .eq("created_by", uid)
      .order("created_at", { ascending: false });

    if (groupsError) {
      toast.error("그룹 목록을 가져오지 못했습니다.");
      setLoading(false);
      return;
    }

    // 각 그룹의 멤버 정보 가져오기
    const groupsWithMembers = await Promise.all(
      (groupsData || []).map(async (group: Group) => {
        const { data: membersData } = await supabase
          .from("finance_group_members")
          .select("*")
          .eq("group_id", group.id);

        // 멤버들의 이름/이메일 가져오기
        const membersWithEmails = await Promise.all(
          (membersData || []).map(async (member: GroupMember) => {
            const { data: userData } = await supabase
              .from("finance_user_status")
              .select("email, name")
              .eq("user_id", member.user_id)
              .maybeSingle();

            return {
              ...member,
              user_email: userData?.email || "",
              user_name: userData?.name || "",
            };
          })
        );

        return {
          ...group,
          members: membersWithEmails,
        } as GroupWithMembers;
      })
    );

    setGroups(groupsWithMembers);
    setLoading(false);
  };

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  };

  const handleEditGroup = (group: GroupWithMembers) => {
    setEditingGroup(group);
    setFormData({ name: group.name, description: group.description || "" });
    setDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!formData.name.trim()) {
      toast.error("그룹 이름을 입력해주세요.");
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }

    try {
      if (editingGroup) {
        // 그룹 수정
        const { error } = await supabase
          .from("finance_groups")
          .update({
            name: formData.name,
            description: formData.description,
          })
          .eq("id", editingGroup.id);

        if (error) throw error;
        toast.success("그룹이 수정되었습니다.");
      } else {
        // 그룹 생성
        const { data: groupData, error: groupError } = await supabase
          .from("finance_groups")
          .insert({
            name: formData.name,
            description: formData.description,
            created_by: user.id,
            group_type: "department",
            permissions: { can_write: [], can_read: [] },
          })
          .select()
          .single();

        if (groupError) throw groupError;

        // 기본 settings 생성
        await supabase
          .from("finance_settings")
          .insert({
            user_id: user.id,
            group_id: groupData.id,
            app_title: formData.name,
          });

        toast.success("그룹이 생성되었습니다.");
      }

      setDialogOpen(false);
      await fetchGroups();
    } catch (error: any) {
      toast.error("오류 발생: " + error.message);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("이 그룹을 삭제하시겠습니까? 그룹의 모든 데이터가 삭제됩니다.")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("finance_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      toast.success("그룹이 삭제되었습니다.");
      await fetchGroups();
    }
  };

  const handleOpenMemberDialog = async (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedUserIds([]);
    setSelectedRole("read");

    // 해당 그룹을 요청한 사용자들 조회
    setLoadingUsers(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("finance_user_status")
        .select("*")
        .eq("requested_group_id", groupId)
        .eq("status", "approved");

      if (error) {
        console.error("그룹 요청 사용자 조회 실패:", error);
        setRequestedGroupUsers([]);
      } else {
        setRequestedGroupUsers(data || []);
      }
    } catch (err) {
      console.error("그룹 요청 사용자 조회 중 예외 발생:", err);
      setRequestedGroupUsers([]);
    } finally {
      setLoadingUsers(false);
    }

    setMemberDialogOpen(true);
  };

  const handleAddMember = async () => {
    const userIdsToAdd = [...selectedUserIds];

    if (!selectedGroupId || userIdsToAdd.length === 0) {
      toast.error("사용자를 선택해주세요.");
      return;
    }

    const supabase = createClient();
    const group = groups.find(g => g.id === selectedGroupId);

    // 이미 멤버인 사용자 제외
    const existingMemberIds = new Set(group?.members.map(m => m.user_id) || []);
    const newUserIds = userIdsToAdd.filter(id => !existingMemberIds.has(id));

    if (newUserIds.length === 0) {
      toast.error("선택한 사용자가 이미 모두 멤버입니다.");
      return;
    }

    try {
      // 그룹 멤버 일괄 추가
      const { error: memberError } = await supabase
        .from("finance_group_members")
        .insert(newUserIds.map(userId => ({
          group_id: selectedGroupId,
          user_id: userId,
          role: "member",
        })));

      if (memberError) throw memberError;

      // 신청자의 requested_group_id 초기화
      await supabase
        .from("finance_user_status")
        .update({ requested_group_id: null })
        .in("user_id", newUserIds);

      // 권한 설정 (일괄)
      const currentPermissions = group?.permissions || { can_write: [], can_read: [] };
      const newPermissions: GroupPermissions = {
        can_write: selectedRole === "write"
          ? [...currentPermissions.can_write, ...newUserIds]
          : currentPermissions.can_write,
        can_read: selectedRole === "read"
          ? [...currentPermissions.can_read, ...newUserIds]
          : currentPermissions.can_read,
      };

      const { error: permError } = await updateGroupPermissions(selectedGroupId, newPermissions);
      if (permError) throw permError;

      toast.success(`${newUserIds.length}명이 추가되었습니다.`);
      setMemberDialogOpen(false);
      await fetchGroups();
    } catch (error: any) {
      toast.error("멤버 추가 실패: " + (error?.message || "알 수 없는 에러"));
    }
  };

  const handleRemoveMember = async (groupId: string, memberId: string, userId: string) => {
    if (!confirm("이 멤버를 제거하시겠습니까?")) return;

    const supabase = createClient();

    try {
      // 멤버 제거
      const { error } = await supabase
        .from("finance_group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // 권한에서 제거
      const group = groups.find(g => g.id === groupId);
      const currentPermissions = group?.permissions || { can_write: [], can_read: [] };
      const newPermissions: GroupPermissions = {
        can_write: currentPermissions.can_write.filter((id: string) => id !== userId),
        can_read: currentPermissions.can_read.filter((id: string) => id !== userId),
      };

      await updateGroupPermissions(groupId, newPermissions);

      toast.success("멤버가 제거되었습니다.");
      await fetchGroups();
    } catch (error: any) {
      toast.error("멤버 제거 실패: " + error.message);
    }
  };

  const handleTogglePermission = async (groupId: string, userId: string, permissionType: "write" | "read" | "none") => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const currentPermissions = group.permissions || { can_write: [], can_read: [] };

    const hasWrite = currentPermissions.can_write.includes(userId);
    const hasRead = currentPermissions.can_read.includes(userId);

    let newPermissions: GroupPermissions;

    if (permissionType === "none") {
      // 모든 권한 제거
      newPermissions = {
        can_write: currentPermissions.can_write.filter((id: string) => id !== userId),
        can_read: currentPermissions.can_read.filter((id: string) => id !== userId),
      };
    } else if (permissionType === "write") {
      if (hasWrite) {
        newPermissions = {
          can_write: currentPermissions.can_write.filter((id: string) => id !== userId),
          can_read: currentPermissions.can_read,
        };
      } else {
        newPermissions = {
          can_write: [...currentPermissions.can_write, userId],
          can_read: currentPermissions.can_read.filter((id: string) => id !== userId),
        };
      }
    } else {
      if (hasRead) {
        newPermissions = {
          can_write: currentPermissions.can_write,
          can_read: currentPermissions.can_read.filter((id: string) => id !== userId),
        };
      } else {
        newPermissions = {
          can_write: currentPermissions.can_write.filter((id: string) => id !== userId),
          can_read: [...currentPermissions.can_read, userId],
        };
      }
    }

    const { error } = await updateGroupPermissions(groupId, newPermissions);
    if (error) {
      toast.error("권한 변경 실패: " + error);
    } else {
      toast.success("권한이 변경되었습니다.");
      await fetchGroups();
    }
  };

  const getUserPermission = (group: GroupWithMembers, userId: string) => {
    const permissions = group.permissions || { can_write: [], can_read: [] };
    if (permissions.can_write.includes(userId)) return "write";
    if (permissions.can_read.includes(userId)) return "read";
    return "none";
  };

  if (loading || userStatusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>뒤로</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
              <Shield className="h-6 w-6 text-teal-600" />
              <span>재정관리자 그룹 관리</span>
            </h1>
            <p className="text-gray-500 mt-1">부서별 그룹을 생성하고 회원 권한을 관리합니다</p>
          </div>
        </div>
        {isSuperAdmin && (
          <Button onClick={handleCreateGroup} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            그룹 생성
          </Button>
        )}
      </div>

      {/* 그룹 참여 요청 */}
      {joinRequests.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-yellow-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-500 text-white text-xs font-bold rounded-full">{joinRequests.length}</span>
              그룹 참여 요청 대기 중
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {joinRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-yellow-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">{req.user_name}</p>
                  <p className="text-xs text-gray-500">{req.user_email} → <span className="text-blue-600 font-medium">{req.group_name}</span></p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                    onClick={async () => {
                      const supabase = createClient();
                      // 이미 멤버인지 확인
                      const { data: existing } = await supabase
                        .from("finance_group_members")
                        .select("id")
                        .eq("user_id", req.user_id)
                        .eq("group_id", req.group_id)
                        .maybeSingle();
                      if (!existing) {
                        const { error } = await supabase
                          .from("finance_group_members")
                          .insert({ group_id: req.group_id, user_id: req.user_id, role: "member" });
                        if (error) { toast.error("그룹 추가 실패: " + error.message); return; }
                      }
                      await supabase
                        .from("finance_group_join_requests")
                        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: currentUserId })
                        .eq("id", req.id);
                      toast.success(`${req.user_name}님이 ${req.group_name}에 추가되었습니다.`);
                      fetchJoinRequests();
                      fetchGroups();
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" /> 승인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs"
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase
                        .from("finance_group_join_requests")
                        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: currentUserId })
                        .eq("id", req.id);
                      toast.success("요청이 거절되었습니다.");
                      fetchJoinRequests();
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> 거절
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 그룹 목록 */}
      <div className="space-y-6">
        {groups.map((group) => (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">{group.description || "설명 없음"}</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditGroup(group)}
                >
                  수정
                </Button>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    삭제
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* 멤버 추가 버튼 */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700 flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  그룹 멤버 ({group.members.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenMemberDialog(group.id)}
                  className="text-teal-600 border-teal-600 hover:bg-teal-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  멤버 추가
                </Button>
              </div>

              {/* 멤버 목록 */}
              {group.members.length === 0 ? (
                <p className="text-gray-500 text-center py-8">등록된 멤버가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {group.members.map((member) => {
                    const isSelf = member.user_id === currentUserId;
                    return (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium">
                          {member.user_name || member.user_email}
                          {isSelf && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">나</span>}
                        </p>
                        <p className="text-sm text-gray-400">{member.user_email}</p>
                        <p className="text-xs text-gray-500">
                          역할: {member.role === 'owner' ? '소유자' : member.role === 'admin' ? '관리자' : '멤버'}
                        </p>
                      </div>
                      {!isSelf && (
                        <div className="flex items-center space-x-4">
                          {/* 권한 토글 버튼 */}
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">권한:</span>
                            <button
                              onClick={() => handleTogglePermission(group.id, member.user_id, "write")}
                              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                getUserPermission(group, member.user_id) === "write"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                            >
                              쓰기
                            </button>
                            <button
                              onClick={() => handleTogglePermission(group.id, member.user_id, "read")}
                              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                getUserPermission(group, member.user_id) === "read"
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                            >
                              읽기
                            </button>
                            <button
                              onClick={() => handleTogglePermission(group.id, member.user_id, "none")}
                              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                getUserPermission(group, member.user_id) === "none"
                                  ? "bg-gray-400 text-white"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                              title="권한 없음"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {/* 제거 버튼 */}
                          {member.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(group.id, member.id, member.user_id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              제거
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 그룹 생성/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "그룹 수정" : "그룹 생성"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "그룹 이름과 설명을 수정합니다." : "새 부서 그룹을 생성합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">그룹 이름 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 재정부, 교육부"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="그룹에 대한 설명"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveGroup} className="bg-teal-600 hover:bg-teal-700">
              {editingGroup ? "수정" : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 멤버 추가 다이얼로그 */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>멤버 추가</DialogTitle>
            <DialogDescription>
              그룹 신청자를 선택하거나 사용자를 직접 검색하여 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">

            {/* 그룹 신청자 목록 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">
                그룹 신청자
                {!loadingUsers && requestedGroupUsers.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-teal-600">
                    ({requestedGroupUsers.filter(u => !groups.find(g => g.id === selectedGroupId)?.members.find(m => m.user_id === u.user_id)).length}명)
                  </span>
                )}
              </Label>
              {loadingUsers ? (
                <p className="text-sm text-gray-400 py-2">불러오는 중...</p>
              ) : (() => {
                const currentGroup = groups.find(g => g.id === selectedGroupId);
                const existingIds = new Set(currentGroup?.members.map(m => m.user_id) || []);
                const pendingUsers = requestedGroupUsers.filter(u => !existingIds.has(u.user_id));

                return pendingUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2 text-center border rounded-lg bg-gray-50">
                    이 그룹을 신청한 사용자가 없습니다.
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {pendingUsers.map((user) => {
                      const isChecked = selectedUserIds.includes(user.user_id);
                      return (
                        <label
                          key={user.user_id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${isChecked ? "bg-teal-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setSelectedUserIds(prev =>
                                e.target.checked
                                  ? [...prev, user.user_id]
                                  : prev.filter(id => id !== user.user_id)
                              );
                            }}
                            className="w-4 h-4 rounded accent-teal-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {user.name || user.email}
                            </p>
                            {user.name && (
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            )}
                          </div>
                          {isChecked && <Check className="h-4 w-4 text-teal-600 shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* 권한 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">기본 권한 *</Label>
              <Select value={selectedRole} onValueChange={(value: "write" | "read") => setSelectedRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">읽기 권한 (조회만)</SelectItem>
                  <SelectItem value="write">쓰기 권한 (데이터 추가/수정)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 선택 요약 */}
            {selectedUserIds.length > 0 && (
              <p className="text-xs text-teal-700 bg-teal-50 rounded px-3 py-2">
                {selectedUserIds.length}명 선택됨 —{" "}
                <span className="font-medium">{selectedRole === "read" ? "읽기" : "쓰기"}</span> 권한으로 추가됩니다.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleAddMember}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={loadingUsers || selectedUserIds.length === 0}
            >
              추가 {selectedUserIds.length > 0 && `(${selectedUserIds.length}명)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
