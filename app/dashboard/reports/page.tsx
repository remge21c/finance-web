"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import WeeklyReport from "@/app/dashboard/reports/weekly/WeeklyReport";
import MonthlyReport from "@/app/dashboard/reports/monthly/MonthlyReport";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");

  return (
    <div className="space-y-4">
      {/* 헤더와 탭 */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-gray-800">보고서</h1>
          <p className="text-gray-500 text-sm">주간 및 월간 보고서를 확인하고 출력하세요</p>
        </div>
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant={activeTab === "weekly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("weekly")}
            className={activeTab === "weekly" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            주간보고서
          </Button>
          <Button
            variant={activeTab === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("monthly")}
            className={activeTab === "monthly" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            월간보고서
          </Button>
        </div>
      </div>

      {/* 탭 내용 */}
      <Card className="p-6">
        {activeTab === "weekly" ? <WeeklyReport /> : <MonthlyReport />}
      </Card>
    </div>
  );
}
