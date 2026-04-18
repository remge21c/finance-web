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
import { Checkbox } from "@/components/ui/checkbox";
import GroupSearchInput from "@/components/GroupSearchInput";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import type { UserStatus, GroupPermissions, GroupMember } from "@/types/database";

interface PendingRequest {
  id: string;
  group_id: string;
  group_name: string;
}

type PermissionType = 'write' | 'read' | 'waiting';
type GroupRole = 'owner' | 'admin' | 'finance_admin' | 'member';

interface GroupPermission {
  group_id: string;
  permission: PermissionType;
  role: GroupRole;
}

export default function AdminUsersPage() {
  const { allUsers, loading, isSuperAdmin, fetchAllUsers, approveUser, rejectUser, grantFinanceAdmin, revokeFinanceAdmin } = useUserStatus();
  const { groups } = useGroupContext();
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
  const [approveGrantFinanceAdmin, setApproveGrantFinanceAdmin] = useState(false);

  // 거절 관련
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 그룹 추가 관련 (승인된 사용자)
  const [addGroupMode, setAddGroupMode] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");

  // 삭제 확인 다이얼로그
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 그룹별 권한 관리
  const [userGroupPermissions, setUserGroupPermissions] = useState<Record<string, GroupPermission[]>>({});
  // 사용자별 그룹 역할 정보
  const [userGroupRoles, setUserGroupRoles] = useState<Record<string, Record<string, GroupRole>>>({});

  const fetchUserGroupMap = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("finance_group_members")
      .select("user_id, group_id, role, finance_groups(id, name)");
    if (data) {
      const memberMap: Record<string, string[]> = {};
      const nameMap: Record<string, string> = {};
      const roleMap: Record<string, Record<string, GroupRole>> = {};

      for (const item of data as GroupMember[]) {
        if (!memberMap[item.user_id]) {
          memberMap[item.user_id] = [];
          roleMap[item.user_id] = {};
        }
        memberMap[item.user_id].push(item.group_id);
        roleMap[item.user_id][item.group_id] = item.role;

        // Note: finance_groups data comes from JOIN, need to handle separately if needed
      }
      setUserGroupMap(memberMap);
      setUserGroupRoles(roleMap);
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
   * 사용자의 그룹별 권한 조회
   */
  const fetchUserGroupPermissions = async (userId: string, groupIds: string[]): Promise<GroupPermission[]> => {
    if (groupIds.length === 0) return [];

    const supabase = createClient();
    const { data: groups } = await supabase
      .from("finance_groups")
      .select("id, permissions")
      .in("id", groupIds);

    if (!groups) return [];

    const permissions: GroupPermission[] = [];
    const roles = userGroupRoles[userId] || {};

    for (const group of groups as any[]) {
      const groupPerms = (group.permissions as GroupPermissions) || { can_write: [], can_read: [] };
      const role = roles[group.id] || 'member';

      // 역할에 따른 기본 권한 결정
      // 재정관리: 자동 쓰기 권한
      // 일반: 명시적으로 부여된 권한만 있음 (없으면 대기 상태)
      let permission: PermissionType = 'waiting';

      if (role === 'finance_admin') {
        permission = 'write';
      } else if (groupPerms.can_write?.includes(userId)) {
        permission = 'write';
      } else if (groupPerms.can_read?.includes(userId)) {
        permission = 'read';
      }

      permissions.push({
        group_id: group.id,
        permission,
        role
      });
    }

    return permissions;
  };

  /**
   * 사용자의 그룹 권한 업데이트
   */
  const handleUpdateGroupPermission = async (groupId: string, permission: PermissionType) => {
    if (!selectedUser) return;

    const supabase = createClient();

    // 현재 그룹 권한 가져오기
    const { data: group } = await supabase
      .from("finance_groups")
      .select("permissions")
      .eq("id", groupId)
      .single();

    if (!group) {
      toast.error("그룹을 찾을 수 없습니다.");
      return;
    }

    const currentPermissions = (group.permissions as GroupPermissions) || { can_write: [], can_read: [] };
    const userId = selectedUser.user_id;

    // 기존 권한 제거
    const newPermissions: GroupPermissions = {
      can_write: currentPermissions.can_write?.filter((id: string) => id !== userId) || [],
      can_read: currentPermissions.can_read?.filter((id: string) => id !== userId) || [],
    };

    // 새 권한 추가
    if (permission === 'write') {
      newPermissions.can_write.push(userId);
    } else if (permission === 'read') {
      newPermissions.can_read.push(userId);
    }
    // permission === 'waiting'인 경우 아무것도 추가하지 않음 (권한 대기 상태)

    // 권한 업데이트
    const { error } = await supabase
      .from("finance_groups")
      .update({ permissions: newPermissions })
      .eq("id", groupId);

    if (error) {
      toast.error("권한 업데이트 실패: " + error.message);
      return;
    }

    toast.success("권한이 업데이트되었습니다.");

    // 로컬 상태 업데이트
    setUserGroupPermissions(prev => ({
      ...prev,
      [selectedUser.user_id]: (prev[selectedUser.user_id] || []).map(p =>
        p.group_id === groupId ? { ...p, permission } : p
      ),
    }));
  };

  /**
   * 사용자의 그룹 역할 업데이트
   */
  const handleUpdateGroupRole = async (groupId: string, role: GroupRole) => {
    if (!selectedUser) return;

    const supabase = createClient();

    // 역할 업데이트
    const { error } = await supabase
      .from("finance_group_members")
      .update({ role })
      .eq("user_id", selectedUser.user_id)
      .eq("group_id", groupId);

    if (error) {
      toast.error("역할 업데이트 실패: " + error.message);
      return;
    }

    // 로컬 상태 업데이트
    setUserGroupRoles(prev => ({
      ...prev,
      [selectedUser.user_id]: {
        ...(prev[selectedUser.user_id] || {}),
        [groupId]: role,
      },
    }));

    // 재정관리자로 변경 시 자동으로 쓰기 권한 부여
    if (role === 'finance_admin') {
      await handleUpdateGroupPermission(groupId, 'write');
    }

    toast.success("역할이 업데이트되었습니다.");
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

  const getGroupNamesWithRoles = (userId: string) => {
    const ids = userGroupMap[userId] || [];
    const roles = userGroupRoles[userId] || {};

    if (ids.length === 0) return "-";

    return (
      <div className="flex flex-wrap gap-1">
        {ids.map(gid => {
          const groupName = getGroupName(gid);
          const role = roles[gid] || 'member';
          const isFinanceAdmin = role === 'finance_admin';

          return (
            <span key={gid} className="inline-flex items-center gap-1">
              <span className="text-xs text-gray-600">{groupName}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isFinanceAdmin
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {isFinanceAdmin ? '재정' : '일반'}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  // 그룹 참여 요청 인라인 승인
  const handleApproveJoinRequest = async (e: React.MouseEvent, req: PendingRequest, userId: string) => {
    e.stopPropagation(); // 행 클릭(상세 다이얼로그) 방지
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
        .insert({ group_id: req.group_id, user_id: userId, role: "member" });
      if (error) {
        toast.error("그룹 추가 실패: " + error.message);
        return;
      }
    }

    await supabase
      .from("finance_group_join_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", req.id);

    toast.success(`${req.group_name} 참여가 승인되었습니다.`);
    await Promise.all([fetchUserGroupMap(), fetchJoinRequestMap()]);
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
    setApproveGroupId(user.requested_group_id || "");
    // 재정관리자 신청으로 가입한 경우 자동 체크
    setApproveGrantFinanceAdmin(user.requested_role === "finance_admin");
    setRejectMode(false);
    setRejectReason("");
    setAddGroupMode(false);
    setNewGroupId("");

    // 사용자의 그룹별 권한 조회
    const groupIds = userGroupMap[user.user_id] || [];
    if (groupIds.length > 0) {
      const permissions = await fetchUserGroupPermissions(user.user_id, groupIds);
      setUserGroupPermissions(prev => ({ ...prev, [user.user_id]: permissions }));
    }

    setDetailOpen(true);
  };

  // 신규 가입 승인 처리
  const handleApproveConfirm = async () => {
    if (!selectedUser) return;
    const result = await approveUser(selectedUser.user_id, {
      grantFinanceAdmin: approveGrantFinanceAdmin,
    });
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
          .insert({ group_id: approveGroupId, user_id: selectedUser.user_id, role: "member" });
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

  const handleGrantFinanceAdmin = async () => {
    if (!selectedUser) return;
    const result = await grantFinanceAdmin(selectedUser.user_id);
    if (result.error) {
      toast.error("재정관리자 승격 실패: " + result.error);
    } else {
      toast.success("재정관리자로 승격되었습니다.");
      await refreshAll();
      const updated = allUsers.find(u => u.user_id === selectedUser.user_id);
      if (updated) setSelectedUser({ ...updated, is_finance_admin: true });
    }
  };

  const handleRevokeFinanceAdmin = async () => {
    if (!selectedUser) return;
    const result = await revokeFinanceAdmin(selectedUser.user_id);
    if (result.error) {
      toast.error("재정관리자 권한 박탈 실패: " + result.error);
    } else {
      toast.success("재정관리자 권한이 박탈되었습니다.");
      await refreshAll();
      const updated = allUsers.find(u => u.user_id === selectedUser.user_id);
      if (updated) setSelectedUser({ ...updated, is_finance_admin: false });
    }
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
      .insert({ group_id: newGroupId, user_id: selectedUser.user_id, role: "member" });
    if (error) {
      toast.error("그룹 추가 실패: " + error.message);
    } else {
      toast.success("그룹에 추가되었습니다.");
      await fetchUserGroupMap();

      // 권한 정보도 다시 로드
      const groupIds = [...(userGroupMap[selectedUser.user_id] || []), newGroupId];
      const permissions = await fetchUserGroupPermissions(selectedUser.user_id, groupIds);
      setUserGroupPermissions(prev => ({ ...prev, [selectedUser.user_id]: permissions }));

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

  const pendingFinanceAdminCount = allUsers.filter(u => u.status === "pending" && u.requested_role === "finance_admin").length;
  const pendingCount = allUsers.filter(u => u.status === "pending").length;
  const approvedCount = allUsers.filter(u => u.status === "approved").length;
  const groupRequestCount = Object.values(joinRequestMap).reduce((acc, reqs) => acc + reqs.length, 0);

  if (loading || allUsersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">접근 권한이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">사용자 관리</h1>
        <p className="text-gray-500">사용자를 클릭하면 상세 설정을 변경할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-800">{allUsers.length}</p>
              <p className="text-sm text-gray-500">전체 사용자</p>
            </div>
          </CardContent>
        </Card>
        <Card className={pendingFinanceAdminCount > 0 ? "border-purple-300 bg-purple-50" : ""}>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className={`text-3xl font-bold ${pendingFinanceAdminCount > 0 ? "text-purple-600" : "text-gray-400"}`}>{pendingFinanceAdminCount}</p>
              <p className="text-sm text-gray-500">재정관리자 신청</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
              <p className="text-sm text-gray-500">승인됨</p>
            </div>
          </CardContent>
        </Card>
        <Card className={groupRequestCount > 0 ? "border-orange-300 bg-orange-50" : ""}>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className={`text-3xl font-bold ${groupRequestCount > 0 ? "text-orange-600" : "text-gray-400"}`}>{groupRequestCount}</p>
              <p className="text-sm text-gray-500">그룹 요청</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 재정관리자 신청 대기 강조 영역 */}
      {pendingFinanceAdminCount > 0 && (
        <Card className="border-purple-300 bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-700 text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-600 text-white text-xs rounded-full font-bold">{pendingFinanceAdminCount}</span>
              재정관리자 신청 승인 대기
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allUsers
                .filter(u => u.status === "pending" && u.requested_role === "finance_admin")
                .map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-white border border-purple-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-purple-50 transition-colors"
                    onClick={() => handleUserClick(u)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{u.name || u.email}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">재정관리자 신청</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 사용자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>소속 그룹</TableHead>
                <TableHead>그룹 요청</TableHead>
                <TableHead>가입일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    등록된 사용자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                allUsers.map((user) => {
                  const pendingRequests = joinRequestMap[user.user_id] || [];
                  return (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleUserClick(user)}
                    >
                      <TableCell className="font-medium">{user.name || user.email}</TableCell>
                      <TableCell className="text-gray-600 text-sm">{user.email}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {user.is_super_admin ? (
                          <span className="text-purple-600 font-medium text-xs">전체 관리</span>
                        ) : user.status === "approved" ? (
                          getGroupNamesWithRoles(user.user_id)
                        ) : (
                          getGroupName(user.requested_group_id)
                        )}
                      </TableCell>
                      <TableCell>
                        {pendingRequests.length > 0 ? (
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            {pendingRequests.map(req => (
                              <div key={req.id} className="flex items-center gap-1.5">
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  {req.group_name}
                                </span>
                                <Button
                                  size="sm"
                                  className="h-5 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                                  onClick={(e) => handleApproveJoinRequest(e, req, user.user_id)}
                                >
                                  승인
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-2 text-[11px] text-red-500 border-red-300 hover:bg-red-50"
                                  onClick={(e) => handleRejectJoinRequest(e, req.id, req.group_name)}
                                >
                                  거절
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {format(new Date(user.created_at), "yyyy-MM-dd", { locale: ko })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 사용자 상세 설정 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setRejectMode(false); setAddGroupMode(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-semibold">{selectedUser.name || selectedUser.email}</p>
                    <p className="text-xs text-gray-500 font-normal">{selectedUser.email}</p>
                  </div>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-1">
                  {getStatusBadge(selectedUser.status)}
                  {selectedUser.is_super_admin && <span className="badge badge-admin">전체관리자</span>}
                  {selectedUser.is_finance_admin && <span className="badge badge-finance">재정관리자</span>}
                  <span className="text-xs text-gray-400">
                    가입일 {format(new Date(selectedUser.created_at), "yyyy년 MM월 dd일", { locale: ko })}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">

                {/* 대기 중 사용자 */}
                {!selectedUser.is_super_admin && selectedUser.status === "pending" && (
                  <div className="space-y-3">
                    {selectedUser.requested_role === "finance_admin" && (
                      <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
                        <span className="text-xs font-medium text-purple-700">재정관리자 신청</span>
                        <span className="text-xs text-purple-500">— 승인 시 그룹 생성·관리 권한이 부여됩니다</span>
                      </div>
                    )}
                    {selectedUser.requested_group_id && (
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                        요청 그룹: <span className="font-medium">{getGroupName(selectedUser.requested_group_id)}</span>
                      </div>
                    )}
                    <div className="border rounded-lg p-3 space-y-3">
                      <p className="text-sm font-medium text-gray-700">승인 설정</p>
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">소속 그룹</Label>
                        <GroupSearchInput value={approveGroupId} onChange={setApproveGroupId} placeholder="그룹 검색 (선택사항)" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="approve-finance-admin" checked={approveGrantFinanceAdmin} onCheckedChange={(v) => setApproveGrantFinanceAdmin(v === true)} />
                        <Label htmlFor="approve-finance-admin" className="text-sm cursor-pointer">
                          재정관리자 <span className="text-xs text-gray-400">(그룹 생성·관리 가능)</span>
                        </Label>
                      </div>
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveConfirm}>승인</Button>
                    </div>
                    {!rejectMode ? (
                      <Button variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50" onClick={() => setRejectMode(true)}>거절</Button>
                    ) : (
                      <div className="border border-red-200 rounded-lg p-3 space-y-2 bg-red-50">
                        <Label className="text-sm font-medium text-red-700">거절 사유 (선택사항)</Label>
                        <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="거절 사유를 입력하세요..." />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRejectMode(false)} className="flex-1">취소</Button>
                          <Button variant="destructive" size="sm" onClick={handleRejectConfirm} className="flex-1">거절 확인</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 거절된 사용자 */}
                {!selectedUser.is_super_admin && selectedUser.status === "rejected" && (
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
                      <div className="flex items-center space-x-2">
                        <Checkbox id="reapprove-finance-admin" checked={approveGrantFinanceAdmin} onCheckedChange={(v) => setApproveGrantFinanceAdmin(v === true)} />
                        <Label htmlFor="reapprove-finance-admin" className="text-sm cursor-pointer">재정관리자</Label>
                      </div>
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveConfirm}>승인</Button>
                    </div>
                  </div>
                )}

                {/* 승인된 사용자 */}
                {!selectedUser.is_super_admin && selectedUser.status === "approved" && (
                  <div className="space-y-3">
                    {/* 소속 그룹 */}
                    <div className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">소속 그룹</p>
                      {(userGroupMap[selectedUser.user_id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400">소속 그룹 없음</p>
                      ) : (
                        <div className="space-y-2">
                          {(userGroupMap[selectedUser.user_id] || []).map(gid => {
                            const groupName = getGroupName(gid);
                            const permission = userGroupPermissions[selectedUser.user_id]?.find(p => p.group_id === gid)?.permission || 'waiting';
                            const role = userGroupRoles[selectedUser.user_id]?.[gid] || 'member';

                            const roleLabels: Record<string, string> = {
                              finance_admin: '재정관리',
                              member: '일반'
                            };

                            const roleBadgeColors: Record<string, string> = {
                              finance_admin: 'bg-green-100 text-green-700',
                              member: 'bg-gray-100 text-gray-700'
                            };

                            return (
                              <div key={gid} className="bg-gray-50 rounded-md p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">{groupName}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadgeColors[role] || 'bg-gray-100 text-gray-700'}`}>
                                      {roleLabels[role] || '일반'}
                                    </span>
                                  </div>
                                  <button
                                    className="text-red-400 hover:text-red-600 text-xs font-medium"
                                    onClick={() => handleRemoveGroup(gid)}
                                  >
                                    제거
                                  </button>
                                </div>

                                {/* 역할 설정 */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-12">역할:</span>
                                  <div className="flex gap-1">
                                    <button
                                      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                                        role === 'member'
                                          ? 'bg-gray-600 text-white'
                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                      }`}
                                      onClick={() => handleUpdateGroupRole(gid, 'member')}
                                    >
                                      일반
                                    </button>
                                    <button
                                      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                                        role === 'finance_admin'
                                          ? 'bg-green-600 text-white'
                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                      }`}
                                      onClick={() => handleUpdateGroupRole(gid, 'finance_admin')}
                                    >
                                      재정관리
                                    </button>
                                  </div>
                                </div>

                                {/* 권한 설정 (역할이 일반인 경우에만 표시) */}
                                {role === 'member' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-12">권한:</span>
                                    <div className="flex gap-1">
                                      <button
                                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                          permission === 'write'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                        onClick={() => handleUpdateGroupPermission(gid, 'write')}
                                      >
                                        쓰기
                                      </button>
                                      <button
                                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                          permission === 'read'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                        onClick={() => handleUpdateGroupPermission(gid, 'read')}
                                      >
                                        읽기
                                      </button>
                                      <button
                                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                          permission === 'waiting'
                                            ? 'bg-yellow-500 text-white'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                        onClick={() => handleUpdateGroupPermission(gid, 'waiting')}
                                      >
                                        대기
                                      </button>
                                    </div>
                                    {permission === 'waiting' && (
                                      <span className="text-xs text-yellow-600 ml-1">권한 대기 중</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 대기 중인 그룹 요청 (새 테이블) */}
                      {(joinRequestMap[selectedUser.user_id] || []).map(req => (
                        <div key={req.id} className="bg-orange-50 border border-orange-200 rounded-md px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-orange-600 font-medium">참여 요청 대기 중</p>
                            <p className="text-sm text-orange-800 font-medium">{req.group_name}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                              onClick={(e) => handleApproveJoinRequest(e, req, selectedUser.user_id)}
                            >
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-500 hover:bg-red-50 text-xs h-7"
                              onClick={(e) => handleRejectJoinRequest(e, req.id, req.group_name)}
                            >
                              거절
                            </Button>
                          </div>
                        </div>
                      ))}

                      {addGroupMode ? (
                        <div className="space-y-2 pt-1">
                          <GroupSearchInput value={newGroupId} onChange={setNewGroupId} placeholder="추가할 그룹 검색" />
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setAddGroupMode(false); setNewGroupId(""); }} className="flex-1">취소</Button>
                            <Button size="sm" onClick={handleAddGroup} disabled={!newGroupId} className="flex-1">추가</Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAddGroupMode(true)}>+ 그룹 추가</Button>
                      )}
                    </div>

                    {/* 관리 권한 */}
                    <div className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">관리 권한</p>
                      {selectedUser.is_finance_admin ? (
                        <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50 w-full" onClick={handleRevokeFinanceAdmin}>재정관리자 해제</Button>
                      ) : (
                        <Button variant="outline" size="sm" className="text-purple-600 border-purple-300 hover:bg-purple-50 w-full" onClick={handleGrantFinanceAdmin}>재정관리자로 승격</Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 위험 구역 */}
                {!selectedUser.is_super_admin && (
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
