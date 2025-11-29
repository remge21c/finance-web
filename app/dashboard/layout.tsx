import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";

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

  const isSuperAdmin = userStatus?.is_super_admin || false;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} isSuperAdmin={isSuperAdmin} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
