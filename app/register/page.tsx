"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GroupSearchInput from "@/components/GroupSearchInput";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // 0. 첫 번째 사용자인지 확인 (Super Admin 결정용)
      const { count: userCount } = await supabase
        .from("finance_user_status")
        .select("*", { count: "exact", head: true });

      const isFirstUser = userCount === 0;

      // 1. 회원가입
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          }
        }
      });

      if (authError) {
        toast.error("회원가입 실패: " + authError.message);
        return;
      }

      if (!authData.user) {
        toast.error("사용자 생성에 실패했습니다.");
        return;
      }

      // 2. 사용자 상태 추가 (이름, 요청 그룹 포함)
      const { data: statusData, error: statusError } = await supabase
        .from("finance_user_status")
        .insert({
          user_id: authData.user.id,
          email: email,
          name: name,
          status: isFirstUser ? "approved" : "pending",
          is_super_admin: isFirstUser,
          requested_group_id: selectedGroupId || null,
        })
        .select();

      if (statusError) {
        console.error("사용자 상태 생성 실패:", JSON.stringify(statusError, null, 2));
        toast.error("사용자 상태 생성 실패: " + (statusError.message || statusError.code || "알 수 없는 오류"));
        return;
      }

      // 첫 번째 사용자는 바로 로그인, 이후 사용자는 승인 대기 안내
      if (isFirstUser) {
        toast.success("관리자 계정으로 등록되었습니다!");
        router.push("/login");
      } else {
        const groupMessage = selectedGroupId
          ? "선택하신 그룹에 가입 요청이 전달되었습니다. 관리자 승인을 기다려주세요."
          : "가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.";
        toast.success(groupMessage);
        router.push("/pending");
      }
    } catch (error) {
      console.error("회원가입 오류:", error);
      toast.error("회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">회원가입</CardTitle>
          <CardDescription>새 계정을 만들어 시작하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">소속 그룹 (선택사항)</Label>
              <GroupSearchInput
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                placeholder="그룹 이름을 검색하세요 (예: 재정부, 교육부)"
              />
              <p className="text-xs text-gray-500 mt-1">
                원하시는 그룹을 검색하여 선택할 수 있습니다. 관리자 승인 후 그룹에 추가됩니다.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading ? "가입 중..." : "회원가입"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-emerald-600 hover:underline">
              로그인
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
