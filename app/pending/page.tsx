"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserStatus } from "@/lib/hooks/useUserStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function PendingPage() {
  const router = useRouter();
  const { userStatus, loading, isPending, isRejected, isApproved, reapply } = useUserStatus();

  // 승인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!loading && isApproved) {
      router.push("/dashboard");
    }
  }, [loading, isApproved, router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("로그아웃 되었습니다.");
    router.push("/");
    router.refresh();
  };

  const handleReapply = async () => {
    const result = await reapply();
    if (result.error) {
      toast.error("재신청 실패: " + result.error);
    } else {
      toast.success("재신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isPending && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">⏳</span>
              </div>
              <CardTitle className="text-2xl text-yellow-700">승인 대기 중</CardTitle>
              <CardDescription>
                가입 신청이 완료되었습니다.<br />
                관리자의 승인을 기다려주세요.
              </CardDescription>
            </>
          )}
          {isRejected && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">❌</span>
              </div>
              <CardTitle className="text-2xl text-red-700">가입이 거절되었습니다</CardTitle>
              <CardDescription>
                {userStatus?.rejected_reason ? (
                  <>거절 사유: {userStatus.rejected_reason}</>
                ) : (
                  <>관리자에게 문의해주세요.</>
                )}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 사용자 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-500">가입 이메일</p>
            <p className="font-medium">{userStatus?.email}</p>
          </div>

          {/* 거절된 경우 재신청 버튼 */}
          {isRejected && (
            <Button
              onClick={handleReapply}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              다시 신청하기
            </Button>
          )}

          {/* 로그아웃 버튼 */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full"
          >
            로그아웃
          </Button>

          {/* 홈으로 돌아가기 */}
          <div className="text-center">
            <Link href="/" className="text-sm text-gray-500 hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

















