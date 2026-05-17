"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, AlertTriangle } from "lucide-react";

interface Group {
  id: string;
  name: string;
}

interface Props {
  connected: boolean;
  hasTargetFolder: boolean;
  lastBackupAt: string | null;
  lastBackupError: string | null;
  groups: Group[];
}

export default function BackupRunCard({
  connected,
  hasTargetFolder,
  lastBackupAt,
  lastBackupError,
  groups,
}: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    // 즉시 paint 되도록 다음 tick 에서 확인창 — INP 개선
    await new Promise((r) => setTimeout(r, 0));
    if (!confirm(`모든 그룹(${groups.length}개)을 지금 백업하시겠습니까?`)) {
      setRunning(false);
      return;
    }
    try {
      const res = await fetch("/api/backup/google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_TOKEN") {
          toast.error("Google Drive 가 연결되어 있지 않습니다.");
        } else if (data.code === "NO_TARGET_FOLDER") {
          toast.error("백업 폴더가 선택되지 않았습니다. 위에서 폴더를 선택하세요.");
        } else if (data.code === "INVALID_GRANT") {
          toast.error("Google 인증이 만료되었습니다. 재연결해주세요.");
        } else {
          toast.error(data.message || "백업 실패");
        }
        return;
      }
      toast.success(`백업 완료: 성공 ${data.succeeded}/${data.total}, 실패 ${data.failed}`);
      router.refresh();
    } catch {
      toast.error("백업 요청에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">백업 실행</CardTitle>
        <CardDescription className="text-xs">
          자동 백업은 매주 월요일 03:00 (KST) 에 실행됩니다. 즉시 백업이 필요하면 아래 버튼을 사용하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="text-sm space-y-1">
          <div>
            <span className="text-gray-500">마지막 백업: </span>
            <span className="text-gray-800">
              {lastBackupAt ? new Date(lastBackupAt).toLocaleString("ko-KR") : "기록 없음"}
            </span>
          </div>
          {lastBackupError && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="font-mono">{lastBackupError}</span>
            </div>
          )}
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-sm h-9"
          onClick={handleRun}
          disabled={!connected || !hasTargetFolder || running || groups.length === 0}
        >
          <Play className="h-4 w-4 mr-1.5" />
          {running ? "백업 중..." : `지금 전체 백업 (${groups.length}개 그룹)`}
        </Button>
        {!connected && (
          <p className="text-xs text-gray-400">먼저 Google 계정을 연결해주세요.</p>
        )}
        {connected && !hasTargetFolder && (
          <p className="text-xs text-gray-400">먼저 백업 폴더를 선택해주세요.</p>
        )}
      </CardContent>
    </Card>
  );
}
