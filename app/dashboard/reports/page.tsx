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
    <div className="space-y-4">
      {/* 헤더와 탭 */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">보고서</h1>
          <p className="text-slate-400 text-xs mt-0.5">주간 및 월간 보고서를 확인하고 출력하세요</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <Button
            variant={activeTab === "weekly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("weekly")}
            className={`text-xs h-8 ${activeTab === "weekly" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
          >
            주간보고서
          </Button>
          <Button
            variant={activeTab === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("monthly")}
            className={`text-xs h-8 ${activeTab === "monthly" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
          >
            월간보고서
          </Button>
          <Button
            variant={activeTab === "custom" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("custom")}
            className={`text-xs h-8 ${activeTab === "custom" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
          >
            일정선택
          </Button>
        </div>
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
