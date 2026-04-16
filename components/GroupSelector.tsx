"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { Group } from "@/types/database";

interface GroupSelectorProps {
  groups: Group[];
  currentGroup: Group | null;
  onGroupChange: (group: Group) => void;
}

export default function GroupSelector({ groups, currentGroup, onGroupChange }: GroupSelectorProps) {
  // 로딩 상태 확인
  const isLoading = !currentGroup && groups.length === 0;

  // 그룹이 1개인 경우 드롭다운 없이 텍스트만 표시
  if (!isLoading && groups.length === 1 && currentGroup) {
    return (
      <div className="px-3 py-1.5 bg-white text-gray-800 rounded-md border border-gray-200 min-w-[200px]">
        <span className="truncate font-medium">{currentGroup.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between min-w-[200px]">
          <span className="truncate">
            {isLoading ? "그룹 로딩 중..." : (currentGroup?.name || "그룹 선택")}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuLabel>그룹 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-4 text-center text-sm text-gray-500">
            그룹을 불러오는 중...
          </div>
        ) : groups.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-gray-500">
            소속된 그룹이 없습니다
          </div>
        ) : (
          groups.map((group) => (
            <DropdownMenuItem
              key={group.id}
              onClick={() => onGroupChange(group)}
              className={currentGroup?.id === group.id ? "bg-accent" : ""}
            >
              <span className="truncate">{group.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
