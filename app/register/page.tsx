"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      });

      if (authError) {
        toast.error("회원가입 실패: " + authError.message);
        return;
      }

      if (!authData.user) {
        toast.error("사용자 생성에 실패했습니다.");
        return;
      }

      // 2. 사용자 상태 추가 (첫 번째 사용자는 자동 승인 + Super Admin)
      const { data: statusData, error: statusError } = await supabase
        .from("finance_user_status")
        .upsert({
          user_id: authData.user.id,
          email: email,
          status: isFirstUser ? "approved" : "pending",
          is_super_admin: isFirstUser,
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (statusError) {
        console.error("사용자 상태 생성 실패:", JSON.stringify(statusError, null, 2));
        console.error("에러 코드:", statusError.code);
        console.error("에러 메시지:", statusError.message);
        console.error("에러 상세:", statusError.details);
        toast.error("사용자 상태 생성 실패: " + (statusError.message || statusError.code || "알 수 없는 오류"));
        return;
      }

      console.log("사용자 상태 생성 성공:", statusData);

      // 3. 기본 설정 생성 (이미 존재하면 무시)
      const { error: settingsError } = await supabase
        .from("finance_settings")
        .upsert({
          user_id: authData.user.id,
          income_items: [],
          expense_items: [],
          income_budgets: [],
          expense_budgets: [],
          author: "",
          manager: "",
          currency: "원",
          memo: "",
          cash_amount: 0,
          touch_amount: 0,
          other_amount: 0,
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: true  // 이미 존재하면 무시
        });

      if (settingsError) {
        console.error("설정 생성 실패:", settingsError);
      }

      // 첫 번째 사용자는 바로 로그인, 이후 사용자는 승인 대기 안내
      if (isFirstUser) {
        toast.success("관리자 계정으로 등록되었습니다!");
      router.push("/login");
      } else {
        toast.success("가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
        router.push("/pending");
      }
    } catch {
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
