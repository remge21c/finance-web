import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { GroupProvider } from "@/lib/contexts/GroupContext";
import { Users, FolderOpen, ArrowLeft, Shield, Cloud } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userStatus } = await supabase
    .from("finance_user_status")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSuperAdmin = userStatus?.is_super_admin || false;

  // 그룹 관리자 확인 + 관리 그룹명 수집
  let isGroupAdmin = false;
  let adminGroupNames: string[] = [];
  if (!isSuperAdmin) {
    const { data: adminMemberships } = await supabase
      .from("finance_group_members")
      .select("id, finance_groups(name)")
      .eq("user_id", user.id)
      .or("permission_level.eq.admin,role.eq.admin,role.eq.owner");
    if (adminMemberships && adminMemberships.length > 0) {
      isGroupAdmin = true;
      adminGroupNames = adminMemberships
        .map((m: any) => m.finance_groups?.name)
        .filter(Boolean);
    }
  }

  // proxy.ts에서 이미 권한 체크를 하므로, 여기까지 온 사용자는 접근 권한이 있음
  if (!isSuperAdmin && !isGroupAdmin) {
    redirect("/dashboard");
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  const navLink = (href: string, active: boolean, children: React.ReactNode) => (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-slate-600 text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );

  return (
    <GroupProvider>
      <div className="min-h-screen bg-slate-50">
        {/* 관리자 네비게이션 */}
        <nav className="sticky top-0 z-50 bg-slate-800 text-white shadow-lg border-b border-slate-700">
          <div className="container mx-auto px-4">
            {/* 1행: 타이틀 + 대시보드 버튼 */}
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center gap-2 font-bold">
                <Shield className="h-7 w-7 text-emerald-400" />
                <span className="text-slate-100 text-base">
                  {isSuperAdmin
                    ? "관리자"
                    : adminGroupNames.length > 0
                      ? `${adminGroupNames.join(", ")} 그룹 관리`
                      : "그룹 관리"}
                </span>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                대시보드
              </Link>
            </div>
            {/* 2행: 메뉴 탭 - 최고관리자만 표시 (그룹관리자는 페이지가 하나뿐이므로 탭 불필요) */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1 pb-2">
                {navLink("/admin/users", pathname.startsWith("/admin/users"), (
                  <>
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    사용자 관리
                  </>
                ))}
                {navLink("/admin/groups", pathname.startsWith("/admin/groups"), (
                  <>
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    그룹 생성/관리
                  </>
                ))}
                {navLink("/admin/backup", pathname.startsWith("/admin/backup"), (
                  <>
                    <Cloud className="h-3.5 w-3.5 shrink-0" />
                    백업 설정
                  </>
                ))}
              </div>
            )}
          </div>
        </nav>
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </GroupProvider>
  );
}
