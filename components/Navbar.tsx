"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User;
  isSuperAdmin?: boolean;
  appTitle?: string;
}

export default function Navbar({ user, isSuperAdmin = false, appTitle = "재정관리" }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("로그아웃 되었습니다.");
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/dashboard", label: "재정출납부" },
    { href: "/dashboard/weekly", label: "주간보고서" },
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
            {isSuperAdmin && (
              <Link href="/admin/users">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-emerald-600 border border-emerald-400 text-sm"
                >
                  🔧 사용자 관리
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-emerald-600"
                >
                  {user.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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










