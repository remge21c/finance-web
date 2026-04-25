"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GroupSearchInput from "@/components/GroupSearchInput";
import { toast } from "sonner";
import type { GroupJoinRequest } from "@/types/database";

interface GroupInfo {
  id: string;
  name: string;
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null);

  const [myGroups, setMyGroups] = useState<GroupInfo[]>([]);
  const [joinRequests, setJoinRequests] = useState<(GroupJoinRequest & { group_name: string })[]>([]);
  const [requestGroupId, setRequestGroupId] = useState("");
  const [requestingGroup, setRequestingGroup] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    setEmail(user.email || "");

    const { data: statusData } = await supabase
      .from("finance_user_status")
      .select("name, primary_group_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (statusData) {
      setName(statusData.name || "");
      setPrimaryGroupId(statusData.primary_group_id || null);
    }

    // 현재 소속 그룹
    const { data: memberData } = await supabase
      .from("finance_group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (memberData?.length) {
      const ids = memberData.map((m: any) => m.group_id);
      const { data: groupsData } = await supabase
        .from("finance_groups")
        .select("id, name")
        .in("id", ids)
        .eq("group_type", "department");
      setMyGroups((groupsData || []) as GroupInfo[]);
    } else {
      setMyGroups([]);
    }

    // 그룹 참여 요청 목록
    const { data: requestData } = await supabase
      .from("finance_group_join_requests")
      .select("*, finance_groups(name)")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false });

    if (requestData) {
      setJoinRequests(requestData.map((r: any) => ({
        ...r,
        group_name: r.finance_groups?.name || r.group_id,
      })));
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("이름을 입력해주세요."); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();

      const { error } = await supabase
        .from("finance_user_status")
        .update({ name })
        .eq("user_id", user.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { name } });

      if (newPassword.trim()) {
        if (!confirmPassword.trim()) { toast.error("비밀번호 확인을 입력해주세요."); setSaving(false); return; }
        if (newPassword !== confirmPassword) { toast.error("비밀번호가 일치하지 않습니다."); setSaving(false); return; }
        if (newPassword.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); setSaving(false); return; }
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) throw pwError;
      }

      setNewPassword(""); setConfirmPassword("");
      toast.success("정보가 업데이트되었습니다.");
      router.push("/dashboard");
    } catch {
      toast.error("업데이트에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestGroup = async () => {
    if (!requestGroupId) return;
    if (myGroups.some(g => g.id === requestGroupId)) {
      toast.warning("이미 소속된 그룹입니다."); return;
    }
    if (joinRequests.some(r => r.group_id === requestGroupId && r.status === "pending")) {
      toast.warning("이미 요청 중인 그룹입니다."); return;
    }
    setRequestingGroup(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();

      const { error } = await supabase
        .from("finance_group_join_requests")
        .upsert({ user_id: user.id, group_id: requestGroupId, status: "pending", requested_at: new Date().toISOString() }, { onConflict: "user_id,group_id" });

      if (error) throw error;
      toast.success("그룹 참여 요청이 전송되었습니다. 관리자 승인 후 반영됩니다.");
      setRequestGroupId("");
      await loadData();
    } catch {
      toast.error("그룹 요청에 실패했습니다.");
    } finally {
      setRequestingGroup(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("finance_group_join_requests")
        .delete()
        .eq("id", requestId);
      if (error) throw error;
      toast.success("요청이 취소되었습니다.");
      await loadData();
    } catch {
      toast.error("요청 취소에 실패했습니다.");
    }
  };

  const handleSetPrimaryGroup = async (groupId: string) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newPrimaryId = primaryGroupId === groupId ? null : groupId;
      
      const { error } = await supabase
        .from("finance_user_status")
        .update({ primary_group_id: newPrimaryId })
        .eq("user_id", user.id);
        
      if (error) throw error;
      setPrimaryGroupId(newPrimaryId);
      toast.success(newPrimaryId ? "우선 접속 그룹이 설정되었습니다." : "우선 접속 그룹 설정이 해제되었습니다.");
    } catch {
      toast.error("우선 그룹 설정에 실패했습니다.");
    }
  };

  const statusLabel = (status: string) => {
    if (status === "pending") return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">대기 중</span>;
    if (status === "approved") return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">승인됨</span>;
    return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">거절됨</span>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">정보를 불러오는 중...</div></div>;
  }

  return (
    <div className="max-w-md mx-auto py-6 sm:py-8 space-y-3 sm:space-y-4 px-3">
      {/* 기본 정보 수정 */}
      <Card>
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">정보 수정</CardTitle>
          <CardDescription className="text-xs sm:text-sm">이름과 비밀번호를 변경할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <form onSubmit={handleUpdateProfile} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">이메일</Label>
              <Input value={email} disabled className="bg-gray-50 text-xs sm:text-sm h-9 sm:h-10" />
              <p className="text-xs text-gray-400">이메일은 변경할 수 없습니다.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm">이름</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" required className="h-9 sm:h-10 text-xs sm:text-sm" />
            </div>
            <div className="pt-3 sm:pt-4 border-t border-gray-100">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4">비밀번호 변경 (선택사항)</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs sm:text-sm">새 비밀번호</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6자 이상 입력" autoComplete="new-password" className="h-9 sm:h-10 text-xs sm:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs sm:text-sm">새 비밀번호 확인</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호 재입력" autoComplete="new-password" className="h-9 sm:h-10 text-xs sm:text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-3 sm:pt-4">
              <Button type="button" variant="outline" className="flex-1 text-xs sm:text-sm" onClick={() => router.back()} disabled={saving}>취소</Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm" disabled={saving}>{saving ? "저장 중..." : "저장하기"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 소속 그룹 & 요청 */}
      <Card>
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">소속 그룹</CardTitle>
          <CardDescription className="text-xs sm:text-sm">현재 소속 그룹을 확인하고 새 그룹 참여를 요청할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
          {/* 현재 소속 그룹 */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-medium text-gray-700">현재 소속</Label>
            {myGroups.length === 0 ? (
              joinRequests.some(r => r.status === "pending") ? (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  승인 대기 중인 요청이 있습니다. 아래 내역을 확인하세요.
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-400">소속된 그룹이 없습니다.</p>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {myGroups.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                    <span className="text-blue-700 text-xs sm:text-sm font-medium">{g.name}</span>
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryGroup(g.id)}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        primaryGroupId === g.id
                          ? "bg-blue-600 text-white font-medium"
                          : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-100"
                      }`}
                      title={primaryGroupId === g.id ? "현재 우선 접속 그룹입니다" : "로그인 시 이 그룹으로 우선 접속합니다"}
                    >
                      {primaryGroupId === g.id ? "★ 우선 접속" : "☆ 우선 설정"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 요청 내역 */}
          {joinRequests.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium text-gray-700">참여 요청 내역</Label>
              <div className="space-y-2">
                {joinRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-800 truncate">{req.group_name}</span>
                      {statusLabel(req.status)}
                    </div>
                    {req.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-6 px-2"
                        onClick={() => handleCancelRequest(req.id)}
                      >
                        취소
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 새 그룹 참여 요청 */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label className="text-xs sm:text-sm font-medium text-gray-700">새 그룹 참여 요청</Label>
            <GroupSearchInput
              value={requestGroupId}
              onChange={setRequestGroupId}
              placeholder="참여할 그룹을 검색하세요"
            />
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm h-8 sm:h-9"
              onClick={handleRequestGroup}
              disabled={!requestGroupId || requestingGroup}
            >
              {requestingGroup ? "요청 중..." : "참여 요청"}
            </Button>
            <p className="text-xs text-gray-400">그룹 재정관리자 또는 관리자 승인 후 추가됩니다.</p>
          </div>
        </CardContent>
      </Card>
      {/* 회원 탈퇴 (위험지대) */}
      <Card className="border-red-100 bg-red-50/30">
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-lg sm:text-xl text-red-600">회원 탈퇴</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-red-500">계정을 삭제하면 모든 정보가 즉시 삭제되며 복구할 수 없습니다.</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-6">
          <Button 
            variant="outline" 
            className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs sm:text-sm h-9 sm:h-10"
            onClick={async () => {
              if (!confirm("정말로 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 이 작업은 되돌릴 수 없습니다.")) return;
              
              setSaving(true);
              try {
                const res = await fetch("/api/user/withdraw", { method: "POST" });
                const result = await res.json();
                
                if (!res.ok) {
                  toast.error(result.error || "탈퇴 처리 중 오류가 발생했습니다.");
                  return;
                }
                
                toast.success("탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.");
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push("/");
              } catch {
                toast.error("탈퇴 요청에 실패했습니다.");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            본인 확인 및 계정 삭제
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
