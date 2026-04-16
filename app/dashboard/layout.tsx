import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import { GroupProvider } from "@/lib/contexts/GroupContext";
import { DataProvider } from "@/lib/contexts/DataContext";

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

  // 사용자 상태 가져오기 (Super Admin, Finance Admin 여부)
  const { data: userStatus } = await supabase
    .from("finance_user_status")
    .select("is_super_admin, is_finance_admin, status, can_group_finance")
    .eq("user_id", user.id)
    .single();

  // 승인되지 않은 사용자는 pending 페이지로
  if (userStatus?.status !== "approved") {
    redirect("/pending");
  }

  // 설정 가져오기 (앱 타이틀) - 첫 번째 그룹의 설정을 가져옴
  const { data: settings } = await supabase
    .from("finance_settings")
    .select("app_title")
    .limit(1)
    .single();

  const isSuperAdmin = userStatus?.is_super_admin || false;
  const isFinanceAdmin = userStatus?.is_finance_admin || false;
  const appTitle = settings?.app_title || "재정관리";

  return (
    <GroupProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} isSuperAdmin={isSuperAdmin} isFinanceAdmin={isFinanceAdmin} appTitle={appTitle} />
        <DataProvider>
          <main className="container mx-auto px-4">
            <div className="pt-6">
              {children}
            </div>
          </main>
        </DataProvider>
      </div>
    </GroupProvider>
  );
}
