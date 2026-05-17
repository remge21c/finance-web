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
  startOfMonth,
  endOfMonth,
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
  viewMode: "weekly" | "monthly" | "all";
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
    } else if (viewMode === "monthly") {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      filtered = transactions.filter((t) => {
        const date = parseISO(t.date);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
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
    <Card className="shadow-sm">
      <CardContent className="p-3 sm:p-5">
        {/* 모바일 — 카드 리스트 */}
        <div className="sm:hidden space-y-2">
          {/* 헤더: 전체선택 + 항목 수 */}
          <div className="flex items-center justify-between px-1 pb-2 border-b border-gray-200">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <Checkbox
                checked={headerCheckboxState}
                onCheckedChange={(checked) =>
                  onToggleSelectAll(visibleIds, checked === true)
                }
              />
              전체 선택
            </label>
            <span className="text-xs text-gray-500">
              {filteredTransactions.length}건
            </span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              {viewMode === "weekly"
                ? "이번 주 거래 내역이 없습니다."
                : viewMode === "monthly"
                  ? "이번 달 거래 내역이 없습니다."
                  : "거래 내역이 없습니다."}
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const isSelected = selectedIds.includes(transaction.id);
              const { monthDay } = formatDate(transaction.date);
              const amountColor =
                transaction.type === "수입" ? "text-blue-700" : "text-red-700";
              return (
                <div
                  key={transaction.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-emerald-100 border-emerald-300"
                      : "bg-white border-gray-200 hover:bg-blue-50"
                  }`}
                  onClick={() =>
                    onToggleSelect(transaction, !isSelected)
                  }
                >
                  <div className="flex items-start gap-3">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="pt-0.5"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          onToggleSelect(transaction, checked === true)
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* 상단: 날짜 · 구분 · 금액 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-500 shrink-0">
                            {monthDay}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                              transaction.type === "수입"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {transaction.type}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {transaction.item}
                          </span>
                        </div>
                        <span
                          className={`text-sm font-semibold shrink-0 ${amountColor}`}
                        >
                          {transaction.type === "지출" ? "-" : ""}
                          {formatAmount(Number(transaction.amount))} {currency}
                        </span>
                      </div>
                      {/* 중단: 내용 */}
                      {transaction.description && (
                        <div className="mt-1 text-xs text-gray-600 truncate">
                          {transaction.description}
                        </div>
                      )}
                      {/* 하단: 메모 */}
                      {transaction.memo && (
                        <div className="mt-0.5 text-xs text-gray-400 truncate">
                          메모: {transaction.memo}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 데스크톱 — 엑셀 스타일 테이블 */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-300">
          <Table className="w-full border-collapse text-sm">
            <TableHeader>
              <TableRow className="bg-gray-100 border-b-2 border-gray-300">
                <TableHead className="w-10 sm:w-12 border border-gray-300 px-2 sm:px-3 py-3 text-center">
                  <Checkbox
                    checked={headerCheckboxState}
                    onCheckedChange={(checked) =>
                      onToggleSelectAll(visibleIds, checked === true)
                    }
                  />
                </TableHead>
                <TableHead className="min-w-[70px] sm:w-[110px] border border-gray-300 px-3 sm:px-4 py-3 text-center font-semibold text-sm">날짜</TableHead>
                <TableHead className="min-w-[50px] sm:w-[70px] border border-gray-300 px-3 sm:px-4 py-3 text-center font-semibold text-sm">구분</TableHead>
                <TableHead className="min-w-[70px] sm:w-[110px] border border-gray-300 px-3 sm:px-4 py-3 text-center font-semibold text-sm">항목</TableHead>
                <TableHead className="min-w-[80px] sm:w-[190px] border border-gray-300 px-3 sm:px-4 py-3 text-center font-semibold text-sm">내용</TableHead>
                <TableHead className="min-w-[70px] sm:w-[110px] border border-gray-300 px-3 sm:px-4 py-3 text-center font-semibold text-sm">금액 ({currency})</TableHead>
                <TableHead className="hidden sm:table-cell w-[130px] border border-gray-300 px-4 py-3 text-center font-semibold">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-500 border border-gray-300 text-sm">
                    {viewMode === "weekly"
                      ? "이번 주 거래 내역이 없습니다."
                      : viewMode === "monthly"
                        ? "이번 달 거래 내역이 없습니다."
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
                    <TableCell className="border border-gray-300 px-2 sm:px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(transaction.id)}
                        onCheckedChange={(checked) =>
                          onToggleSelect(transaction, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="border border-gray-300 px-3 sm:px-4 py-3 text-center text-sm">
                      <span className="sm:hidden">{formatDate(transaction.date).monthDay}</span>
                      <span className="hidden sm:inline">{transaction.date}</span>
                    </TableCell>
                    <TableCell className="border border-gray-300 px-3 sm:px-4 py-3 text-center">
                      <span
                        className={`px-2 sm:px-3 py-1 rounded text-sm font-medium ${
                          transaction.type === "수입"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </TableCell>
                    <TableCell className="border border-gray-300 px-3 sm:px-4 py-3 text-center truncate text-sm">{transaction.item}</TableCell>
                    <TableCell className="border border-gray-300 px-3 sm:px-4 py-3 text-left truncate text-sm">{transaction.description}</TableCell>
                    <TableCell className="border border-gray-300 px-3 sm:px-4 py-3 text-right font-medium text-sm">
                      {formatAmount(Number(transaction.amount))}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell border border-gray-300 px-4 py-3 text-left text-gray-500 text-sm truncate">
                      {transaction.memo}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 하단 정보 */}
        <div className="mt-5 p-4 sm:p-5 border-t-2 border-gray-300 bg-gray-50 rounded-lg">
          {/* 모바일: 세로 중앙 정렬, 데스크톱: 가로 정렬 */}
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 text-center sm:text-left">
            {/* 선택 합계 및 삭제 버튼 (모바일: 가로 중앙, 데스크톱: 좌측) */}
            <div className="flex items-center justify-center gap-3 order-2 sm:order-1">
              {selectedIds.length > 0 && (
                <>
                  <div className="text-sm text-gray-600">
                    선택 합계: <strong className="text-base">{formatAmount(selectedSum)} {currency}</strong>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteClick}
                      className="h-10 px-4 text-sm font-medium whitespace-nowrap"
                    >
                      선택 삭제
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* 현재 잔액 (항상 표시, 모바일: 최상단, 데스크톱: 중앙) */}
            <div className="text-lg sm:text-xl font-bold py-1 order-1 sm:order-2 border-b sm:border-b-0 border-gray-200 pb-2 sm:pb-0 w-full sm:w-auto">
              현재 잔액:{" "}
              <span className={balance >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatAmount(balance)} {currency}
              </span>
            </div>

            {/* CSV 버튼들 (모바일: 가로 중앙, 데스크톱: 우측) */}
            <div className="flex items-center justify-center gap-2 order-3">
              {onCsvExport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCsvExport}
                  className="h-10 px-4 border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium"
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
                  className="h-10 px-4 border-orange-500 text-orange-600 hover:bg-orange-50 text-sm font-medium"
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
