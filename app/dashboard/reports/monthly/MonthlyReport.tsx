"use client";

import { useState, useMemo, useEffect } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReportViewToggle from "@/components/ReportViewToggle";
import ReportBodyTables from "@/components/ReportBodyTables";
import { toast } from "sonner";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  format,
  parseISO,
  isWithinInterval,
  isBefore,
} from "date-fns";
import { ko } from "date-fns/locale";
import { formatReportAmount, type ReportViewMode } from "@/lib/reports/reportView";
import {
  buildReportPrintHtml,
  openReportPrintWindow,
} from "@/lib/reports/buildReportPrintHtml";

export default function MonthlyReport() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();

  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ReportViewMode>("detail");
  const [cashAmount, setCashAmount] = useState("");
  const [touchAmount, setTouchAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");

  const loading = txLoading || settingsLoading;
  const currency = settings?.currency || "원";

  useEffect(() => {
    if (settings) {
      setCashAmount(settings.cash_amount?.toString() || "0");
      setTouchAmount(settings.touch_amount?.toString() || "0");
      setOtherAmount(settings.other_amount?.toString() || "0");
    }
  }, [settings]);

  const monthRange = useMemo(() => {
    const today = new Date();
    const targetDate = addMonths(today, monthOffset);
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);
    return { start, end };
  }, [monthOffset]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start: monthRange.start, end: monthRange.end });
    });
  }, [transactions, monthRange]);

  const incomeTransactions = monthlyTransactions.filter((t) => t.type === "수입");
  const expenseTransactions = monthlyTransactions.filter((t) => t.type === "지출");

  const incomeTotal = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseTotal = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const lastMonthBalance = useMemo(() => {
    return transactions
      .filter((t) => isBefore(parseISO(t.date), monthRange.start))
      .reduce((sum, t) => {
        if (t.type === "수입") return sum + Number(t.amount);
        return sum - Number(t.amount);
      }, 0);
  }, [transactions, monthRange.start]);

  const currentBalance = lastMonthBalance + incomeTotal - expenseTotal;
  const totalAccount =
    parseFloat(cashAmount || "0") +
    parseFloat(touchAmount || "0") +
    parseFloat(otherAmount || "0");

  const handleSaveAmounts = async () => {
    const result = await updateSettings({
      cash_amount: parseFloat(cashAmount || "0"),
      touch_amount: parseFloat(touchAmount || "0"),
      other_amount: parseFloat(otherAmount || "0"),
    });

    if (result.error) {
      toast.error("저장 실패: " + result.error);
    } else {
      toast.success("저장되었습니다.");
    }
  };

  const handlePrint = () => {
    const reportPeriod = format(monthRange.start, "yyyy년 MM월", { locale: ko });
    const html = buildReportPrintHtml({
      viewMode,
      reportKindLabel: "월간보고서",
      appTitle: settings?.app_title || "재정출납부",
      reportPeriod,
      currency,
      incomeTransactions,
      expenseTransactions,
      incomeItemOrder: settings?.income_items || [],
      expenseItemOrder: settings?.expense_items || [],
      summaryTitle: "월간 요약",
      prevBalanceLabel: "지난달 이월금",
      prevBalance: lastMonthBalance,
      incomeTotal,
      expenseTotal,
      currentBalanceLabel: "월간 잔액",
      currentBalance,
      account1Name: settings?.account1_name || "현금",
      account2Name: settings?.account2_name || "터치앤고",
      account3Name: settings?.account3_name || "기타",
      cashAmount: parseFloat(cashAmount || "0"),
      touchAmount: parseFloat(touchAmount || "0"),
      otherAmount: parseFloat(otherAmount || "0"),
      sign1Label: settings?.ui_sign_1 || "작성자",
      sign2Label: settings?.ui_sign_2 || "책임자",
      sign3Label: settings?.ui_sign_3 || "감사자",
      author: settings?.author || "",
      manager: settings?.manager || "",
      auditor: settings?.auditor || "",
      maxRows: 30,
    });

    if (!openReportPrintWindow(html)) {
      toast.error("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2">
        <div className="text-center">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-800">월간 보고서</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(monthOffset - 1)} className="text-xs h-8 sm:h-9">
            ◀ 이전달
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)} className="text-xs h-8 sm:h-9">
            이번달
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(monthOffset + 1)} className="text-xs h-8 sm:h-9">
            다음달 ▶
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 sm:h-9"
            onClick={handlePrint}
          >
            출력
          </Button>
        </div>
        <div className="flex justify-center">
          <ReportViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className="text-center text-gray-600 text-xs sm:text-sm">
        {format(monthRange.start, "yyyy년 MM월", { locale: ko })}
      </div>

      <div className="print:hidden">
        <ReportBodyTables
          viewMode={viewMode}
          incomeTransactions={incomeTransactions}
          expenseTransactions={expenseTransactions}
          incomeItemOrder={settings?.income_items || []}
          expenseItemOrder={settings?.expense_items || []}
          compact
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3">
              <CardTitle className="text-base sm:text-lg">월간 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 sm:space-y-2 px-3">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>지난달 이월금:</span>
                <span className="font-medium">{formatReportAmount(lastMonthBalance)} {currency}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>이번달 총 수입:</span>
                <span className="font-medium text-blue-600">{formatReportAmount(incomeTotal)} {currency}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>이번달 총 지출:</span>
                <span className="font-medium text-red-600">{formatReportAmount(expenseTotal)} {currency}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-xs sm:text-sm">
                <span className="font-bold">이번달 잔액:</span>
                <span className={`font-bold sm:text-lg ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatReportAmount(currentBalance)} {currency}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 sm:py-3 px-3">
              <CardTitle className="text-base sm:text-lg">계좌 현황</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 px-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="cash-m" className="text-xs">{settings?.account1_name || "현금"}</Label>
                  <Input
                    id="cash-m"
                    type="text"
                    inputMode="numeric"
                    value={cashAmount ? Number(cashAmount).toLocaleString("ko-KR") : ""}
                    onChange={(e) => setCashAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="h-8 text-right"
                  />
                </div>
                <div>
                  <Label htmlFor="touch-m" className="text-xs">{settings?.account2_name || "터치앤고"}</Label>
                  <Input
                    id="touch-m"
                    type="text"
                    inputMode="numeric"
                    value={touchAmount ? Number(touchAmount).toLocaleString("ko-KR") : ""}
                    onChange={(e) => setTouchAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="h-8 text-right"
                  />
                </div>
                <div>
                  <Label htmlFor="other-m" className="text-xs">{settings?.account3_name || "기타"}</Label>
                  <Input
                    id="other-m"
                    type="text"
                    inputMode="numeric"
                    value={otherAmount ? Number(otherAmount).toLocaleString("ko-KR") : ""}
                    onChange={(e) => setOtherAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="h-8 text-right"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center border-t pt-2 text-xs sm:text-sm">
                <span className="font-bold">총액:</span>
                <span className="font-bold sm:text-lg text-emerald-600">
                  {formatReportAmount(totalAccount)} {currency}
                </span>
              </div>
              <Button size="sm" onClick={handleSaveAmounts} className="w-full">
                저장
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
