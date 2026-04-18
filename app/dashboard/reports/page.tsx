"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import WeeklyReport from "@/app/dashboard/reports/weekly/WeeklyReport";
import MonthlyReport from "@/app/dashboard/reports/monthly/MonthlyReport";
import CustomRangeReport from "@/app/dashboard/reports/custom/CustomRangeReport";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "custom">("weekly");

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-800">보고서</h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">주간 및 월간 보고서를 확인하고 출력하세요</p>
      </div>

      {/* 탭 버튼 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        <Button
          variant={activeTab === "weekly" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("weekly")}
          className={`text-xs flex-1 sm:flex-none h-8 ${activeTab === "weekly" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
        >
          주간보고서
        </Button>
        <Button
          variant={activeTab === "monthly" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("monthly")}
          className={`text-xs flex-1 sm:flex-none h-8 ${activeTab === "monthly" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
        >
          월간보고서
        </Button>
        <Button
          variant={activeTab === "custom" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("custom")}
          className={`text-xs flex-1 sm:flex-none h-8 ${activeTab === "custom" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
        >
          일정선택
        </Button>
      </div>

      {/* 탭 내용 */}
      <Card className="p-3 sm:p-6">
        {activeTab === "weekly" ? (
          <WeeklyReport />
        ) : activeTab === "monthly" ? (
          <MonthlyReport />
        ) : (
          <CustomRangeReport />
        )}
      </Card>
    </div>
  );
}
