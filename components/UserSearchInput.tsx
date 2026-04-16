"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface User {
  id: string;
  user_id: string;
  email: string;
  name: string;
  status: string;
}

interface UserSearchInputProps {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
}

export default function UserSearchInput({ users, value, onChange, placeholder = "사용자 검색..." }: UserSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 선택된 사용자 정보 가져오기
  useEffect(() => {
    if (value) {
      const user = users.find(u => u.user_id === value);
      if (user) {
        setSelectedUser(user);
      }
    } else {
      setSelectedUser(null);
    }
  }, [value, users]);

  // 사용자 검색
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(query) ||
      (user.name && user.name.toLowerCase().includes(query))
    );

    setSearchResults(filtered);
  }, [searchQuery, users]);

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

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    onChange(user.user_id);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const handleClear = () => {
    setSelectedUser(null);
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
          value={searchQuery || selectedUser?.email || ""}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pr-20"
        />
        {selectedUser && (
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
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-start space-x-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{user.name || user.email}</p>
                    {user.name && (
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    )}
                  </div>
                  {selectedUser?.user_id === user.user_id && (
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
