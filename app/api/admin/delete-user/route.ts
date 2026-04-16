import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export async function DELETE(request: NextRequest) {
  try {
    // 1. 요청자가 슈퍼관리자인지 서버에서 검증
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: requesterStatus } = await supabase
      .from("finance_user_status")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!requesterStatus?.is_super_admin) {
      return NextResponse.json({ error: "슈퍼관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 2. 삭제할 대상 user_id 파싱
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    }

    // 3. 자기 자신 삭제 방지
    if (userId === user.id) {
      return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });
    }

    // 4. 대상이 슈퍼관리자인지 확인 (슈퍼관리자는 삭제 불가)
    const { data: targetStatus } = await supabase
      .from("finance_user_status")
      .select("is_super_admin, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetStatus?.is_super_admin) {
      return NextResponse.json({ error: "슈퍼관리자 계정은 삭제할 수 없습니다." }, { status: 400 });
    }

    // 5. 서비스 롤 클라이언트로 auth.users에서 삭제 (cascade로 finance_user_status 등 자동 삭제)
    const adminClient = createAdminClient();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[delete-user] auth.admin.deleteUser error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[delete-user] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
