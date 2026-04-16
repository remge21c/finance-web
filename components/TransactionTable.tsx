"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { Transaction, Settings } from "@/types/database";
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  format,
} from "date-fns";

interface TransactionTableProps {
  transactions: Transaction[];
  settings: Settings | null;
  selectedIds: string[];
  onToggleSelect: (transaction: Transaction, checked: boolean) => void;
  onToggleSelectAll: (ids: string[], checked: boolean) => void;
  onDeleteSelected: () => Promise<void> | void;
  onCsvExport?: () => void;
  onCsvImport?: () => void;
  viewMode: "weekly" | "all";
  readOnly?: boolean;
}

export default function TransactionTable({
  transactions,
  settings,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteSelected,
  onCsvExport,
  onCsvImport,
  viewMode,
  readOnly = false,
}: TransactionTableProps) {
  const currency = settings?.currency || "원";

  // 주간/전체 필터링 (최근 날짜가 위로 오도록 내림차순 정렬)
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (viewMode === "weekly") {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      filtered = transactions.filter((t) => {
        const date = parseISO(t.date);
        return isWithinInterval(date, { start: weekStart, end: weekEnd });
      });
    }

    // 날짜 내림차순 정렬 (최근 날짜가 위로)
    return [...filtered].sort((a, b) => {
      const dateA = parseISO(a.date).getTime();
      const dateB = parseISO(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, viewMode]);

  // 선택된 항목 금액 합계
  const selectedSum = useMemo(() => {
    return transactions
      .filter((t) => selectedIds.includes(t.id))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions, selectedIds]);

  // 전체 잔액 계산
  const balance = useMemo(() => {
    return transactions.reduce((sum, t) => {
      if (t.type === "수입") return sum + Number(t.amount);
      return sum - Number(t.amount);
    }, 0);
  }, [transactions]);

  // 현재 화면에 보이는 ID 집합
  const visibleIds = useMemo(
    () => filteredTransactions.map((t) => t.id),
    [filteredTransactions]
  );

  // 현재 보이는 항목들 중 선택된 ID
  const visibleSelectedIds = useMemo(() => {
    return selectedIds.filter((id) => visibleIds.includes(id));
  }, [selectedIds, visibleIds]);

  const allVisibleSelected =
    filteredTransactions.length > 0 &&
    visibleSelectedIds.length === filteredTransactions.length;

  const headerCheckboxState =
    allVisibleSelected && filteredTransactions.length > 0
      ? true
      : visibleSelectedIds.length > 0
        ? "indeterminate"
        : false;

  const handleDeleteClick = () => {
    if (onDeleteSelected) {
      void onDeleteSelected();
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ko-KR", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const year = format(date, "yyyy");
    const monthDay = format(date, "MM-dd");
    return { year, monthDay };
  };

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardContent className="p-2 sm:p-4">
        {/* 테이블 - 엑셀 스타일 */}
        <div className="overflow-x-auto rounded-lg border border-gray-300">
          <Table className="w-full border-collapse text-xs sm:text-sm">
            <TableHeader>
              <TableRow className="bg-gray-100 border-b-2 border-gray-300">
                <TableHead className="w-8 sm:w-10 border border-gray-300 px-1 sm:px-2 py-2 text-center">
                  <Checkbox
                    checked={headerCheckboxState}
                    onCheckedChange={(checked) =>
                      onToggleSelectAll(visibleIds, checked === true)
                    }
                  />
                </TableHead>
                <TableHead className="min-w-[70px] sm:w-[100px] border border-gray-300 px-2 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">날짜</TableHead>
                <TableHead className="min-w-[50px] sm:w-[60px] border border-gray-300 px-2 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">구분</TableHead>
                <TableHead className="min-w-[80px] sm:w-[100px] border border-gray-300 px-2 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">항목</TableHead>
                <TableHead className="min-w-[100px] sm:w-[180px] border border-gray-300 px-2 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">내용</TableHead>
                <TableHead className="min-w-[80px] sm:w-[100px] border border-gray-300 px-2 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">금액 ({currency})</TableHead>
                <TableHead className="hidden sm:table-cell w-[118px] border border-gray-300 px-3 py-2 text-center font-semibold">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500 border border-gray-300 text-xs sm:text-sm">
                    {viewMode === "weekly"
                      ? "이번 주 거래 내역이 없습니다."
                      : "거래 내역이 없습니다."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((transaction, index) => (
                  <TableRow
                    key={transaction.id}
                    className={`cursor-pointer border-b border-gray-300 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } ${selectedIds.includes(transaction.id) ? "bg-emerald-100" : ""} hover:bg-blue-50`}
                    onClick={() => onToggleSelect(transaction, !selectedIds.includes(transaction.id))}
                  >
                    <TableCell className="border border-gray-300 px-1 sm:px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(transaction.id)}
                        onCheckedChange={(checked) =>
                          onToggleSelect(transaction, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="border border-gray-300 px-2 sm:px-3 py-2 text-center text-xs sm:text-sm">
                      <span className="sm:hidden">{formatDate(transaction.date).monthDay}</span>
                      <span className="hidden sm:inline">{transaction.date}</span>
                    </TableCell>
                    <TableCell className="border border-gray-300 px-2 sm:px-3 py-2 text-center">
                      <span
                        className={`px-1.5 sm:px-2 py-1 rounded text-xs font-medium ${
                          transaction.type === "수입"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </TableCell>
                    <TableCell className="border border-gray-300 px-2 sm:px-3 py-2 text-center truncate text-xs sm:text-sm">{transaction.item}</TableCell>
                    <TableCell className="border border-gray-300 px-2 sm:px-3 py-2 text-left truncate text-xs sm:text-sm">{transaction.description}</TableCell>
                    <TableCell className="border border-gray-300 px-2 sm:px-3 py-2 text-right font-medium text-xs sm:text-sm">
                      {formatAmount(Number(transaction.amount))}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell border border-gray-300 px-3 py-2 text-left text-gray-500 text-sm truncate">
                      {transaction.memo}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 하단 정보 */}
        <div className="mt-4 p-3 sm:p-4 border-t-2 border-gray-300 bg-gray-50 rounded-lg">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            {/* 왼쪽: 선택 합계 및 삭제 버튼 */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-1">
              {selectedIds.length > 0 && (
                <>
                  <div className="text-xs sm:text-sm text-gray-600 truncate">
                    선택 합계: <strong className="text-sm sm:text-base">{formatAmount(selectedSum)} {currency}</strong> <span className="text-xs">({selectedIds.length}개)</span>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteClick}
                      className="h-8 px-2 sm:px-3 text-xs whitespace-nowrap"
                    >
                      선택 삭제
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* 중앙: 현재 잔액 (항상 표시) */}
            <div className="flex-1 text-center text-base sm:text-lg font-bold py-1">
              현재 잔액:{" "}
              <span className={balance >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatAmount(balance)} {currency}
              </span>
            </div>

            {/* 오른쪽: CSV 버튼들 */}
            <div className="flex items-center justify-end gap-2 flex-1">
              {onCsvExport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCsvExport}
                  className="h-8 px-2 sm:px-3 border-green-500 text-green-600 hover:bg-green-50 text-xs"
                >
                  CSV저장
                </Button>
              )}
              {onCsvImport && !readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCsvImport}
                  className="h-8 px-2 sm:px-3 border-orange-500 text-orange-600 hover:bg-orange-50 text-xs"
                >
                  CSV불러오기
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
