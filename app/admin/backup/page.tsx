import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BackupConnectionCard from "@/components/BackupConnectionCard";
import BackupRunCard from "@/components/BackupRunCard";
import BackupHistoryTable from "@/components/BackupHistoryTable";
import { Cloud } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminBackupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; google?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: status } = await supabase
    .from("finance_user_status")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!status?.is_super_admin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const { data: config } = await admin
    .from("finance_backup_config")
    .select("google_email, connected_at, last_backup_at, last_backup_error")
    .eq("id", "singleton")
    .maybeSingle();

  const { data: groups } = await admin
    .from("finance_groups")
    .select("id, name")
    .eq("group_type", "department")
    .order("name");

  // 그룹별 최근 백업 1건
  const { data: recentLogs } = await admin
    .from("finance_backup_log")
    .select("id, group_id, trigger_type, status, file_name, web_view_link, error_message, created_at, rotated_deleted")
    .order("created_at", { ascending: false })
    .limit(50);

  const params = await searchParams;
  const errorCode = params.error;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cloud className="h-6 w-6 text-emerald-600" />
        <h1 className="text-xl font-bold">Google Drive 백업 설정</h1>
      </div>

      {errorCode && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 px-4 text-sm text-red-700">
            연결 실패: <span className="font-mono">{errorCode}</span>
            {errorCode === "no_refresh_token" && (
              <div className="mt-1 text-xs">
                Google 에서 이전 동의가 남아있어 refresh_token 이 발급되지 않았습니다.
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline ml-1"
                >
                  Google 계정 권한 페이지
                </a>
                에서 이 앱을 제거한 후 다시 시도하세요.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {params.google === "connected" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 px-4 text-sm text-emerald-700">
            Google Drive 가 성공적으로 연결되었습니다.
          </CardContent>
        </Card>
      )}

      <BackupConnectionCard
        connected={!!config}
        googleEmail={config?.google_email ?? null}
        connectedAt={config?.connected_at ?? null}
      />

      <BackupRunCard
        connected={!!config}
        lastBackupAt={config?.last_backup_at ?? null}
        lastBackupError={config?.last_backup_error ?? null}
        groups={groups ?? []}
      />

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">백업 이력</CardTitle>
          <CardDescription className="text-xs">
            매주 월요일 03:00 KST 에 자동으로 모든 그룹을 백업합니다. 그룹 폴더에는 최신 3개 파일만 유지됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <BackupHistoryTable
            groups={groups ?? []}
            logs={recentLogs ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
