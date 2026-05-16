"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Cloud, ExternalLink, Play, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  groupId: string;
  groupName: string;
}

interface LatestLog {
  id: string;
  status: "success" | "failure";
  trigger_type: "manual" | "cron";
  file_name: string | null;
  web_view_link: string | null;
  error_message: string | null;
  created_at: string;
}

export default function GroupBackupStatus({ groupId, groupName }: Props) {
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [latest, setLatest] = useState<LatestLog | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: status } = await supabase
      .from("finance_user_status")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .maybeSingle();
    setIsSuperAdmin(!!status?.is_super_admin);

    const { data: log } = await supabase
      .from("finance_backup_log")
      .select("id, status, trigger_type, file_name, web_view_link, error_message, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((log as LatestLog) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [groupId]);

  const handleRun = async () => {
    if (!confirm(`'${groupName}' 그룹을 지금 백업하시겠습니까?`)) return;
    setRunning(true);
    try {
      const res = await fetch("/api/backup/google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_TOKEN") toast.error("Google Drive 가 연결되어 있지 않습니다.");
        else if (data.code === "INVALID_GRANT") toast.error("Google 인증 만료. 재연결이 필요합니다.");
        else toast.error(data.message || "백업 실패");
        return;
      }
      if (data.failed > 0) {
        toast.warning(`백업 부분 실패: ${data.succeeded}/${data.total}`);
      } else {
        toast.success("백업이 완료되었습니다.");
      }
      await load();
    } catch {
      toast.error("백업 요청에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Cloud className="h-4 w-4 text-emerald-600" />
          Google Drive 백업 상태
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 space-y-2">
        {loading ? (
          <p className="text-xs text-gray-400">불러오는 중...</p>
        ) : latest ? (
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              {latest.status === "success" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  성공
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-700">
                  <XCircle className="h-3.5 w-3.5" />
                  실패
                </span>
              )}
              <span className="text-gray-500">
                {latest.trigger_type === "cron" ? "자동" : "수동"}
              </span>
              <span className="text-gray-600">
                {new Date(latest.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
            {latest.web_view_link && (
              <a
                href={latest.web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                {latest.file_name ?? "Drive 에서 열기"}
              </a>
            )}
            {latest.error_message && (
              <p className="text-xs text-red-600 break-words">{latest.error_message}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">아직 백업 이력이 없습니다.</p>
        )}

        {isSuperAdmin && (
          <Button
            variant="outline"
            className="text-xs h-8 mt-2"
            onClick={handleRun}
            disabled={running}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {running ? "백업 중..." : "이 그룹 지금 백업"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
