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
import { Plus, Users, Shield, ArrowLeft, Check, X, Crown } from "lucide-react";
import type { Group, GroupMember, UserStatus, GroupPermissions } from "@/types/database";
import { transferFinanceAdminRole } from "@/lib/supabase/groups";

interface GroupWithMembers extends Group {
  members: (GroupMember & { user_email: string; user_name: string })[];
}

export default function FinanceAdminGroupsPage() {
  const router = useRouter();
  const { isSuperAdmin, allUsers, loading: userStatusLoading } = useUserStatus();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupWithMembers | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", finance_admin_id: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<"write" | "read">("read");
  const [requestedGroupUsers, setRequestedGroupUsers] = useState<UserStatus[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 그룹 참여 요청 관련
  interface JoinRequest { id: string; user_id: string; group_id: string; status: string; requested_at: string; user_name: string; user_email: string; group_name: string; }
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // 권한 넘기기 관련 상태
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedGroupForTransfer, setSelectedGroupForTransfer] = useState<GroupWithMembers | null>(null);
  const [selectedMemberIdForTransfer, setSelectedMemberIdForTransfer] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferConfirmChecked, setTransferConfirmChecked] = useState(false);

  // 승인된 사용자만 필터링
  const approvedUsers = allUsers.filter(u => u.status === "approved" && !u.is_super_admin);

  useEffect(() => {
    // 사용자 상태 로딩 중이면 대기
    if (userStatusLoading) {
      return;
    }
    // 최고관리자가 아니면 리다이렉트
    if (!isSuperAdmin) {
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

    // 본인이 생성한 그룹
    const { data: ownedGroups, error: groupsError } = await supabase
      .from("finance_groups")
      .select("*")
      .eq("created_by", uid);

    if (groupsError) {
      toast.error("그룹 목록을 가져오지 못했습니다.");
      setLoading(false);
      return;
    }

    // 멤버로 속한 그룹 (자신이 생성하지 않은 그룹)
    let memberGroups: any[] = [];
    const { data: memberData } = await supabase
      .from("finance_group_members")
      .select("group_id")
      .eq("user_id", uid);

    if (memberData && memberData.length > 0) {
      const ownedIds = new Set((ownedGroups || []).map((g: any) => g.id));
      const memberGroupIds = memberData.map((m: any) => m.group_id).filter((id: string) => !ownedIds.has(id));
      if (memberGroupIds.length > 0) {
        const { data: memberGroupsData } = await supabase
          .from("finance_groups")
          .select("*")
          .in("id", memberGroupIds);
        memberGroups = memberGroupsData || [];
      }
    }

    // 합치기 및 정렬
    const allGroupsMap = new Map();
    (ownedGroups || []).forEach((g: any) => allGroupsMap.set(g.id, g));
    memberGroups.forEach((g: any) => allGroupsMap.set(g.id, g));
    const groupsData = Array.from(allGroupsMap.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

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
    setFormData({ name: "", description: "", finance_admin_id: "" });
    setDialogOpen(true);
  };

  const handleEditGroup = (group: GroupWithMembers) => {
    setEditingGroup(group);
    // 현재 재정관리자 찾기
    const currentFinanceAdmin = group.members.find(m => m.role === 'finance_admin');
    setFormData({
      name: group.name,
      description: group.description || "",
      finance_admin_id: currentFinanceAdmin?.user_id || ""
    });
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

        // 재정관리자 변경
        const currentFinanceAdmin = editingGroup.members.find(m => m.role === 'finance_admin');

        if (formData.finance_admin_id && formData.finance_admin_id !== currentFinanceAdmin?.user_id) {
          // 이전 재정관리자를 member로 변경
          if (currentFinanceAdmin) {
            await supabase
              .from("finance_group_members")
              .update({ role: "member" })
              .eq("id", currentFinanceAdmin.id);
          }

          // 새로운 재정관리자 설정
          const newFinanceAdminMember = editingGroup.members.find(m => m.user_id === formData.finance_admin_id);
          if (newFinanceAdminMember) {
            await supabase
              .from("finance_group_members")
              .update({ role: "finance_admin" })
              .eq("id", newFinanceAdminMember.id);

            // 쓰기 권한 자동 부여
            const groupPerms = editingGroup.permissions || { can_write: [], can_read: [] };
            if (!groupPerms.can_write.includes(formData.finance_admin_id)) {
              const newPermissions = {
                can_write: [...groupPerms.can_write, formData.finance_admin_id],
                can_read: groupPerms.can_read.filter((id: string) => id !== formData.finance_admin_id)
              };
              await updateGroupPermissions(editingGroup.id, newPermissions);
            }
          }
        }

        toast.success("그룹이 수정되었습니다.");
      } else {
        // 그룹 생성
        if (!formData.finance_admin_id) {
          toast.error("재정관리자를 지정해주세요.");
          return;
        }

        const { data: groupData, error: groupError } = await supabase
          .from("finance_groups")
          .insert({
            name: formData.name,
            description: formData.description,
            created_by: user.id,
            group_type: "department",
            permissions: { can_write: [formData.finance_admin_id], can_read: [] },
          })
          .select()
          .single();

        if (groupError) throw groupError;

        // 재정관리자 멤버로 추가
        const { error: memberError } = await supabase
          .from("finance_group_members")
          .insert({
            group_id: groupData.id,
            user_id: formData.finance_admin_id,
            role: "finance_admin"
          });

        if (memberError) throw memberError;

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

  // 권한 넘기기 다이얼로그 열기
  const handleOpenTransferDialog = (group: GroupWithMembers) => {
    setSelectedGroupForTransfer(group);
    setSelectedMemberIdForTransfer(null);
    setTransferConfirmChecked(false);
    setTransferDialogOpen(true);
  };

  // 권한 넘기기 실행
  const handleTransferRole = async () => {
    if (!selectedGroupForTransfer || !selectedMemberIdForTransfer || !currentUserId) return;

    setIsTransferring(true);

    try {
      const result = await transferFinanceAdminRole(
        selectedGroupForTransfer.id,
        currentUserId,
        selectedMemberIdForTransfer
      );

      if (result.error) {
        toast.error("권한 넘기기 실패: " + result.error);
        setIsTransferring(false);
        return;
      }

      toast.success("권한이 넘어갔습니다. 로그아웃됩니다.");

      // 1초 후 로그아웃
      setTimeout(async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem("selectedGroupId");
        router.push("/");
        router.refresh();
      }, 1000);
    } catch (error: any) {
      toast.error("권한 넘기기 실패: " + error.message);
      setIsTransferring(false);
    }
  };

  if (loading || userStatusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">뒤로</span>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center space-x-2">
              <Shield className="h-6 w-6 text-teal-600" />
              <span>재정관리자 그룹 관리</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">부서별 그룹을 생성하고 회원 권한을 관리합니다</p>
          </div>
        </div>
        <Button onClick={handleCreateGroup} className="bg-teal-600 hover:bg-teal-700 text-sm h-10 px-4">
          <Plus className="h-4 w-4 mr-2" />
          그룹 생성
        </Button>
      </div>

      {/* 그룹 참여 요청 */}
      {joinRequests.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-base sm:text-lg text-yellow-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-500 text-white text-sm font-bold rounded-full">{joinRequests.length}</span>
              그룹 참여 요청 대기 중
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
            {joinRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-white rounded-lg px-4 sm:px-5 py-3 sm:py-4 border border-yellow-200">
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-base font-medium text-gray-800 truncate">{req.user_name}</p>
                  <p className="text-sm text-gray-500 truncate">{req.user_email} → <span className="text-blue-600 font-medium">{req.group_name}</span></p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 h-10 px-5 text-sm font-medium"
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
                    <Check className="h-4 w-4 mr-1" /> 승인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 h-10 px-5 text-sm font-medium"
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
                    <X className="h-4 w-4 mr-1" /> 거절
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 그룹 목록 */}
      <div className="space-y-4 sm:space-y-6">
        {groups.map((group) => (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between py-3 sm:py-4 px-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg sm:text-xl truncate pr-3">{group.name}</CardTitle>
                <p className="text-sm text-gray-500 mt-1 truncate">{group.description || "설명 없음"}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditGroup(group)}
                  className="text-sm h-10 px-5 font-medium"
                >
                  수정
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteGroup(group.id)}
                  className="text-red-600 border-red-600 hover:bg-red-50 text-sm h-10 px-5 font-medium"
                >
                  삭제
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* 멤버 추가 버튼 */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  그룹 멤버 ({group.members.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenMemberDialog(group.id)}
                  className="text-teal-600 border-teal-600 hover:bg-teal-50 text-sm h-10 px-5 font-medium"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  멤버 추가
                </Button>
              </div>

              {/* 멤버 목록 */}
              {group.members.length === 0 ? (
                <p className="text-gray-500 text-center py-8 sm:py-10 text-sm">등록된 멤버가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {group.members.map((member) => {
                    const isSelf = member.user_id === currentUserId;
                    return (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.user_name || member.user_email}
                          {isSelf && <span className="ml-2 text-sm bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">나</span>}
                          {member.role === 'finance_admin' && <span className="ml-1 text-sm bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">재정관리자</span>}
                        </p>
                        <p className="text-sm text-gray-400 truncate">{member.user_email}</p>
                        <p className="text-sm text-gray-500">
                          역할: {member.role === 'finance_admin' ? '그룹 재정관리자' : '멤버'}
                        </p>
                      </div>
                      {isSelf ? (
                        // 자기 자신인 경우: 재정관리자이면 권한 넘기기 버튼 표시
                        member.role === 'finance_admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenTransferDialog(group)}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-sm h-10 px-4 flex items-center gap-1"
                            title="재정관리 권한 넘기기"
                          >
                            <Crown className="h-4 w-4" />
                            <span className="hidden xs:inline">권한 넘기기</span>
                          </Button>
                        )
                      ) : (
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* 권한 토글 버튼 */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 hidden sm:inline">권한:</span>
                            <button
                              onClick={() => handleTogglePermission(group.id, member.user_id, "write")}
                              className={`px-3 py-2 rounded text-sm font-medium transition-colors min-h-[44px] ${
                                getUserPermission(group, member.user_id) === "write"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                            >
                              쓰기
                            </button>
                            <button
                              onClick={() => handleTogglePermission(group.id, member.user_id, "read")}
                              className={`px-3 py-2 rounded text-sm font-medium transition-colors min-h-[44px] ${
                                getUserPermission(group, member.user_id) === "read"
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                            >
                              읽기
                            </button>
                            <button
                              onClick={() => handleTogglePermission(group.id, member.user_id, "none")}
                              className={`px-3 py-2 rounded text-sm font-medium transition-colors min-h-[44px] ${
                                getUserPermission(group, member.user_id) === "none"
                                  ? "bg-gray-400 text-white"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                              title="권한 없음"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {/* 제거 버튼 - 재정관리자는 제거 불가 */}
                          {member.role !== "finance_admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(group.id, member.id, member.user_id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-sm h-10 px-4"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editingGroup ? "그룹 수정" : "그룹 생성"}</DialogTitle>
            <DialogDescription className="text-sm">
              {editingGroup ? "그룹 정보를 수정합니다." : "새 부서 그룹을 생성하고 재정관리자를 지정합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">그룹 이름 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 재정부, 교육부"
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">설명</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="그룹에 대한 설명"
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finance_admin" className="text-sm font-medium">그룹 내 재정관리자 *</Label>
              <Select
                value={formData.finance_admin_id}
                onValueChange={(value) => setFormData({ ...formData, finance_admin_id: value })}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="재정관리자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {approvedUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id} className="text-sm">
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                재정관리자는 쓰기 권한을 갖고, 다른 멤버의 권한을 설정할 수 있습니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-sm h-10 px-5 font-medium">
              취소
            </Button>
            <Button onClick={handleSaveGroup} className="bg-teal-600 hover:bg-teal-700 text-sm h-10 px-5 font-medium">
              {editingGroup ? "수정" : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 멤버 추가 다이얼로그 */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">멤버 추가</DialogTitle>
            <DialogDescription className="text-sm">
              그룹 신청자를 선택하거나 사용자를 직접 검색하여 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">

            {/* 그룹 신청자 목록 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">
                그룹 신청자
                {!loadingUsers && requestedGroupUsers.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-teal-600">
                    ({requestedGroupUsers.filter(u => !groups.find(g => g.id === selectedGroupId)?.members.find(m => m.user_id === u.user_id)).length}명)
                  </span>
                )}
              </Label>
              {loadingUsers ? (
                <p className="text-sm text-gray-400 py-3">불러오는 중...</p>
              ) : (() => {
                const currentGroup = groups.find(g => g.id === selectedGroupId);
                const existingIds = new Set(currentGroup?.members.map(m => m.user_id) || []);
                const pendingUsers = requestedGroupUsers.filter(u => !existingIds.has(u.user_id));

                return pendingUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center border rounded-lg bg-gray-50">
                    이 그룹을 신청한 사용자가 없습니다.
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {pendingUsers.map((user) => {
                      const isChecked = selectedUserIds.includes(user.user_id);
                      return (
                        <label
                          key={user.user_id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors min-h-[52px] ${isChecked ? "bg-teal-50" : ""}`}
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
                            className="w-5 h-5 rounded accent-teal-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {user.name || user.email}
                            </p>
                            {user.name && (
                              <p className="text-sm text-gray-500 truncate">{user.email}</p>
                            )}
                          </div>
                          {isChecked && <Check className="h-5 w-5 text-teal-600 shrink-0" />}
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
                <SelectTrigger className="h-10 text-sm">
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
              <p className="text-sm text-teal-700 bg-teal-50 rounded px-4 py-3">
                {selectedUserIds.length}명 선택됨 —{" "}
                <span className="font-medium">{selectedRole === "read" ? "읽기" : "쓰기"}</span> 권한으로 추가됩니다.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)} className="text-sm h-10 px-5 font-medium">
              취소
            </Button>
            <Button
              onClick={handleAddMember}
              className="bg-teal-600 hover:bg-teal-700 text-sm h-10 px-5 font-medium"
              disabled={loadingUsers || selectedUserIds.length === 0}
            >
              추가 {selectedUserIds.length > 0 && `(${selectedUserIds.length}명)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 권한 넘기기 확인 다이얼로그 */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Crown className="h-6 w-6 text-purple-600" />
              재정관리 권한 넘기기
            </DialogTitle>
            <DialogDescription className="text-sm">
              재정관리 권한을 다른 회원에게 넘기겠습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 경고 메시지 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-red-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-base font-semibold text-red-800">중요 경고</p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1 mt-2">
                    <li>권한을 넘기면 현재 재정관리자는 <strong>일반 회원</strong>으로 변경됩니다</li>
                    <li>권한 변경 후 <strong>자동으로 로그아웃</strong>됩니다</li>
                    <li>다시 로그인하여 계속 사용할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 권한을 넘길 회원 선택 */}
            {selectedGroupForTransfer && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  권한을 넘길 회원 선택 *
                </Label>
                <Select value={selectedMemberIdForTransfer || ""} onValueChange={setSelectedMemberIdForTransfer}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="회원을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedGroupForTransfer.members
                      .filter(m => m.user_id !== currentUserId) // 자신은 제외
                      .map((member) => (
                        <SelectItem key={member.id} value={member.user_id} className="text-sm">
                          {member.user_name || member.user_email}
                          {member.role === 'finance_admin' && ' (재정관리자)'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 선택된 회원 정보 미리보기 */}
            {selectedGroupForTransfer && selectedMemberIdForTransfer && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  권한을 넘길 회원:
                </p>
                {(() => {
                  const selectedMember = selectedGroupForTransfer.members.find(m => m.user_id === selectedMemberIdForTransfer);
                  if (!selectedMember) return null;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-base">
                        {selectedMember.user_name?.charAt(0) || selectedMember.user_email?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-800">
                          {selectedMember.user_name || selectedMember.user_email}
                        </p>
                        <p className="text-sm text-gray-500">{selectedMember.user_email}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 확인 체크박스 */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="transfer-confirm"
                checked={transferConfirmChecked}
                onChange={(e) => setTransferConfirmChecked(e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-red-600"
              />
              <label htmlFor="transfer-confirm" className="text-sm text-gray-700 cursor-pointer">
                위 내용을 이해했으며, 재정관리 권한을 넘기겠습니다.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              disabled={isTransferring}
              className="text-sm h-10 px-5 font-medium"
            >
              취소
            </Button>
            <Button
              onClick={handleTransferRole}
              disabled={!selectedMemberIdForTransfer || !transferConfirmChecked || isTransferring}
              className="bg-red-600 hover:bg-red-700 text-sm h-10 px-5 font-medium"
            >
              {isTransferring ? "처리 중..." : "권한 넘기기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
