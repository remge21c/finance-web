import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { buildOAuth2ClientWithRedirect } from "@/lib/google/drive";

export const runtime = "nodejs";

const STATE_COOKIE = "google_oauth_state";

function redirectWithError(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/admin/backup?error=${code}`);
}

function decodeIdTokenEmail(idToken: string | null | undefined): string | null {
  if (!idToken) return null;
  try {
    const parts = idToken.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );
    return typeof payload?.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectWithError(origin, oauthError);
  }
  if (!code || !state) {
    return redirectWithError(origin, "missing_params");
  }

  const storedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return redirectWithError(origin, "state_mismatch");
  }

  // 로그인 + 슈퍼관리자 검증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirectWithError(origin, "unauthenticated");
  }
  const { data: status } = await supabase
    .from("finance_user_status")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!status?.is_super_admin) {
    return redirectWithError(origin, "forbidden");
  }

  // Google 토큰 교환
  const redirectUri = `${origin}/api/auth/google-drive/callback`;
  const oauth2Client = buildOAuth2ClientWithRedirect(redirectUri);

  let tokens;
  try {
    const res = await oauth2Client.getToken(code);
    tokens = res.tokens;
  } catch {
    return redirectWithError(origin, "token_exchange_failed");
  }

  if (!tokens.refresh_token) {
    // 이미 동의한 적이 있는 사용자 — Google 이 refresh_token 을 생략. 재연결 안내.
    return redirectWithError(origin, "no_refresh_token");
  }

  const googleEmail = decodeIdTokenEmail(tokens.id_token);

  // service_role 로 DB 저장 (트리거가 connected_by 를 auth.uid() 로 세팅하므로 supabase 서버 client 가 적합하나,
  // singleton row 의 upsert 를 위해 admin 사용. connected_by 는 별도로 user.id 명시)
  const admin = createAdminClient();
  const { error: upsertError } = await admin
    .from("finance_backup_config")
    .upsert(
      {
        id: "singleton",
        refresh_token: tokens.refresh_token,
        google_email: googleEmail,
        scope: tokens.scope ?? null,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        last_backup_error: null,
      },
      { onConflict: "id" },
    );

  if (upsertError) {
    return redirectWithError(origin, "db_save_failed");
  }

  const response = NextResponse.redirect(`${origin}/admin/backup?google=connected`);
  // 상태 쿠키 제거
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    path: "/api/auth/google-drive",
    maxAge: 0,
  });
  return response;
}
