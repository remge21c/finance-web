"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
  parseISO,
  isWithinInterval,
  isBefore,
} from "date-fns";
import { ko } from "date-fns/locale";
import { useReactToPrint } from "react-to-print";

export default function WeeklyReportPage() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [cashAmount, setCashAmount] = useState("");
  const [touchAmount, setTouchAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  const loading = txLoading || settingsLoading;
  const currency = settings?.currency || "원";

  // 원본 금액 (변경사항 비교용)
  const [originalAmounts, setOriginalAmounts] = useState({
    cash: "0",
    touch: "0",
    other: "0",
  });

  // 초기 금액 설정 - settings가 로드되면 금액 상태 업데이트
  useEffect(() => {
    if (settings) {
      const cash = settings.cash_amount?.toString() || "0";
      const touch = settings.touch_amount?.toString() || "0";
      const other = settings.other_amount?.toString() || "0";
      
      setCashAmount(cash);
      setTouchAmount(touch);
      setOtherAmount(other);
      setOriginalAmounts({ cash, touch, other });
    }
  }, [settings]);

  // 변경사항 확인
  const hasAmountsChanged = useMemo(() => 
    cashAmount !== originalAmounts.cash || 
    touchAmount !== originalAmounts.touch || 
    otherAmount !== originalAmounts.other,
    [cashAmount, touchAmount, otherAmount, originalAmounts]
  );

  // 주간 범위 계산
  const weekRange = useMemo(() => {
    const today = new Date();
    const targetDate = addWeeks(today, weekOffset);
    const start = startOfWeek(targetDate, { weekStartsOn: 1 });
    const end = endOfWeek(targetDate, { weekStartsOn: 1 });
    return { start, end };
  }, [weekOffset]);

  // 주간 거래 필터링
  const weeklyTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start: weekRange.start, end: weekRange.end });
    });
  }, [transactions, weekRange]);

  // 수입/지출 분리
  const incomeTransactions = weeklyTransactions.filter((t) => t.type === "수입");
  const expenseTransactions = weeklyTransactions.filter((t) => t.type === "지출");

  // 합계 계산
  const incomeTotal = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseTotal = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // 지난주 이월금 계산
  const lastWeekBalance = useMemo(() => {
    return transactions
      .filter((t) => isBefore(parseISO(t.date), weekRange.start))
      .reduce((sum, t) => {
        if (t.type === "수입") return sum + Number(t.amount);
        return sum - Number(t.amount);
      }, 0);
  }, [transactions, weekRange.start]);

  // 이번주 잔액
  const currentBalance = lastWeekBalance + incomeTotal - expenseTotal;

  // 계좌 총액
  const totalAccount = 
    parseFloat(cashAmount || "0") + 
    parseFloat(touchAmount || "0") + 
    parseFloat(otherAmount || "0");

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ko-KR", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  };

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
      // 원본값 업데이트
      setOriginalAmounts({
        cash: cashAmount,
        touch: touchAmount,
        other: otherAmount,
      });
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `주간보고서_${format(weekRange.start, "yyyyMMdd")}-${format(weekRange.end, "yyyyMMdd")}`,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">주간 보고서</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}>
            ◀ 이전주
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            이번주
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}>
            다음주 ▶
          </Button>
          <Button 
            size="sm" 
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setShowPreview(true)}
          >
            출력
          </Button>
        </div>
      </div>

      {/* 주간 범위 표시 */}
      <div className="text-center text-gray-600">
        {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "M월 d일", { locale: ko })}
      </div>

      {/* 미리보기 모달 */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>주간보고서 미리보기</span>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  handlePrint();
                  setShowPreview(false);
                }}
              >
                🖨️ 인쇄
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {/* 미리보기 내용 */}
          <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
            {/* 헤더 */}
            <div className="border-[3px] border-green-600 rounded-lg p-4 mb-4">
              <h1 className="text-2xl font-bold text-center text-gray-800">주간보고서</h1>
              <p className="text-center text-gray-600 mt-1">
                보고 기간: {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "yyyy년 M월 d일", { locale: ko })}
              </p>
              <p className="text-center text-gray-500 text-sm mt-1">
                생성일: {format(new Date(), "yyyy년 M월 d일 HH:mm", { locale: ko })}
              </p>
            </div>

            {/* 수입/지출 테이블 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* 수입 내역 */}
              <div className="border border-gray-300 rounded overflow-hidden">
                <div className="bg-green-600 text-white py-2 px-3 font-bold text-center text-sm">
                  수입 내역
                </div>
                <table className="w-full text-xs table-fixed">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="py-1 px-1 text-left font-semibold w-12">날짜</th>
                      <th className="py-1 px-1 text-left font-semibold w-16">항목</th>
                      <th className="py-1 px-1 text-left font-semibold">내용</th>
                      <th className="py-1 px-1 text-right font-semibold w-14">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeTransactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-200">
                        <td className="py-1 px-1">{format(parseISO(t.date), "MM/dd")}</td>
                        <td className="py-1 px-1 truncate">{t.item}</td>
                        <td className="py-1 px-1 truncate">{t.description}</td>
                        <td className="py-1 px-1 text-right text-blue-600">{formatAmount(Number(t.amount))}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(8 - incomeTransactions.length, 0) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-gray-200">
                        <td className="py-1 px-1">&nbsp;</td>
                        <td className="py-1 px-1"></td>
                        <td className="py-1 px-1"></td>
                        <td className="py-1 px-1"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 지출 내역 */}
              <div className="border border-gray-300 rounded overflow-hidden">
                <div className="bg-green-600 text-white py-2 px-3 font-bold text-center text-sm">
                  지출 내역
                </div>
                <table className="w-full text-xs table-fixed">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="py-1 px-1 text-left font-semibold w-12">날짜</th>
                      <th className="py-1 px-1 text-left font-semibold w-16">항목</th>
                      <th className="py-1 px-1 text-left font-semibold">내용</th>
                      <th className="py-1 px-1 text-right font-semibold w-14">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseTransactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-200">
                        <td className="py-1 px-1">{format(parseISO(t.date), "MM/dd")}</td>
                        <td className="py-1 px-1 truncate">{t.item}</td>
                        <td className="py-1 px-1 truncate">{t.description}</td>
                        <td className="py-1 px-1 text-right text-red-600">{formatAmount(Number(t.amount))}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(8 - expenseTransactions.length, 0) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-gray-200">
                        <td className="py-1 px-1">&nbsp;</td>
                        <td className="py-1 px-1"></td>
                        <td className="py-1 px-1"></td>
                        <td className="py-1 px-1"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 요약 정보 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 주간 요약 */}
              <div className="border border-gray-300 rounded overflow-hidden">
                <div className="bg-gray-100 py-1 px-3 font-bold border-b border-gray-300 text-sm">
                  주간 요약
                </div>
                <div className="p-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>지난주 잔액:</span>
                    <span className="font-medium">{formatAmount(lastWeekBalance)} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>총 수입:</span>
                    <span className="font-medium text-blue-600">{formatAmount(incomeTotal)} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>총 지출:</span>
                    <span className="font-medium text-red-600">{formatAmount(expenseTotal)} {currency}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-1">
                    <span className="font-bold">주간 잔액:</span>
                    <span className={`font-bold ${currentBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatAmount(currentBalance)} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* 계좌 현황 */}
              <div className="border border-gray-300 rounded overflow-hidden">
                <div className="bg-gray-100 py-1 px-3 font-bold border-b border-gray-300 text-sm">
                  계좌 현황
                </div>
                <div className="p-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>현금:</span>
                    <span className="font-medium">{formatAmount(parseFloat(cashAmount || "0"))} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>터치앤고:</span>
                    <span className="font-medium">{formatAmount(parseFloat(touchAmount || "0"))} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>기타:</span>
                    <span className="font-medium">{formatAmount(parseFloat(otherAmount || "0"))} {currency}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-1">
                    <span className="font-bold">총 계좌:</span>
                    <span className="font-bold text-green-600">
                      {formatAmount(totalAccount)} {currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 서명란 */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border border-gray-300 rounded p-2 text-center">
                <div className="text-xs text-gray-600 mb-1">작성자: {settings?.author || ""}</div>
                <div className="h-8 border-b border-gray-400 mx-4"></div>
              </div>
              <div className="border border-gray-300 rounded p-2 text-center">
                <div className="text-xs text-gray-600 mb-1">책임자: {settings?.manager || ""}</div>
                <div className="h-8 border-b border-gray-400 mx-4"></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 출력 영역 (실제 프린트용, 화면에는 숨김) */}
      <div ref={printRef} className="bg-white print:print-a4">
        {/* 출력용 헤더 - 녹색 테두리 */}
        <div className="hidden print:block border-[3px] border-green-600 rounded-lg p-4 mb-4">
          <h1 className="text-2xl font-bold text-center text-gray-800">주간보고서</h1>
          <p className="text-center text-gray-600 mt-1">
            보고 기간: {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "yyyy년 M월 d일", { locale: ko })}
          </p>
          <p className="text-center text-gray-500 text-sm mt-1">
            생성일: {format(new Date(), "yyyy년 M월 d일 HH:mm", { locale: ko })}
          </p>
        </div>

        {/* 수입/지출 테이블 - 2열 배치 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
          {/* 수입 내역 */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="bg-green-600 text-white py-2 px-3 font-bold text-center">
              수입 내역
            </div>
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="py-2 px-2 text-left font-semibold w-14 print:w-12 print:text-xs">날짜</th>
                  <th className="py-2 px-2 text-left font-semibold w-28 print:w-24 print:text-xs">항목</th>
                  <th className="py-2 px-2 text-left font-semibold print:text-xs">내용</th>
                  <th className="py-2 px-2 text-right font-semibold w-16 print:w-14 print:text-xs">금액</th>
                </tr>
              </thead>
              <tbody>
                {incomeTransactions.map((t, i) => (
                  <tr key={t.id} className={`border-b border-gray-200 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                    <td className="py-1.5 px-2 print:text-xs">{format(parseISO(t.date), "MM/dd")}</td>
                    <td className="py-1.5 px-2 print:text-xs truncate">{t.item}</td>
                    <td className="py-1.5 px-2 print:text-xs truncate">{t.description}</td>
                    <td className="py-1.5 px-2 text-right text-blue-600 print:text-xs">{formatAmount(Number(t.amount))}</td>
                  </tr>
                ))}
                {/* 빈 행 채우기 - 화면: 최소 10행, 출력: 최소 18행 */}
                {Array.from({ length: Math.max(10 - incomeTransactions.length, 0) }).map((_, i) => (
                  <tr key={`empty-income-${i}`} className="border-b border-gray-200 print:hidden">
                    <td className="py-1.5 px-2">&nbsp;</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                ))}
                {/* 출력용 빈 행 - A4 용지에 맞게 18행 */}
                {Array.from({ length: Math.max(18 - incomeTransactions.length, 0) }).map((_, i) => (
                  <tr key={`print-empty-income-${i}`} className="border-b border-gray-200 hidden print:table-row">
                    <td className="py-1.5 px-2 print:text-xs">&nbsp;</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 지출 내역 */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="bg-green-600 text-white py-2 px-3 font-bold text-center">
              지출 내역
            </div>
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="py-2 px-2 text-left font-semibold w-14 print:w-12 print:text-xs">날짜</th>
                  <th className="py-2 px-2 text-left font-semibold w-28 print:w-24 print:text-xs">항목</th>
                  <th className="py-2 px-2 text-left font-semibold print:text-xs">내용</th>
                  <th className="py-2 px-2 text-right font-semibold w-16 print:w-14 print:text-xs">금액</th>
                </tr>
              </thead>
              <tbody>
                {expenseTransactions.map((t, i) => (
                  <tr key={t.id} className={`border-b border-gray-200 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                    <td className="py-1.5 px-2 print:text-xs">{format(parseISO(t.date), "MM/dd")}</td>
                    <td className="py-1.5 px-2 print:text-xs truncate">{t.item}</td>
                    <td className="py-1.5 px-2 print:text-xs truncate">{t.description}</td>
                    <td className="py-1.5 px-2 text-right text-red-600 print:text-xs">{formatAmount(Number(t.amount))}</td>
                  </tr>
                ))}
                {/* 빈 행 채우기 - 화면: 최소 10행, 출력: 최소 18행 */}
                {Array.from({ length: Math.max(10 - expenseTransactions.length, 0) }).map((_, i) => (
                  <tr key={`empty-expense-${i}`} className="border-b border-gray-200 print:hidden">
                    <td className="py-1.5 px-2">&nbsp;</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                ))}
                {/* 출력용 빈 행 - A4 용지에 맞게 18행 */}
                {Array.from({ length: Math.max(18 - expenseTransactions.length, 0) }).map((_, i) => (
                  <tr key={`print-empty-expense-${i}`} className="border-b border-gray-200 hidden print:table-row">
                    <td className="py-1.5 px-2 print:text-xs">&nbsp;</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 요약 정보 - 2열 배치 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 print:grid-cols-2 print:gap-3 print:mt-3">
          {/* 주간 요약 */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="bg-gray-100 py-2 px-3 font-bold border-b border-gray-300">
              주간 요약
            </div>
            <div className="p-3 space-y-2 print:p-2 print:space-y-1">
              <div className="flex justify-between print:text-sm">
                <span>지난주 잔액:</span>
                <span className="font-medium">{formatAmount(lastWeekBalance)} {currency}</span>
              </div>
              <div className="flex justify-between print:text-sm">
                <span>총 수입:</span>
                <span className="font-medium text-blue-600">{formatAmount(incomeTotal)} {currency}</span>
              </div>
              <div className="flex justify-between print:text-sm">
                <span>총 지출:</span>
                <span className="font-medium text-red-600">{formatAmount(expenseTotal)} {currency}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2 print:pt-1">
                <span className="font-bold">주간 잔액:</span>
                <span className={`font-bold ${currentBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatAmount(currentBalance)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* 계좌 현황 */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="bg-gray-100 py-2 px-3 font-bold border-b border-gray-300">
              계좌 현황
            </div>
            <div className="p-3 print:p-2">
              {/* 입력 필드 - 화면에서만 표시 */}
              <div className="grid grid-cols-3 gap-2 print:hidden">
                <div>
                  <Label htmlFor="cash" className="text-xs">현금</Label>
                  <Input
                    id="cash"
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label htmlFor="touch" className="text-xs">터치앤고</Label>
                  <Input
                    id="touch"
                    type="number"
                    value={touchAmount}
                    onChange={(e) => setTouchAmount(e.target.value)}
                    className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label htmlFor="other" className="text-xs">기타</Label>
                  <Input
                    id="other"
                    type="number"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(e.target.value)}
                    className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              
              {/* 출력용 계좌 정보 */}
              <div className="hidden print:block space-y-1">
                <div className="flex justify-between text-sm">
                  <span>현금:</span>
                  <span className="font-medium">{formatAmount(parseFloat(cashAmount || "0"))} {currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>터치앤고:</span>
                  <span className="font-medium">{formatAmount(parseFloat(touchAmount || "0"))} {currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>기타:</span>
                  <span className="font-medium">{formatAmount(parseFloat(otherAmount || "0"))} {currency}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2 print:mt-1 print:pt-1">
                <span className="font-bold">총 계좌:</span>
                <span className="font-bold text-green-600">
                  {formatAmount(totalAccount)} {currency}
                </span>
              </div>
              <Button 
                size="sm" 
                onClick={handleSaveAmounts} 
                className={`w-full mt-2 print:hidden ${hasAmountsChanged ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 hover:bg-gray-500"}`}
              >
                저장
              </Button>
            </div>
          </div>
        </div>

        {/* 서명란 - 출력 모드에서만 표시 */}
        <div className="hidden print:grid grid-cols-2 gap-4 mt-6">
          <div className="border border-gray-300 rounded p-3 text-center">
            <div className="text-sm text-gray-600 mb-2">작성자: {settings?.author || ""}</div>
            <div className="h-10 border-b border-gray-400 mx-4"></div>
          </div>
          <div className="border border-gray-300 rounded p-3 text-center">
            <div className="text-sm text-gray-600 mb-2">책임자: {settings?.manager || ""}</div>
            <div className="h-10 border-b border-gray-400 mx-4"></div>
          </div>
        </div>
      </div>
    </div>
  );
}




