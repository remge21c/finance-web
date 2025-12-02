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
import { Checkbox } from "@/components/ui/checkbox";
import type { Transaction, Settings } from "@/types/database";
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
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
}: TransactionTableProps) {
  const currency = settings?.currency || "원";

  // 주간/전체 필터링
  const filteredTransactions = useMemo(() => {
    if (viewMode === "all") return transactions;

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // 월요일 시작
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    return transactions.filter((t) => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
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

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 테이블 */}
      <div className="overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={headerCheckboxState}
                  onCheckedChange={(checked) =>
                    onToggleSelectAll(visibleIds, checked === true)
                  }
                />
              </TableHead>
              <TableHead className="w-[100px] text-center">날짜</TableHead>
              <TableHead className="w-[60px] text-center">구분</TableHead>
              <TableHead className="w-[100px] text-center">항목</TableHead>
              <TableHead className="w-[180px] text-center">내용</TableHead>
              <TableHead className="w-[100px] text-center">금액 ({currency})</TableHead>
              <TableHead className="w-[140px] text-center">메모</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {viewMode === "weekly" 
                    ? "이번 주 거래 내역이 없습니다." 
                    : "거래 내역이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction, index) => (
                <TableRow
                  key={transaction.id}
                  className={`cursor-pointer ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } ${selectedIds.includes(transaction.id) ? "bg-emerald-50" : ""} hover:bg-emerald-100`}
                  onClick={() => onToggleSelect(transaction, !selectedIds.includes(transaction.id))}
                >
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(transaction.id)}
                      onCheckedChange={(checked) =>
                        onToggleSelect(transaction, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center truncate">{transaction.date}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.type === "수입"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-center truncate">{transaction.item}</TableCell>
                  <TableCell className="text-left truncate">{transaction.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(Number(transaction.amount))}
                  </TableCell>
                  <TableCell className="text-left text-gray-500 text-sm truncate">
                    {transaction.memo}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 하단 정보 */}
      <div className="p-4 border-t">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 선택 합계 및 삭제 버튼 */}
          <div className="flex items-center gap-3 flex-1">
            {selectedIds.length > 0 && (
              <>
                <div className="text-sm text-gray-600">
                  선택 합계: <strong>{formatAmount(selectedSum)} {currency}</strong> ({selectedIds.length}개)
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="h-8 px-3"
                >
                  선택 삭제
                </Button>
              </>
            )}
          </div>
          {/* 중앙: 현재 잔액 */}
          {selectedIds.length === 0 && (
            <div className="flex-1 text-center text-lg font-bold">
              현재 잔액:{" "}
              <span className={balance >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatAmount(balance)} {currency}
              </span>
            </div>
          )}
          {/* 오른쪽: CSV 버튼들 */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            {onCsvExport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCsvExport}
                className="h-8 px-3 border-green-500 text-green-600 hover:bg-green-50"
              >
                CSV저장
              </Button>
            )}
            {onCsvImport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCsvImport}
                className="h-8 px-3 border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                CSV불러오기
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

