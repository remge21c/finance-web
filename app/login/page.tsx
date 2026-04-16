"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface UserPermissions {
  name: string;
  user_groups: Array<{ id: string; name: string }>;
  user_id: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // 컴포넌트 마운트 시 이전 세션 데이터 정리
  useEffect(() => {
    localStorage.removeItem("selectedGroupId");
  }, []);

  // 이메일 입력 시 사용자 권한 및 소속 그룹 확인
  useEffect(() => {
    const checkUserPermissions = async () => {
      if (!email || !email.includes("@")) {
        setUserPermissions(null);
        setSelectedGroupId("");
        return;
      }

      setCheckingEmail(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("finance_user_status")
          .select("can_group_finance, status, name, user_id")
          .eq("email", email)
          .maybeSingle();

        if (data && data.status === "approved" && (data.can_group_finance ?? true)) {
          // 소속된 그룹 목록 조회
          let userGroups: Array<{ id: string; name: string }> = [];
          const { data: memberData } = await supabase
            .from("finance_group_members")
            .select("group_id")
            .eq("user_id", data.user_id);

          if (memberData && memberData.length > 0) {
            const groupIds = memberData.map(m => m.group_id);
            const { data: groupsData } = await supabase
              .from("finance_groups")
              .select("id, name")
              .in("id", groupIds);

            if (groupsData) {
              userGroups = groupsData;
            }
          }

          setUserPermissions({
            name: data.name || "",
            user_groups: userGroups,
            user_id: data.user_id,
          });

          // 기본값 설정: 첫 번째 소속 그룹
          if (userGroups.length > 0) {
            setSelectedGroupId(userGroups[0].id);
          }
        } else {
          setUserPermissions(null);
          setSelectedGroupId("");
        }
      } catch {
        setUserPermissions(null);
        setSelectedGroupId("");
      } finally {
        setCheckingEmail(false);
      }
    };

    const debounceTimer = setTimeout(checkUserPermissions, 500);
    return () => clearTimeout(debounceTimer);
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("로그인 실패: " + error.message);
        setLoading(false);
        return;
      }

      // 선택한 그룹 저장
      if (selectedGroupId) {
        localStorage.setItem("selectedGroupId", selectedGroupId);
      }

      toast.success("로그인 성공!");
      window.location.href = "/dashboard";
    } catch {
      toast.error("로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const availableGroups = userPermissions?.user_groups || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">로그인</CardTitle>
          <CardDescription>재정 관리 프로그램에 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
              {checkingEmail && (
                <p className="text-xs text-gray-500">권한 확인 중...</p>
              )}
              {userPermissions && (
                <p className="text-xs text-emerald-600">✓ 사용자 권한 확인 완료</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* 그룹 선택 */}
            {userPermissions && (
              <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-700">
                  그룹 선택
                  <span className="ml-2 text-xs text-emerald-600">(권한 확인됨)</span>
                </p>

                {/* 소속 그룹 목록 */}
                {availableGroups.length > 0 ? (
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-gray-500">접속할 그룹을 선택하세요:</p>
                    {availableGroups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2 ml-1">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={selectedGroupId === group.id}
                          onCheckedChange={() => setSelectedGroupId(group.id)}
                        />
                        <Label
                          htmlFor={`group-${group.id}`}
                          className="text-sm text-gray-700 cursor-pointer"
                        >
                          {group.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ml-6 text-xs text-orange-600">⚠ 소속된 그룹이 없습니다. 관리자에게 문의하세요.</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading || (!!userPermissions && availableGroups.length === 0)}
            >
              {loading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            계정이 없으신가요?{" "}
            <Link href="/register" className="text-emerald-600 hover:underline">
              회원가입
            </Link>
          </div>
          <div className="mt-2 text-center">
            <Link href="/" className="text-sm text-gray-500 hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
