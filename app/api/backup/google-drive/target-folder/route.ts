import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { getDriveClient } from "@/lib/google/drive";

export const runtime = "nodejs";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다.", status: 401 as const, user: null };

  const { data: status } = await supabase
    .from("finance_user_status")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!status?.is_super_admin) {
    return { error: "슈퍼관리자 권한이 필요합니다.", status: 403 as const, user: null };
  }
  return { user, error: null, status: 200 as const };
}

/** 선택한 폴더 저장 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as { folder_id?: string; folder_name?: string };
  const folderId = (body.folder_id ?? "").trim();
  const folderName = (body.folder_name ?? "").trim();
  if (!folderId) {
    return NextResponse.json({ error: "folder_id 필수" }, { status: 400 });
  }

  // 검증: 실제 Drive 에 해당 폴더가 존재하며 폴더 타입인지 확인 (Picker 응답 위·변조 방어)
  // drive.file scope 한계로 검증 실패할 수 있음 — 실패 시 경고만 남기고 저장은 진행
  try {
    const drive = await getDriveClient();
    const file = await drive.files.get({ fileId: folderId, fields: "id,name,mimeType" });
    if (file.data.mimeType !== "application/vnd.google-apps.folder") {
      return NextResponse.json({ error: "선택한 항목이 폴더가 아닙니다." }, { status: 400 });
    }
  } catch (err: any) {
    const detail = err?.response?.data ?? err?.message ?? String(err);
    const detailStr = typeof detail === "string" ? detail : JSON.stringify(detail);
    // 검증 실패는 차단하지 않음 — 첫 백업 시 실제 접근성 검증됨
    console.warn("[target-folder POST] 폴더 검증 건너뜀:", detailStr);
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("finance_backup_config")
    .update({
      target_folder_id: folderId,
      target_folder_name: folderName || null,
      target_picked_at: new Date().toISOString(),
    })
    .eq("id", "singleton");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** 선택 해제 */
export async function DELETE(_request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("finance_backup_config")
    .update({
      target_folder_id: null,
      target_folder_name: null,
      target_picked_at: null,
    })
    .eq("id", "singleton");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
