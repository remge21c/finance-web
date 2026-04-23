"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import GroupSelector from "@/components/GroupSelector";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { useDataContext } from "@/lib/contexts/DataContext";
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
  Building2,
} from "lucide-react";
import Image from "next/image";

interface NavbarProps {
  user: User;
  isSuperAdmin?: boolean;
  appTitle?: string;
  pendingRequestCount?: number;
}

export default function Navbar({ user, isSuperAdmin = false, appTitle = "재정관리", pendingRequestCount = 0 }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { groups, currentGroup, setCurrentGroup, hasWritePermission, currentPermissionLevel, loading } = useGroupContext();

  // 그룹 관리 권한: 슈퍼관리자 또는 그룹 관리자만
  const hasGroupAdminPermission = isSuperAdmin || currentPermissionLevel === 'admin';
  const { settings } = useDataContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayTitle = settings?.app_title || appTitle;

  // 그룹 승인 대기 체크 (슈퍼관리자 제외)
  const isPendingGroup = !isSuperAdmin && !loading && groups.length === 0;

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
    ...(hasGroupAdminPermission ? [{ href: "/dashboard/settings", label: "설정", icon: <Settings className="h-4 w-4" /> }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 bg-emerald-700 text-white shadow-lg border-b border-emerald-800">
      <div className="container mx-auto px-4">
        {/* 상단 바 */}
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 font-bold tracking-tight hover:opacity-90 transition-opacity">
              <Building2 className="h-8 w-8 text-emerald-100" />
              <span className="text-base sm:text-lg truncate max-w-[140px] sm:max-w-none">{displayTitle}</span>
            </Link>
          </div>

          {/* 데스크톱 네비게이션 링크 */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              
              if (isPendingGroup) {
                return (
                  <button
                    key={link.href}
                    onClick={() => toast.warning("소속된 그룹이 없습니다. 관리자의 승인을 기다려주세요.")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors text-emerald-300/50 cursor-not-allowed"
                  >
                    {link.icon}
                    {link.label}
                  </button>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-800 text-white"
                      : "text-emerald-100 hover:bg-emerald-600 hover:text-white"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
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
                  그룹 없음
                </div>
              )}
            </div>

            {/* 관리자 버튼 (데스크톱) */}
            <div className="hidden lg:flex items-center gap-2">
              {(isSuperAdmin || currentPermissionLevel === "admin") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-emerald-600 border border-emerald-500/60 text-sm gap-2"
                  onClick={() => router.push("/admin/users")}
                >
                  <Shield className="h-4 w-4" />
                  {isSuperAdmin ? "전체 관리" : "소속그룹 관리"}
                </Button>
              )}
            </div>

            {/* 사용자 액션 */}
            <div className="flex items-center gap-1">
              <span className="hidden lg:inline text-sm text-emerald-200 mr-2 max-w-[140px] truncate">
                {user.email}
              </span>

              <Link href={pendingRequestCount > 0 ? "/admin/users" : "/dashboard/profile"} className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-100 hover:bg-emerald-600 hover:text-white h-10 w-10 p-0"
                  title={pendingRequestCount > 0 ? `그룹 참여 요청 ${pendingRequestCount}건` : "프로필 설정"}
                >
                  <UserCircle className="h-5 w-5" />
                  {pendingRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-5 flex items-center justify-center px-1.5 leading-none">
                      {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                    </span>
                  )}
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-100 hover:bg-emerald-600 hover:text-white h-10 w-10 p-0"
                onClick={handleLogout}
                title="로그아웃"
              >
                <LogOut className="h-5 w-5" />
              </Button>

              {/* 모바일 햄버거 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-white hover:bg-emerald-600 h-10 w-10 p-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
                  그룹 없음
                </div>
              )}
            </div>

            {/* 네비게이션 링크 */}
            <div className="space-y-1 px-3 mb-3">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;

                if (isPendingGroup) {
                  return (
                    <button
                      key={link.href}
                      onClick={() => {
                        toast.warning("소속된 그룹이 없습니다. 관리자의 승인을 기다려주세요.");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-md text-base font-medium transition-colors min-h-[48px] text-emerald-300/40 w-full text-left cursor-not-allowed"
                    >
                      {link.icon}
                      {link.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-base font-medium transition-colors min-h-[48px] ${
                      isActive
                        ? "bg-emerald-800 text-white"
                        : "text-emerald-100 hover:bg-emerald-600 hover:text-white"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* 관리자 버튼 (모바일) */}
            <div className="flex flex-col gap-2 px-3 mb-3">
              {(isSuperAdmin || currentPermissionLevel === "admin") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-emerald-600 border border-emerald-500/60 text-sm gap-2 justify-start h-11 px-4"
                  onClick={() => {
                    router.push("/admin/users");
                    setMobileMenuOpen(false);
                  }}
                >
                  <Shield className="h-5 w-5" />
                  {isSuperAdmin ? "전체 관리" : "소속그룹 관리"}
                </Button>
              )}
            </div>

            {/* 사용자 이메일 (모바일) */}
            <div className="px-4 py-3 border-t border-emerald-600 text-sm text-emerald-200">
              {user.email}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
