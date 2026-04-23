"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GroupSearchInput from "@/components/GroupSearchInput";
import { toast } from "sonner";
import { User, Mail, Lock, UserPlus, FolderSearch, Wallet } from "lucide-react";

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

      const { count: userCount } = await supabase
        .from("finance_user_status")
        .select("*", { count: "exact", head: true });

      const isFirstUser = userCount === 0;

      if (!isFirstUser && !selectedGroupId) {
        toast.error("참여할 그룹을 선택해야 합니다.");
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (authError) {
        toast.error("회원가입 실패: " + authError.message);
        return;
      }

      if (!authData.user) {
        toast.error("사용자 생성에 실패했습니다.");
        return;
      }

      const { error: statusError } = await supabase
        .from("finance_user_status")
        .insert({
          user_id: authData.user.id,
          email,
          name,
          status: isFirstUser ? "approved" : "pending",
          is_super_admin: isFirstUser,
          requested_role: "user",
          requested_group_id: selectedGroupId || null,
        });

      if (statusError) {
        console.error("사용자 상태 생성 실패:", JSON.stringify(statusError, null, 2));
        toast.error("사용자 상태 생성 실패: " + (statusError.message || statusError.code || "알 수 없는 오류"));
        return;
      }

      // 그룹을 선택한 경우 그룹 참여 요청 생성
      if (!isFirstUser && selectedGroupId) {
        await supabase
          .from("finance_group_join_requests")
          .insert({
            user_id: authData.user.id,
            group_id: selectedGroupId,
            status: "pending",
            requested_at: new Date().toISOString(),
          });
      }

      if (isFirstUser) {
        toast.success("관리자 계정으로 등록되었습니다!");
        router.push("/login");
      } else {
        const groupMessage = selectedGroupId
          ? "가입이 완료되었습니다. 그룹 참여 요청이 관리자에게 전송되었습니다."
          : "가입이 완료되었습니다. 로그인 후 그룹 참여를 요청해주세요.";
        toast.success(groupMessage);
        router.push("/login");
      }
    } catch (error) {
      console.error("회원가입 오류:", error);
      toast.error("회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-100 py-8">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 drop-shadow-lg mx-auto">
            <Wallet className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="text-sm text-gray-500 mt-1">새 계정을 만들어 시작하세요</p>
        </div>

        {/* 회원가입 카드 */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">이름 <span className="text-red-400">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">이메일</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 그룹 선택 */}
            <div className="space-y-1.5">
              <Label htmlFor="group" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <FolderSearch className="h-3.5 w-3.5 text-gray-400" />
                참여할 그룹 <span className="text-red-400">*</span>
              </Label>
              <GroupSearchInput
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                placeholder="그룹 이름을 검색하세요"
              />
              <p className="text-xs text-gray-400">
                그룹 선택은 필수입니다. 관리자 승인 후 그룹에 추가됩니다.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">비밀번호</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="6자 이상 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">비밀번호 확인</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 mt-1"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  가입 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  회원가입
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
