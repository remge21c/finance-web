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
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 - 모바일: 세로, 데스크탑: 타이틀과 버튼 한 줄 */}
      <div>
        {/* 데스크탑 */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">보고서</h1>
            <p className="text-sm text-slate-400 mt-1">주간 및 월간 보고서를 확인하고 출력하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "weekly" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("weekly")}
              className={`text-sm h-10 ${activeTab === "weekly" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            >
              주간보고서
            </Button>
            <Button
              variant={activeTab === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("monthly")}
              className={`text-sm h-10 ${activeTab === "monthly" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            >
              월간보고서
            </Button>
            <Button
              variant={activeTab === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("custom")}
              className={`text-sm h-10 ${activeTab === "custom" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            >
              일정선택
            </Button>
          </div>
        </div>

        {/* 모바일 */}
        <div className="sm:hidden">
          <h1 className="text-xl font-bold text-slate-800">보고서</h1>
          <p className="text-sm text-slate-400 mt-1">주간 및 월간 보고서를 확인하고 출력하세요</p>
          <div className="flex gap-1.5 bg-slate-100 rounded-lg p-1.5 mt-3">
            <Button
              variant={activeTab === "weekly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("weekly")}
              className={`text-sm flex-1 h-10 ${activeTab === "weekly" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
            >
              주간보고서
            </Button>
            <Button
              variant={activeTab === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("monthly")}
              className={`text-sm flex-1 h-10 ${activeTab === "monthly" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
            >
              월간보고서
            </Button>
            <Button
              variant={activeTab === "custom" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("custom")}
              className={`text-sm flex-1 h-10 ${activeTab === "custom" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
            >
              일정선택
            </Button>
          </div>
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
