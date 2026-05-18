"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { useDataContext } from "@/lib/contexts/DataContext";

/**
 * 모바일/데스크탑 동작 차이를 진단하기 위한 디버그 패널.
 * URL 에 ?debug=1 이 있을 때만 화면에 표시.
 */
export default function DebugPanel() {
  const params = useSearchParams();
  const enabled = params.get("debug") === "1";

  const { groups, currentGroup, isSuperAdmin, userId, currentPermissionLevel, hasWritePermission, loading: groupsLoading } = useGroupContext();
  const { settings, transactions, loading: dataLoading } = useDataContext();

  const [stored, setStored] = useState<string | null>(null);
  const [userAgent, setUserAgent] = useState<string>("");

  useEffect(() => {
    if (!enabled) return;
    setStored(localStorage.getItem("selectedGroupId"));
    setUserAgent(navigator.userAgent);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed top-16 left-2 right-2 sm:left-auto sm:right-2 sm:w-[420px] z-[100] bg-black/90 text-white text-xs p-3 rounded-lg shadow-xl space-y-1 max-h-[80vh] overflow-y-auto font-mono">
      <div className="font-bold text-emerald-300">🔍 Debug Panel</div>
      <div><span className="text-slate-400">userId:</span> {userId ?? "null"}</div>
      <div><span className="text-slate-400">isSuperAdmin:</span> {String(isSuperAdmin)}</div>
      <div><span className="text-slate-400">currentGroup:</span> {currentGroup ? `${currentGroup.name} (${currentGroup.id.slice(0, 8)}, type=${currentGroup.group_type})` : "null"}</div>
      <div><span className="text-slate-400">localStorage.selectedGroupId:</span> {stored ?? "null"}</div>
      <div><span className="text-slate-400">permissionLevel:</span> {currentPermissionLevel ?? "null"}</div>
      <div><span className="text-slate-400">hasWritePermission:</span> {String(hasWritePermission)}</div>
      <div><span className="text-slate-400">groupsLoading:</span> {String(groupsLoading)} / dataLoading: {String(dataLoading)}</div>
      <div><span className="text-slate-400">settings.app_title:</span> {settings?.app_title ?? "null"}</div>
      <div><span className="text-slate-400">transactions:</span> {transactions.length}건</div>
      <div className="pt-1 border-t border-slate-700">
        <div className="text-slate-400">groups ({groups.length}):</div>
        <ul className="pl-2">
          {groups.map((g) => (
            <li key={g.id} className={g.id === currentGroup?.id ? "text-emerald-300" : ""}>
              {g.id === currentGroup?.id ? "▶ " : "  "}
              {g.name} <span className="text-slate-500">[{g.group_type}]</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="pt-1 border-t border-slate-700 text-slate-500 break-all">{userAgent}</div>
    </div>
  );
}
