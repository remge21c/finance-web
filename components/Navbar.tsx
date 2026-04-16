"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import GroupSelector from "@/components/GroupSelector";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import {
  Wallet,
  Users,
  FolderOpen,
  Settings,
  LogOut,
  Shield,
  UserCircle,
  LayoutList,
  FileText,
  Menu,
  X,
} from "lucide-react";

interface NavbarProps {
  user: User;
  isSuperAdmin?: boolean;
  isFinanceAdmin?: boolean;
  appTitle?: string;
}

export default function Navbar({ user, isSuperAdmin = false, isFinanceAdmin = false, appTitle = "재정관리" }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { groups, currentGroup, setCurrentGroup, hasWritePermission } = useGroupContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("selectedGroupId");
    toast.success("로그아웃 되었습니다.");
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/dashboard", label: "재정출납부", icon: <Wallet className="h-4 w-4" /> },
    { href: "/dashboard/reports", label: "보고서", icon: <FileText className="h-4 w-4" /> },
    { href: "/dashboard/all", label: "전체목록", icon: <LayoutList className="h-4 w-4" /> },
    ...(hasWritePermission ? [{ href: "/dashboard/settings", label: "설정", icon: <Settings className="h-4 w-4" /> }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 bg-emerald-700 text-white shadow-lg border-b border-emerald-800">
      <div className="container mx-auto px-4">
        {/* 상단 바 */}
        <div className="flex items-center justify-between h-14">
          {/* 로고 */}
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight hover:opacity-90 transition-opacity">
              <div className="bg-emerald-600 rounded-lg p-1.5 border border-emerald-500">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline">{appTitle}</span>
            </Link>
          </div>

          {/* 데스크톱 네비게이션 링크 */}
          <div className="hidden md:flex items-center space-x-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-emerald-800 text-white"
                    : "text-emerald-100 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          {/* 사용자 메뉴 */}
          <div className="flex items-center gap-2">
            {/* 그룹 선택 (데스크톱) */}
            <div className="hidden sm:block">
              {groups.length > 0 || currentGroup ? (
                <GroupSelector
                  groups={groups}
                  currentGroup={currentGroup}
                  onGroupChange={setCurrentGroup}
                />
              ) : (
                <div className="px-3 py-1.5 text-xs text-emerald-300">
                  그룹 로딩 중...
                </div>
              )}
            </div>

            {/* 슈퍼/재정관리자 버튼 (데스크톱) */}
            <div className="hidden lg:flex items-center gap-2">
              {isSuperAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-emerald-600 border border-emerald-500/60 text-xs gap-1.5"
                    onClick={() => router.push("/admin/users")}
                  >
                    <Users className="h-3.5 w-3.5" />
                    사용자 관리
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-emerald-600 border border-emerald-500/60 text-xs gap-1.5"
                    onClick={() => router.push("/admin/groups")}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    그룹 관리
                  </Button>
                </>
              )}

              {isFinanceAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-emerald-600 border border-teal-500/60 text-xs gap-1.5"
                  onClick={() => router.push("/dashboard/finance/groups")}
                >
                  <Shield className="h-3.5 w-3.5" />
                  그룹 관리
                </Button>
              )}
            </div>

            {/* 사용자 액션 */}
            <div className="flex items-center gap-1">
              <span className="hidden lg:inline text-xs text-emerald-200 mr-1 max-w-[120px] truncate">
                {user.email}
              </span>

              <Link href="/dashboard/profile">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-100 hover:bg-emerald-600 hover:text-white h-8 w-8 p-0"
                  title="프로필 설정"
                >
                  <UserCircle className="h-4 w-4" />
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-100 hover:bg-emerald-600 hover:text-white h-8 w-8 p-0"
                onClick={handleLogout}
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </Button>

              {/* 모바일 햄버거 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-white hover:bg-emerald-600 h-8 w-8 p-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-emerald-600">
            {/* 그룹 선택 (모바일) */}
            <div className="mb-3 px-2">
              {groups.length > 0 || currentGroup ? (
                <GroupSelector
                  groups={groups}
                  currentGroup={currentGroup}
                  onGroupChange={setCurrentGroup}
                />
              ) : (
                <div className="px-3 py-1.5 text-xs text-emerald-300">
                  그룹 로딩 중...
                </div>
              )}
            </div>

            {/* 네비게이션 링크 */}
            <div className="space-y-1 px-2 mb-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-emerald-800 text-white"
                      : "text-emerald-100 hover:bg-emerald-600 hover:text-white"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>

            {/* 관리자 버튼 (모바일) */}
            <div className="flex flex-col gap-2 px-2 mb-3">
              {isSuperAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-emerald-600 border border-emerald-500/60 text-xs gap-2 justify-start"
                    onClick={() => {
                      router.push("/admin/users");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Users className="h-4 w-4" />
                    사용자 관리
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-emerald-600 border border-emerald-500/60 text-xs gap-2 justify-start"
                    onClick={() => {
                      router.push("/admin/groups");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <FolderOpen className="h-4 w-4" />
                    그룹 관리
                  </Button>
                </>
              )}

              {isFinanceAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-emerald-600 border border-teal-500/60 text-xs gap-2 justify-start"
                  onClick={() => {
                    router.push("/dashboard/finance/groups");
                    setMobileMenuOpen(false);
                  }}
                >
                  <Shield className="h-4 w-4" />
                  그룹 관리
                </Button>
              )}
            </div>

            {/* 사용자 이메일 (모바일) */}
            <div className="px-4 py-2 border-t border-emerald-600 text-xs text-emerald-200">
              {user.email}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
