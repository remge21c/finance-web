"use client";

import { useEffect, useState } from "react";
import { useUserStatus } from "@/lib/hooks/useUserStatus";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GroupSearchInput from "@/components/GroupSearchInput";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import type { UserStatus, GroupMember, PermissionLevel } from "@/types/database";
import { setMemberPermissionLevel } from "@/lib/supabase/groupPermissions";
import { transferFinanceAdminRole } from "@/lib/supabase/groups";
import { useRouter } from "next/navigation";
import { Users, Clock, Shield } from "lucide-react";

interface PendingRequest {
  id: string;
  group_id: string;
  group_name: string;
}

export default function AdminUsersPage() {
  const { userStatus, allUsers, loading, isSuperAdmin, fetchAllUsers, approveUser, rejectUser } = useUserStatus();
  const { groups } = useGroupContext();
  const router = useRouter();
  const [allUsersLoading, setAllUsersLoading] = useState(true);
  const [userGroupMap, setUserGroupMap] = useState<Record<string, string[]>>({});
  const [groupNameMap, setGroupNameMap] = useState<Record<string, string>>({});
  // 사용자별 대기 중인 그룹 참여 요청
  const [joinRequestMap, setJoinRequestMap] = useState<Record<string, PendingRequest[]>>({});

  // 상세 다이얼로그
  const [selectedUser, setSelectedUser] = useState<UserStatus | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 승인 관련
  const [approveGroupId, setApproveGroupId] = useState("");

  // 거절 관련
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 그룹 추가 관련 (승인된 사용자)
  const [addGroupMode, setAddGroupMode] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");

  // 삭제 확인 다이얼로그
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 사용자별 그룹 permission_level
  const [userPermissionLevels, setUserPermissionLevels] = useState<Record<string, Record<string, PermissionLevel>>>({});

  const fetchUserGroupMap = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("finance_group_members")
      .select("user_id, group_id, permission_level, finance_groups(id, name)");
    if (data) {
      const memberMap: Record<string, string[]> = {};
      const nameMap: Record<string, string> = {};
      const levelMap: Record<string, Record<string, PermissionLevel>> = {};

      for (const item of data as any[]) {
        if (!memberMap[item.user_id]) {
          memberMap[item.user_id] = [];
          levelMap[item.user_id] = {};
        }
        memberMap[item.user_id].push(item.group_id);
        levelMap[item.user_id][item.group_id] = item.permission_level ?? 'general';

        if (item.finance_groups) {
          nameMap[item.group_id] = item.finance_groups.name;
        }
      }
      setUserGroupMap(memberMap);
      setUserPermissionLevels(levelMap);
      setGroupNameMap(prev => ({ ...prev, ...nameMap }));
    }
  };

  const fetchJoinRequestMap = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("finance_group_join_requests")
      .select("id, user_id, group_id, status, finance_groups(id, name)")
      .eq("status", "pending");
    if (data) {
      const map: Record<string, PendingRequest[]> = {};
      const nameMap: Record<string, string> = {};
      for (const item of data as any[]) {
        if (!map[item.user_id]) map[item.user_id] = [];
        const groupName = item.finance_groups?.name || item.group_id;
        map[item.user_id].push({
          id: item.id,
          group_id: item.group_id,
          group_name: groupName,
        });
        if (item.finance_groups) {
          nameMap[item.group_id] = groupName;
        }
      }
      setJoinRequestMap(map);
      setGroupNameMap(prev => ({ ...prev, ...nameMap }));
    }
  };

  const fetchRequestedGroupNames = async (users: UserStatus[]) => {
    const ids = [...new Set(users.map(u => u.requested_group_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("finance_groups")
      .select("id, name")
      .in("id", ids);
    if (data) {
      const nameMap: Record<string, string> = {};
      for (const g of data as any[]) nameMap[g.id] = g.name;
      setGroupNameMap(prev => ({ ...prev, ...nameMap }));
    }
  };

  /**
   * 사용자의 그룹 permission_level 업데이트
   */
  const handleSetPermissionLevel = async (userId: string, groupId: string, level: PermissionLevel) => {
    // 관리자 권한 넘기기 확인
    if (level === 'admin' && !isSuperAdmin) {
      if (userId === userStatus?.user_id) return; // 자신은 이미 어드민

      const confirmed = window.confirm(
        "해당 사용자에게 관리자 권한을 넘기시겠습니까?\n확인을 누르면 즉시 관리자 권한이 이양되며 로그아웃됩니다."
      );
      
      if (confirmed) {
        const result = await transferFinanceAdminRole(groupId, userStatus!.user_id, userId);
        if (result.error) {
          toast.error("권한 이양 실패: " + result.error);
          return;
        }
        toast.success("관리 권한이 성공적으로 이양되었습니다. 로그아웃합니다.");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
        return;
      } else {
        return;
      }
    }

    const result = await setMemberPermissionLevel(groupId, userId, level);
    if (result.error) {
      toast.error("권한 업데이트 실패: " + result.error);
      return;
    }
    
    // 사용자가 'pending' 상태라면 자동으로 'approved' 처리
    if (selectedUser?.status === "pending") {
      await approveUser(userId);
    }

    toast.success("권한이 업데이트되었습니다.");
    await fetchAllUsers(); // 전체 사용자 상태 갱신
    setUserPermissionLevels(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), [groupId]: level },
    }));
  };

  useEffect(() => {
    setAllUsersLoading(true);
    Promise.all([fetchAllUsers(), fetchUserGroupMap(), fetchJoinRequestMap()]).finally(() => setAllUsersLoading(false));
  }, [fetchAllUsers]);

  // allUsers가 로드된 후 requested_group_id 이름도 보강
  useEffect(() => {
    if (allUsers.length > 0) fetchRequestedGroupNames(allUsers);
  }, [allUsers]);

  const refreshAll = async () => {
    await Promise.all([fetchAllUsers(), fetchUserGroupMap(), fetchJoinRequestMap()]);
  };

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "-";
    // DB에서 직접 가져온 이름 우선, 없으면 context groups에서 탐색
    if (groupNameMap[groupId]) return groupNameMap[groupId];
    const group = groups.find(g => g.id === groupId);
    return group?.name || groupId;
  };

  const getGroupNames = (userId: string) => {
    const ids = userGroupMap[userId] || [];
    if (ids.length === 0) return "-";
    return ids.map(gid => getGroupName(gid)).join(", ");
  };


  // 그룹 참여 요청 인라인 승인
  const handleApproveJoinRequest = async (e: React.MouseEvent, req: PendingRequest, userId: string) => {
    e.stopPropagation(); // 행 클릭(상세 다이얼로그) 방지
    
    if (!isSuperAdmin && !adminGroupIds.includes(req.group_id)) {
      toast.error("해당 그룹에 대한 승인 권한이 없습니다.");
      return;
    }

    const supabase = createClient();

    // 이미 멤버인지 확인
    const { data: existing } = await supabase
      .from("finance_group_members")
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", req.group_id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase
        .from("finance_group_members")
        .insert({ group_id: req.group_id, user_id: userId, permission_level: "general" });
      if (error) {
        toast.error("그룹 추가 실패: " + error.message);
        return;
      }
    }

    await supabase
      .from("finance_group_join_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", req.id);

    // 사용자의 전체 상태가 'pending'인 경우 'approved'로 자동 승인 처리
    await supabase
      .from("finance_user_status")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("status", "pending");

    toast.success(`${req.group_name} 참여가 승인되었습니다.`);
    await Promise.all([fetchAllUsers(), fetchUserGroupMap(), fetchJoinRequestMap()]);
  };

  // 그룹 참여 요청 거절
  const handleRejectJoinRequest = async (e: React.MouseEvent, reqId: string, groupName: string) => {
    e.stopPropagation();
    const supabase = createClient();
    await supabase
      .from("finance_group_join_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", reqId);
    toast.success(`${groupName} 참여 요청이 거절되었습니다.`);
    await fetchJoinRequestMap();
  };

  // 사용자 클릭 → 상세 다이얼로그 열기
  const handleUserClick = async (user: UserStatus) => {
    setSelectedUser(user);
    
    // 기본 승인 그룹 설정
    if (user.requested_group_id) {
      setApproveGroupId(user.requested_group_id);
    } else if (!isSuperAdmin && adminGroupIds.length === 1) {
      // 그룹관리자인데 관리하는 그룹이 딱 하나라면 자동 선택
      setApproveGroupId(adminGroupIds[0]);
    } else {
      setApproveGroupId("");
    }

    setRejectMode(false);
    setRejectReason("");
    setAddGroupMode(false);
    setNewGroupId("");

    setDetailOpen(true);
  };

  // 신규 가입 승인 처리
  const handleApproveConfirm = async () => {
    if (!selectedUser) return;

    if (!isSuperAdmin) {
      toast.error("전체 승인 권한은 최고관리자만 가능합니다.");
      return;
    }
    const result = await approveUser(selectedUser.user_id);
    if (result.error) {
      toast.error("승인 실패: " + result.error);
      return;
    }
    if (approveGroupId) {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("finance_group_members")
        .select("*")
        .eq("user_id", selectedUser.user_id)
        .eq("group_id", approveGroupId)
        .maybeSingle();
      if (!existing) {
        const { error: memberError } = await supabase
          .from("finance_group_members")
          .insert({
            group_id: approveGroupId,
            user_id: selectedUser.user_id,
            permission_level: "general",
          });
        if (memberError) {
          toast.warning("승인되었으나 그룹 추가 실패: " + memberError.message);
        } else {
          toast.success("사용자가 승인되고 그룹에 추가되었습니다.");
        }
      } else {
        toast.success("사용자가 승인되었습니다.");
      }
    } else {
      toast.success("사용자가 승인되었습니다.");
    }
    await refreshAll();
    setDetailOpen(false);
  };

  const handleRejectConfirm = async () => {
    if (!selectedUser) return;
    const result = await rejectUser(selectedUser.user_id, rejectReason);
    if (result.error) { toast.error("거절 실패: " + result.error); return; }
    toast.success("사용자가 거절되었습니다.");
    await refreshAll();
    setDetailOpen(false);
  };

  const handleAddGroup = async () => {
    if (!selectedUser || !newGroupId) return;
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("finance_group_members")
      .select("*")
      .eq("user_id", selectedUser.user_id)
      .eq("group_id", newGroupId)
      .maybeSingle();
    if (existing) { toast.warning("이미 해당 그룹의 멤버입니다."); return; }
    const { error } = await supabase
      .from("finance_group_members")
      .insert({ group_id: newGroupId, user_id: selectedUser.user_id, permission_level: "general" });
    if (error) {
      toast.error("그룹 추가 실패: " + error.message);
    } else {
      // 사용자가 'pending' 상태라면 자동으로 'approved' 처리
      if (selectedUser.status === "pending") {
        await approveUser(selectedUser.user_id);
      }
      toast.success("그룹에 추가되었습니다.");
      await Promise.all([fetchAllUsers(), fetchUserGroupMap()]);
      setAddGroupMode(false);
      setNewGroupId("");
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    if (!selectedUser) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("finance_group_members")
      .delete()
      .eq("user_id", selectedUser.user_id)
      .eq("group_id", groupId);
    if (error) {
      toast.error("그룹 제거 실패: " + error.message);
    } else {
      toast.success("그룹에서 제거되었습니다.");
      await fetchUserGroupMap();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.user_id }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error("삭제 실패: " + result.error);
      } else {
        toast.success(`${selectedUser.email} 계정이 삭제되었습니다.`);
        setDeleteDialogOpen(false);
        setDetailOpen(false);
        setAllUsersLoading(true);
        await refreshAll();
        setAllUsersLoading(false);
      }
    } catch {
      toast.error("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="badge badge-pending">대기</span>;
      case "approved": return <span className="badge badge-approved">승인</span>;
      case "rejected": return <span className="badge badge-rejected">거절</span>;
      default: return null;
    }
  };

  // 현재 사용자가 관리자인 그룹 ID 목록
  const adminGroupIds = Object.keys(userPermissionLevels[userStatus?.user_id || ''] || {})
    .filter(gid => userPermissionLevels[userStatus?.user_id || '']?.[gid] === 'admin');

  // isGroupAdmin 폴백 적용: 기존 finance_user_status 의 관리자 권한도 허용
  const isFinanceAdmin = (userStatus as any)?.is_finance_admin || false;
  const isGroupAdmin = adminGroupIds.length > 0 || isFinanceAdmin;

  if (loading || allUsersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!isSuperAdmin && !isGroupAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">접근 권한이 없습니다. 관리자만 이용 가능합니다.</div>
      </div>
    );
  }

  // 필터링 적용
  const filteredUsers = isSuperAdmin 
    ? allUsers 
    : allUsers.filter(u => {
        // 최고관리자는 그룹관리자 목록에서 제외
        if (u.is_super_admin) return false;

        // 이미 소속 멤버인 경우
        const userGroups = userGroupMap[u.user_id] || [];
        if (userGroups.some(gid => adminGroupIds.includes(gid))) return true;
        
        // 가입 신청한 그룹이 나의 관리 그룹인 경우
        if (u.requested_group_id && adminGroupIds.includes(u.requested_group_id)) return true;
        
        // 추가 참여 요청이 나의 관리 그룹인 경우
        const reqs = joinRequestMap[u.user_id] || [];
        if (reqs.some(r => adminGroupIds.includes(r.group_id))) return true;
        
        return false;
      });

  const filteredJoinRequestMap: Record<string, PendingRequest[]> = {};
  if (isSuperAdmin) {
    Object.assign(filteredJoinRequestMap, joinRequestMap);
  } else {
    Object.keys(joinRequestMap).forEach(uid => {
      const myReqs = joinRequestMap[uid].filter(r => adminGroupIds.includes(r.group_id));
      if (myReqs.length > 0) {
        filteredJoinRequestMap[uid] = myReqs;
      }
    });
  }

  const approvedCount = filteredUsers.filter(u => u.status === "approved").length;
  const groupRequestCount = Object.values(filteredJoinRequestMap).reduce((acc, reqs) => acc + reqs.length, 0);

  // 최고관리자용 그룹별 섹션 데이터
  const pendingUsers = filteredUsers.filter(u => !u.is_super_admin && u.status === "pending");
  const superAdmins = filteredUsers.filter(u => u.is_super_admin);

  const allGroupIdsInUse = new Set<string>();
  filteredUsers.forEach(u => (userGroupMap[u.user_id] || []).forEach(gid => allGroupIdsInUse.add(gid)));
  Object.values(filteredJoinRequestMap).forEach(reqs => reqs.forEach(r => allGroupIdsInUse.add(r.group_id)));

  type GroupPendingReq = PendingRequest & { userId: string };
  const groupSections = [...allGroupIdsInUse].map(gid => {
    const members = filteredUsers.filter(
      u => !u.is_super_admin && u.status === "approved" && (userGroupMap[u.user_id] || []).includes(gid)
    );
    const pendingReqs: GroupPendingReq[] = [];
    Object.entries(filteredJoinRequestMap).forEach(([uid, reqs]) =>
      reqs.filter(r => r.group_id === gid).forEach(r => pendingReqs.push({ ...r, userId: uid }))
    );
    return { id: gid, name: getGroupName(gid), members, pendingRequests: pendingReqs };
  }).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const noGroupApprovedUsers = filteredUsers.filter(
    u => !u.is_super_admin && u.status === "approved" && (userGroupMap[u.user_id] || []).length === 0
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          {isSuperAdmin ? "전체 사용자 관리" : "소속 그룹원 및 승인 관리"}
        </h1>
        <p className="text-gray-500 text-sm sm:text-base">사용자를 클릭하면 상세 설정을 변경할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className={`grid gap-4 ${isSuperAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-800">{filteredUsers.length}</p>
              <p className="text-base text-gray-500">관리 대상</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
              <p className="text-base text-gray-500">승인됨</p>
            </div>
          </CardContent>
        </Card>
        {isSuperAdmin && (
          <Card className={groupRequestCount > 0 ? "border-orange-300 bg-orange-50" : ""}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-3xl font-bold ${groupRequestCount > 0 ? "text-orange-600" : "text-gray-400"}`}>{groupRequestCount}</p>
                <p className="text-base text-gray-500">그룹 요청</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 사용자 목록 */}
      {isSuperAdmin ? (
        /* 최고관리자: 그룹별 섹션 */
        <div className="space-y-4">
          {/* 승인 대기 */}
          {pendingUsers.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  승인 대기
                  <span className="text-sm font-normal text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{pendingUsers.length}명</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-orange-50/60">
                      <TableHead className="text-xs py-2 w-[22%]">이름</TableHead>
                      <TableHead className="text-xs py-2 w-[43%]">이메일</TableHead>
                      <TableHead className="text-xs py-2 w-[15%]">요청 그룹</TableHead>
                      <TableHead className="text-xs py-2 w-[20%]">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map(user => (
                      <TableRow key={user.id} className="cursor-pointer hover:bg-orange-50 transition-colors" onClick={() => handleUserClick(user)}>
                        <TableCell className="font-medium text-sm py-2.5">{user.name || user.email}</TableCell>
                        <TableCell className="text-gray-500 text-sm py-2.5">{user.email}</TableCell>
                        <TableCell className="text-sm py-2.5">{getGroupName(user.requested_group_id)}</TableCell>
                        <TableCell className="text-gray-400 text-xs py-2.5">{format(new Date(user.created_at), "yyyy-MM-dd", { locale: ko })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* 그룹별 섹션 */}
          {groupSections.map(group => (
            <Card key={group.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  {group.name}
                  <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{group.members.length}명</span>
                  {group.pendingRequests.length > 0 && (
                    <span className="text-sm font-normal text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">요청 {group.pendingRequests.length}건</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {group.members.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs py-2 w-[22%]">이름</TableHead>
                        <TableHead className="text-xs py-2 w-[43%]">이메일</TableHead>
                        <TableHead className="text-xs py-2 w-[15%]">권한</TableHead>
                        <TableHead className="text-xs py-2 w-[20%]">가입일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.members.map(user => {
                        const level: PermissionLevel = userPermissionLevels[user.user_id]?.[group.id] || "general";
                        const levelColors: Record<PermissionLevel, string> = { admin: "bg-purple-100 text-purple-700", assistant: "bg-blue-100 text-blue-700", general: "bg-gray-100 text-gray-600" };
                        const levelLabels: Record<PermissionLevel, string> = { admin: "관리", assistant: "보조", general: "일반" };
                        return (
                          <TableRow key={user.id} className="cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => handleUserClick(user)}>
                            <TableCell className="font-medium text-sm py-2.5">{user.name || user.email}</TableCell>
                            <TableCell className="text-gray-500 text-sm py-2.5">{user.email}</TableCell>
                            <TableCell className="py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[level]}`}>{levelLabels[level]}</span>
                            </TableCell>
                            <TableCell className="text-gray-400 text-xs py-2.5">{format(new Date(user.created_at), "yyyy-MM-dd", { locale: ko })}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {/* 그룹 가입 요청 */}
                {group.pendingRequests.length > 0 && (
                  <div className={`space-y-1.5 ${group.members.length > 0 ? "mt-3 pt-3 border-t border-dashed border-orange-200" : ""}`}>
                    <p className="text-xs font-medium text-orange-600 mb-2">가입 요청</p>
                    {group.pendingRequests.map(req => {
                      const user = filteredUsers.find(u => u.user_id === req.userId);
                      return (
                        <div key={req.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{user?.name || user?.email || req.userId}</p>
                            <p className="text-xs text-gray-400">{user?.email}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 font-medium" onClick={(e) => handleApproveJoinRequest(e, req, req.userId)}>승인</Button>
                            <Button size="sm" variant="outline" className="text-red-500 border-red-300 hover:bg-red-50 text-xs h-8 font-medium" onClick={(e) => handleRejectJoinRequest(e, req.id, req.group_name)}>거절</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {group.members.length === 0 && group.pendingRequests.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">멤버가 없습니다.</p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* 그룹 미배정 */}
          {noGroupApprovedUsers.length > 0 && (
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-gray-500">
                  <Users className="h-4 w-4" />
                  그룹 미배정
                  <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{noGroupApprovedUsers.length}명</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs py-2 w-[22%]">이름</TableHead>
                      <TableHead className="text-xs py-2 w-[58%]">이메일</TableHead>
                      <TableHead className="text-xs py-2 w-[20%]">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noGroupApprovedUsers.map(user => (
                      <TableRow key={user.id} className="cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => handleUserClick(user)}>
                        <TableCell className="font-medium text-sm py-2.5">{user.name || user.email}</TableCell>
                        <TableCell className="text-gray-500 text-sm py-2.5">{user.email}</TableCell>
                        <TableCell className="text-gray-400 text-xs py-2.5">{format(new Date(user.created_at), "yyyy-MM-dd", { locale: ko })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* 최고관리자 */}
          {superAdmins.length > 0 && (
            <Card className="border-purple-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600" />
                  최고관리자
                  <span className="text-sm font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{superAdmins.length}명</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-50/50">
                      <TableHead className="text-xs py-2 w-[22%]">이름</TableHead>
                      <TableHead className="text-xs py-2 w-[58%]">이메일</TableHead>
                      <TableHead className="text-xs py-2 w-[20%]">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superAdmins.map(user => (
                      <TableRow key={user.id} className="cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => handleUserClick(user)}>
                        <TableCell className="font-medium text-sm py-2.5">{user.name || user.email}</TableCell>
                        <TableCell className="text-gray-500 text-sm py-2.5">{user.email}</TableCell>
                        <TableCell className="text-gray-400 text-xs py-2.5">{format(new Date(user.created_at), "yyyy-MM-dd", { locale: ko })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">등록된 사용자가 없습니다.</div>
          )}
        </div>
      ) : (
        /* 그룹관리자: 기존 플랫 테이블 */
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">사용자 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-sm font-semibold py-3">이름</TableHead>
                  <TableHead className="text-sm font-semibold py-3">이메일</TableHead>
                  <TableHead className="text-sm font-semibold py-3">상태</TableHead>
                  <TableHead className="text-sm font-semibold py-3">가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-500 text-sm">
                      등록된 사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleUserClick(user)}
                    >
                      <TableCell className="font-medium text-sm py-3">{user.name || user.email}</TableCell>
                      <TableCell className="text-gray-600 text-sm py-3">{user.email}</TableCell>
                      <TableCell className="py-3">{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-gray-500 text-sm py-3">
                        {format(new Date(user.created_at), "yyyy-MM-dd", { locale: ko })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 사용자 상세 설정 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setRejectMode(false); setAddGroupMode(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                    {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{selectedUser.name || selectedUser.email}</p>
                    <p className="text-sm text-gray-500 font-normal">{selectedUser.email}</p>
                  </div>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-2">
                  {getStatusBadge(selectedUser.status)}
                  {selectedUser.is_super_admin && <span className="badge badge-admin">전체관리자</span>}
                  <span className="text-sm text-gray-400">
                    가입일 {format(new Date(selectedUser.created_at), "yyyy년 MM월 dd일", { locale: ko })}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">

                {/* 대기 중 사용자 */}
                {!selectedUser.is_super_admin && selectedUser.status === "pending" && (
                  <div className="space-y-4">
                    {selectedUser.requested_group_id && (
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-md px-4 py-3">
                        요청 그룹: <span className="font-medium">{getGroupName(selectedUser.requested_group_id)}</span>
                      </div>
                    )}

                    {isSuperAdmin ? (
                      /* 최고관리자: 그룹 검색 + 전체 승인 */
                      <div className="border rounded-lg p-4 space-y-4">
                        <p className="text-sm font-medium text-gray-700">승인 설정</p>
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">소속 그룹</Label>
                          <GroupSearchInput value={approveGroupId} onChange={setApproveGroupId} placeholder="그룹 검색 (선택사항)" />
                        </div>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 text-sm font-medium" onClick={handleApproveConfirm}>승인</Button>
                      </div>
                    ) : (
                      /* 그룹관리자: 내 그룹의 join request 승인만 가능 */
                      <div className="border rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">그룹 가입 승인</p>
                        {(() => {
                          const myReqs = (joinRequestMap[selectedUser.user_id] || []).filter(r => adminGroupIds.includes(r.group_id));
                          if (myReqs.length === 0) {
                            return <p className="text-sm text-gray-400">내 관리 그룹에 대한 가입 요청이 없습니다.</p>;
                          }
                          return myReqs.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                              <span className="text-sm text-orange-800 font-medium">{req.group_name}</span>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9 font-medium"
                                onClick={(e) => handleApproveJoinRequest(e, req, selectedUser.user_id)}
                              >
                                그룹 가입 승인
                              </Button>
                            </div>
                          ));
                        })()}
                      </div>
                    )}

                    {!rejectMode ? (
                      <Button variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50 h-10 text-sm font-medium" onClick={() => setRejectMode(true)}>거절</Button>
                    ) : (
                      <div className="border border-red-200 rounded-lg p-4 space-y-3 bg-red-50">
                        <Label className="text-sm font-medium text-red-700">거절 사유 (선택사항)</Label>
                        <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="거절 사유를 입력하세요..." className="h-10 text-sm" />
                        <div className="flex gap-3">
                          <Button variant="outline" size="sm" onClick={() => setRejectMode(false)} className="flex-1 h-10 text-sm">취소</Button>
                          <Button variant="destructive" size="sm" onClick={handleRejectConfirm} className="flex-1 h-10 text-sm">거절 확인</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 거절된 사용자 - 최고관리자만 재승인 가능 */}
                {!selectedUser.is_super_admin && selectedUser.status === "rejected" && isSuperAdmin && (
                  <div className="space-y-3">
                    {selectedUser.rejected_reason && (
                      <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                        거절 사유: {selectedUser.rejected_reason}
                      </div>
                    )}
                    <div className="border rounded-lg p-3 space-y-3">
                      <p className="text-sm font-medium text-gray-700">재승인 설정</p>
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">소속 그룹</Label>
                        <GroupSearchInput value={approveGroupId} onChange={setApproveGroupId} placeholder="그룹 검색 (선택사항)" />
                      </div>
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveConfirm}>승인</Button>
                    </div>
                  </div>
                )}

                {/* 승인된 사용자 소속 그룹 목록 필터링 */}
                {!selectedUser.is_super_admin && selectedUser.status === "approved" && (
                  <div className="space-y-3">
                    <div className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">소속 그룹</p>
                      {(() => {
                        const userGroups = userGroupMap[selectedUser.user_id] || [];
                        const myManagedGroups = isSuperAdmin ? userGroups : userGroups.filter(gid => adminGroupIds.includes(gid));
                        
                        if (myManagedGroups.length === 0) {
                          return <p className="text-xs text-gray-400">관리 중인 그룹 내 소속 없음</p>;
                        }

                        return (
                          <div className="space-y-2">
                            {myManagedGroups.map(gid => {
                              const groupName = getGroupName(gid);
                              const currentLevel: PermissionLevel = userPermissionLevels[selectedUser.user_id]?.[gid] || 'general';
                              const levelLabel: Record<PermissionLevel, string> = { admin: '관리', assistant: '보조', general: '일반' };
                              
                              const activeColor: Record<PermissionLevel, string> = {
                                admin: 'bg-purple-600 text-white',
                                assistant: 'bg-blue-600 text-white',
                                general: 'bg-gray-600 text-white',
                              };

                              return (
                                <div key={gid} className="bg-gray-50 rounded-md p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">{groupName}</span>
                                    {(isSuperAdmin || adminGroupIds.includes(gid)) && (
                                      <button className="text-red-400 hover:text-red-600 text-xs font-medium" onClick={() => handleRemoveGroup(gid)}>제거</button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-10">권한:</span>
                                    <div className="flex gap-1">
                                      {(['admin', 'assistant', 'general'] as PermissionLevel[])
                                        .filter(level => isSuperAdmin || level !== 'admin')
                                        .map(level => {
                                        const isCurrent = currentLevel === level;
                                        return (
                                          <button
                                            key={level}
                                            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                                              isCurrent ? activeColor[level] : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                            }`}
                                            onClick={() => handleSetPermissionLevel(selectedUser.user_id, gid, level)}
                                          >
                                            {levelLabel[level]}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* 추가 참여 요청 목록 필터링 */}
                      {(filteredJoinRequestMap[selectedUser.user_id] || []).map(req => (
                        <div key={req.id} className="bg-orange-50 border border-orange-200 rounded-md px-3 py-2 flex items-center justify-between mt-2">
                          <div>
                            <p className="text-xs text-orange-600 font-medium">참여 요청 대기 중</p>
                            <p className="text-sm text-orange-800 font-medium">{req.group_name}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9 font-medium" onClick={(e) => handleApproveJoinRequest(e, req, selectedUser.user_id)}>승인</Button>
                            <Button size="sm" variant="outline" className="border-red-300 text-red-500 hover:bg-red-50 text-xs h-9 font-medium" onClick={(e) => handleRejectJoinRequest(e, req.id, req.group_name)}>거절</Button>
                          </div>
                        </div>
                      ))}

                      {isSuperAdmin && (
                        addGroupMode ? (
                          <div className="space-y-2 pt-1">
                            <GroupSearchInput value={newGroupId} onChange={setNewGroupId} placeholder="추가할 그룹 검색" />
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => { setAddGroupMode(false); setNewGroupId(""); }} className="flex-1 h-10 font-medium">취소</Button>
                              <Button size="sm" onClick={handleAddGroup} disabled={!newGroupId} className="flex-1 h-10 font-medium">추가</Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full text-xs h-10 font-medium" onClick={() => setAddGroupMode(true)}>+ 그룹 추가</Button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 위험 구역 - 최고관리자만 계정 삭제 가능 */}
                {isSuperAdmin && !selectedUser.is_super_admin && (
                  <div className="border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-600 mb-2">위험 구역</p>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50 w-full" onClick={() => setDeleteDialogOpen(true)}>계정 삭제</Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정 삭제</DialogTitle>
            <DialogDescription>이 작업은 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-700">다음 계정을 완전히 삭제하시겠습니까?</p>
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
              <p className="font-medium text-red-800">{selectedUser?.email}</p>
            </div>
            <p className="text-xs text-gray-500">계정을 삭제하면 해당 사용자의 모든 데이터(거래 내역, 설정, 그룹 멤버십 등)가 함께 삭제됩니다.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>취소</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? "삭제 중..." : "영구 삭제"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
