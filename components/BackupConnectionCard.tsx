"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link as LinkIcon, Unplug, CheckCircle2 } from "lucide-react";

interface Props {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
}

export default function BackupConnectionCard({ connected, googleEmail, connectedAt }: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const handleNavigateToStart = () => {
    setNavigating(true);
    // 로딩 상태가 먼저 paint 된 뒤 다음 tick 에서 네비게이션 → INP 개선
    setTimeout(() => {
      window.location.href = "/api/auth/google-drive/start";
    }, 0);
  };

  const handleDisconnect = async () => {
    if (!confirm("Google Drive 연결을 해제하시겠습니까?\n자동 백업이 중단됩니다.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google-drive/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("연결이 해제되었습니다.");
      router.refresh();
    } catch {
      toast.error("연결 해제에 실패했습니다.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">Google 계정 연결</CardTitle>
        <CardDescription className="text-xs">
          백업 파일이 저장될 Google Drive 계정입니다. 슈퍼관리자 본인의 계정을 연결하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-gray-700">연결됨</span>
              {googleEmail && (
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{googleEmail}</span>
              )}
            </div>
            {connectedAt && (
              <p className="text-xs text-gray-500">
                연결 시각: {new Date(connectedAt).toLocaleString("ko-KR")}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="text-xs h-8"
                onClick={handleNavigateToStart}
                disabled={navigating}
              >
                <LinkIcon className="h-3.5 w-3.5 mr-1" />
                다른 계정으로 재연결
              </Button>
              <Button
                variant="outline"
                className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                <Unplug className="h-3.5 w-3.5 mr-1" />
                {disconnecting ? "해제 중..." : "연결 해제"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              아직 Google Drive 계정이 연결되어 있지 않습니다.
            </p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-sm h-9"
              onClick={handleNavigateToStart}
              disabled={navigating}
            >
              <LinkIcon className="h-4 w-4 mr-1.5" />
              {navigating ? "이동 중..." : "Google 계정 연결하기"}
            </Button>
            <p className="text-xs text-gray-400">
              연결 시 Drive 의 finance-web 폴더에 파일을 만들 수 있는 권한만 요청합니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
