"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import GroupSelector from "@/components/GroupSelector";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { Shield } from "lucide-react";

interface NavbarProps {
  user: User;
  isSuperAdmin?: boolean;
  isFinanceAdmin?: boolean;
  appTitle?: string;
}

export default function Navbar({ user, isSuperAdmin = false, isFinanceAdmin = false, appTitle = "재정관리" }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { groups, currentGroup, setCurrentGroup } = useGroupContext();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // 로그아웃 시 선택한 그룹 ID 삭제
    localStorage.removeItem("selectedGroupId");
    toast.success("로그아웃 되었습니다.");
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/dashboard", label: "재정출납부" },
    { href: "/dashboard/reports", label: "보고서" },
    { href: "/dashboard/all", label: "전체목록" },
    { href: "/dashboard/settings", label: "설정" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-emerald-700 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* 로고 */}
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="font-bold text-lg">
              💰 {appTitle}
            </Link>
          </div>

          {/* 네비게이션 링크 */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-emerald-800 text-white"
                    : "text-emerald-100 hover:bg-emerald-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* 사용자 메뉴 */}
          <div className="flex items-center space-x-2">
            {/* 그룹 선택 */}
            {groups.length > 0 || currentGroup ? (
              <GroupSelector
                groups={groups}
                currentGroup={currentGroup}
                onGroupChange={setCurrentGroup}
              />
            ) : (
              <div className="px-3 py-1.5 text-sm text-gray-400">
                그룹 로딩 중...
              </div>
            )}

            {isSuperAdmin && (
              <>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-emerald-600 border border-emerald-400 text-sm"
                  onClick={() => router.push("/admin/users")}
                >
                  🔧 사용자 관리
                </Button>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-emerald-600 border border-emerald-400 text-sm"
                  onClick={() => router.push("/admin/groups")}
                >
                  📁 그룹 관리
                </Button>
              </>
            )}

            {/* 재정관리자 그룹 관리 */}
            {isFinanceAdmin && (
              <Button
                variant="ghost"
                className="text-white hover:bg-emerald-600 border border-teal-400 text-sm"
                onClick={() => router.push("/dashboard/finance/groups")}
              >
                <Shield className="h-4 w-4 mr-1" />
                그룹 관리
              </Button>
            )}
            <div className="flex items-center space-x-1 ml-2 border-l border-emerald-600 pl-4">
              <span className="hidden lg:inline text-sm text-emerald-100 mr-2">
                {user.email}
              </span>

              <Link href="/dashboard/profile">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-emerald-600 h-9 px-2"
                  title="정보수정"
                >
                  <span className="text-xl">⚙️</span>
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-emerald-600 h-9 px-2"
                onClick={handleLogout}
                title="로그아웃"
              >
                <span className="text-xl">🚪</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 모바일 네비게이션 */}
        <div className="md:hidden pb-2">
          <div className="flex space-x-1 overflow-x-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  pathname === link.href
                    ? "bg-emerald-800 text-white"
                    : "text-emerald-100 hover:bg-emerald-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
