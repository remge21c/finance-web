"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GroupSearchInput from "@/components/GroupSearchInput";
import { toast } from "sonner";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function loadUserProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");

      const { data: statusData } = await supabase
        .from("finance_user_status")
        .select("name, requested_group_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (statusData) {
        setName(statusData.name || "");
        setSelectedGroupId(statusData.requested_group_id || "");
      }

      setLoading(false);
    }

    loadUserProfile();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("사용자를 찾을 수 없습니다.");

      // 1. 이름 및 요청 그룹 업데이트
      const { error: statusError } = await supabase
        .from("finance_user_status")
        .update({
          name: name,
          requested_group_id: selectedGroupId || null,
        })
        .eq("user_id", user.id);

      if (statusError) throw statusError;

      // 2. Auth 메타데이터 업데이트
      await supabase.auth.updateUser({ data: { name } });

      // 3. 비밀번호 변경 (입력한 경우에만)
      if (newPassword && newPassword.trim()) {
        // 새 비밀번호를 입력했으면 확인 필수
        if (!confirmPassword || !confirmPassword.trim()) {
          toast.error("새 비밀번호 확인을 입력해주세요.");
          setSaving(false);
          return;
        }

        if (newPassword !== confirmPassword) {
          toast.error("비밀번호가 일치하지 않습니다.");
          setSaving(false);
          return;
        }

        if (newPassword.length < 6) {
          toast.error("비밀번호는 6자 이상이어야 합니다.");
          setSaving(false);
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
      }

      // 4. 입력 필드 초기화
      setNewPassword("");
      setConfirmPassword("");

      toast.success("정보가 업데이트되었습니다.");
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error("업데이트 실패: " + (error.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">정보를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>정보 수정 ⚙️</CardTitle>
          <CardDescription>가입 정보를 수정하고 비밀번호를 변경할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input value={email} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-400">이메일은 변경할 수 없습니다.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>소속 그룹 요청</Label>
              <GroupSearchInput
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                placeholder="그룹 이름을 검색하세요"
              />
              <p className="text-xs text-gray-500">
                가입을 요청할 그룹을 변경할 수 있습니다. 관리자 승인 후 반영됩니다.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">비밀번호 변경 (선택사항)</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6자 이상 입력"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
                disabled={saving}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={saving}
              >
                {saving ? "저장 중..." : "저장하기"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
