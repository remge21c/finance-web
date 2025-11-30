"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  
  const printRef = useRef<HTMLDivElement>(null);

  const loading = txLoading || settingsLoading;
  const currency = settings?.currency || "원";

  // 초기 금액 설정 - settings가 로드되면 금액 상태 업데이트
  useEffect(() => {
    if (settings) {
      setCashAmount(settings.cash_amount?.toString() || "0");
      setTouchAmount(settings.touch_amount?.toString() || "0");
      setOtherAmount(settings.other_amount?.toString() || "0");
    }
  }, [settings]);

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
            onClick={() => handlePrint()}
          >
            출력
          </Button>
        </div>
      </div>

      {/* 주간 범위 표시 */}
      <div className="text-center text-gray-600">
        {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "M월 d일", { locale: ko })}
      </div>

      {/* 출력 영역 */}
      <div ref={printRef} className="print:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 수입 테이블 */}
          <Card>
            <CardHeader className="bg-blue-50 py-3">
              <CardTitle className="text-lg text-blue-700">수입</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">날짜</TableHead>
                    <TableHead className="w-24">항목</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead className="text-right w-24">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-gray-400">
                        수입 내역 없음
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomeTransactions.map((t, i) => (
                      <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell>{format(parseISO(t.date), "MM-dd")}</TableCell>
                        <TableCell>{t.item}</TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell className="text-right">{formatAmount(Number(t.amount))}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 지출 테이블 */}
          <Card>
            <CardHeader className="bg-red-50 py-3">
              <CardTitle className="text-lg text-red-700">지출</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">날짜</TableHead>
                    <TableHead className="w-24">항목</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead className="text-right w-24">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-gray-400">
                        지출 내역 없음
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseTransactions.map((t, i) => (
                      <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell>{format(parseISO(t.date), "MM-dd")}</TableCell>
                        <TableCell>{t.item}</TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell className="text-right">{formatAmount(Number(t.amount))}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 요약 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* 주간 요약 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">주간 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>지난주 이월금:</span>
                <span className="font-medium">{formatAmount(lastWeekBalance)} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span>이번주 총 수입:</span>
                <span className="font-medium text-blue-600">{formatAmount(incomeTotal)} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span>이번주 총 지출:</span>
                <span className="font-medium text-red-600">{formatAmount(expenseTotal)} {currency}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold">이번주 잔액:</span>
                <span className={`font-bold text-lg ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatAmount(currentBalance)} {currency}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 계좌 현황 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">계좌 현황</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="cash" className="text-xs">현금</Label>
                  <Input
                    id="cash"
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="touch" className="text-xs">터치앤고</Label>
                  <Input
                    id="touch"
                    type="number"
                    value={touchAmount}
                    onChange={(e) => setTouchAmount(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="other" className="text-xs">기타</Label>
                  <Input
                    id="other"
                    type="number"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-bold">총액:</span>
                <span className="font-bold text-lg text-emerald-600">
                  {formatAmount(totalAccount)} {currency}
                </span>
              </div>
              <Button size="sm" onClick={handleSaveAmounts} className="w-full print:hidden">
                저장
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 서명란 */}
        <div className="grid grid-cols-2 gap-8 mt-6 print:mt-8">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-600 mb-2">작성자: {settings?.author || ""}</div>
              <div className="h-12 border-b border-gray-300"></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-600 mb-2">책임자: {settings?.manager || ""}</div>
              <div className="h-12 border-b border-gray-300"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


