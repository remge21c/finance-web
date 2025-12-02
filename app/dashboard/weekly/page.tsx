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

  // 초기 금액 설정
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

  // 새 창에서 미리보기 열기
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>주간보고서_${format(weekRange.start, "yyyyMMdd")}-${format(weekRange.end, "yyyyMMdd")}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 20mm;
              background: white;
            }
            @page { 
              size: A4; 
              margin: 15mm;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 12px;
              font-size: 11px;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 6px 8px; 
              text-align: left;
            }
            th { 
              background: #f5f5f5; 
              font-weight: 600;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .card { 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              margin-bottom: 12px;
              overflow: hidden;
            }
            .card-header { 
              padding: 8px 12px; 
              font-weight: 600;
              font-size: 14px;
            }
            .bg-blue-50 { background: #eff6ff; color: #1e40af; }
            .bg-red-50 { background: #fef2f2; color: #b91c1c; }
            .card-content { padding: 0; }
            .summary-row { 
              display: flex; 
              justify-content: space-between; 
              padding: 6px 12px;
              border-bottom: 1px solid #f3f4f6;
            }
            .summary-row:last-child { border-bottom: none; }
            .summary-row.total { 
              border-top: 2px solid #ddd; 
              padding-top: 8px;
              margin-top: 4px;
              font-weight: 700;
            }
            .text-blue-600 { color: #2563eb; }
            .text-red-600 { color: #dc2626; }
            .text-emerald-600 { color: #059669; }
            .grid-2 { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 12px;
              margin-bottom: 12px;
            }
            .account-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              padding: 12px;
              border-bottom: 1px solid #f3f4f6;
            }
            .account-item { text-align: center; }
            .account-label { 
              font-size: 10px; 
              color: #6b7280; 
              margin-bottom: 4px;
            }
            .account-value { 
              font-weight: 600;
              font-size: 12px;
            }
            h1 { 
              text-align: center; 
              font-size: 20px; 
              margin-bottom: 8px;
              font-weight: 700;
            }
            .date-range { 
              text-align: center; 
              color: #6b7280; 
              margin-bottom: 16px;
              font-size: 12px;
            }
            .print-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              padding: 10px 20px;
              background: #059669;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              z-index: 1000;
            }
            .print-btn:hover { background: #047857; }
            @media print {
              .print-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-btn no-print" onclick="window.print()">인쇄</button>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
      <div ref={printRef} className="bg-white p-6">
        {/* 제목 및 기간 */}
        <h1 className="text-xl font-bold text-center mb-2">주간 보고서</h1>
        <div className="text-center text-gray-600 text-sm mb-4">
          보고 기간: {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "M월 d일", { locale: ko })}
        </div>
        
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
                    // 빈 행 30개 추가 (A4 용지 채우기)
                    Array.from({ length: 30 }).map((_, i) => (
                      <TableRow key={`empty-income-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <>
                      {incomeTransactions.map((t, i) => (
                        <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell>{format(parseISO(t.date), "MM-dd")}</TableCell>
                          <TableCell>{t.item}</TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell className="text-right">{formatAmount(Number(t.amount))}</TableCell>
                        </TableRow>
                      ))}
                      {/* 나머지 빈 행 추가 */}
                      {Array.from({ length: Math.max(0, 30 - incomeTransactions.length) }).map((_, i) => (
                        <TableRow key={`empty-income-${i}`} className={(incomeTransactions.length + i) % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell>&nbsp;</TableCell>
                          <TableCell>&nbsp;</TableCell>
                          <TableCell>&nbsp;</TableCell>
                          <TableCell>&nbsp;</TableCell>
                        </TableRow>
                      ))}
                    </>
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
                    // 빈 행 30개 추가 (A4 용지 채우기)
                    Array.from({ length: 30 }).map((_, i) => (
                      <TableRow key={`empty-expense-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <>
                      {expenseTransactions.map((t, i) => (
                        <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell>{format(parseISO(t.date), "MM-dd")}</TableCell>
                          <TableCell>{t.item}</TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell className="text-right">{formatAmount(Number(t.amount))}</TableCell>
                        </TableRow>
                      ))}
                      {/* 나머지 빈 행 추가 */}
                      {Array.from({ length: Math.max(0, 30 - expenseTransactions.length) }).map((_, i) => (
                        <TableRow key={`empty-expense-${i}`} className={(expenseTransactions.length + i) % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell>&nbsp;</TableCell>
                          <TableCell>&nbsp;</TableCell>
                          <TableCell>&nbsp;</TableCell>
                          <TableCell>&nbsp;</TableCell>
                        </TableRow>
                      ))}
                    </>
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

      </div>
    </div>
  );
}

