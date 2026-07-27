"use client";

import { Button } from "@/components/ui/button";
import type { ReportViewMode } from "@/lib/reports/reportView";

interface ReportViewToggleProps {
  value: ReportViewMode;
  onChange: (mode: ReportViewMode) => void;
}

/** 보고서 미리보기/출력 형식 선택 */
export default function ReportViewToggle({ value, onChange }: ReportViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      <Button
        type="button"
        size="sm"
        variant={value === "detail" ? "default" : "ghost"}
        onClick={() => onChange("detail")}
        className={`h-8 text-xs sm:text-sm px-2.5 sm:px-3 ${
          value === "detail"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            : "text-slate-600 hover:bg-white hover:text-slate-800"
        }`}
      >
        날짜별 상세목록
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "summary" ? "default" : "ghost"}
        onClick={() => onChange("summary")}
        className={`h-8 text-xs sm:text-sm px-2.5 sm:px-3 ${
          value === "summary"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            : "text-slate-600 hover:bg-white hover:text-slate-800"
        }`}
      >
        항목별 합산
      </Button>
    </div>
  );
}
