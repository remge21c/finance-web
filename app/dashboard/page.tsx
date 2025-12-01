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
    if (!ids || ids.length === 0) {
      toast.error("삭제할 항목을 선택하세요.");
      return;
    }

    if (!confirm(`${ids.length}개 항목을 삭제하시겠습니까?`)) return;
    
    const result = await deleteMultipleTransactions(ids);
    if (result.error) {
      toast.error("삭제 실패: " + result.error);
    } else {
      toast.success(`${ids.length}개 항목이 삭제되었습니다.`);
      setSelectedIds([]);
      setSelectedTransaction(null); // 폼도 초기화
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setSelectedIds([transaction.id]); // 수정 시 해당 항목도 체크
  };

  const handleClear = () => {
    setSelectedTransaction(null);
    setSelectedIds([]); // 새입력 시 선택 해제
  };

  // 체크박스 선택 핸들러 - 선택 시 폼에도 데이터 로드
  const handleSelect = (ids: string[]) => {
    console.log("handleSelect 호출 - ids:", ids);
    setSelectedIds(ids);
    
    // 단일 선택 시 해당 거래를 폼에 로드
    if (ids.length === 1) {
      const transaction = transactions.find((t) => t.id === ids[0]);
      if (transaction) {
        setSelectedTransaction(transaction);
      }
    } else if (ids.length === 0) {
      // 선택 해제 시 폼도 초기화
      setSelectedTransaction(null);
    }
    // 다중 선택 시에는 폼 유지 (마지막 선택된 항목)
  };

  // CSV 저장 함수
  const handleCsvExport = () => {
    if (transactions.length === 0) {
      toast.error("저장할 데이터가 없습니다.");
      return;
    }

    // CSV 헤더
    const headers = ["날짜", "구분", "항목", "내용", "금액", "메모"];
    
    // CSV 데이터 생성
    const csvRows = [
      headers.join(","),
      ...transactions.map((tx) => {
        const row = [
          tx.date,
          tx.type,
          `"${tx.item}"`,
          `"${tx.description || ""}"`,
          tx.amount.toString(),
          `"${tx.memo || ""}"`,
        ];
        return row.join(",");
      }),
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM 추가 (한글 지원)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // 파일 다운로드
    const link = document.createElement("a");
    link.href = url;
    link.download = `재정출납부_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 저장되었습니다.");
  };

  // CSV 불러오기 함수
  const handleCsvImport = async (data: TransactionInput[]) => {
    if (data.length === 0) {
      toast.error("불러올 데이터가 없습니다.");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const item of data) {
      const result = await addTransaction(item);
      if (result.error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (errorCount > 0) {
      toast.warning(`${successCount}개 성공, ${errorCount}개 실패`);
    } else {
      toast.success(`${successCount}개 항목을 불러왔습니다.`);
    }
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
        selectedIds={selectedIds}
        transactions={transactions}
        onSubmit={handleSubmit}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onClear={handleClear}
        onCsvExport={handleCsvExport}
        onCsvImport={handleCsvImport}
      />

      {/* 거래 테이블 */}
      <TransactionTable
        transactions={transactions}
        settings={settings}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onEdit={handleEdit}
        onDeleteSelected={handleDelete}
        viewMode={viewMode}
      />
    </div>
  );
}








