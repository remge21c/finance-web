import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export const runtime = "nodejs";

/**
 * Google Picker 초기화용 짧은 수명 access_token 발급
 * - 슈퍼관리자만 호출 가능
 * - refresh_token 은 절대 응답에 포함하지 않음
 */
export async function GET(_request: NextRequest) {
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
  const { data: config } = await admin
    .from("finance_backup_config")
    .select("refresh_token")
    .eq("id", "singleton")
    .maybeSingle();

  if (!config?.refresh_token) {
    return NextResponse.json({ error: "Google Drive 가 연결되어 있지 않습니다.", code: "NO_TOKEN" }, { status: 412 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: config.refresh_token });

  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "토큰 발급 실패" }, { status: 500 });
    }
    // Google access_token 의 기본 수명은 약 3600초 (1시간)
    return NextResponse.json({ accessToken: token, expiresIn: 3600 });
  } catch (err: any) {
    const detail = err?.response?.data ?? err?.message ?? String(err);
    console.error("[picker-token] access token 발급 실패:", JSON.stringify(detail));
    return NextResponse.json({ error: "토큰 발급 실패", code: "TOKEN_FETCH_FAILED" }, { status: 500 });
  }
}
