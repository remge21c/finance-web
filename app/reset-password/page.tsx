"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, Lock, CheckCircle2, XCircle, KeyRound } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error("링크가 만료되었거나 유효하지 않습니다. 다시 시도해주세요.");
      router.push("/forgot-password");
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        toast.error("인증 세션이 없습니다. 비밀번호 찾기를 다시 시도해주세요.");
        router.push("/forgot-password");
      }
      setChecking(false);
    });
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error("오류: " + error.message);
        return;
      }

      toast.success("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-100">
        <div className="flex items-center gap-2 text-gray-500">
          <span className="h-4 w-4 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
          인증 확인 중...
        </div>
      </div>
    );
  }

  if (!sessionReady) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg mb-4">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">새 비밀번호 설정</h1>
          <p className="text-sm text-gray-500 mt-1">새로 사용할 비밀번호를 입력해주세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">새 비밀번호</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="6자 이상 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-medium text-gray-700">비밀번호 확인</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirm"
                  type="password"
                  placeholder="비밀번호를 다시 입력"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                  className={`pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 ${
                    passwordsMismatch ? "border-red-300 focus:border-red-400" :
                    passwordsMatch ? "border-emerald-300 focus:border-emerald-400" : ""
                  }`}
                />
              </div>
              {passwordsMismatch && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <XCircle className="h-3.5 w-3.5" />
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
              {passwordsMatch && password.length >= 6 && (
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  비밀번호가 일치합니다.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 mt-1"
              disabled={loading || password !== confirm || password.length < 6}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  변경 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  비밀번호 변경
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-100">
        <div className="flex items-center gap-2 text-gray-500">
          <span className="h-4 w-4 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
          로딩 중...
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
