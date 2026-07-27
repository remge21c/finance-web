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
import { format, parseISO, isWithinInterval, isBefore, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { formatReportAmount, type ReportViewMode } from "@/lib/reports/reportView";
import {
  buildReportPrintHtml,
  openReportPrintWindow,
} from "@/lib/reports/buildReportPrintHtml";

export default function CustomRangeReport() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();

  const today = format(new Date(), "yyyy-MM-dd");
  const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState<string>(thisMonthStart);
  const [endDate, setEndDate] = useState<string>(today);
  const [appliedStart, setAppliedStart] = useState<string>(thisMonthStart);
  const [appliedEnd, setAppliedEnd] = useState<string>(today);
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

  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) {
      setAppliedStart(startDate);
      setAppliedEnd(endDate);
    }
  }, [startDate, endDate]);

  const handleApply = () => {
    if (!startDate || !endDate) {
      toast.error("시작일과 종료일을 모두 입력해주세요.");
      return;
    }
    if (startDate > endDate) {
      toast.error("시작일이 종료일보다 늦을 수 없습니다.");
      return;
    }
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const rangeTransactions = useMemo(() => {
    if (!appliedStart || !appliedEnd) return [];
    const start = parseISO(appliedStart);
    const end = parseISO(appliedEnd);
    return transactions.filter((t) =>
      isWithinInterval(parseISO(t.date), { start, end })
    );
  }, [transactions, appliedStart, appliedEnd]);

  const incomeTransactions = rangeTransactions.filter((t) => t.type === "수입");
  const expenseTransactions = rangeTransactions.filter((t) => t.type === "지출");

  const incomeTotal = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseTotal = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const prevBalance = useMemo(() => {
    if (!appliedStart) return 0;
    const start = parseISO(appliedStart);
    return transactions
      .filter((t) => isBefore(parseISO(t.date), start))
      .reduce((sum, t) => {
        if (t.type === "수입") return sum + Number(t.amount);
        return sum - Number(t.amount);
      }, 0);
  }, [transactions, appliedStart]);

  const currentBalance = prevBalance + incomeTotal - expenseTotal;
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
    if (!appliedStart || !appliedEnd) {
      toast.error("먼저 조회할 기간을 선택해주세요.");
      return;
    }

    const reportPeriod = `${format(parseISO(appliedStart), "yyyy년 MM월 dd일", { locale: ko })} ~ ${format(parseISO(appliedEnd), "yyyy년 MM월 dd일", { locale: ko })}`;
    const html = buildReportPrintHtml({
      viewMode,
      reportKindLabel: "일정선택 보고서",
      appTitle: settings?.app_title || "재정출납부",
      reportPeriod,
      currency,
      incomeTransactions,
      expenseTransactions,
      incomeItemOrder: settings?.income_items || [],
      expenseItemOrder: settings?.expense_items || [],
      summaryTitle: "기간 요약",
      prevBalanceLabel: "기간 시작 전 잔액",
      prevBalance,
      incomeTotal,
      expenseTotal,
      currentBalanceLabel: "기간 잔액",
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
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-800">일정선택 보고서</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs whitespace-nowrap" htmlFor="start-date">시작일</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-7 sm:h-8 text-xs w-24 sm:w-28 md:w-36"
            />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-xs whitespace-nowrap" htmlFor="end-date">종료일</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-7 sm:h-8 text-xs w-24 sm:w-28 md:w-36"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleApply} className="text-xs h-8 sm:h-9">
            조회
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 sm:h-9" onClick={handlePrint}>
            출력
          </Button>
        </div>
        <div className="flex justify-center">
          <ReportViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className="text-center text-gray-600 text-xs sm:text-sm">
        {appliedStart && appliedEnd
          ? `${format(parseISO(appliedStart), "yyyy년 M월 d일", { locale: ko })} ~ ${format(parseISO(appliedEnd), "yyyy년 M월 d일", { locale: ko })}`
          : "기간을 선택하고 조회 버튼을 누르세요"}
      </div>

      <ReportBodyTables
        viewMode={viewMode}
        incomeTransactions={incomeTransactions}
        expenseTransactions={expenseTransactions}
        incomeItemOrder={settings?.income_items || []}
        expenseItemOrder={settings?.expense_items || []}
        compact
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="py-2 sm:py-3 px-3">
            <CardTitle className="text-base sm:text-lg">기간 요약</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 sm:space-y-2 px-3">
            <div className="flex justify-between text-xs sm:text-sm">
              <span>기간 시작 전 잔액:</span>
              <span className="font-medium">{formatReportAmount(prevBalance)} {currency}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span>총 수입:</span>
              <span className="font-medium text-blue-600">{formatReportAmount(incomeTotal)} {currency}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span>총 지출:</span>
              <span className="font-medium text-red-600">{formatReportAmount(expenseTotal)} {currency}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-xs sm:text-sm">
              <span className="font-bold">기간 잔액:</span>
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
                <Label htmlFor="cash-custom" className="text-xs">{settings?.account1_name || "현금"}</Label>
                <Input
                  id="cash-custom"
                  type="text"
                  inputMode="numeric"
                  value={cashAmount ? Number(cashAmount).toLocaleString("ko-KR") : ""}
                  onChange={(e) => setCashAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="h-8 text-right"
                />
              </div>
              <div>
                <Label htmlFor="touch-custom" className="text-xs">{settings?.account2_name || "터치앤고"}</Label>
                <Input
                  id="touch-custom"
                  type="text"
                  inputMode="numeric"
                  value={touchAmount ? Number(touchAmount).toLocaleString("ko-KR") : ""}
                  onChange={(e) => setTouchAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="h-8 text-right"
                />
              </div>
              <div>
                <Label htmlFor="other-custom" className="text-xs">{settings?.account3_name || "기타"}</Label>
                <Input
                  id="other-custom"
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
  );
}
