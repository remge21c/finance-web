"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface Group {
  id: string;
  name: string;
  description: string;
}

interface GroupSearchInputProps {
  value: string;
  onChange: (groupId: string) => void;
  placeholder?: string;
}

export default function GroupSearchInput({ value, onChange, placeholder = "그룹을 검색하세요..." }: GroupSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 선택된 그룹 정보 가져오기
  useEffect(() => {
    if (value) {
      const fetchSelectedGroup = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("finance_groups")
          .select("id, name, description")
          .eq("id", value)
          .maybeSingle();

        if (data) {
          setSelectedGroup(data);
        }
      };
      fetchSelectedGroup();
    } else {
      setSelectedGroup(null);
    }
  }, [value]);

  // 그룹 검색
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    const searchGroups = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("finance_groups")
        .select("id, name, description")
        .filter("name", "ilike", `%${searchQuery}%`)
        .order("name")
        .limit(10);

      console.log("그룹 검색:", searchQuery, "결과:", data, "에러:", error);

      if (data) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(searchGroups, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // 외부 클릭 시 결과 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    onChange(group.id);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const handleClear = () => {
    setSelectedGroup(null);
    onChange("");
    setSearchQuery("");
  };

  const handleInputFocus = () => {
    if (searchResults.length > 0 || searchQuery.trim().length > 0) {
      setShowResults(true);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery || selectedGroup?.name || ""}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pr-20"
        />
        {selectedGroup && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {showResults && (searchResults.length > 0 || searchQuery.trim().length > 0) && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="p-2">
              {searchResults.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-start space-x-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{group.name}</p>
                    {group.description && (
                      <p className="text-xs text-gray-500 truncate">{group.description}</p>
                    )}
                  </div>
                  {selectedGroup?.id === group.id && (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
