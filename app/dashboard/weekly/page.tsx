"use client";

import { useState, useMemo, useEffect } from "react";
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

export default function WeeklyReportPage() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [cashAmount, setCashAmount] = useState("");
  const [touchAmount, setTouchAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");

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

  // 새 창으로 HTML 보고서 생성
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
      return;
    }

    // 보고 기간 및 생성일 포맷팅
    const reportPeriod = `${format(weekRange.start, "yyyy년 MM월 dd일", { locale: ko })} ~ ${format(weekRange.end, "yyyy년 MM월 dd일", { locale: ko })}`;
    const createdDate = format(new Date(), "yyyy년 MM월 dd일 HH:mm", { locale: ko });

    // 수입 내역 테이블 행 생성
    const incomeRows = [];
    const maxRows = 24; // 최대 24행
    const incomeDataRows = incomeTransactions.map((t) => {
      const date = format(parseISO(t.date), "MM/dd");
      return `<tr>
        <td>${date}</td>
        <td>${t.item}</td>
        <td>${t.description || ''}</td>
        <td class="amount income">${formatAmount(Number(t.amount))}</td>
      </tr>`;
    }).join('');
    
    // 빈 행 추가
    const emptyIncomeRows = Array.from({ length: Math.max(0, maxRows - incomeTransactions.length) })
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');
    
    const incomeTableRows = incomeDataRows + emptyIncomeRows;

    // 지출 내역 테이블 행 생성
    const expenseRows = [];
    const expenseDataRows = expenseTransactions.map((t) => {
      const date = format(parseISO(t.date), "MM/dd");
      return `<tr>
        <td>${date}</td>
        <td>${t.item}</td>
        <td>${t.description || ''}</td>
        <td class="amount expense">${formatAmount(Number(t.amount))}</td>
      </tr>`;
    }).join('');
    
    // 빈 행 추가
    const emptyExpenseRows = Array.from({ length: Math.max(0, maxRows - expenseTransactions.length) })
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');
    
    const expenseTableRows = expenseDataRows + emptyExpenseRows;

    // 작성자 및 책임자 정보
    const author = settings?.author || '';
    const manager = settings?.manager || '';

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>주간보고서</title>
    <style>
        @page {
            size: A4;
            margin: 15mm;
        }
        @media screen {
            body {
                font-family: 'Malgun Gothic', Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f0f0f0;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                min-height: 100vh;
            }
            .report-container {
                width: 210mm;
                min-height: 297mm;
                background-color: white;
                padding: 10mm;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                border-radius: 5px;
            }
        }
        @media print {
            body {
                font-family: 'Malgun Gothic', Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: white;
            }
            .report-container {
                width: 100%;
                min-height: 100vh;
                background-color: white;
                padding: 0;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
            }
        }
        .header {
            text-align: center;
            margin-bottom: 8mm;
            border-bottom: 2px solid #2E7D32;
            padding-bottom: 5mm;
        }
        .header h1 {
            color: #2E7D32;
            margin: 0;
            font-size: 28px;
        }
        .header p {
            color: #666;
            margin: 5px 0 0 0;
            font-size: 14px;
        }
        .content {
            display: flex;
            gap: 8mm;
            flex: 1;
            margin-bottom: 8mm;
        }
        .section {
            flex: 1;
        }
        .section h3 {
            background-color: #2E7D32;
            color: white;
            padding: 8px;
            margin: 0 0 10px 0;
            border-radius: 5px;
            text-align: center;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5mm;
            font-size: 11px;
        }
        .data-table th, .data-table td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
            font-size: 11px;
            line-height: 1.3;
        }
        .data-table th:last-child, .data-table td:last-child {
            text-align: right;
        }
        .data-table th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .data-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        @media print {
            .data-table {
                font-size: 10px;
            }
            .data-table th, .data-table td {
                padding: 3px;
                font-size: 10px;
                line-height: 1.2;
            }
        }
        .summary-section {
            display: flex;
            gap: 5mm;
            margin-bottom: 3mm;
        }
        .summary {
            flex: 1;
            background-color: #f8f9fa;
            padding: 5px;
            border-radius: 3px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .account-info {
            flex: 1;
            background-color: #f8f9fa;
            padding: 5px;
            border-radius: 3px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        @media print {
            .summary-section {
                margin-bottom: 2mm;
            }
            .summary, .account-info {
                padding: 3px;
                font-size: 10px;
            }
        }
        .summary h4 {
            color: #2E7D32;
            margin-top: 0;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            padding: 2px 0;
            border-bottom: 1px solid #eee;
        }
        .summary-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 16px;
            color: #2E7D32;
        }
        .account-info h4 {
            color: #2E7D32;
            margin-top: 0;
        }
        .account-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            padding: 2px 0;
            border-bottom: 1px solid #eee;
        }
        .account-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 16px;
            color: #2E7D32;
        }
        .total-account {
            font-weight: bold;
            font-size: 18px;
            color: #2E7D32;
            padding-top: 10px;
            margin-top: 10px;
        }
        .amount {
            text-align: right;
            font-weight: bold;
        }
        .income {
            color: #1976D2;
        }
        .expense {
            color: #D32F2F;
        }
        .signature-section {
            margin-top: 5px;
            padding-top: 5px;
        }
        .signature-label {
            font-weight: bold;
            color: #2E7D32;
            font-size: 12px;
            text-align: center;
            margin-bottom: 3px;
        }
        .signature-row {
            display: flex;
            justify-content: space-between;
            gap: 50px;
        }
        .signature-box {
            flex: 1;
            text-align: center;
            border: 2px solid #2E7D32;
            border-radius: 8px;
            padding: 5px;
            background-color: #f9f9f9;
            min-height: 40px;
        }
        .signature-line {
            border: 1px solid #333;
            width: 100%;
            height: 40px;
            background-color: white;
            border-radius: 4px;
        }
        @media print {
            .signature-section {
                margin-top: 3px;
                padding-top: 3px;
            }
            .signature-label {
                font-size: 10px;
            }
            .signature-box {
                padding: 3px;
                min-height: 30px;
            }
            .signature-line {
                height: 30px;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>주간보고서</h1>
            <p>보고 기간: ${reportPeriod}</p>
            <p>생성일: ${createdDate}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h3>수입 내역</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">날짜</th>
                            <th style="width: 20%;">항목</th>
                            <th style="width: 50%;">내용</th>
                            <th style="width: 15%;">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${incomeTableRows}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h3>지출 내역</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">날짜</th>
                            <th style="width: 20%;">항목</th>
                            <th style="width: 50%;">내용</th>
                            <th style="width: 15%;">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenseTableRows}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="summary-section">
            <div class="summary">
                <h4>주간 요약</h4>
                <div class="summary-row">
                    <span>지난주 잔액:</span>
                    <span class="amount">${formatAmount(lastWeekBalance)} ${currency}</span>
                </div>
                <div class="summary-row">
                    <span>총 수입:</span>
                    <span class="amount income">${formatAmount(incomeTotal)} ${currency}</span>
                </div>
                <div class="summary-row">
                    <span>총 지출:</span>
                    <span class="amount expense">${formatAmount(expenseTotal)} ${currency}</span>
                </div>
                <div class="summary-row total-account">
                    <span>주간 잔액:</span>
                    <span class="amount">${formatAmount(currentBalance)} ${currency}</span>
                </div>
            </div>
            
            <div class="account-info">
                <h4>계좌 현황</h4>
                <div class="account-row">
                    <span>현금:</span>
                    <span class="amount">${formatAmount(parseFloat(cashAmount || "0"))} ${currency}</span>
                </div>
                <div class="account-row">
                    <span>터치앤고:</span>
                    <span class="amount">${formatAmount(parseFloat(touchAmount || "0"))} ${currency}</span>
                </div>
                <div class="account-row">
                    <span>기타:</span>
                    <span class="amount">${formatAmount(parseFloat(otherAmount || "0"))} ${currency}</span>
                </div>
                <div class="account-row total-account">
                    <span>총 계좌:</span>
                    <span class="amount">${formatAmount(totalAccount)} ${currency}</span>
                </div>
            </div>
        </div>
        
        <div class="signature-section">
            <div class="signature-row">
                <div class="signature-box">
                    <div class="signature-label">작성자: ${author}</div>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">책임자: ${manager}</div>
                    <div class="signature-line"></div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
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
    </div>
  );
}


