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
import { ChevronDown, CheckCircle2 } from "lucide-react";
import type { Group } from "@/types/database";

interface GroupSelectorProps {
  groups: Group[];
  currentGroup: Group | null;
  onGroupChange: (group: Group) => void;
}

export default function GroupSelector({ groups, currentGroup, onGroupChange }: GroupSelectorProps) {
  const isLoading = !currentGroup && groups.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-between gap-1.5 text-emerald-100 hover:bg-emerald-600 hover:text-white border border-emerald-500/60 h-8 text-sm max-w-[160px]"
        >
          <span className="truncate">
            {isLoading ? "로딩 중..." : (currentGroup?.name || "그룹 선택")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel className="text-xs text-gray-500 font-medium">그룹 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-3 text-center text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : groups.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-gray-400">
            소속된 그룹이 없습니다
          </div>
        ) : (
          groups.map((group) => (
            <DropdownMenuItem
              key={group.id}
              onClick={() => onGroupChange(group)}
              className={`flex items-center justify-between cursor-pointer ${
                currentGroup?.id === group.id ? "bg-emerald-50 text-emerald-700" : ""
              }`}
            >
              <span className="truncate">{group.name}</span>
              {currentGroup?.id === group.id && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
