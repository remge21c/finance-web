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
  onSelect: (ids: string[]) => void;
  onEdit: (transaction: Transaction) => void;
  onDeleteSelected: () => void;
  viewMode: "weekly" | "all";
}

export default function TransactionTable({
  transactions,
  settings,
  selectedIds,
  onSelect,
  onEdit,
  onDeleteSelected,
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

  // 현재 보이는 항목들의 ID만 필터링
  const visibleSelectedIds = useMemo(() => {
    const filteredIds = filteredTransactions.map((t) => t.id);
    return selectedIds.filter((id) => filteredIds.includes(id));
  }, [selectedIds, filteredTransactions]);

  const handleSelectAll = () => {
    if (visibleSelectedIds.length === filteredTransactions.length && filteredTransactions.length > 0) {
      onSelect([]);
    } else {
      onSelect(filteredTransactions.map((t) => t.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter((i) => i !== id));
    } else {
      onSelect([...selectedIds, id]);
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
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filteredTransactions.length > 0 &&
                    visibleSelectedIds.length === filteredTransactions.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[100px]">날짜</TableHead>
              <TableHead className="w-[60px]">구분</TableHead>
              <TableHead className="w-[100px]">항목</TableHead>
              <TableHead className="w-[180px]">내용</TableHead>
              <TableHead className="w-[100px] text-right">금액 ({currency})</TableHead>
              <TableHead className="w-[140px]">메모</TableHead>
              <TableHead className="w-[60px]">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {viewMode === "weekly" 
                    ? "이번 주 거래 내역이 없습니다." 
                    : "거래 내역이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction, index) => (
                <TableRow
                  key={transaction.id}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } ${selectedIds.includes(transaction.id) ? "bg-emerald-50" : ""}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(transaction.id)}
                      onCheckedChange={() => handleSelectOne(transaction.id)}
                    />
                  </TableCell>
                  <TableCell className="truncate">{transaction.date}</TableCell>
                  <TableCell>
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
                  <TableCell className="truncate">{transaction.item}</TableCell>
                  <TableCell className="truncate">{transaction.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(Number(transaction.amount))}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm truncate">
                    {transaction.memo}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(transaction)}
                      className="h-7 px-2 text-emerald-600 hover:text-emerald-700"
                    >
                      수정
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 하단 정보 */}
      <div className="flex items-center justify-between p-4 border-t">
        {/* 왼쪽: 선택 합계 및 삭제 버튼 */}
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <>
              <div className="text-sm text-gray-600">
                선택 합계: <strong>{formatAmount(selectedSum)} {currency}</strong> ({selectedIds.length}개)
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteSelected}
                className="h-8 px-3"
              >
                선택 삭제
              </Button>
            </>
          )}
        </div>
        {/* 오른쪽: 현재 잔액 */}
        <div className="text-lg font-bold">
          현재 잔액:{" "}
          <span className={balance >= 0 ? "text-emerald-600" : "text-red-600"}>
            {formatAmount(balance)} {currency}
          </span>
        </div>
      </div>
    </div>
  );
}

