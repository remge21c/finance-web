"use client";

import { useState } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import TransactionForm from "@/components/TransactionForm";
import TransactionTable from "@/components/TransactionTable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Transaction, TransactionInput } from "@/types/database";

export default function DashboardPage() {
  const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteMultipleTransactions } = useTransactions();
  const { settings, loading: settingsLoading } = useSettings();
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"weekly" | "all">("weekly");

  const loading = txLoading || settingsLoading;

  const handleSubmit = async (data: TransactionInput) => {
    const result = await addTransaction(data);
    if (result.error) {
      toast.error("추가 실패: " + result.error);
    } else {
      toast.success("거래가 추가되었습니다.");
    }
  };

  const handleUpdate = async (id: string, data: TransactionInput) => {
    const result = await updateTransaction(id, data);
    if (result.error) {
      toast.error("수정 실패: " + result.error);
    } else {
      toast.success("거래가 수정되었습니다.");
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`${ids.length}개 항목을 삭제하시겠습니까?`)) return;
    
    const result = await deleteMultipleTransactions(ids);
    if (result.error) {
      toast.error("삭제 실패: " + result.error);
    } else {
      toast.success(`${ids.length}개 항목이 삭제되었습니다.`);
      setSelectedIds([]);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleClear = () => {
    setSelectedTransaction(null);
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
        <h1 className="text-2xl font-bold text-gray-800">재정출납부</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("weekly")}
            className={viewMode === "weekly" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            주간보기
          </Button>
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("all")}
            className={viewMode === "all" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            전체보기
          </Button>
        </div>
      </div>

      {/* 입력 폼 */}
      <TransactionForm
        settings={settings}
        selectedTransaction={selectedTransaction}
        onSubmit={handleSubmit}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onClear={handleClear}
      />

      {/* 거래 테이블 */}
      <TransactionTable
        transactions={transactions}
        settings={settings}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
        viewMode={viewMode}
      />
    </div>
  );
}


