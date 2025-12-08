import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";

// 매 요청마다 새로 렌더링 (설정 변경 반영)
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 사용자 상태 가져오기 (Super Admin 여부)
  const { data: userStatus } = await supabase
    .from("finance_user_status")
    .select("is_super_admin, status")
    .eq("user_id", user.id)
    .single();

  // 승인되지 않은 사용자는 pending 페이지로
  if (userStatus?.status !== "approved") {
    redirect("/pending");
  }

  // 설정 가져오기 (앱 타이틀)
  const { data: settings } = await supabase
    .from("finance_settings")
    .select("app_title")
    .eq("user_id", user.id)
    .single();

  const isSuperAdmin = userStatus?.is_super_admin || false;
  const appTitle = settings?.app_title || "재정관리";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} isSuperAdmin={isSuperAdmin} appTitle={appTitle} />
      <main className="container mx-auto px-4">
        <div className="pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
