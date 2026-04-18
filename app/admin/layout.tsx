import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { GroupProvider } from "@/lib/contexts/GroupContext";
import { Shield, Users, FolderOpen, ArrowLeft } from "lucide-react";

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

  if (!userStatus?.is_super_admin) {
    redirect("/dashboard");
  }

  return (
    <GroupProvider>
      <div className="min-h-screen bg-slate-50">
        {/* 관리자 네비게이션 */}
        <nav className="sticky top-0 z-50 bg-slate-800 text-white shadow-lg border-b border-slate-700">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <div className="bg-slate-700 rounded-lg p-1.5 border border-slate-600">
                    <Shield className="h-4 w-4 text-slate-200" />
                  </div>
                  <span className="text-slate-100">관리자</span>
                </div>
                <div className="w-px h-5 bg-slate-600" />
                <Link
                  href="/admin/users"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  사용자 관리
                </Link>
                <Link
                  href="/admin/groups"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  그룹 관리
                </Link>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                대시보드
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
