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
import { format, parseISO, isWithinInterval, isBefore, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";

export default function CustomRangeReport() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();

  const today = format(new Date(), "yyyy-MM-dd");
  const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState<string>(thisMonthStart);
  const [endDate, setEndDate] = useState<string>(today);
  const [appliedStart, setAppliedStart] = useState<string>(thisMonthStart);
  const [appliedEnd, setAppliedEnd] = useState<string>(today);

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

  // 날짜 변경 시 자동으로 조회 적용
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

  const formatAmount = (amount: number) =>
    amount.toLocaleString("ko-KR", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });

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

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
      return;
    }

    const reportPeriod = `${format(parseISO(appliedStart), "yyyy년 MM월 dd일", { locale: ko })} ~ ${format(parseISO(appliedEnd), "yyyy년 MM월 dd일", { locale: ko })}`;
    const createdDate = format(new Date(), "yyyy년 MM월 dd일 HH:mm", { locale: ko });

    const maxRows = 30;

    const incomeDataRows = incomeTransactions.map((t) => {
      const date = format(parseISO(t.date), "MM/dd");
      return `<tr>
        <td>${date}</td>
        <td>${t.item}</td>
        <td>${t.description || ''}</td>
        <td class="amount income">${formatAmount(Number(t.amount))}</td>
      </tr>`;
    }).join('');

    const emptyIncomeRows = Array.from({ length: Math.max(0, maxRows - incomeTransactions.length) })
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');

    const expenseDataRows = expenseTransactions.map((t) => {
      const date = format(parseISO(t.date), "MM/dd");
      return `<tr>
        <td>${date}</td>
        <td>${t.item}</td>
        <td>${t.description || ''}</td>
        <td class="amount expense">${formatAmount(Number(t.amount))}</td>
      </tr>`;
    }).join('');

    const emptyExpenseRows = Array.from({ length: Math.max(0, maxRows - expenseTransactions.length) })
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');

    const author = settings?.author || '';
    const manager = settings?.manager || '';
    const auditor = settings?.auditor || '';
    const account1Name = settings?.account1_name || '현금';
    const account2Name = settings?.account2_name || '터치앤고';
    const account3Name = settings?.account3_name || '기타';

    const appTitle = settings?.app_title || '재정출납부';
    const reportTitle = `${appTitle} 일정선택 보고서`;

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        * { box-sizing: border-box; }
        @page { size: A4; margin: 10mm; }
        body {
            font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: white;
            font-size: 12px;
            line-height: 1.4;
        }
        .report-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            padding: 5mm;
        }
        .header {
            text-align: center;
            margin-bottom: 8mm;
            border-bottom: 2px solid #2E7D32;
            padding-bottom: 5mm;
        }
        .header h1 {
            color: #2E7D32;
            margin: 0 0 5px 0;
            font-size: 20px;
        }
        .header p {
            color: #666;
            margin: 2px 0 0 0;
            font-size: 11px;
        }
        .content {
            display: flex;
            gap: 5mm;
            margin-bottom: 5mm;
        }
        .section {
            flex: 1;
            min-width: 0;
        }
        .section h3 {
            background-color: #2E7D32;
            color: white;
            padding: 6px 10px;
            margin: 0 0 5px 0;
            border-radius: 3px;
            text-align: center;
            font-size: 13px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3mm;
            font-size: 10px;
        }
        .data-table th, .data-table td {
            border: 1px solid #ddd;
            padding: 4px 6px;
            text-align: left;
            font-size: 10px;
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
        .summary-section {
            display: flex;
            gap: 5mm;
            margin-bottom: 3mm;
        }
        .summary, .account-info {
            flex: 1;
            background-color: #f8f9fa;
            padding: 8px;
            border-radius: 3px;
            border: 1px solid #ddd;
        }
        .summary h4, .account-info h4 {
            color: #2E7D32;
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: bold;
        }
        .summary-row, .account-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            padding: 2px 0;
            border-bottom: 1px solid #eee;
            font-size: 10px;
        }
        .summary-row:last-child, .account-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 11px;
            color: #2E7D32;
            margin-top: 5px;
        }
        .amount {
            text-align: right;
            font-weight: bold;
        }
        .income { color: #1976D2; }
        .expense { color: #D32F2F; }
        .signature-section {
            margin-top: auto;
            padding-top: 5mm;
        }
        .signature-label {
            font-weight: bold;
            color: #2E7D32;
            font-size: 11px;
            text-align: center;
            margin-bottom: 5px;
        }
        .signature-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
        }
        .signature-box {
            flex: 1;
            text-align: center;
            border: 1px solid #2E7D32;
            border-radius: 5px;
            padding: 8px;
            background-color: #f9f9f9;
            min-height: 50px;
        }
        .signature-line {
            border: 1px solid #ccc;
            width: 100%;
            height: 35px;
            background-color: white;
            border-radius: 3px;
            margin-top: 5px;
        }

        @media print {
            @page { margin: 10mm; }
            body { font-size: 11px; }
            .header h1 { font-size: 18px; }
            .header p { font-size: 10px; }
            .section h3 { font-size: 12px; padding: 5px 8px; }
            .data-table { font-size: 9px; }
            .data-table th, .data-table td { padding: 3px 4px; font-size: 9px; }
            .summary h4, .account-info h4 { font-size: 11px; }
            .summary-row, .account-row { font-size: 9px; }
            .summary-row:last-child, .account-row:last-child { font-size: 10px; }
            .signature-label { font-size: 10px; }
            .signature-box { min-height: 45px; padding: 6px; }
            .signature-line { height: 30px; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>${reportTitle}</h1>
            <p>보고 기간: ${reportPeriod}</p>
            <p>생성일: ${createdDate}</p>
        </div>
        <div class="content">
            <div class="section">
                <h3>수입 내역</h3>
                <table class="data-table">
                    <thead><tr><th style="width: 15%;">날짜</th><th style="width: 20%;">항목</th><th style="width: 50%;">내용</th><th style="width: 15%;">금액</th></tr></thead>
                    <tbody>${incomeDataRows + emptyIncomeRows}</tbody>
                </table>
            </div>
            <div class="section">
                <h3>지출 내역</h3>
                <table class="data-table">
                    <thead><tr><th style="width: 15%;">날짜</th><th style="width: 20%;">항목</th><th style="width: 50%;">내용</th><th style="width: 15%;">금액</th></tr></thead>
                    <tbody>${expenseDataRows + emptyExpenseRows}</tbody>
                </table>
            </div>
        </div>
        <div class="summary-section">
            <div class="summary">
                <h4>기간 요약</h4>
                <div class="summary-row"><span>기간 시작 전 잔액:</span><span class="amount">${formatAmount(prevBalance)} ${currency}</span></div>
                <div class="summary-row"><span>총 수입:</span><span class="amount income">${formatAmount(incomeTotal)} ${currency}</span></div>
                <div class="summary-row"><span>총 지출:</span><span class="amount expense">${formatAmount(expenseTotal)} ${currency}</span></div>
                <div class="summary-row"><span>기간 잔액:</span><span class="amount">${formatAmount(currentBalance)} ${currency}</span></div>
            </div>
            <div class="account-info">
                <h4>계좌 현황</h4>
                <div class="account-row"><span>${account1Name}:</span><span class="amount">${formatAmount(parseFloat(cashAmount || "0"))} ${currency}</span></div>
                <div class="account-row"><span>${account2Name}:</span><span class="amount">${formatAmount(parseFloat(touchAmount || "0"))} ${currency}</span></div>
                <div class="account-row"><span>${account3Name}:</span><span class="amount">${formatAmount(parseFloat(otherAmount || "0"))} ${currency}</span></div>
                <div class="account-row"><span>총 계좌:</span><span class="amount">${formatAmount(totalAccount)} ${currency}</span></div>
            </div>
        </div>
        <div class="signature-section">
            <div class="signature-row">
                <div class="signature-box"><div class="signature-label">작성자: ${author}</div><div class="signature-line"></div></div>
                <div class="signature-box"><div class="signature-label">책임자: ${manager}</div><div class="signature-line"></div></div>
                <div class="signature-box"><div class="signature-label">감사자: ${auditor}</div><div class="signature-line"></div></div>
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
    <div className="space-y-3 sm:space-y-4">
      {/* 헤더 */}
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
      </div>

      {/* 조회 기간 표시 */}
      <div className="text-center text-gray-600 text-xs sm:text-sm">
        {appliedStart && appliedEnd
          ? `${format(parseISO(appliedStart), "yyyy년 M월 d일", { locale: ko })} ~ ${format(parseISO(appliedEnd), "yyyy년 M월 d일", { locale: ko })}`
          : "기간을 선택하고 조회 버튼을 누르세요"}
      </div>

      {/* 수입/지출 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="bg-blue-50 py-2 sm:py-3 px-3">
            <CardTitle className="text-base sm:text-lg text-blue-700">수입</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 sm:w-20 text-xs sm:text-sm">날짜</TableHead>
                  <TableHead className="w-20 sm:w-24 text-xs sm:text-sm">항목</TableHead>
                  <TableHead className="text-xs sm:text-sm">내용</TableHead>
                  <TableHead className="text-right w-20 sm:w-24 text-xs sm:text-sm">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                      수입 내역 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeTransactions.map((t, i) => (
                    <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="text-xs sm:text-sm">{format(parseISO(t.date), "MM-dd")}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{t.item}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{t.description}</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">{formatAmount(Number(t.amount))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-red-50 py-2 sm:py-3 px-3">
            <CardTitle className="text-base sm:text-lg text-red-700">지출</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 sm:w-20 text-xs sm:text-sm">날짜</TableHead>
                  <TableHead className="w-20 sm:w-24 text-xs sm:text-sm">항목</TableHead>
                  <TableHead className="text-xs sm:text-sm">내용</TableHead>
                  <TableHead className="text-right w-20 sm:w-24 text-xs sm:text-sm">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                      지출 내역 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseTransactions.map((t, i) => (
                    <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="text-xs sm:text-sm">{format(parseISO(t.date), "MM-dd")}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{t.item}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{t.description}</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">{formatAmount(Number(t.amount))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 요약 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="py-2 sm:py-3 px-3">
            <CardTitle className="text-base sm:text-lg">기간 요약</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 sm:space-y-2 px-3">
            <div className="flex justify-between text-xs sm:text-sm">
              <span>기간 시작 전 잔액:</span>
              <span className="font-medium">{formatAmount(prevBalance)} {currency}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span>총 수입:</span>
              <span className="font-medium text-blue-600">{formatAmount(incomeTotal)} {currency}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span>총 지출:</span>
              <span className="font-medium text-red-600">{formatAmount(expenseTotal)} {currency}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-xs sm:text-sm">
              <span className="font-bold">기간 잔액:</span>
              <span className={`font-bold sm:text-lg ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatAmount(currentBalance)} {currency}
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
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <Label htmlFor="touch-custom" className="text-xs">{settings?.account2_name || "터치앤고"}</Label>
                <Input
                  id="touch-custom"
                  type="number"
                  value={touchAmount}
                  onChange={(e) => setTouchAmount(e.target.value)}
                  className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <Label htmlFor="other-custom" className="text-xs">{settings?.account3_name || "기타"}</Label>
                <Input
                  id="other-custom"
                  type="number"
                  value={otherAmount}
                  onChange={(e) => setOtherAmount(e.target.value)}
                  className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex justify-between items-center border-t pt-2 text-xs sm:text-sm">
              <span className="font-bold">총액:</span>
              <span className="font-bold sm:text-lg text-emerald-600">
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
  );
}
