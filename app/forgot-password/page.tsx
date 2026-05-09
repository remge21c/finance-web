"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Image from "next/image";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        toast.error("오류: " + error.message);
        return;
      }

      setSent(true);
    } catch {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="inline-block mb-4 drop-shadow-xl">
            <Image src="/app-icon.png" alt="재정관리" width={96} height={96} className="rounded-[22px]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">비밀번호 찾기</h1>
          <p className="text-sm text-gray-500 mt-1.5">가입한 이메일 주소를 입력하세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {sent ? (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-full">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">이메일을 보냈습니다</p>
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-medium text-gray-700">{email}</span> 으로<br />
                  비밀번호 재설정 링크를 발송했습니다.
                </p>
                <p className="text-xs text-gray-400 mt-3">스팸 메일함도 확인해주세요.</p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full h-10 mt-2">
                  로그인으로 돌아가기
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">이메일</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="가입 시 사용한 이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-9 h-10 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    발송 중...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    재설정 메일 발송
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>

        {!sent && (
          <div className="mt-4 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 hover:underline">
              <ArrowLeft className="h-3 w-3" />
              로그인으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
