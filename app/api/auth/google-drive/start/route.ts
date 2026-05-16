import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOAuth2ClientWithRedirect } from "@/lib/google/drive";

export const runtime = "nodejs";

const STATE_COOKIE = "google_oauth_state";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

export async function GET(request: NextRequest) {
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

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/google-drive/callback`;
  const nonce = crypto.randomUUID();

  const oauth2Client = buildOAuth2ClientWithRedirect(redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: nonce,
    include_granted_scopes: true,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google-drive",
    maxAge: 600, // 10분
  });
  return response;
}
