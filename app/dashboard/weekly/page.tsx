"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PrinterIcon } from "lucide-react";

export default function WeeklyReportPage() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [cashAmount, setCashAmount] = useState("");
  const [touchAmount, setTouchAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  
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

  // 새 창으로 출력 미리보기 열기
  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
      return;
    }

    const printContent = printRef.current.innerHTML;
    const currentDate = new Date();
    const reportDate = format(currentDate, "yyyy년 MM월 dd일 HH:mm");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>주간보고서_${format(weekRange.start, "yyyyMMdd")}-${format(weekRange.end, "yyyyMMdd")}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: 'Malgun Gothic', sans-serif;
              margin: 0;
              padding: 20mm;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .report-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .report-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .report-info {
              font-size: 12px;
              color: #666;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            .income-table th {
              background-color: #e3f2fd;
            }
            .expense-table th {
              background-color: #ffebee;
            }
            .summary-section {
              margin-top: 20px;
            }
            .summary-box {
              border: 1px solid #000;
              padding: 10px;
              margin-bottom: 10px;
            }
            .summary-title {
              font-weight: bold;
              margin-bottom: 8px;
              font-size: 12px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 11px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
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
            onClick={handlePrint}
          >
            출력
          </Button>
        </div>
      </div>

      {/* 주간 범위 표시 */}
      <div className="text-center text-gray-600">
        {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "M월 d일", { locale: ko })}
      </div>

      {/* 출력 영역 (화면에서는 숨김) */}
      <div ref={printRef} className="hidden">
        <div className="report-header">
          <div className="report-title">주간보고서</div>
          <div className="report-info">
            보고 기간: {format(weekRange.start, "yyyy년 MM월 dd일", { locale: ko })} ~ {format(weekRange.end, "yyyy년 MM월 dd일", { locale: ko })} 생성일: {format(new Date(), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}
          </div>
        </div>

        {/* 수입 내역 */}
        <div className="income-section">
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>수입 내역</h3>
          <table className="income-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>날짜</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>항목</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>내용</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {incomeTransactions.length === 0 ? (
                Array.from({ length: 30 }).map((_, i) => (
                  <tr key={`empty-income-${i}`}>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                  </tr>
                ))
              ) : (
                <>
                  {incomeTransactions.map((t) => (
                    <tr key={t.id}>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{format(parseISO(t.date), "MM-dd")}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{t.item}</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{t.description || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatAmount(Number(t.amount))}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 30 - incomeTransactions.length) }).map((_, i) => (
                    <tr key={`empty-income-${i}`}>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* 지출 내역 */}
        <div className="expense-section">
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>지출 내역</h3>
          <table className="expense-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#ffebee' }}>날짜</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#ffebee' }}>항목</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#ffebee' }}>내용</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', backgroundColor: '#ffebee' }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {expenseTransactions.length === 0 ? (
                Array.from({ length: 30 }).map((_, i) => (
                  <tr key={`empty-expense-${i}`}>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                  </tr>
                ))
              ) : (
                <>
                  {expenseTransactions.map((t) => (
                    <tr key={t.id}>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{format(parseISO(t.date), "MM-dd")}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{t.item}</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{t.description || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatAmount(Number(t.amount))}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 30 - expenseTransactions.length) }).map((_, i) => (
                    <tr key={`empty-expense-${i}`}>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* 요약 정보 */}
        <div className="summary-section" style={{ marginTop: '20px' }}>
          <div className="summary-box" style={{ border: '1px solid #000', padding: '10px', marginBottom: '10px' }}>
            <div className="summary-title" style={{ fontWeight: 'bold', marginBottom: '8px' }}>주간 요약</div>
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>지난주 이월금:</span>
              <span>{formatAmount(lastWeekBalance)} {currency}</span>
            </div>
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>이번주 총 수입:</span>
              <span>{formatAmount(incomeTotal)} {currency}</span>
            </div>
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>이번주 총 지출:</span>
              <span>{formatAmount(expenseTotal)} {currency}</span>
            </div>
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
              <span style={{ fontWeight: 'bold' }}>이번주 잔액:</span>
              <span style={{ fontWeight: 'bold' }}>{formatAmount(currentBalance)} {currency}</span>
            </div>
          </div>

          <div className="summary-box" style={{ border: '1px solid #000', padding: '10px' }}>
            <div className="summary-title" style={{ fontWeight: 'bold', marginBottom: '8px' }}>계좌 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>현금</div>
                <div style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatAmount(parseFloat(cashAmount || "0"))}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>터치앤고</div>
                <div style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatAmount(parseFloat(touchAmount || "0"))}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>기타</div>
                <div style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatAmount(parseFloat(otherAmount || "0"))}</div>
              </div>
            </div>
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
              <span style={{ fontWeight: 'bold' }}>총액:</span>
              <span style={{ fontWeight: 'bold' }}>{formatAmount(totalAccount)} {currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 화면 표시 영역 */}
      <div className="print:hidden">
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
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-bold">총액:</span>
                <span className="font-bold text-lg text-emerald-600">
                  {formatAmount(totalAccount)} {currency}
                </span>
              </div>
              <Button size="sm" onClick={handleSaveAmounts} className="w-full">
                저장
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 미리보기 모달 */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle>주간보고서 미리보기</DialogTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handlePrint()} className="flex items-center gap-1">
                  <PrinterIcon className="h-4 w-4" /> 인쇄
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPrintPreview(false)}>
                  닫기
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <div className="bg-white shadow-lg mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}>
              {/* 제목 */}
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold">주간 보고서</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {format(weekRange.start, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekRange.end, "M월 d일", { locale: ko })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* 수입 테이블 */}
                <div className="border border-gray-300 rounded">
                  <div className="bg-blue-50 py-2 px-3 border-b border-gray-300">
                    <h3 className="text-base font-semibold text-blue-700">수입</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-16 text-xs py-1">날짜</TableHead>
                        <TableHead className="w-20 text-xs py-1">항목</TableHead>
                        <TableHead className="text-xs py-1">내용</TableHead>
                        <TableHead className="text-right w-20 text-xs py-1">금액</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-2 text-xs text-gray-400">
                            수입 내역 없음
                          </TableCell>
                        </TableRow>
                      ) : (
                        incomeTransactions.map((t, i) => (
                          <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <TableCell className="text-xs py-1">{format(parseISO(t.date), "MM-dd")}</TableCell>
                            <TableCell className="text-xs py-1">{t.item}</TableCell>
                            <TableCell className="text-xs py-1">{t.description}</TableCell>
                            <TableCell className="text-right text-xs py-1">{formatAmount(Number(t.amount))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* 지출 테이블 */}
                <div className="border border-gray-300 rounded">
                  <div className="bg-red-50 py-2 px-3 border-b border-gray-300">
                    <h3 className="text-base font-semibold text-red-700">지출</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-16 text-xs py-1">날짜</TableHead>
                        <TableHead className="w-20 text-xs py-1">항목</TableHead>
                        <TableHead className="text-xs py-1">내용</TableHead>
                        <TableHead className="text-right w-20 text-xs py-1">금액</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-2 text-xs text-gray-400">
                            지출 내역 없음
                          </TableCell>
                        </TableRow>
                      ) : (
                        expenseTransactions.map((t, i) => (
                          <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <TableCell className="text-xs py-1">{format(parseISO(t.date), "MM-dd")}</TableCell>
                            <TableCell className="text-xs py-1">{t.item}</TableCell>
                            <TableCell className="text-xs py-1">{t.description}</TableCell>
                            <TableCell className="text-right text-xs py-1">{formatAmount(Number(t.amount))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 요약 정보 */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {/* 주간 요약 */}
                <div className="border border-gray-300 rounded">
                  <div className="bg-gray-50 py-2 px-3 border-b border-gray-300">
                    <h3 className="text-base font-semibold">주간 요약</h3>
                  </div>
                  <div className="p-3 space-y-1 text-sm">
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
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-bold">이번주 잔액:</span>
                      <span className={`font-bold ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatAmount(currentBalance)} {currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 계좌 현황 */}
                <div className="border border-gray-300 rounded">
                  <div className="bg-gray-50 py-2 px-3 border-b border-gray-300">
                    <h3 className="text-base font-semibold">계좌 현황</h3>
                  </div>
                  <div className="p-3 space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">현금</Label>
                        <div className="h-6 flex items-center border rounded px-2 bg-gray-50 text-xs">
                          {formatAmount(parseFloat(cashAmount || "0"))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">터치앤고</Label>
                        <div className="h-6 flex items-center border rounded px-2 bg-gray-50 text-xs">
                          {formatAmount(parseFloat(touchAmount || "0"))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">기타</Label>
                        <div className="h-6 flex items-center border rounded px-2 bg-gray-50 text-xs">
                          {formatAmount(parseFloat(otherAmount || "0"))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-t pt-1 mt-1">
                      <span className="font-bold">총액:</span>
                      <span className="font-bold text-emerald-600">
                        {formatAmount(totalAccount)} {currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

