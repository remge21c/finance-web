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
  onDelete: (ids: string[]) => void;
  viewMode: "weekly" | "all";
}

export default function TransactionTable({
  transactions,
  settings,
  selectedIds,
  onSelect,
  onEdit,
  onDelete,
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

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
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
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filteredTransactions.length > 0 &&
                    selectedIds.length === filteredTransactions.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-28">날짜</TableHead>
              <TableHead className="w-16">구분</TableHead>
              <TableHead className="w-24">항목</TableHead>
              <TableHead className="w-[150px]">내용</TableHead>
              <TableHead className="w-28 text-right">금액 ({currency})</TableHead>
              <TableHead className="min-w-[120px]">메모</TableHead>
              <TableHead className="w-16">작업</TableHead>
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
                  <TableCell>{transaction.date}</TableCell>
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
                  <TableCell>{transaction.item}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(Number(transaction.amount))}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
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
        {/* 왼쪽: 선택 합계 */}
        <div className="text-sm text-gray-600">
          {selectedIds.length > 0 && (
            <span>
              선택 합계: <strong>{formatAmount(selectedSum)} {currency}</strong> ({selectedIds.length}개)
            </span>
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

