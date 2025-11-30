"use client";

import { useEffect, useState } from "react";
import { useUserStatus } from "@/lib/hooks/useUserStatus";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function AdminUsersPage() {
  const { allUsers, loading, isSuperAdmin, fetchAllUsers, approveUser, rejectUser } = useUserStatus();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const handleApprove = async (userId: string) => {
    if (!confirm("이 사용자를 승인하시겠습니까?")) return;
    
    const result = await approveUser(userId);
    if (result.error) {
      toast.error("승인 실패: " + result.error);
    } else {
      toast.success("사용자가 승인되었습니다.");
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

  const getStatusBadge = (status: string, isSuperAdmin: boolean) => {
    if (isSuperAdmin) {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">관리자</span>;
    }
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">대기</span>;
      case "approved":
        return <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">승인</span>;
      case "rejected":
        return <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">거절</span>;
      default:
        return null;
    }
  };

  if (loading) {
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
      <div>
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
                <TableHead>이메일</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead>거절 사유</TableHead>
                <TableHead className="w-40">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    등록된 사용자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                allUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{getStatusBadge(user.status, user.is_super_admin)}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {format(new Date(user.created_at), "yyyy-MM-dd HH:mm", { locale: ko })}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {user.rejected_reason || "-"}
                    </TableCell>
                    <TableCell>
                      {!user.is_super_admin && (
                        <div className="flex space-x-2">
                          {user.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(user.user_id)}
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
    </div>
  );
}








