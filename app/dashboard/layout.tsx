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
    .select("is_super_admin, is_finance_admin, status")
    .eq("user_id", user.id)
    .single();

  // 승인되지 않은 사용자는 pending 페이지로
  if (userStatus?.status !== "approved") {
    redirect("/pending");
  }

  const isSuperAdmin = userStatus?.is_super_admin || false;
  const isFinanceAdmin = userStatus?.is_finance_admin || false;

  // 설정 가져오기 (앱 타이틀)
  const { data: settings } = await supabase
    .from("finance_settings")
    .select("app_title")
    .limit(1)
    .single();

  const appTitle = settings?.app_title || "재정관리";

  // 재정관리자 또는 슈퍼관리자: 내가 관리하는 그룹의 대기 중 참여 요청 수
  let pendingRequestCount = 0;
  if (isSuperAdmin || isFinanceAdmin) {
    try {
      if (isSuperAdmin) {
        const { count } = await supabase
          .from("finance_group_join_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        pendingRequestCount = count || 0;
      } else {
        // 재정관리자: 자신이 생성한 그룹의 요청만
        const { data: myGroups } = await supabase
          .from("finance_groups")
          .select("id")
          .eq("created_by", user.id);
        if (myGroups?.length) {
          const groupIds = myGroups.map((g: any) => g.id);
          const { count } = await supabase
            .from("finance_group_join_requests")
            .select("*", { count: "exact", head: true })
            .in("group_id", groupIds)
            .eq("status", "pending");
          pendingRequestCount = count || 0;
        }
      }
    } catch {
      // 테이블이 없는 경우 무시
    }
  }

  return (
    <GroupProvider>
      <div className="min-h-screen bg-slate-50">
        <DataProvider>
          <Navbar user={user} isSuperAdmin={isSuperAdmin} isFinanceAdmin={isFinanceAdmin} appTitle={appTitle} pendingRequestCount={pendingRequestCount} />
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
