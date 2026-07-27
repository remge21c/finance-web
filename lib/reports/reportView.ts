import type { Transaction } from "@/types/database";

export type ReportViewMode = "detail" | "summary";

export interface ItemAggregate {
  item: string;
  count: number;
  total: number;
  percent: number;
}

/** 보고서 금액 표시 */
export function formatReportAmount(amount: number): string {
  return amount.toLocaleString("ko-KR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

/**
 * 항목별 합산.
 * preferredOrder가 있으면 해당 순서 우선, 나머지는 합계 내림차순.
 */
export function aggregateByItem(
  transactions: Transaction[],
  preferredOrder: string[] = [],
): ItemAggregate[] {
  const map = new Map<string, { count: number; total: number }>();

  for (const t of transactions) {
    const key = t.item || "(미분류)";
    const prev = map.get(key) || { count: 0, total: 0 };
    prev.count += 1;
    prev.total += Number(t.amount) || 0;
    map.set(key, prev);
  }

  const grandTotal = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
  const orderIndex = new Map(preferredOrder.map((name, i) => [name, i]));

  return Array.from(map.entries())
    .map(([item, { count, total }]) => ({
      item,
      count,
      total,
      percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => {
      const ai = orderIndex.has(a.item) ? orderIndex.get(a.item)! : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.item) ? orderIndex.get(b.item)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return b.total - a.total;
    });
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}
