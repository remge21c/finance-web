"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, AlertCircle, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface PendingRequestInfo {
  group_name: string;
  requested_at: string;
}

export default function NoGroupAvailable() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequestInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchPending() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }

      const { data } = await supabase
        .from("finance_group_join_requests")
        .select("requested_at, finance_groups(name)")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

      if (data) {
        setPendingRequests(data.map((r: any) => ({
          group_name: r.finance_groups?.name || "알 수 없는 그룹",
          requested_at: r.requested_at,
        })));
      }
      setLoaded(true);
    }
    fetchPending();
  }, []);

  if (!loaded) return null;

  const hasPending = pendingRequests.length > 0;

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-gray-700">
            {hasPending ? (
              <Clock className="h-6 w-6 text-orange-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500" />
            )}
            <span>{hasPending ? "그룹 승인 대기 중" : "그룹이 없습니다"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPending ? (
            <>
              <p className="text-gray-600">
                아래 그룹의 참여 요청이 관리자 승인을 기다리고 있습니다.
                <br />
                승인이 완료되면 자동으로 접근할 수 있습니다.
              </p>
              <div className="space-y-2">
                {pendingRequests.map((req, i) => (
                  <div key={i} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-800">{req.group_name}</span>
                    </div>
                    <span className="text-xs text-orange-500">승인 대기</span>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/profile">
                <Button variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-50">
                  <Users className="h-4 w-4 mr-2" />
                  추가 그룹 요청하기
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                현재 소속된 그룹이 없습니다.
                <br />
                아래 버튼을 눌러 참여할 그룹을 요청해주세요.
              </p>
              <Link href="/dashboard/profile">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <Users className="h-4 w-4 mr-2" />
                  프로필에서 그룹 요청하기
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">그룹이란?</p>
                <p className="text-blue-700">
                  그룹은 부서나 팀 단위로 재정을 관리하는 공간입니다.
                  관리자가 승인하면 해당 그룹의 재정 데이터를 확인하고
                  권한에 따라 입력/수정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
