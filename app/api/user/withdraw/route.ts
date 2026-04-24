import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export async function POST(request: NextRequest) {
  try {
    // 1. 현재 사용자 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 2. 슈퍼관리자인지 확인 (슈퍼관리자는 직접 탈퇴 불가 - 시스템 안전을 위해)
    const { data: userStatus } = await supabase
      .from("finance_user_status")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userStatus?.is_super_admin) {
      return NextResponse.json({ 
        error: "슈퍼관리자 계정은 직접 탈퇴할 수 없습니다. 다른 관리자에게 권한을 위임하거나 고객센터에 문의하세요." 
      }, { status: 403 });
    }

    // 3. 서비스 롤 클라이언트로 auth.users에서 삭제
    // auth.admin.deleteUser 호출 시 cascade 설정에 의해 관련 테이블(finance_user_status, 멤버 등)이 자동 삭제됩니다.
    const adminClient = createAdminClient();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("[user-withdraw] auth.admin.deleteUser error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 4. 로그아웃 처리 (클라이언트에서도 처리되겠지만 서버 세션 무효화)
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: "회원 탈퇴가 완료되었습니다." });
  } catch (err: any) {
    console.error("[user-withdraw] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
