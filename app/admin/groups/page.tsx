"use client";

import { useState, useEffect, useCallback } from "react";
import { useUserStatus } from "@/lib/hooks/useUserStatus";
import { createClient } from "@/lib/supabase/client";
import { createGroup as createGroupApi, updateGroup as updateGroupApi, deleteGroup as deleteGroupApi } from "@/lib/supabase/groups";
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
import { toast } from "sonner";
import { Trash2, Edit2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Group, GroupInput } from "@/types/database";

export default function AdminGroupsPage() {
  const router = useRouter();
  const { isSuperAdmin, loading: userStatusLoading } = useUserStatus();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<GroupInput>({ name: "", description: "" });

  const fetchAllGroups = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("finance_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[AdminGroups] fetch error:", error);
        toast.error("그룹 목록 조회 실패: " + error.message);
      } else {
        setGroups(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllGroups();
  }, [fetchAllGroups]);

  if (userStatusLoading || loading) {
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

  const handleCreate = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({ name: group.name, description: group.description });
    setDialogOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm("이 그룹을 삭제하시겠습니까? 그룹의 모든 데이터가 삭제됩니다.")) return;

    const result = await deleteGroupApi(groupId);
    if (result.error) {
      toast.error("삭제 실패: " + result.error);
    } else {
      toast.success("그룹이 삭제되었습니다.");
      await fetchAllGroups();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("그룹 이름을 입력해주세요.");
      return;
    }

    if (editingGroup) {
      const result = await updateGroupApi(editingGroup.id, formData);
      if (result.error) {
        toast.error("수정 실패: " + result.error);
      } else {
        toast.success("그룹이 수정되었습니다.");
        setDialogOpen(false);
        await fetchAllGroups();
      }
    } else {
      const result = await createGroupApi(formData);
      if (result.error) {
        toast.error("생성 실패: " + result.error);
      } else {
        toast.success("그룹이 생성되었습니다.");
        setDialogOpen(false);
        await fetchAllGroups();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">그룹 관리</h1>
          <p className="text-gray-500">재정 관리 그룹을 생성하고 관리합니다. ({groups.length}개)</p>
        </div>
        <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">
          + 그룹 생성
        </Button>
      </div>

      {/* 그룹 목록 */}
      {groups.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          등록된 그룹이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(group)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/groups/permissions?id=${group.id}`)}
                    className="h-8 w-8 p-0 text-teal-600 hover:text-teal-700"
                    title="권한 설정"
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(group.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">{group.description || "설명 없음"}</p>
                <p className="text-xs text-gray-400">
                  생성일: {new Date(group.created_at).toLocaleDateString("ko-KR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 그룹 생성/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "그룹 수정" : "그룹 생성"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "그룹 정보를 수정합니다." : "새로운 그룹을 생성합니다."}
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
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingGroup ? "수정" : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
