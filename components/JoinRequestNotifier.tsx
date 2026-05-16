"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const STORAGE_KEY = "joinRequestLastNotifiedAt";

export default function JoinRequestNotifier() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data, error } = await supabase
        .from("finance_group_join_requests")
        .select("id, status, reviewed_at, finance_groups(name)")
        .eq("user_id", user.id)
        .not("reviewed_at", "is", null)
        .in("status", ["approved", "rejected"])
        .order("reviewed_at", { ascending: true });

      if (error || !data || cancelled) return;

      const stored = localStorage.getItem(STORAGE_KEY);

      // 최초 진입: 알림 폭주 방지 — 현재 가장 최근 reviewed_at 으로 baseline 설정 후 알림 없이 종료
      if (!stored) {
        const latest = data[data.length - 1]?.reviewed_at;
        if (latest) localStorage.setItem(STORAGE_KEY, latest);
        return;
      }

      const lastNotifiedTime = new Date(stored).getTime();
      const newlyReviewed = data.filter(
        (r) => r.reviewed_at && new Date(r.reviewed_at).getTime() > lastNotifiedTime,
      );

      if (newlyReviewed.length === 0) return;

      for (const req of newlyReviewed) {
        const groupName = (req as any).finance_groups?.name || "그룹";
        if (req.status === "approved") {
          toast.success(`'${groupName}' 참여가 승인되었습니다.`, {
            description: "상단 그룹 선택기에서 전환할 수 있습니다.",
            duration: 6000,
          });
        } else if (req.status === "rejected") {
          toast.error(`'${groupName}' 참여 요청이 거절되었습니다.`, {
            duration: 6000,
          });
        }
      }

      const latest = newlyReviewed[newlyReviewed.length - 1].reviewed_at;
      if (latest) localStorage.setItem(STORAGE_KEY, latest);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
