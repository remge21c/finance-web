import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runBackup } from "@/lib/google/backup";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
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

  let body: { group_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body 없으면 전체 백업
  }

  const summary = await runBackup({
    groupId: body.group_id,
    trigger: "manual",
    triggeredBy: user.id,
  });

  if (summary.fatalError) {
    const noPrereq = summary.fatalError.code === "NO_TOKEN" || summary.fatalError.code === "NO_TARGET_FOLDER";
    const httpStatus = noPrereq ? 412 : 500;
    return NextResponse.json(
      { ok: false, code: summary.fatalError.code, message: summary.fatalError.message },
      { status: httpStatus },
    );
  }

  return NextResponse.json({ ok: true, ...summary });
}
