import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import JoinRequestNotifier from "@/components/JoinRequestNotifier";
import { GroupProvider } from "@/lib/contexts/GroupContext";
import { DataProvider } from "@/lib/contexts/DataContext";
import type { Group } from "@/types/database";

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

  // 사용자 상태 가져오기 (Super Admin 여부 + 우선 그룹)
  const { data: userStatus } = await supabase
    .from("finance_user_status")
    .select("is_super_admin, status, primary_group_id")
    .eq("user_id", user.id)
    .single();

  // 승인되지 않은 사용자는 pending 페이지로
  if (userStatus?.status !== "approved") {
    redirect("/pending");
  }

  const isSuperAdmin = userStatus?.is_super_admin || false;
  const primaryGroupId = userStatus?.primary_group_id || null;

  // 그룹 목록을 서버에서 미리 가져오기 — 첫 paint부터 우선 그룹 표시 가능
  let initialGroups: Group[] = [];
  if (isSuperAdmin) {
    const { data } = await supabase
      .from("finance_groups")
      .select("*")
      .order("created_at", { ascending: false });
    initialGroups = (data || []) as Group[];
  } else {
    const { data: memberData } = await supabase
      .from("finance_group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (memberData && memberData.length > 0) {
      const groupIds = memberData.map((m: { group_id: string }) => m.group_id);
      const { data: groupsData } = await supabase
        .from("finance_groups")
        .select("*")
        .in("id", groupIds);
      initialGroups = (groupsData || []) as Group[];
    }
  }

  // 초기 그룹 결정: 우선 그룹 → 첫 번째 그룹 순 (localStorage는 서버에서 접근 불가)
  const visibleInitialGroups = isSuperAdmin
    ? initialGroups
    : initialGroups.filter((g) => g.group_type === "department");
  let initialGroupId: string | null = null;
  if (primaryGroupId && visibleInitialGroups.some((g) => g.id === primaryGroupId)) {
    initialGroupId = primaryGroupId;
  } else if (visibleInitialGroups.length > 0) {
    initialGroupId = visibleInitialGroups[0].id;
  }

  // 초기 그룹의 설정 (앱 타이틀)을 가져와 첫 paint부터 올바른 타이틀 표시
  let appTitle = "재정관리";
  if (initialGroupId) {
    const { data: settings } = await supabase
      .from("finance_settings")
      .select("app_title")
      .eq("group_id", initialGroupId)
      .maybeSingle();
    if (settings?.app_title) appTitle = settings.app_title;
  }

  // 최고관리자: 모든 그룹의 대기 중 참여 요청 수
  let pendingRequestCount = 0;
  if (isSuperAdmin) {
    try {
      const { count } = await supabase
        .from("finance_group_join_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      pendingRequestCount = count || 0;
    } catch {
      // 테이블이 없는 경우 무시
    }
  }

  return (
    <GroupProvider
      initialGroups={initialGroups}
      initialPrimaryGroupId={primaryGroupId}
      initialIsSuperAdmin={isSuperAdmin}
      initialUserId={user.id}
    >
      <div className="min-h-screen bg-slate-50">
        <DataProvider>
          <JoinRequestNotifier />
          <Navbar user={user} isSuperAdmin={isSuperAdmin} appTitle={appTitle} pendingRequestCount={pendingRequestCount} />
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
