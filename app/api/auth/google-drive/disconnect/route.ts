import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: status } = await supabase
    .from("finance_user_status")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!status?.is_super_admin) {
    return NextResponse.json({ error: "슈퍼관리자 권한이 필요합니다." }, { status: 403 });
  }

  const admin = createAdminClient();

  // 1) DB 에서 토큰 조회 + 삭제
  const { data: config } = await admin
    .from("finance_backup_config")
    .select("refresh_token")
    .eq("id", "singleton")
    .maybeSingle();

  await admin.from("finance_backup_config").delete().eq("id", "singleton");

  // 2) Google 측 revoke 시도 (실패해도 DB 는 이미 비웠으므로 무시)
  if (config?.refresh_token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: config.refresh_token }).toString(),
      });
    } catch {
      // 무시
    }
  }

  return NextResponse.json({ ok: true });
}
