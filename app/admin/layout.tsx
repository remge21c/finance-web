import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { GroupProvider } from "@/lib/contexts/GroupContext";

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

  // Super Admin 확인
  const { data: userStatus } = await supabase
    .from("finance_user_status")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!userStatus?.is_super_admin) {
    redirect("/dashboard");
  }

  return (
    <GroupProvider>
      <div className="min-h-screen bg-gray-50">
        {/* 관리자 네비게이션 */}
        <nav className="sticky top-0 z-50 bg-slate-800 text-white shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center space-x-4">
                <Link href="/admin/users" className="font-bold text-lg text-white">
                  🔧 관리자
                </Link>
                <span className="text-slate-500">|</span>
                <Link
                  href="/admin/users"
                  className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  사용자 관리
                </Link>
                <Link
                  href="/admin/groups"
                  className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  그룹 관리
                </Link>
              </div>
              <Link
                href="/dashboard"
                className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                ← 대시보드
              </Link>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </GroupProvider>
  );
}
