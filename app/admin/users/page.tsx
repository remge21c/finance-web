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

export default function AdminUsersPage() {
  const { allUsers, loading, isSuperAdmin, fetchAllUsers, approveUser, rejectUser, grantFinanceAdmin, revokeFinanceAdmin } = useUserStatus();
  const { groups } = useGroupContext();
  const [allUsersLoading, setAllUsersLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<{ userId: string; email: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserRequestedGroupId, setSelectedUserRequestedGroupId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [grantFinanceAdminChecked, setGrantFinanceAdminChecked] = useState(false);
  const [canGroupChecked, setCanGroupChecked] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  useEffect(() => {
    setAllUsersLoading(true);
    fetchAllUsers().finally(() => setAllUsersLoading(false));
  }, [fetchAllUsers]);

  const handleApproveClick = (userId: string, requestedGroupId: string | null) => {
    setSelectedUserId(userId);
    setSelectedUserRequestedGroupId(requestedGroupId);
    setGrantFinanceAdminChecked(false);
    setCanGroupChecked(true);
    setSelectedGroupId(requestedGroupId || "");
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedUserId) return;

    const result = await approveUser(selectedUserId, {
      grantFinanceAdmin: grantFinanceAdminChecked,
      canGroupFinance: canGroupChecked,
    });
    if (result.error) {
      toast.error("승인 실패: " + result.error);
      return;
    }

    // 그룹이 선택되었으면 사용자를 그룹에 추가
    if (selectedGroupId) {
      const supabase = createClient();

      // 먼저 이미 그룹 멤버인지 확인
      const { data: existingMember } = await supabase
        .from("finance_group_members")
        .select("*")
        .eq("user_id", selectedUserId)
        .eq("group_id", selectedGroupId)
        .maybeSingle();

      if (!existingMember) {
        // 그룹 멤버 추가
        const { error: memberError } = await supabase
          .from("finance_group_members")
          .insert({
            group_id: selectedGroupId,
            user_id: selectedUserId,
            role: "member",
          });

        if (memberError) {
          toast.warning("사용자가 승인되었으나 그룹 추가에 실패했습니다: " + memberError.message);
        } else {
          toast.success(grantFinanceAdminChecked ? "재정관리자로 승인되고 그룹에 추가되었습니다." : "사용자가 승인되고 그룹에 추가되었습니다.");
        }
      } else {
        toast.success(grantFinanceAdminChecked ? "재정관리자로 승인되었습니다." : "사용자가 승인되었습니다.");
      }
    } else {
      toast.success(grantFinanceAdminChecked ? "재정관리자로 승인되었습니다." : "사용자가 승인되었습니다.");
    }

    setApproveDialogOpen(false);
  };

  const handleGrantFinanceAdmin = async (userId: string) => {
    if (!confirm("이 사용자를 재정관리자로 승격하시겠습니까?")) return;

    const result = await grantFinanceAdmin(userId);
    if (result.error) {
      toast.error("재정관리자 승격 실패: " + result.error);
    } else {
      toast.success("재정관리자로 승격되었습니다.");
    }
  };

  const handleRevokeFinanceAdmin = async (userId: string) => {
    if (!confirm("이 사용자의 재정관리자 권한을 박탈하시겠습니까?")) return;

    const result = await revokeFinanceAdmin(userId);
    if (result.error) {
      toast.error("재정관리자 권한 박탈 실패: " + result.error);
    } else {
      toast.success("재정관리자 권한이 박탈되었습니다.");
    }
  };

  const handleDeleteClick = (userId: string, email: string) => {
    setDeleteTargetUser({ userId, email });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetUser) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTargetUser.userId }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error("삭제 실패: " + result.error);
      } else {
        toast.success(`${deleteTargetUser.email} 계정이 삭제되었습니다.`);
        setDeleteDialogOpen(false);
        setDeleteTargetUser(null);
        setAllUsersLoading(true);
        fetchAllUsers().finally(() => setAllUsersLoading(false));
      }
    } catch (err) {
      toast.error("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRejectClick = (userId: string) => {
    setSelectedUserId(userId);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedUserId) return;
    
    const result = await rejectUser(selectedUserId, rejectReason);
    if (result.error) {
      toast.error("거절 실패: " + result.error);
    } else {
      toast.success("사용자가 거절되었습니다.");
      setRejectDialogOpen(false);
    }
  };

  // 상태별 사용자 수
  const pendingCount = allUsers.filter(u => u.status === "pending").length;
  const approvedCount = allUsers.filter(u => u.status === "approved").length;
  const rejectedCount = allUsers.filter(u => u.status === "rejected").length;

  const getStatusBadge = (status: string, isSuperAdmin: boolean, isFinanceAdmin: boolean) => {
    const badges = [];
    if (isSuperAdmin) {
      badges.push(<span key="super" className="badge badge-admin">관리자</span>);
    }
    if (isFinanceAdmin) {
      badges.push(<span key="finance" className="badge badge-finance">재정관리자</span>);
    }
    if (!isSuperAdmin && !isFinanceAdmin) {
      switch (status) {
        case "pending":
          return <span className="badge badge-pending">대기</span>;
        case "approved":
          return <span className="badge badge-approved">승인</span>;
        case "rejected":
          return <span className="badge badge-rejected">거절</span>;
        default:
          return null;
      }
    }
    return badges.length > 0 ? <div className="flex gap-1">{badges}</div> : null;
  };

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "-";
    const group = groups.find(g => g.id === groupId);
    return group?.name || groupId;
  };

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
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">사용자 관리</h1>
        <p className="text-gray-500">가입 신청을 승인하거나 거절할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-800">{allUsers.length}</p>
              <p className="text-sm text-gray-500">전체 사용자</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-sm text-gray-500">승인 대기</p>
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
              <p className="text-sm text-gray-500">거절됨</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 사용자 테이블 */}
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
                <TableHead className="w-24">상태</TableHead>
                <TableHead>재정권한</TableHead>
                <TableHead>요청 그룹</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead className="w-48">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    등록된 사용자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                allUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || user.email}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{user.email}</TableCell>
                    <TableCell>{getStatusBadge(user.status, user.is_super_admin, user.is_finance_admin)}</TableCell>
                    <TableCell>
                      {!user.is_super_admin && user.status === "approved" && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`group-finance-${user.user_id}`}
                            checked={user.can_group_finance}
                            disabled={true}
                          />
                          <Label htmlFor={`group-finance-${user.user_id}`} className="text-sm">
                            그룹재정
                          </Label>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {getGroupName(user.requested_group_id)}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {format(new Date(user.created_at), "yyyy-MM-dd HH:mm", { locale: ko })}
                    </TableCell>
                    <TableCell>
                      {!user.is_super_admin && (
                        <div className="flex flex-wrap gap-2">
                          {user.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleApproveClick(user.user_id, user.requested_group_id)}
                            >
                              승인
                            </Button>
                          )}
                          {user.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleRejectClick(user.user_id)}
                            >
                              거절
                            </Button>
                          )}
                          {user.status === "approved" && !user.is_finance_admin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-purple-600 border-purple-600 hover:bg-purple-50"
                              onClick={() => handleGrantFinanceAdmin(user.user_id)}
                            >
                              재정관리자 지정
                            </Button>
                          )}
                          {user.status === "approved" && user.is_finance_admin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 border-orange-600 hover:bg-orange-50"
                              onClick={() => handleRevokeFinanceAdmin(user.user_id)}
                            >
                              재정관리자 해제
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-gray-500 border-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-400"
                            onClick={() => handleDeleteClick(user.user_id, user.email)}
                          >
                            삭제
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 거절 사유 입력 다이얼로그 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 거절</DialogTitle>
            <DialogDescription>
              거절 사유를 입력해주세요. (선택사항)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">거절 사유</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거절 사유를 입력하세요..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm}>
              거절
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 사용자 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 삭제</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-700">
              다음 계정을 완전히 삭제하시겠습니까?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
              <p className="font-medium text-red-800">{deleteTargetUser?.email}</p>
            </div>
            <p className="text-xs text-gray-500">
              계정을 삭제하면 해당 사용자의 모든 데이터(거래 내역, 설정, 그룹 멤버십 등)가 함께 삭제됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? "삭제 중..." : "영구 삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 승인 다이얼로그 (재정관리자 권한 포함) */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 승인</DialogTitle>
            <DialogDescription>
              사용자를 승인하고 그룹에 추가할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-select">소속 그룹 선택</Label>
              <GroupSearchInput
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                placeholder="그룹 이름을 검색하세요 (예: 재정부, 교육부)"
              />
              <p className="text-xs text-gray-500">
                {selectedUserRequestedGroupId
                  ? `사용자가 요청한 그룹: ${getGroupName(selectedUserRequestedGroupId)}`
                  : "선택한 그룹에 사용자를 멤버로 추가합니다."}
              </p>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">재정 접근 권한</p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="can-group"
                  checked={canGroupChecked}
                  onCheckedChange={(checked) => setCanGroupChecked(checked === true)}
                />
                <Label htmlFor="can-group" className="cursor-pointer text-sm">
                  그룹재정 사용
                </Label>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">관리 권한</p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="finance-admin"
                  checked={grantFinanceAdminChecked}
                  onCheckedChange={(checked) => setGrantFinanceAdminChecked(checked === true)}
                />
                <Label htmlFor="finance-admin" className="cursor-pointer text-sm">
                  재정관리자 <span className="text-xs text-gray-400">(그룹 생성·관리 가능)</span>
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleApproveConfirm} className="bg-emerald-600 hover:bg-emerald-700">
              승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}























